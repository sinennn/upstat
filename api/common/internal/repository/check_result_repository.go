package repository

import (
	"context"
	"github.com/cuesoftinc/upstat/api/common/internal/config"
	"github.com/cuesoftinc/upstat/api/common/internal/model"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"os"
	"time"
)

type CheckResultRepository interface {
	CreateCheckResult(result model.CheckResults) (*model.CheckResults, error)
	ListRecentByMonitor(monitorID string, limit int64) ([]*model.CheckResults, error)
	CountSuccessfulSince(monitorID string, since time.Time) (int64, error)
	CountTotalSince(monitorID string, since time.Time) (int64, error)
	AverageResponseTimeSince(monitorID string, since time.Time) (float64, error)
	// ListDailyUptime aggregates raw check results into per-day (UTC) buckets
	// for a monitor over [since, now]. Buckets with no checks are absent —
	// the caller maps gaps to nodata days.
	ListDailyUptime(monitorID string, since time.Time) ([]*model.DailyUptime, error)
	// P95ResponseTimeSince is the observed 95th-percentile response time over
	// [since, now]. Computed as a single bucketed aggregation (10ms
	// resolution) so it never streams every check document into the process.
	P95ResponseTimeSince(monitorID string, since time.Time) (int64, error)
}

type checkResultRepository struct {
	connection *config.DB
}

func checkResultCollection(db *config.DB) *mongo.Collection {
	return db.Client.Database(os.Getenv("MONGO_DB")).Collection("CheckResult")
}

func NewCheckResultRepository(db *config.DB) CheckResultRepository {
	return &checkResultRepository{connection: db}
}

func (db *checkResultRepository) CreateCheckResult(result model.CheckResults) (*model.CheckResults, error) {
	collection := checkResultCollection(db.connection)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	result.Id = primitive.NewObjectID()
	result.CreatedAt = time.Now()
	result.CheckedAt = time.Now()

	_, err := collection.InsertOne(ctx, result)
	if err != nil {
		return nil, err
	}

	return &result, nil
}

func (db *checkResultRepository) CountTotalSince(monitorID string, since time.Time) (int64, error) {
	collection := checkResultCollection(db.connection)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	totalCounts := bson.M{"monitorId": monitorID,
		"checkedAt": bson.M{
			"$gte": since},
	}

	count, err := collection.CountDocuments(ctx, totalCounts)
	if err != nil {
		return 0, err
	}

	return count, nil
}

func (db *checkResultRepository) CountSuccessfulSince(monitorID string, since time.Time) (int64, error) {
	collection := checkResultCollection(db.connection)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	succesfulCounts := bson.M{"monitorId": monitorID,
		"status": "up",
		"checkedAt": bson.M{
			"$gte": since},
	}

	count, err := collection.CountDocuments(ctx, succesfulCounts)
	if err != nil {
		return 0, err
	}

	return count, nil
}

func (db *checkResultRepository) AverageResponseTimeSince(monitorID string, since time.Time) (float64, error) {
	collection := checkResultCollection(db.connection)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	pipeline := mongo.Pipeline{
		bson.D{{Key: "$match", Value: bson.M{
			"monitorId": monitorID,
			"checkedAt": bson.M{"$gte": since},
		}}},
		bson.D{{Key: "$group", Value: bson.M{
			"_id": nil,
			"avg": bson.M{"$avg": "$responseTimeMs"},
		}}},
	}

	cursor, err := collection.Aggregate(ctx, pipeline)
	if err != nil {
		return 0, err
	}
	defer cursor.Close(ctx)

	var result struct {
		Avg float64 `bson:"avg"`
	}

	if cursor.Next(ctx) {
		if err := cursor.Decode(&result); err != nil {
			return 0, err
		}
	}

	return result.Avg, nil
}

