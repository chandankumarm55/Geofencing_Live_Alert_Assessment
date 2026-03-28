package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"geofencing-backend/config"
	"geofencing-backend/models"
	"geofencing-backend/services"
	"net/http"
	"time"

	"github.com/gorilla/mux"
	"go.mongodb.org/mongo-driver/bson"
)

func respondError(w http.ResponseWriter, code int, message string, start time.Time) {
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"error":   message,
		"time_ns": fmt.Sprintf("%d", time.Since(start).Nanoseconds()),
	})
}

func CreateGeofence(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	w.Header().Set("Content-Type", "application/json")

	var req struct {
		Name        string      `json:"name"`
		Description string      `json:"description"`
		Coordinates [][]float64 `json:"coordinates"`
		Category    string      `json:"category"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body", start)
		return
	}

	if req.Name == "" {
		respondError(w, http.StatusBadRequest, "name is required", start)
		return
	}

	validCategories := map[string]bool{
		"delivery_zone": true, "restricted_zone": true, "toll_zone": true, "customer_area": true,
	}
	if !validCategories[req.Category] {
		respondError(w, http.StatusBadRequest, "category must be one of: delivery_zone, restricted_zone, toll_zone, customer_area", start)
		return
	}

	if len(req.Coordinates) < 4 {
		respondError(w, http.StatusBadRequest, "coordinates must have at least 4 points", start)
		return
	}

	first := req.Coordinates[0]
	last := req.Coordinates[len(req.Coordinates)-1]
	if first[0] != last[0] || first[1] != last[1] {
		respondError(w, http.StatusBadRequest, "first and last coordinates must be identical (closed polygon)", start)
		return
	}

	for _, coord := range req.Coordinates {
		if len(coord) != 2 {
			respondError(w, http.StatusBadRequest, "each coordinate must be [latitude, longitude]", start)
			return
		}
		if coord[0] < -90 || coord[0] > 90 {
			respondError(w, http.StatusBadRequest, "latitude must be between -90 and 90", start)
			return
		}
		if coord[1] < -180 || coord[1] > 180 {
			respondError(w, http.StatusBadRequest, "longitude must be between -180 and 180", start)
			return
		}
	}

	geofence := models.Geofence{
		ID:          services.GenerateID("geo"),
		Name:        req.Name,
		Description: req.Description,
		Coordinates: req.Coordinates,
		Category:    req.Category,
		Status:      "active",
		CreatedAt:   time.Now(),
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if _, err := config.DB.Collection("geofences").InsertOne(ctx, geofence); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to create geofence", start)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"id":      geofence.ID,
		"name":    geofence.Name,
		"status":  geofence.Status,
		"time_ns": fmt.Sprintf("%d", time.Since(start).Nanoseconds()),
	})
}

func GetGeofences(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	w.Header().Set("Content-Type", "application/json")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	filter := bson.M{}
	if cat := r.URL.Query().Get("category"); cat != "" {
		filter["category"] = cat
	}

	cursor, err := config.DB.Collection("geofences").Find(ctx, filter)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to fetch geofences", start)
		return
	}
	defer cursor.Close(ctx)

	var geofences []models.Geofence
	if err = cursor.All(ctx, &geofences); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to parse geofences", start)
		return
	}
	if geofences == nil {
		geofences = []models.Geofence{}
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"geofences": geofences,
		"time_ns":   fmt.Sprintf("%d", time.Since(start).Nanoseconds()),
	})
}

func DeleteGeofence(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	w.Header().Set("Content-Type", "application/json")

	id := mux.Vars(r)["id"]
	if id == "" {
		respondError(w, http.StatusBadRequest, "geofence id is required", start)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	result, err := config.DB.Collection("geofences").DeleteOne(ctx, bson.M{"_id": id})
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to delete geofence", start)
		return
	}
	if result.DeletedCount == 0 {
		respondError(w, http.StatusNotFound, "Geofence not found", start)
		return
	}

	// Cascade: remove alert_configs and vehicle_geofences referencing this geofence
	config.DB.Collection("alert_configs").DeleteMany(ctx, bson.M{"geofence_id": id})
	config.DB.Collection("vehicle_geofences").DeleteMany(ctx, bson.M{"geofence_id": id})

	json.NewEncoder(w).Encode(map[string]interface{}{
		"deleted": true,
		"id":      id,
		"time_ns": fmt.Sprintf("%d", time.Since(start).Nanoseconds()),
	})
}
