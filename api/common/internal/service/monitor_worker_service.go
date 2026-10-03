package service

import (
	"context"
	"github.com/cuesoftinc/upstat/api/common/internal/config"
	"github.com/cuesoftinc/upstat/api/common/internal/model"
	"github.com/cuesoftinc/upstat/api/common/internal/repository"
	"github.com/cuesoftinc/upstat/api/common/internal/util"
	"go.mongodb.org/mongo-driver/bson"
	"log/slog"
	"sync"
	"time"
)

// MonitorWorker runs the check loop. It carries no state that other
// replicas depend on: WorkerID only labels lease ownership for
// observability, so any number of instances (multiple Cloud Run replicas,
// local dev, etc.) can run this concurrently against the same database
// and safely share the monitor set via MonitorRepo.ClaimMonitor.
type MonitorWorker struct {
	MonitorRepo      repository.MonitorRepository
	CheckResultRepo  repository.CheckResultRepository
	IncidentRepo     repository.IncidentRepository
	NotificationRepo repository.NotificationRepository
	Concurrency      int
	PollInterval     time.Duration
	LeaseDuration    time.Duration
	WorkerID         string
	// checkFunc is the HTTP-check step, injectable for tests. Defaults to
	// ExecuteHttpCheck when nil.
	checkFunc func(*model.Monitor) checkExecutionResult
}

func NewMonitorWorker(db *config.DB) *MonitorWorker {
	return &MonitorWorker{
		MonitorRepo:      repository.NewMonitorRepository(db),
		CheckResultRepo:  repository.NewCheckResultRepository(db),
		IncidentRepo:     repository.NewIncidentRepository(db),
		NotificationRepo: repository.NewNotificationRepository(db),
		Concurrency:      10,
		PollInterval:     5 * time.Second,
		LeaseDuration:    60 * time.Second,
		WorkerID:         util.NewWorkerID(),
	}
}

func (w *MonitorWorker) Start(ctx context.Context) {
	ticker := time.NewTicker(w.PollInterval)
	defer ticker.Stop()

	w.runOnce()

	for {
		select {
		case <-ctx.Done():
			slog.Info("monitor worker stopped")
			return
		case <-ticker.C:
			w.runOnce()
		}
	}
}

func (w *MonitorWorker) runOnce() {
	monitors, err := w.MonitorRepo.ListActiveMonitors()
	if err != nil {
		slog.Error("could not list active monitors")
		return
	}

	sem := make(chan struct{}, w.Concurrency)
	var wg sync.WaitGroup

	for _, monitor := range monitors {
		if !shouldRunMonitor(monitor) {
			continue
		}

		wg.Add(1)
		sem <- struct{}{}

		go func(m *model.Monitor) {
			defer wg.Done()
			defer func() { <-sem }()

			claimed, err := w.MonitorRepo.ClaimMonitor(m.Id, w.WorkerID, w.LeaseDuration)
			if err != nil {
				slog.Error("could not claim monitor", "error", err, "monitor", m.Id.Hex())
				return
			}
			if !claimed {
				// another replica already holds the lease for this tick
				return
			}

			if err := w.processMonitor(m); err != nil {
				slog.Error("monitor check failed", "error", err)
			}
		}(monitor)
	}
	wg.Wait()

}

func shouldRunMonitor(monitor *model.Monitor) bool {
	if monitor.LastCheckedAt == nil {
		return true
	}

	interval := time.Duration(monitor.IntervalSeconds) * time.Second
	if interval <= 0 {
		interval = 60 * time.Second
	}

	return time.Since(*monitor.LastCheckedAt) >= interval

}

func (w *MonitorWorker) processMonitor(monitor *model.Monitor) error {
	check := w.checkFunc
	if check == nil {
		check = ExecuteHttpCheck
	}
	result := check(monitor)

	checkResult := model.CheckResults{
		MonitorID:      monitor.Id.Hex(),
		CheckedAt:      time.Now(),
		ResponseTimeMs: result.ResponseTimeMs,
		Status:         result.Status,
		StatusCode:     result.StatusCode,
		Error:          result.Error,
		Attempts:       result.Attempts,
	}

	if _, err := w.CheckResultRepo.CreateCheckResult(checkResult); err != nil {
		return err
	}

	if err := w.evaluateMetricAlerts(monitor); err != nil {
		return err
	}

	consecutiveFailures := monitor.ConsecutiveFailures

	if result.Status == "up" {
		consecutiveFailures = 0

		resolvedIncident, err := w.IncidentRepo.ResolveActiveIncidents(monitor.Id)
		if err != nil {
			return err
		}

		if resolvedIncident != nil {
			if _, err := w.NotificationRepo.Enqueue(model.NotificationOutbox{
				Kind:       "incident.resolved",
				MonitorID:  monitor.Id.Hex(),
				IncidentID: resolvedIncident.Id.Hex(),
				Payload: bson.M{
					"monitorName":     monitor.Name,
					"incidentTitle":   resolvedIncident.Title,
					"durationSeconds": resolvedIncident.DurationSeconds,
				},
			}); err != nil {
				return err
			}
		}

		return w.MonitorRepo.UpdateAfterCheck(
			monitor.Id,
			"up",
			result.StatusCode,
			result.ResponseTimeMs,
			consecutiveFailures,
		)
	}

	consecutiveFailures++

	nextStatus := monitor.Status
	if consecutiveFailures >= monitor.FailureThreshold {
		nextStatus = "down"

		activeIncident, err := w.IncidentRepo.GetActiveIncidentForMonitor(monitor.Id)
		if err != nil {
			return err
		}

		if activeIncident == nil {
			createdIncident, err := w.IncidentRepo.CreateIncident(&model.Incident{
				MonitorID:     monitor.Id.Hex(),
				Title:         monitor.Name + " is down",
				FailureReason: failureReason(result),
				Status:        "active",
			})
			if err != nil {
				return err
			}

			if _, err := w.NotificationRepo.Enqueue(model.NotificationOutbox{
				Kind:       "incident.opened",
				MonitorID:  monitor.Id.Hex(),
				IncidentID: createdIncident.Id.Hex(),
				Payload: bson.M{
					"monitorName":   monitor.Name,
					"incidentTitle": createdIncident.Title,
					"failureReason": createdIncident.FailureReason,
				},
			}); err != nil {
				return err
			}
		}
	}

	return w.MonitorRepo.UpdateAfterCheck(
		monitor.Id,
		nextStatus,
		result.StatusCode,
		result.ResponseTimeMs,
		consecutiveFailures,
	)

}

