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

type NotificationRepository interface {
	Enqueue(entry model.NotificationOutbox) (*model.NotificationOutbox, error)
	ListPending(limit int64) ([]*model.NotificationOutbox, error)
	Claim(id primitive.ObjectID, workerID string, leaseDuration time.Duration) (bool, error)
	MarkDelivered(id primitive.ObjectID) error
	MarkFailed(id primitive.ObjectID, lastErr string, nextAttemptAt time.Time, giveUp bool) error
}

type notificationRepository struct {
	connection *config.DB
}

func notificationCollection(db *config.DB) *mongo.Collection {
	return db.Client.Database(os.Getenv("MONGO_DB")).Collection("NotificationOutbox")
}

func NewNotificationRepository(db *config.DB) NotificationRepository {
	return &notificationRepository{connection: db}
}

func (db *notificationRepository) Enqueue(entry model.NotificationOutbox) (*model.NotificationOutbox, error) {
	collection := notificationCollection(db.connection)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	now := time.Now()
	entry.Id = primitive.NewObjectID()
	entry.Status = "pending"
	entry.Attempts = 0
	entry.NextAttemptAt = now
	entry.CreatedAt = now
	entry.UpdatedAt = now

	_, err := collection.InsertOne(ctx, entry)
	if err != nil {
		return nil, err
	}

	return &entry, nil
}

func (db *notificationRepository) ListPending(limit int64) ([]*model.NotificationOutbox, error) {
	collection := notificationCollection(db.connection)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if limit <= 0 {
		limit = 50
	}

	filter := bson.M{
		"status":        "pending",
		"nextAttemptAt": bson.M{"$lte": time.Now()},
	}

	opts := options.Find().
		SetLimit(limit).
		SetSort(bson.D{{Key: "nextAttemptAt", Value: 1}})

	cursor, err := collection.Find(ctx, filter, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var entries []*model.NotificationOutbox
	err = cursor.All(ctx, &entries)
	return entries, err
}

// Claim atomically acquires a short-lived lease on a pending entry, the same
// compare-and-swap pattern as MonitorRepository.ClaimMonitor: any number of
// NotificationWorker replicas can share the outbox without coordinating with
// each other directly.
func (db *notificationRepository) Claim(id primitive.ObjectID, workerID string, leaseDuration time.Duration) (bool, error) {
	collection := notificationCollection(db.connection)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	now := time.Now()

	filter := bson.M{
		"_id":    id,
		"status": "pending",
		"$or": bson.A{
			bson.M{"lockedUntil": bson.M{"$exists": false}},
			bson.M{"lockedUntil": nil},
			bson.M{"lockedUntil": bson.M{"$lt": now}},
		},
	}

	update := bson.M{
		"$set": bson.M{
			"lockedBy":    workerID,
			"lockedUntil": now.Add(leaseDuration),
		},
	}

	result, err := collection.UpdateOne(ctx, filter, update)
	if err != nil {
		return false, err
	}

	return result.ModifiedCount == 1, nil
}

func (db *notificationRepository) MarkDelivered(id primitive.ObjectID) error {
	collection := notificationCollection(db.connection)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	now := time.Now()

	_, err := collection.UpdateByID(ctx, id, bson.M{
		"$set": bson.M{
			"status":      "delivered",
			"deliveredAt": now,
			"updatedAt":   now,
			"lockedBy":    nil,
			"lockedUntil": nil,
		},
	})
	return err
}

func (db *notificationRepository) MarkFailed(id primitive.ObjectID, lastErr string, nextAttemptAt time.Time, giveUp bool) error {
	collection := notificationCollection(db.connection)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	status := "pending"
	if giveUp {
		status = "failed"
	}

	_, err := collection.UpdateByID(ctx, id, bson.M{
		"$set": bson.M{
			"status":        status,
			"lastError":     lastErr,
			"nextAttemptAt": nextAttemptAt,
			"updatedAt":     time.Now(),
			"lockedBy":      nil,
			"lockedUntil":   nil,
		},
		"$inc": bson.M{"attempts": 1},
	})
	return err
}
