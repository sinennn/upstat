package repository_test

import (
	"testing"
	"time"

	"github.com/cuesoftinc/upstat/api/common/internal/model"
	"github.com/cuesoftinc/upstat/api/common/internal/repository"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// TestListDailyUptime_AggregatesByDay verifies the per-day aggregation the
// GetMonitorHistory RPC relies on: it must bucket by UTC day and count
// up/down checks from the persisted CheckResult documents.
func TestListDailyUptime_AggregatesByDay(t *testing.T) {
	resetCollections(t)
	monitor := createTestMonitor(t)
	repo := repository.NewCheckResultRepository(testDB)

	now := time.Now().UTC()
	today := time.Date(now.Year(), now.Month(), now.Day(), 12, 0, 0, 0, time.UTC)
	yesterday := today.AddDate(0, 0, -1)

	// Seed via the collection directly: CreateCheckResult stamps checkedAt=now,
	// but this test needs explicit timestamps to exercise day bucketing.
	coll := testDB.Client.Database("UpstatTest").Collection("CheckResult")
	for i, r := range []model.CheckResults{
		{MonitorID: monitor.Id.Hex(), Status: "up", StatusCode: 200, ResponseTimeMs: 42, CheckedAt: today},
		{MonitorID: monitor.Id.Hex(), Status: "up", StatusCode: 200, ResponseTimeMs: 40, CheckedAt: today},
		{MonitorID: monitor.Id.Hex(), Status: "down", StatusCode: 503, ResponseTimeMs: 200, CheckedAt: today},
		{MonitorID: monitor.Id.Hex(), Status: "up", StatusCode: 200, ResponseTimeMs: 38, CheckedAt: yesterday},
	} {
		if _, err := coll.InsertOne(t.Context(), r); err != nil {
			t.Fatalf("could not seed check %d: %v", i, err)
		}
	}

	since := time.Now().UTC().AddDate(0, 0, -90)
	rows, err := repo.ListDailyUptime(monitor.Id.Hex(), since)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(rows) != 2 {
		t.Fatalf("expected 2 day buckets, got %d: %+v", len(rows), rows)
	}

	byDate := map[string]*model.DailyUptime{}
	for _, row := range rows {
		byDate[row.Date] = row
	}

	td := today.Format("2006-01-02")
	yd := yesterday.Format("2006-01-02")
	if _, ok := byDate[td]; !ok {
		t.Fatalf("expected bucket for %s, got %v", td, byDate)
	}
	if byDate[td].Total != 3 || byDate[td].Successful != 2 {
		t.Fatalf("expected today 3 total/2 up, got %+v", byDate[td])
	}
	if byDate[yd].Total != 1 || byDate[yd].Successful != 1 {
		t.Fatalf("expected yesterday 1 total/1 up, got %+v", byDate[yd])
	}
}

// TestListIncidentsByMonitorIDs_OwnerScopedFeed verifies the dashboard feed
// returns every incident for the caller's monitors, newest first.
func TestListIncidentsByMonitorIDs_OwnerScopedFeed(t *testing.T) {
	resetCollections(t)
	ownerA := createTestMonitor(t)
	repo := repository.NewMonitorRepository(testDB)
	ownerB := *ownerA
	ownerB.Id = primitive.NewObjectID()
	ownerB.OwnerId = "other-owner"
	if _, err := repo.CreateMonitor(ownerB); err != nil {
		t.Fatalf("could not seed second monitor: %v", err)
	}

	incidentRepo := repository.NewIncidentRepository(testDB)
	older := model.Incident{MonitorID: ownerA.Id.Hex(), Title: "older", Status: "resolved", StartedAt: time.Now().Add(-2 * time.Hour)}
	resolved, err := incidentRepo.CreateIncident(&older)
	if err != nil {
		t.Fatalf("could not seed resolved incident: %v", err)
	}
	opened := model.Incident{MonitorID: ownerA.Id.Hex(), Title: "opened", Status: "active", StartedAt: time.Now()}
	active, err := incidentRepo.CreateIncident(&opened)
	if err != nil {
		t.Fatalf("could not seed active incident: %v", err)
	}

	// An incident on owner B's monitor must not appear in owner A's feed.
	foreign := model.Incident{MonitorID: ownerB.Id.Hex(), Title: "foreign", Status: "active", StartedAt: time.Now()}
	if _, err := incidentRepo.CreateIncident(&foreign); err != nil {
		t.Fatalf("could not seed foreign incident: %v", err)
	}

	feed, err := incidentRepo.ListIncidentsByMonitorIDs([]string{ownerA.Id.Hex()}, 50)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(feed) != 2 {
		t.Fatalf("expected 2 incidents for owner A, got %d: %+v", len(feed), feed)
	}
	// newest started first
	if feed[0].Id != active.Id || feed[1].Id != resolved.Id {
		t.Fatalf("expected newest-first ordering, got %+v", feed)
	}

	// Per-monitor scoping works too.
	byMonitor, err := incidentRepo.ListIncidentsByMonitor(ownerA.Id.Hex(), 10)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(byMonitor) != 2 {
		t.Fatalf("expected 2 incidents for the monitor, got %d", len(byMonitor))
	}
}

// TestStatusPageRepository_GetBySlug verifies slug→owner resolution for the
// public status-page endpoint.
func TestStatusPageRepository_GetBySlug(t *testing.T) {
	resetCollections(t)
	db := testDB.Client.Database("UpstatTest")
	if _, err := db.Collection("StatusPage").InsertOne(t.Context(), map[string]any{
		"ownerId": "owner-a",
		"name":    "Upstat",
		"slug":    "upstat",
	}); err != nil {
		t.Fatalf("could not seed status page: %v", err)
	}

	repo := repository.NewStatusPageRepository(testDB)
	page, err := repo.GetBySlug("upstat")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if page.OwnerId != "owner-a" || page.Slug != "upstat" {
		t.Fatalf("unexpected page: %+v", page)
	}
	if _, err := repo.GetBySlug("nope"); err == nil {
		t.Fatalf("expected error for missing slug")
	}
}

// TestUpdateMonitor_PersistsEditableFields verifies the updated $set writes
// active/muted/scheduling through, owner-scoped.
func TestUpdateMonitor_PersistsEditableFields(t *testing.T) {
	resetCollections(t)
	repo := repository.NewMonitorRepository(testDB)
	monitor := createTestMonitor(t)

	updated, err := repo.UpdateMonitor(monitor.Id.Hex(), monitor.OwnerId, model.Monitor{
		OwnerId:          monitor.OwnerId,
		Name:             "renamed",
		Target:           "https://new.example.com",
		Type:             "api",
		Active:           false,
		Muted:            true,
		IntervalSeconds:  120,
		TimeoutSeconds:   15,
		FailureThreshold: 5,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if updated.Name != "renamed" || updated.Active || !updated.Muted {
		t.Fatalf("expected renamed + inactive + muted, got %+v", updated)
	}
	if updated.IntervalSeconds != 120 || updated.TimeoutSeconds != 15 || updated.FailureThreshold != 5 {
		t.Fatalf("expected scheduling fields persisted, got %+v", updated)
	}

	// Cross-owner update must not match.
	if _, err := repo.UpdateMonitor(monitor.Id.Hex(), "someone-else", model.Monitor{Name: "n"}); err == nil {
		t.Fatalf("expected cross-owner update to fail")
	}
}

// TestCreateIncident_DefaultsStartedAt pins the worker's call shape: it opens
// incidents without a StartedAt, so the repository must stamp one — otherwise
// the stored zero time renders as year 1 and resolve durations explode.
func TestCreateIncident_DefaultsStartedAt(t *testing.T) {
	resetCollections(t)
	monitor := createTestMonitor(t)
	repo := repository.NewIncidentRepository(testDB)

	before := time.Now().Add(-time.Second)
	created, err := repo.CreateIncident(&model.Incident{
		MonitorID: monitor.Id.Hex(),
		Title:     monitor.Name + " is down",
		Status:    "active",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if created.StartedAt.Before(before) {
		t.Fatalf("StartedAt not stamped: %v", created.StartedAt)
	}

	resolved, err := repo.ResolveActiveIncidents(monitor.Id)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resolved == nil || resolved.DurationSeconds < 0 || resolved.DurationSeconds > 60 {
		t.Fatalf("expected a short duration, got %+v", resolved)
	}
}

// TestListRecentByMonitor_HonoursServiceMaximum guards the 500-row maximum
// GetMonitorHistory documents (the repository used to clamp to 100).
func TestListRecentByMonitor_HonoursServiceMaximum(t *testing.T) {
	resetCollections(t)
	monitor := createTestMonitor(t)
	repo := repository.NewCheckResultRepository(testDB)
	for i := 0; i < 150; i++ {
		if _, err := repo.CreateCheckResult(model.CheckResults{
			MonitorID: monitor.Id.Hex(), CheckedAt: time.Now(), Status: "up", StatusCode: 200,
		}); err != nil {
			t.Fatalf("seed: %v", err)
		}
	}
	got, err := repo.ListRecentByMonitor(monitor.Id.Hex(), 500)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got) != 150 {
		t.Fatalf("want all 150 checks, got %d", len(got))
	}
}
