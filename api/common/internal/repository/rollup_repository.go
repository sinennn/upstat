package repository

import (
	"context"
	"github.com/cuesoftinc/upstat/api/common/internal/config"
	"github.com/cuesoftinc/upstat/api/common/internal/model"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"os"
	"time"
)

type RollupRepository interface {
	// UpsertHourlyRollup (re)computes the aggregate for [bucketStart,
	// bucketStart+1h) from raw CheckResults and upserts it into the rollup
	// collection. Recomputing from scratch each call keeps it idempotent —
	// safe to call repeatedly, from any number of worker replicas, with no
	// lease needed. Returns nil, nil if there are no raw checks in the
	// bucket yet.
	UpsertHourlyRollup(monitorID string, bucketStart time.Time) (*model.CheckResultRollup, error)
}

type rollupRepository struct {
	connection *config.DB
}

func checkResultRollupCollection(db *config.DB) *mongo.Collection {
	return db.Client.Database(os.Getenv("MONGO_DB")).Collection("CheckResultRollup")
}

func NewRollupRepository(db *config.DB) RollupRepository {
	return &rollupRepository{connection: db}
}

func (db *rollupRepository) UpsertHourlyRollup(monitorID string, bucketStart time.Time) (*model.CheckResultRollup, error) {
	rawCollection := checkResultCollection(db.connection)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	bucketEnd := bucketStart.Add(time.Hour)

	pipeline := mongo.Pipeline{
		bson.D{{Key: "$match", Value: bson.M{
			"monitorId": monitorID,
			"checkedAt": bson.M{"$gte": bucketStart, "$lt": bucketEnd},
		}}},
		bson.D{{Key: "$group", Value: bson.M{
			"_id":         nil,
			"totalChecks": bson.M{"$sum": 1},
			"successfulChecks": bson.M{"$sum": bson.M{"$cond": bson.A{
				bson.M{"$eq": bson.A{"$status", "up"}},
				1,
				0,
			}}},
			"avgResponseTimeMs": bson.M{"$avg": "$responseTimeMs"},
			"minResponseTimeMs": bson.M{"$min": "$responseTimeMs"},
			"maxResponseTimeMs": bson.M{"$max": "$responseTimeMs"},
		}}},
	}

	cursor, err := rawCollection.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var agg struct {
		TotalChecks       int64   `bson:"totalChecks"`
		SuccessfulChecks  int64   `bson:"successfulChecks"`
		AvgResponseTimeMs float64 `bson:"avgResponseTimeMs"`
		MinResponseTimeMs int64   `bson:"minResponseTimeMs"`
		MaxResponseTimeMs int64   `bson:"maxResponseTimeMs"`
	}

	if !cursor.Next(ctx) {
		return nil, nil
	}
	if err := cursor.Decode(&agg); err != nil {
		return nil, err
	}

	now := time.Now()
	rollup := &model.CheckResultRollup{
		MonitorID:         monitorID,
		BucketStart:       bucketStart,
		TotalChecks:       agg.TotalChecks,
		SuccessfulChecks:  agg.SuccessfulChecks,
		AvgResponseTimeMs: agg.AvgResponseTimeMs,
		MinResponseTimeMs: agg.MinResponseTimeMs,
		MaxResponseTimeMs: agg.MaxResponseTimeMs,
		UpdatedAt:         now,
	}

	rollupCollection := checkResultRollupCollection(db.connection)
	filter := bson.M{"monitorId": monitorID, "bucketStart": bucketStart}
	update := bson.M{
		"$set": bson.M{
			"totalChecks":       rollup.TotalChecks,
			"successfulChecks":  rollup.SuccessfulChecks,
			"avgResponseTimeMs": rollup.AvgResponseTimeMs,
			"minResponseTimeMs": rollup.MinResponseTimeMs,
			"maxResponseTimeMs": rollup.MaxResponseTimeMs,
			"updatedAt":         now,
		},
		"$setOnInsert": bson.M{
			"monitorId":   monitorID,
			"bucketStart": bucketStart,
			"createdAt":   now,
		},
	}
	opts := options.Update().SetUpsert(true)

	if _, err := rollupCollection.UpdateOne(ctx, filter, update, opts); err != nil {
		return nil, err
	}

	return rollup, nil
}