func (db *checkResultRepository) ListRecentByMonitor(monitorID string, limit int64) ([]*model.CheckResults, error) {
	collection := checkResultCollection(db.connection)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	listRecentMonitors := bson.M{"monitorId": monitorID}
	mostRecent := bson.D{{Key: "createdAt", Value: -1}}

	if limit <= 0 {
		limit = 10
	}

	if limit > 100 {
		limit = 100
	}

	findOptions := options.Find().SetLimit(limit).SetSort(mostRecent)

	cursor, err := collection.Find(ctx, listRecentMonitors, findOptions)
	if err != nil {
		return nil, err
	}

	defer cursor.Close(ctx)

	var results []*model.CheckResults
	err = cursor.All(ctx, &results)
	return results, err
}

// ListDailyUptime aggregates raw check results into per-day (UTC) buckets for
// a monitor over [since, now]. Buckets with no checks are absent — the caller
// maps gaps to nodata days. This reads the same persisted CheckResult data the
// RollupWorker aggregates; no second metrics system.
func (db *checkResultRepository) ListDailyUptime(monitorID string, since time.Time) ([]*model.DailyUptime, error) {
	collection := checkResultCollection(db.connection)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	pipeline := mongo.Pipeline{
		bson.D{{Key: "$match", Value: bson.M{
			"monitorId": monitorID,
			"checkedAt": bson.M{"$gte": since},
		}}},
		bson.D{{Key: "$group", Value: bson.M{
			"_id":   bson.M{"$dateToString": bson.M{"format": "%Y-%m-%d", "date": "$checkedAt"}},
			"total": bson.M{"$sum": 1},
			"successful": bson.M{"$sum": bson.M{"$cond": bson.A{
				bson.M{"$eq": bson.A{"$status", "up"}},
				1,
				0,
			}}},
		}}},
		bson.D{{Key: "$sort", Value: bson.D{{Key: "_id", Value: 1}}}},
	}

	cursor, err := collection.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var rows []*model.DailyUptime
	if err := cursor.All(ctx, &rows); err != nil {
		return nil, err
	}
	return rows, nil
}

// P95ResponseTimeSince returns the observed 95th-percentile response time over
// [since, now]. It buckets response times in 10ms steps inside MongoDB and
// walks the cumulative counts, so the cost is one aggregation pass rather than
// transferring every raw check to the app. The 10ms bucket is the stated
// resolution: the returned value is the lower bound of the bucket in which the
// 95th percentile falls.
func (db *checkResultRepository) P95ResponseTimeSince(monitorID string, since time.Time) (int64, error) {
	collection := checkResultCollection(db.connection)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	pipeline := mongo.Pipeline{
		bson.D{{Key: "$match", Value: bson.M{
			"monitorId": monitorID,
			"checkedAt": bson.M{"$gte": since},
		}}},
		bson.D{{Key: "$group", Value: bson.M{
			"_id":   bson.M{"$multiply": bson.A{bson.M{"$floor": bson.M{"$divide": bson.A{"$responseTimeMs", 10}}}, 10}},
			"count": bson.M{"$sum": 1},
		}}},
		bson.D{{Key: "$sort", Value: bson.D{{Key: "_id", Value: 1}}}},
	}

	cursor, err := collection.Aggregate(ctx, pipeline)
	if err != nil {
		return 0, err
	}
	defer cursor.Close(ctx)

	var buckets []struct {
		Bucket int64 `bson:"_id"`
		Count  int64 `bson:"count"`
	}
	if err := cursor.All(ctx, &buckets); err != nil {
		return 0, err
	}

	var total int64
	for _, bucket := range buckets {
		total += bucket.Count
	}
	if total == 0 {
		return 0, nil
	}

	// Rank of the 95th percentile (1-based) among the ascending samples.
	rank := (95*total + 99) / 100
	var seen int64
	for _, bucket := range buckets {
		seen += bucket.Count
		if seen >= rank {
			return bucket.Bucket, nil
		}
	}

	return buckets[len(buckets)-1].Bucket, nil
}
