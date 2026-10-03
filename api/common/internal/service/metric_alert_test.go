package service

import (
	"testing"
	"time"

	"github.com/cuesoftinc/upstat/api/common/internal/model"
	"github.com/cuesoftinc/upstat/api/common/internal/repository"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// fakeCheckResultRepo is a full fake — evaluateMetricAlerts only calls the
// three read methods below, but the interface requires the rest.
type fakeCheckResultRepo struct {
	total      int64
	successful int64
	avgMs      float64
}

func (f *fakeCheckResultRepo) CreateCheckResult(result model.CheckResults) (*model.CheckResults, error) {
	return &result, nil
}
func (f *fakeCheckResultRepo) ListRecentByMonitor(string, int64) ([]*model.CheckResults, error) {
	return nil, nil
}
func (f *fakeCheckResultRepo) CountSuccessfulSince(string, time.Time) (int64, error) {
	return f.successful, nil
}
func (f *fakeCheckResultRepo) CountTotalSince(string, time.Time) (int64, error) {
	return f.total, nil
}
func (f *fakeCheckResultRepo) AverageResponseTimeSince(string, time.Time) (float64, error) {
	return f.avgMs, nil
}
func (f *fakeCheckResultRepo) ListDailyUptime(string, time.Time) ([]*model.DailyUptime, error) {
	return nil, nil
}
func (f *fakeCheckResultRepo) P95ResponseTimeSince(string, time.Time) (int64, error) {
	return int64(f.avgMs), nil
}

type fakeNotificationRepo struct {
	enqueued []model.NotificationOutbox
}

func (f *fakeNotificationRepo) Enqueue(entry model.NotificationOutbox) (*model.NotificationOutbox, error) {
	f.enqueued = append(f.enqueued, entry)
	return &entry, nil
}
func (f *fakeNotificationRepo) ListPending(int64) ([]*model.NotificationOutbox, error) { return nil, nil }
func (f *fakeNotificationRepo) Claim(primitive.ObjectID, string, time.Duration) (bool, error) {
	return true, nil
}
func (f *fakeNotificationRepo) MarkDelivered(primitive.ObjectID) error { return nil }
func (f *fakeNotificationRepo) MarkFailed(primitive.ObjectID, string, time.Time, bool) error {
	return nil
}

// fakeMonitorRepo embeds the interface so it only has to override what the
// test exercises (SetMetricAlertState); any other method call would panic
// on the nil embedded interface, which is fine — evaluateMetricAlerts never
// calls them.
type fakeMonitorRepo struct {
	repository.MonitorRepository
	alertStateCalls []fakeAlertStateCall
}

type fakeAlertStateCall struct {
	monitorID       primitive.ObjectID
	errorRateActive bool
	latencyActive   bool
}

func (f *fakeMonitorRepo) SetMetricAlertState(monitorID primitive.ObjectID, errorRateActive, latencyActive bool) error {
	f.alertStateCalls = append(f.alertStateCalls, fakeAlertStateCall{monitorID, errorRateActive, latencyActive})
	return nil
}

func newTestWorker(checkResults *fakeCheckResultRepo, notifications *fakeNotificationRepo, monitors *fakeMonitorRepo) *MonitorWorker {
	return &MonitorWorker{
		CheckResultRepo:  checkResults,
		NotificationRepo: notifications,
		MonitorRepo:      monitors,
	}
}

func kindsOf(entries []model.NotificationOutbox) []string {
	kinds := make([]string, len(entries))
	for i, e := range entries {
		kinds[i] = e.Kind
	}
	return kinds
}

func TestEvaluateMetricAlerts_DisabledByDefault(t *testing.T) {
	checkResults := &fakeCheckResultRepo{total: 10, successful: 0} // 100% error rate
	notifications := &fakeNotificationRepo{}
	monitors := &fakeMonitorRepo{}
	w := newTestWorker(checkResults, notifications, monitors)

	monitor := &model.Monitor{Id: primitive.NewObjectID(), Name: "api"}
	// both thresholds zero (unset) — must be a no-op

	if err := w.evaluateMetricAlerts(monitor); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(notifications.enqueued) != 0 {
		t.Fatalf("expected no notifications, got %v", kindsOf(notifications.enqueued))
	}
	if len(monitors.alertStateCalls) != 0 {
		t.Fatalf("expected no state updates, got %d", len(monitors.alertStateCalls))
	}
}

func TestEvaluateMetricAlerts_NoDataInWindow(t *testing.T) {
	checkResults := &fakeCheckResultRepo{total: 0, successful: 0}
	notifications := &fakeNotificationRepo{}
	monitors := &fakeMonitorRepo{}
	w := newTestWorker(checkResults, notifications, monitors)

	monitor := &model.Monitor{Id: primitive.NewObjectID(), Name: "api", ErrorRateThresholdPct: 10}

	if err := w.evaluateMetricAlerts(monitor); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(notifications.enqueued) != 0 {
		t.Fatalf("expected no notifications with zero samples, got %v", kindsOf(notifications.enqueued))
	}
}

func TestEvaluateMetricAlerts_ErrorRateBreachThenRecovery(t *testing.T) {
	notifications := &fakeNotificationRepo{}
	monitors := &fakeMonitorRepo{}
	monitor := &model.Monitor{Id: primitive.NewObjectID(), Name: "api", ErrorRateThresholdPct: 10}

	// 50% error rate, well over a 10% threshold: expect a breach.
	w := newTestWorker(&fakeCheckResultRepo{total: 10, successful: 5}, notifications, monitors)
	if err := w.evaluateMetricAlerts(monitor); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got := kindsOf(notifications.enqueued); len(got) != 1 || got[0] != "metric.error_rate.breached" {
		t.Fatalf("expected a single breach notification, got %v", got)
	}
	if len(monitors.alertStateCalls) != 1 || !monitors.alertStateCalls[0].errorRateActive {
		t.Fatalf("expected state to flip to active, got %+v", monitors.alertStateCalls)
	}

	// Simulate persistence: the monitor now carries the active flag.
	monitor.ErrorRateAlertActive = true

	// Still breaching on the next tick: must NOT enqueue a second breach.
	w = newTestWorker(&fakeCheckResultRepo{total: 10, successful: 5}, notifications, monitors)
	if err := w.evaluateMetricAlerts(monitor); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got := kindsOf(notifications.enqueued); len(got) != 1 {
		t.Fatalf("expected no additional notification while still breaching, got %v", got)
	}
	if len(monitors.alertStateCalls) != 1 {
		t.Fatalf("expected no additional state update while unchanged, got %d", len(monitors.alertStateCalls))
	}

	// Recovers: 0% error rate now.
	w = newTestWorker(&fakeCheckResultRepo{total: 10, successful: 10}, notifications, monitors)
	if err := w.evaluateMetricAlerts(monitor); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got := kindsOf(notifications.enqueued); len(got) != 2 || got[1] != "metric.error_rate.recovered" {
		t.Fatalf("expected a recovery notification, got %v", got)
	}
	if len(monitors.alertStateCalls) != 2 || monitors.alertStateCalls[1].errorRateActive {
		t.Fatalf("expected state to flip back to inactive, got %+v", monitors.alertStateCalls)
	}
}

func TestEvaluateMetricAlerts_LatencyBreach(t *testing.T) {
	notifications := &fakeNotificationRepo{}
	monitors := &fakeMonitorRepo{}
	monitor := &model.Monitor{Id: primitive.NewObjectID(), Name: "api", LatencyThresholdMs: 500}

	w := newTestWorker(&fakeCheckResultRepo{avgMs: 900}, notifications, monitors)
	if err := w.evaluateMetricAlerts(monitor); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got := kindsOf(notifications.enqueued); len(got) != 1 || got[0] != "metric.latency.breached" {
		t.Fatalf("expected a latency breach notification, got %v", got)
	}

	entry := notifications.enqueued[0]
	if entry.Payload["avgResponseTimeMs"] != 900.0 {
		t.Fatalf("expected payload to carry the observed average, got %v", entry.Payload)
	}
}

func TestEvaluateMetricAlerts_BothThresholdsBreachIndependently(t *testing.T) {
	notifications := &fakeNotificationRepo{}
	monitors := &fakeMonitorRepo{}
	monitor := &model.Monitor{
		Id:                    primitive.NewObjectID(),
		Name:                  "api",
		ErrorRateThresholdPct: 10,
		LatencyThresholdMs:    500,
	}

	w := newTestWorker(&fakeCheckResultRepo{total: 10, successful: 5, avgMs: 900}, notifications, monitors)
	if err := w.evaluateMetricAlerts(monitor); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	got := kindsOf(notifications.enqueued)
	if len(got) != 2 {
		t.Fatalf("expected both rules to independently breach, got %v", got)
	}
	if len(monitors.alertStateCalls) != 1 {
		t.Fatalf("expected a single combined state update, got %d", len(monitors.alertStateCalls))
	}
	call := monitors.alertStateCalls[0]
	if !call.errorRateActive || !call.latencyActive {
		t.Fatalf("expected both flags active, got %+v", call)
	}
}

func TestApplyMetricAlertTransition_NoOpWhenUnchanged(t *testing.T) {
	w := &MonitorWorker{NotificationRepo: &fakeNotificationRepo{}}
	monitor := &model.Monitor{Id: primitive.NewObjectID(), Name: "api"}

	active, err := w.applyMetricAlertTransition(monitor, true, true, "metric.error_rate", bson.M{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !active {
		t.Fatalf("expected state to stay active")
	}
	if len(w.NotificationRepo.(*fakeNotificationRepo).enqueued) != 0 {
		t.Fatalf("expected no notification when state is unchanged")
	}
}
