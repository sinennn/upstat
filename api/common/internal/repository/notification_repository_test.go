package repository_test

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/cuesoftinc/upstat/api/common/internal/model"
	"github.com/cuesoftinc/upstat/api/common/internal/repository"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func fetchNotification(t *testing.T, id primitive.ObjectID) model.NotificationOutbox {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var doc model.NotificationOutbox
	err := testDB.Client.Database(os.Getenv("MONGO_DB")).Collection("NotificationOutbox").
		FindOne(ctx, bson.M{"_id": id}).Decode(&doc)
	if err != nil {
		t.Fatalf("could not fetch notification: %v", err)
	}
	return doc
}

func TestNotificationRepository_EnqueueListClaim(t *testing.T) {
	resetCollections(t)
	repo := repository.NewNotificationRepository(testDB)

	entry, err := repo.Enqueue(model.NotificationOutbox{
		Kind:      "incident.opened",
		MonitorID: "monitor-1",
		Payload:   bson.M{"monitorName": "api"},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if entry.Status != "pending" {
		t.Fatalf("expected status pending, got %q", entry.Status)
	}

	pending, err := repo.ListPending(10)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(pending) != 1 || pending[0].Id != entry.Id {
		t.Fatalf("expected the enqueued entry in ListPending, got %+v", pending)
	}

	claimed, err := repo.Claim(entry.Id, "worker-a", time.Minute)
	if err != nil || !claimed {
		t.Fatalf("expected claim to succeed, got claimed=%v err=%v", claimed, err)
	}

	// A second worker must not be able to claim it while the lease holds.
	claimed, err = repo.Claim(entry.Id, "worker-b", time.Minute)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if claimed {
		t.Fatalf("expected second claim to be rejected while the lease is held")
	}
}

func TestNotificationRepository_MarkFailedBacksOffThenGivesUp(t *testing.T) {
	resetCollections(t)
	repo := repository.NewNotificationRepository(testDB)

	entry, err := repo.Enqueue(model.NotificationOutbox{Kind: "incident.opened", MonitorID: "monitor-1", Payload: bson.M{}})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if _, err := repo.Claim(entry.Id, "worker-a", time.Minute); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	future := time.Now().Add(time.Hour)
	if err := repo.MarkFailed(entry.Id, "boom", future, false); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	doc := fetchNotification(t, entry.Id)
	if doc.Status != "pending" {
		t.Fatalf("expected status to stay pending on retry, got %q", doc.Status)
	}
	if doc.Attempts != 1 {
		t.Fatalf("expected attempts=1, got %d", doc.Attempts)
	}
	if doc.LastError != "boom" {
		t.Fatalf("expected lastError to be recorded, got %q", doc.LastError)
	}
	if doc.LockedBy != nil {
		t.Fatalf("expected the lease to be released after marking failed")
	}

	// Not due yet — must not show up as pending work.
	pending, err := repo.ListPending(10)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(pending) != 0 {
		t.Fatalf("expected no pending entries before nextAttemptAt, got %d", len(pending))
	}

	// Claim again (simulating the worker loop after the backoff window) and
	// give up for good this time.
	if _, err := repo.Claim(entry.Id, "worker-a", time.Minute); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if err := repo.MarkFailed(entry.Id, "boom again", time.Now(), true); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	doc = fetchNotification(t, entry.Id)
	if doc.Status != "failed" {
		t.Fatalf("expected status=failed after giving up, got %q", doc.Status)
	}
	if doc.Attempts != 2 {
		t.Fatalf("expected attempts=2, got %d", doc.Attempts)
	}

	pending, err = repo.ListPending(10)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(pending) != 0 {
		t.Fatalf("expected dead-lettered entries to never show up as pending, got %d", len(pending))
	}
}

func TestNotificationRepository_MarkDelivered(t *testing.T) {
	resetCollections(t)
	repo := repository.NewNotificationRepository(testDB)

	entry, err := repo.Enqueue(model.NotificationOutbox{Kind: "incident.resolved", MonitorID: "monitor-1", Payload: bson.M{}})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if _, err := repo.Claim(entry.Id, "worker-a", time.Minute); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if err := repo.MarkDelivered(entry.Id); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	doc := fetchNotification(t, entry.Id)
	if doc.Status != "delivered" {
		t.Fatalf("expected status=delivered, got %q", doc.Status)
	}
	if doc.DeliveredAt == nil {
		t.Fatalf("expected DeliveredAt to be set")
	}

	pending, err := repo.ListPending(10)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(pending) != 0 {
		t.Fatalf("expected delivered entries to never show up as pending, got %d", len(pending))
	}
}
