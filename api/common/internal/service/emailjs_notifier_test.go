package service

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/cuesoftinc/upstat/api/common/internal/model"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type stubMonitorLookup map[string]*model.Monitor

func (s stubMonitorLookup) GetMonitorByID(id string) (*model.Monitor, error) {
	if m, ok := s[id]; ok {
		return m, nil
	}
	return nil, errors.New("not found")
}

type stubUserLookup map[string]*model.User

func (s stubUserLookup) GetUserByID(id string) (*model.User, error) {
	if u, ok := s[id]; ok {
		return u, nil
	}
	return nil, errors.New("not found")
}

func emailJSFixture(t *testing.T, status int) (*EmailJSNotifier, *model.Monitor, *[]emailJSRequest) {
	t.Helper()
	var sent []emailJSRequest
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req emailJSRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Errorf("bad body: %v", err)
		}
		sent = append(sent, req)
		w.WriteHeader(status)
		_, _ = w.Write([]byte("The Public Key is invalid"))
	}))
	t.Cleanup(srv.Close)

	owner := &model.User{Id: primitive.NewObjectID(), Name: "Ada", Email: "ada@example.com"}
	monitor := &model.Monitor{
		Id: primitive.NewObjectID(), OwnerId: owner.Id.Hex(),
		Name: "Website", Target: "https://example.com", FailureThreshold: 3,
	}
	n := NewEmailJSNotifier(
		EmailJSConfig{ServiceID: "svc", TemplateID: "tpl", PublicKey: "pub", PrivateKey: "priv", AppURL: "http://app/"},
		stubMonitorLookup{monitor.Id.Hex(): monitor},
		stubUserLookup{owner.Id.Hex(): owner},
	)
	n.Endpoint = srv.URL
	return n, monitor, &sent
}

func TestEmailJSNotifier_SendsDowntimeAndResolution(t *testing.T) {
	n, monitor, sent := emailJSFixture(t, http.StatusOK)
	ctx := context.Background()

	opened := &model.NotificationOutbox{
		Kind: "incident.opened", MonitorID: monitor.Id.Hex(), IncidentID: "inc1",
		Payload: bson.M{"failureReason": "HTTP 503"}, CreatedAt: time.Now(),
	}
	resolved := &model.NotificationOutbox{
		Kind: "incident.resolved", MonitorID: monitor.Id.Hex(), IncidentID: "inc1",
		Payload: bson.M{"durationSeconds": int32(754)}, CreatedAt: time.Now(),
	}
	if err := n.Deliver(ctx, opened); err != nil {
		t.Fatalf("opened: %v", err)
	}
	if err := n.Deliver(ctx, resolved); err != nil {
		t.Fatalf("resolved: %v", err)
	}

	if len(*sent) != 2 {
		t.Fatalf("want 2 sends, got %d", len(*sent))
	}
	down, up := (*sent)[0], (*sent)[1]
	if down.ServiceID != "svc" || down.TemplateID != "tpl" || down.UserID != "pub" || down.AccessToken != "priv" {
		t.Fatalf("credentials not passed: %+v", down)
	}
	if down.TemplateParams["to_email"] != "ada@example.com" || down.TemplateParams["status"] != "DOWN" ||
		down.TemplateParams["failure_reason"] != "HTTP 503" {
		t.Fatalf("downtime params: %v", down.TemplateParams)
	}
	if down.TemplateParams["incident_url"] != "http://app/dashboard/incidents/view?id=inc1" {
		t.Fatalf("incident_url: %q", down.TemplateParams["incident_url"])
	}
	if up.TemplateParams["status"] != "RESOLVED" || up.TemplateParams["duration"] != "12m 34s" {
		t.Fatalf("resolution params: %v", up.TemplateParams)
	}
}

func TestEmailJSNotifier_SkipsMutedAndMetricKinds(t *testing.T) {
	n, monitor, sent := emailJSFixture(t, http.StatusOK)
	ctx := context.Background()

	metric := &model.NotificationOutbox{Kind: "metric.latency.breached", MonitorID: monitor.Id.Hex()}
	if err := n.Deliver(ctx, metric); err != nil {
		t.Fatal(err)
	}
	monitor.Muted = true
	opened := &model.NotificationOutbox{Kind: "incident.opened", MonitorID: monitor.Id.Hex()}
	if err := n.Deliver(ctx, opened); err != nil {
		t.Fatal(err)
	}
	gone := &model.NotificationOutbox{Kind: "incident.opened", MonitorID: primitive.NewObjectID().Hex()}
	if err := n.Deliver(ctx, gone); err != nil {
		t.Fatal(err)
	}
	if len(*sent) != 0 {
		t.Fatalf("want no sends, got %d", len(*sent))
	}
}

func TestEmailJSNotifier_ProviderErrorIsRetried(t *testing.T) {
	n, monitor, _ := emailJSFixture(t, http.StatusBadRequest)
	err := n.Deliver(context.Background(), &model.NotificationOutbox{
		Kind: "incident.opened", MonitorID: monitor.Id.Hex(),
	})
	if err == nil {
		t.Fatal("want an error so the outbox retries")
	}
}
