package config

import (
	"context"
	"log"
	"os"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var DB *mongo.Database
var Client *mongo.Client

func ConnectMongoDB() {
	mongoURI := os.Getenv("MONGODB_URI")
	if mongoURI == "" {
		mongoURI = "mongodb://localhost:27017"
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var err error
	Client, err = mongo.Connect(ctx, options.Client().ApplyURI(mongoURI))
	if err != nil {
		log.Fatalf("Failed to connect to MongoDB: %v", err)
	}

	if err = Client.Ping(ctx, nil); err != nil {
		log.Fatalf("Failed to ping MongoDB: %v", err)
	}

	dbName := os.Getenv("DB_NAME")
	if dbName == "" {
		dbName = "geofencing_db"
	}

	DB = Client.Database(dbName)
	log.Println("✅ Connected to MongoDB successfully")
	createIndexes()
}

func createIndexes() {
	ctx := context.Background()

	DB.Collection("vehicle_geofences").Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys: bson.D{{Key: "vehicle_id", Value: 1}, {Key: "geofence_id", Value: 1}},
	})

	DB.Collection("violations").Indexes().CreateMany(ctx, []mongo.IndexModel{
		{Keys: bson.D{{Key: "vehicle_id", Value: 1}}},
		{Keys: bson.D{{Key: "geofence_id", Value: 1}}},
		{Keys: bson.D{{Key: "timestamp", Value: -1}}},
	})

	DB.Collection("alert_configs").Indexes().CreateMany(ctx, []mongo.IndexModel{
		{Keys: bson.D{{Key: "geofence_id", Value: 1}}},
		{Keys: bson.D{{Key: "vehicle_id", Value: 1}}},
	})

	DB.Collection("location_history").Indexes().CreateMany(ctx, []mongo.IndexModel{
		{Keys: bson.D{{Key: "vehicle_id", Value: 1}}},
		{Keys: bson.D{{Key: "timestamp", Value: -1}}},
	})

	log.Println("Database indexes created")
}
