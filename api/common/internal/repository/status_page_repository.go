package repository

import (
	"context"
	"os"
	"time"

	"github.com/cuesoftinc/upstat/api/common/internal/config"
	"github.com/cuesoftinc/upstat/api/common/internal/model"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

// StatusPageRepository resolves a public StatusPage document by its slug so
// the public endpoint can serve /status/{slug} without leaking owner ids.
type StatusPageRepository interface {
	GetBySlug(slug string) (*model.StatusPage, error)
}

type statusPageRepository struct {
	connection *config.DB
}

func statusPageCollection(db *config.DB) *mongo.Collection {
	return db.Client.Database(os.Getenv("MONGO_DB")).Collection("StatusPage")
}

func NewStatusPageRepository(db *config.DB) StatusPageRepository {
	return &statusPageRepository{connection: db}
}

func (db *statusPageRepository) GetBySlug(slug string) (*model.StatusPage, error) {
	collection := statusPageCollection(db.connection)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var page model.StatusPage
	err := collection.FindOne(ctx, bson.M{"slug": slug}).Decode(&page)
	if err != nil {
		return nil, err
	}

	return &page, nil
}
