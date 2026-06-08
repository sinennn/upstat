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

type IncidentRepository interface {
	GetActiveIncidentForMonitor(monitorID primitive.ObjectID) (*models.Incident, error)
	ResolveActiveIncidents(monitorID primitive.ObjectID) error
	ListActiveIncidents() ([]*models.Incident, error)
	ListIncidentsByMonitor(monitorID string, limit int64) ([]*models.Incident, error)
}

type incidentRepository struct {
	connection *config.DB
}

func incidentCollection(db *config.DB) *mongo.Collection {
	return db.Client.Database(os.Getenv("MONGO_DB")).Collection("Incident")
}

func NewIncidentRepository(db *config.DB) IncidentRepository {
	return &incidentRepository{connection: db}
}


func (db *incidentRepository) ListIncidentsByMonitor(monitorID string, limit int64)([]*models.Incident, error){
	collection := incidentCollection(db.connection)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	listByMonitor := bson.M{"monitorId":monitorID}

	findOptions := options.Find().SetLimit(limit)

	cursor, err := collection.Find(ctx, listByMonitor, findOptions)
	if err != nil{
		return nil, err
	}

	defer cursor.Close(ctx)

	var incidents []*models.Incident
	err = cursor.All(ctx, &incidents)
	return incidents, err

}



func (db *incidentRepository) ListActiveIncidents()([]*models.Incident, error){
	collection := incidentCollection(db.connection)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

    active:= bson.M{"status":"active"}

	cursor, err := collection.Find(ctx, active)
	if err != nil{
		return nil, err
	}

	defer cursor.Close(ctx)

    var activeIncidents []*models.Incident
    err = cursor.All(ctx, &activeIncidents)
	return activeIncidents, err
}

func (db *incidentRepository) GetActiveIncidentForMonitor(monitorID primitive.ObjectID) (*models.Incident, error) {
	collection := incidentCollection(db.connection)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var incident models.Incident
	err := collection.FindOne(ctx, bson.M{
		"monitorId": monitorID,
		"status":    "active",
	}).Decode(&incident)

	if err == mongo.ErrNoDocuments {
		return nil, nil
	}

	if err != nil {
		return nil, err
	}

	return &incident, nil
}

func (db *incidentRepository) ResolveActiveIncidents(monitorID primitive.ObjectID) error {
	collection := incidentCollection(db.connection)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	now := time.Now()

	var incident models.Incident
	err := collection.FindOne(ctx, bson.M{
		"monitorId": monitorID,
		"status":    "active",
	}).Decode(&incident)

	if err == mongo.ErrNoDocuments {
		return nil
	}

	if err != nil {
		return err
	}

	duration := int64(now.Sub(incident.StartedAt).Seconds())

	_, err = collection.UpdateByID(ctx, incident.Id, bson.M{
       "$set": bson.M{
		"status": "resolved",
		"resolvedAt": now,
		"durationSeconds": duration,
		"updatedAt": now,
	   },
	})
  
   return err

}
