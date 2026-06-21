package config

import (
	"context"
	"log"
	"os"
	"time"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type DB struct {
	Client *mongo.Client
}

func NewDBHandler() *DB {
	LoadEnv()
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	client, err := mongo.Connect(ctx, options.Client().ApplyURI(os.Getenv("MONGO_URI")))
	if err != nil {
		log.Println(err)
	}

	err = client.Ping(ctx, nil)
	if err != nil {
		log.Fatalln(err)
	}
	log.Println("Connected to MongoDB")

	return &DB{Client: client}
}
