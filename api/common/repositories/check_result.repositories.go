package repositories

import (
	"context"
	"github.com/CuesoftCloud/upstat/config"
	"github.com/CuesoftCloud/upstat/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"os"
	"time"
)

type CheckResultRepository interface {
	CreateCheckResult(result models.CheckResults) (*models.CheckResults, error)
	ListRecentByMonitor(monitorID string, limit int64) ([]*models.CheckResults, error)
	CountSuccessfulSince(monitorID string, since time.Time) (int64, error)
	CountTotalSince(monitorID string, since time.Time) (int64, error)
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

func (db *checkResultRepository) CreateCheckResult(result models.CheckResults) (*models.CheckResults, error) {
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

func (db *checkResultRepository) ListRecentByMonitor(monitorID string, limit int64) ([]*models.CheckResults, error) {
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

	var results []*models.CheckResults
	err = cursor.All(ctx, &results)
	return results, err
}
