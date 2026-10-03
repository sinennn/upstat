package service

import (
	"testing"
	"time"

	"github.com/cuesoftinc/upstat/api/common/internal/model"
	"github.com/cuesoftinc/upstat/api/common/internal/repository"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// lifecycleMonitorRepo records UpdateAfterCheck writes; every other method
// panics on the nil embedded interface (never called by processMonitor).
type lifecycleMonitorRepo struct {
	repository.MonitorRepository
	updates []model.Monitor
}

func (f *lifecycleMonitorRepo) UpdateAfterCheck(monitorID primitive.ObjectID, status string, statusCode int, responseTimeMs int64, consecutiveFailures int) error {
	f.updates = append(f.updates, model.Monitor{Id: monitorID, Status: status, LastStatusCode: statusCode, LastResponseTimeMs: responseTimeMs, ConsecutiveFailures: consecutiveFailures})
	return nil
}

// lifecycleChecks records persisted check results.
type lifecycleChecks struct {
	repository.CheckResultRepository
	results []*model.CheckResults
}

func (f *lifecycleChecks) CreateCheckResult(r model.CheckResults) (*model.CheckResults, error) {
	f.results = append(f.results, &r)
	return &r, nil
}

// lifecycleIncidents drives the open/resolve state machine against a map of
// active incidents per monitor, mirroring the real repository's semantics.
type lifecycleIncidents struct {
	repository.IncidentRepository
	active   map[string]*model.Incident
	created  []*model.Incident
	resolved []*model.Incident
}

func (f *lifecycleIncidents) GetActiveIncidentForMonitor(monitorID primitive.ObjectID) (*model.Incident, error) {
	return f.active[monitorID.Hex()], nil
}

func (f *lifecycleIncidents) CreateIncident(incident *model.Incident) (model.Incident, error) {
	if incident.Id.IsZero() {
		incident.Id = primitive.NewObjectID()
	}
	if f.active == nil {
		f.active = map[string]*model.Incident{}
	}
	f.active[incident.MonitorID] = incident
	f.created = append(f.created, incident)
	return *incident, nil
}

func (f *lifecycleIncidents) ResolveActiveIncidents(monitorID primitive.ObjectID) (*model.Incident, error) {
	key := monitorID.Hex()
	inc := f.active[key]
	if inc == nil {
		return nil, nil
	}
	delete(f.active, key)
	now := time.Now()
	inc.Status = "resolved"
	inc.ResolvedAt = &now
	f.resolved = append(f.resolved, inc)
	return inc, nil
}

// TestWorker_IncidentLifecycle drives the full state machine the monitoring
// vertical depends on: failing checks past the failure threshold open an
// incident, recovery resolves it, and both transitions enqueue exactly one
// notification each.
func TestWorker_IncidentLifecycle(t *testing.T) {
	monitor := &model.Monitor{
		Id:               primitive.NewObjectID(),
		OwnerId:          "owner-a",
		Name:             "checkout",
		Target:           "https://example.com",
		Type:             "website",
		Active:           true,
		Status:           "up",
		IntervalSeconds:  60,
		TimeoutSeconds:   10,
		FailureThreshold: 2,
	}

	checks := &lifecycleChecks{}
	incidents := &lifecycleIncidents{}
	notifications := &fakeNotificationRepo{}
	monitors := &lifecycleMonitorRepo{}

	worker := &MonitorWorker{
		MonitorRepo:      monitors,
		CheckResultRepo:  checks,
		IncidentRepo:     incidents,
		NotificationRepo: notifications,
		checkFunc: func(*model.Monitor) checkExecutionResult {
			return checkExecutionResult{Status: "down", StatusCode: 503, ResponseTimeMs: 200}
		},
	}

	// First failure: below threshold — no incident yet.
	if err := worker.processMonitor(monitor); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(incidents.created) != 0 || len(notifications.enqueued) != 0 {
		t.Fatalf("expected no incident below threshold, created=%d notifs=%+v", len(incidents.created), notifications.enqueued)
	}
	monitor.ConsecutiveFailures = 1

	// Second failure: reaches threshold → incident opens + notification.
	if err := worker.processMonitor(monitor); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(incidents.created) != 1 {
		t.Fatalf("expected incident opened, created=%d", len(incidents.created))
	}
	if len(notifications.enqueued) != 1 || notifications.enqueued[0].Kind != "incident.opened" {
		t.Fatalf("expected incident.opened notification, got %+v", notifications.enqueued)
	}
	monitor.Status = "down"
	monitor.ConsecutiveFailures = 2

	// Recovery: status flips up, incident resolves, one resolved notification.
	worker.checkFunc = func(*model.Monitor) checkExecutionResult {
		return checkExecutionResult{Status: "up", StatusCode: 200, ResponseTimeMs: 40}
	}
	if err := worker.processMonitor(monitor); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(incidents.resolved) != 1 {
		t.Fatalf("expected incident resolved, resolved=%d", len(incidents.resolved))
	}
	kinds := kindsOf(notifications.enqueued)
	if len(kinds) != 2 || kinds[1] != "incident.resolved" {
		t.Fatalf("expected incident.resolved notification, got %v", kinds)
	}
	// The monitor document now records the up status.
	if len(monitors.updates) == 0 || monitors.updates[len(monitors.updates)-1].Status != "up" {
		t.Fatalf("expected final monitor update with up status, got %+v", monitors.updates)
	}
}
