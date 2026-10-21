package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/cuesoftinc/upstat/api/common/internal/model"
)

const emailJSEndpoint = "https://api.emailjs.com/api/v1.0/email/send"

// EmailJSConfig holds the credentials for EmailJS's REST API. Server-side
// sends need "Allow EmailJS API for non-browser applications" switched on
// under Account → Security, and the private key passed as accessToken.
type EmailJSConfig struct {
	ServiceID  string
	TemplateID string
	PublicKey  string
	PrivateKey string
	// AppURL is the web UI's origin, used to link the email to the incident.
	AppURL string
}

// EmailJSConfigFromEnv returns the config and true when every required
// EMAILJS_* variable is set.
func EmailJSConfigFromEnv() (EmailJSConfig, bool) {
	cfg := EmailJSConfig{
		ServiceID:  os.Getenv("EMAILJS_SERVICE_ID"),
		TemplateID: os.Getenv("EMAILJS_TEMPLATE_ID"),
		PublicKey:  os.Getenv("EMAILJS_PUBLIC_KEY"),
		PrivateKey: os.Getenv("EMAILJS_PRIVATE_KEY"),
		AppURL:     os.Getenv("APP_URL"),
	}
	if cfg.AppURL == "" {
		cfg.AppURL = "http://localhost:2003"
	}
	ok := cfg.ServiceID != "" && cfg.TemplateID != "" && cfg.PublicKey != "" && cfg.PrivateKey != ""
	return cfg, ok
}

type monitorLookup interface {
	GetMonitorByID(id string) (*model.Monitor, error)
}

type userLookup interface {
	GetUserByID(id string) (*model.User, error)
}

// EmailJSNotifier emails the monitor's owner when an incident opens or
// resolves. A returned error leaves the outbox entry pending, so the
// worker's lease/backoff retries a failed send; entries with nobody to
// tell (muted monitor, deleted monitor or owner, metric kinds) are
// acknowledged without sending.
type EmailJSNotifier struct {
	Config   EmailJSConfig
	Monitors monitorLookup
	Users    userLookup
	Client   *http.Client
	Endpoint string
}

func NewEmailJSNotifier(cfg EmailJSConfig, monitors monitorLookup, users userLookup) *EmailJSNotifier {
	return &EmailJSNotifier{
		Config:   cfg,
		Monitors: monitors,
		Users:    users,
		Client:   &http.Client{Timeout: 8 * time.Second},
		Endpoint: emailJSEndpoint,
	}
}

type emailJSRequest struct {
	ServiceID      string            `json:"service_id"`
	TemplateID     string            `json:"template_id"`
	UserID         string            `json:"user_id"`
	AccessToken    string            `json:"accessToken"`
	TemplateParams map[string]string `json:"template_params"`
}

func (n *EmailJSNotifier) Deliver(ctx context.Context, entry *model.NotificationOutbox) error {
	if entry.Kind != "incident.opened" && entry.Kind != "incident.resolved" {
		slog.Info("notification skipped: no email for this kind", "kind", entry.Kind, "monitorId", entry.MonitorID)
		return nil
	}

	monitor, err := n.Monitors.GetMonitorByID(entry.MonitorID)
	if err != nil || monitor == nil {
		slog.Info("notification skipped: monitor gone", "monitorId", entry.MonitorID)
		return nil
	}
	if monitor.Muted {
		slog.Info("notification skipped: monitor muted", "monitorId", entry.MonitorID, "kind", entry.Kind)
		return nil
	}

	owner, err := n.Users.GetUserByID(monitor.OwnerId)
	if err != nil || owner == nil || owner.Email == "" {
		slog.Info("notification skipped: owner has no email", "monitorId", entry.MonitorID)
		return nil
	}

	body, err := json.Marshal(emailJSRequest{
		ServiceID:      n.Config.ServiceID,
		TemplateID:     n.Config.TemplateID,
		UserID:         n.Config.PublicKey,
		AccessToken:    n.Config.PrivateKey,
		TemplateParams: n.templateParams(entry, monitor, owner),
	})
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, n.Endpoint, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	res, err := n.Client.Do(req)
	if err != nil {
		return fmt.Errorf("emailjs: %w", err)
	}
	defer res.Body.Close()

	if res.StatusCode < 200 || res.StatusCode >= 300 {
		msg, _ := io.ReadAll(io.LimitReader(res.Body, 512))
		return fmt.Errorf("emailjs: %d %s", res.StatusCode, strings.TrimSpace(string(msg)))
	}

	slog.Info("notification emailed", "kind", entry.Kind, "monitorId", entry.MonitorID, "to", owner.Email)
	return nil
}

func (n *EmailJSNotifier) templateParams(entry *model.NotificationOutbox, monitor *model.Monitor, owner *model.User) map[string]string {
	name := owner.Name
	if name == "" {
		name = owner.Email
	}

	params := map[string]string{
		"to_email":     owner.Email,
		"to_name":      name,
		"monitor_name": monitor.Name,
		"monitor_url":  monitor.Target,
		"incident_url": strings.TrimRight(n.Config.AppURL, "/") + "/dashboard/incidents/view?id=" + entry.IncidentID,
		"occurred_at":  entry.CreatedAt.UTC().Format("Mon, 02 Jan 2006 15:04 MST"),
	}

	if entry.Kind == "incident.opened" {
		reason := payloadString(entry, "failureReason")
		if reason == "" {
			reason = "Health check failed"
		}
		params["status"] = "DOWN"
		params["subject"] = "🔴 " + monitor.Name + " is down"
		params["failure_reason"] = reason
		params["duration"] = ""
		params["message"] = fmt.Sprintf(
			"%s (%s) stopped responding after %d consecutive failed checks. Reason: %s.",
			monitor.Name, monitor.Target, monitor.FailureThreshold, reason,
		)
	} else {
		duration := formatDuration(payloadSeconds(entry, "durationSeconds"))
		params["status"] = "RESOLVED"
		params["subject"] = "✅ " + monitor.Name + " is back up"
		params["failure_reason"] = ""
		params["duration"] = duration
		params["message"] = fmt.Sprintf(
			"%s (%s) is responding again. Total downtime: %s.",
			monitor.Name, monitor.Target, duration,
		)
	}
	return params
}

func payloadString(entry *model.NotificationOutbox, key string) string {
	if v, ok := entry.Payload[key].(string); ok {
		return v
	}
	return ""
}

// payloadSeconds reads a number that may have round-tripped through BSON
// as int32, int64 or float64.
func payloadSeconds(entry *model.NotificationOutbox, key string) int64 {
	switch v := entry.Payload[key].(type) {
	case int:
		return int64(v)
	case int32:
		return int64(v)
	case int64:
		return v
	case float64:
		return int64(v)
	}
	return 0
}

func formatDuration(seconds int64) string {
	if seconds < 60 {
		return fmt.Sprintf("%ds", seconds)
	}
	d := time.Duration(seconds) * time.Second
	h := int(d.Hours())
	m := int(d.Minutes()) % 60
	s := int(d.Seconds()) % 60
	switch {
	case h > 0:
		return fmt.Sprintf("%dh %dm", h, m)
	case s > 0:
		return fmt.Sprintf("%dm %ds", m, s)
	default:
		return fmt.Sprintf("%dm", m)
	}
}
