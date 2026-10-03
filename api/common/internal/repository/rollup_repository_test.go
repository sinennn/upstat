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

func insertCheckResult(t *testing.T, monitorID string, checkedAt time.Time, status string, responseTimeMs int64) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err := testDB.Client.Database(os.Getenv("MONGO_DB")).Collection("CheckResult").InsertOne(ctx, model.CheckResults{
		Id:             primitive.NewObjectID(),
		MonitorID:      monitorID,
		CheckedAt:      checkedAt,
		ResponseTimeMs: responseTimeMs,
		Status:         status,
		CreatedAt:      checkedAt,
	})
	if err != nil {
		t.Fatalf("could not insert check result: %v", err)
	}
}

func TestUpsertHourlyRollup_AggregatesAndIsIdempotent(t *testing.T) {
	resetCollections(t)

	monitorID := primitive.NewObjectID().Hex()
	bucketStart := time.Date(2026, 1, 1, 10, 0, 0, 0, time.UTC)

	// Inside the bucket [10:00, 11:00): 3 up (100, 200, 300ms) + 1 down (400ms).
	insertCheckResult(t, monitorID, bucketStart.Add(5*time.Minute), "up", 100)
	insertCheckResult(t, monitorID, bucketStart.Add(30*time.Minute), "up", 200)
	insertCheckResult(t, monitorID, bucketStart.Add(59*time.Minute+59*time.Second), "up", 300)
	insertCheckResult(t, monitorID, bucketStart.Add(45*time.Minute), "down", 400)

	// Outside the bucket on both edges — must be excluded.
	insertCheckResult(t, monitorID, bucketStart.Add(-time.Second), "up", 999)
	insertCheckResult(t, monitorID, bucketStart.Add(time.Hour), "up", 999)

	// A different monitor entirely — must be excluded.
	insertCheckResult(t, primitive.NewObjectID().Hex(), bucketStart.Add(10*time.Minute), "up", 999)

	repo := repository.NewRollupRepository(testDB)

	rollup, err := repo.UpsertHourlyRollup(monitorID, bucketStart)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if rollup == nil {
		t.Fatalf("expected a rollup, got nil")
	}

	if rollup.TotalChecks != 4 {
		t.Errorf("TotalChecks = %d, want 4", rollup.TotalChecks)
	}
	if rollup.SuccessfulChecks != 3 {
		t.Errorf("SuccessfulChecks = %d, want 3", rollup.SuccessfulChecks)
	}
	if rollup.AvgResponseTimeMs != 250 {
		t.Errorf("AvgResponseTimeMs = %v, want 250", rollup.AvgResponseTimeMs)
	}
	if rollup.MinResponseTimeMs != 100 {
		t.Errorf("MinResponseTimeMs = %d, want 100", rollup.MinResponseTimeMs)
	}
	if rollup.MaxResponseTimeMs != 400 {
		t.Errorf("MaxResponseTimeMs = %d, want 400", rollup.MaxResponseTimeMs)
	}

	// Idempotency: a second upsert for the same bucket must update the
	// existing document in place, not create a duplicate.
	if _, err := repo.UpsertHourlyRollup(monitorID, bucketStart); err != nil {
		t.Fatalf("unexpected error on second upsert: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	count, err := testDB.Client.Database(os.Getenv("MONGO_DB")).Collection("CheckResultRollup").
		CountDocuments(ctx, bson.M{"monitorId": monitorID, "bucketStart": bucketStart})
	if err != nil {
		t.Fatalf("could not count rollup docs: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected exactly one rollup document after two upserts, got %d", count)
	}
}

func TestUpsertHourlyRollup_EmptyBucketReturnsNil(t *testing.T) {
	resetCollections(t)

	monitorID := primitive.NewObjectID().Hex()
	bucketStart := time.Date(2026, 1, 1, 10, 0, 0, 0, time.UTC)

	repo := repository.NewRollupRepository(testDB)
	rollup, err := repo.UpsertHourlyRollup(monitorID, bucketStart)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if rollup != nil {
		t.Fatalf("expected nil rollup for an empty bucket, got %+v", rollup)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	count, err := testDB.Client.Database(os.Getenv("MONGO_DB")).Collection("CheckResultRollup").CountDocuments(ctx, bson.M{})
	if err != nil {
		t.Fatalf("could not count rollup docs: %v", err)
	}
	if count != 0 {
		t.Fatalf("expected no rollup document to be written for an empty bucket, got %d", count)
	}
}