func failureReason(result checkExecutionResult) string {
	if result.Error != "" {
		return result.Error
	}

	if result.StatusCode > 0 {
		return "received unhealthy status code"
	}

	return "monitor check failed"
}

// metricAlertWindow is the rolling window used to evaluate error-rate and
// latency thresholds — independent of, and usually much shorter-lived than,
// the incident state machine's consecutive-failure count.
const metricAlertWindow = 5 * time.Minute

// evaluateMetricAlerts checks the error-rate and latency thresholds (if
// configured) over the last metricAlertWindow and enqueues a breach/recovery
// notification on each state transition. It is a no-op when neither
// threshold is set, so existing monitors are unaffected until opted in.
func (w *MonitorWorker) evaluateMetricAlerts(monitor *model.Monitor) error {
	if monitor.ErrorRateThresholdPct <= 0 && monitor.LatencyThresholdMs <= 0 {
		return nil
	}

	since := time.Now().Add(-metricAlertWindow)
	errorRateActive := monitor.ErrorRateAlertActive
	latencyActive := monitor.LatencyAlertActive

	if monitor.ErrorRateThresholdPct > 0 {
		total, err := w.CheckResultRepo.CountTotalSince(monitor.Id.Hex(), since)
		if err != nil {
			return err
		}

		if total > 0 {
			successful, err := w.CheckResultRepo.CountSuccessfulSince(monitor.Id.Hex(), since)
			if err != nil {
				return err
			}

			errorRatePct := float64(total-successful) / float64(total) * 100
			breached := errorRatePct >= monitor.ErrorRateThresholdPct

			active, err := w.applyMetricAlertTransition(monitor, errorRateActive, breached, "metric.error_rate", bson.M{
				"errorRatePct":  errorRatePct,
				"thresholdPct":  monitor.ErrorRateThresholdPct,
				"windowMinutes": metricAlertWindow.Minutes(),
			})
			if err != nil {
				return err
			}
			errorRateActive = active
		}
	}

	if monitor.LatencyThresholdMs > 0 {
		avgMs, err := w.CheckResultRepo.AverageResponseTimeSince(monitor.Id.Hex(), since)
		if err != nil {
			return err
		}

		breached := avgMs > 0 && avgMs >= float64(monitor.LatencyThresholdMs)

		active, err := w.applyMetricAlertTransition(monitor, latencyActive, breached, "metric.latency", bson.M{
			"avgResponseTimeMs": avgMs,
			"thresholdMs":       monitor.LatencyThresholdMs,
			"windowMinutes":     metricAlertWindow.Minutes(),
		})
		if err != nil {
			return err
		}
		latencyActive = active
	}

	if errorRateActive != monitor.ErrorRateAlertActive || latencyActive != monitor.LatencyAlertActive {
		return w.MonitorRepo.SetMetricAlertState(monitor.Id, errorRateActive, latencyActive)
	}

	return nil
}

// applyMetricAlertTransition enqueues a notification on breach and on
// recovery, but only once per transition (edge-triggered on wasActive vs
// breached), and returns the new active state to persist.
func (w *MonitorWorker) applyMetricAlertTransition(monitor *model.Monitor, wasActive bool, breached bool, kind string, payload bson.M) (bool, error) {
	if breached == wasActive {
		return wasActive, nil
	}

	suffix := "recovered"
	if breached {
		suffix = "breached"
	}

	if err := w.enqueueMetricAlert(monitor, kind+"."+suffix, payload); err != nil {
		return wasActive, err
	}

	return breached, nil
}

func (w *MonitorWorker) enqueueMetricAlert(monitor *model.Monitor, kind string, extra bson.M) error {
	payload := bson.M{"monitorName": monitor.Name}
	for k, v := range extra {
		payload[k] = v
	}

	_, err := w.NotificationRepo.Enqueue(model.NotificationOutbox{
		Kind:      kind,
		MonitorID: monitor.Id.Hex(),
		Payload:   payload,
	})
	return err
}
