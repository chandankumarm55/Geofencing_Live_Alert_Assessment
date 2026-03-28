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

func ConfigureAlert(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	w.Header().Set("Content-Type", "application/json")

	var req struct {
		GeofenceID string `json:"geofence_id"`
		VehicleID  string `json:"vehicle_id"`
		EventType  string `json:"event_type"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body", start)
		return
	}
	if req.GeofenceID == "" {
		respondError(w, http.StatusBadRequest, "geofence_id is required", start)
		return
	}
	if req.EventType != "entry" && req.EventType != "exit" && req.EventType != "both" {
		respondError(w, http.StatusBadRequest, "event_type must be one of: entry, exit, both", start)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	gfCount, _ := config.DB.Collection("geofences").CountDocuments(ctx, bson.M{"_id": req.GeofenceID})
	if gfCount == 0 {
		respondError(w, http.StatusNotFound, "Geofence not found", start)
		return
	}

	if req.VehicleID != "" {
		vCount, _ := config.DB.Collection("vehicles").CountDocuments(ctx, bson.M{"_id": req.VehicleID})
		if vCount == 0 {
			respondError(w, http.StatusNotFound, "Vehicle not found", start)
			return
		}
	}

	alert := models.AlertConfig{
		ID:         services.GenerateID("alert"),
		GeofenceID: req.GeofenceID,
		VehicleID:  req.VehicleID,
		EventType:  req.EventType,
		Status:     "active",
		CreatedAt:  time.Now(),
	}
	if _, err := config.DB.Collection("alert_configs").InsertOne(ctx, alert); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to create alert", start)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"alert_id":    alert.ID,
		"geofence_id": alert.GeofenceID,
		"vehicle_id":  alert.VehicleID,
		"event_type":  alert.EventType,
		"status":      alert.Status,
		"time_ns":     fmt.Sprintf("%d", time.Since(start).Nanoseconds()),
	})
}

func GetAlerts(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	w.Header().Set("Content-Type", "application/json")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	filter := bson.M{}
	if gfID := r.URL.Query().Get("geofence_id"); gfID != "" {
		filter["geofence_id"] = gfID
	}
	if vID := r.URL.Query().Get("vehicle_id"); vID != "" {
		filter["vehicle_id"] = vID
	}

	cursor, err := config.DB.Collection("alert_configs").Find(ctx, filter)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to fetch alerts", start)
		return
	}
	defer cursor.Close(ctx)

	var alertConfigs []models.AlertConfig
	cursor.All(ctx, &alertConfigs)

	// Enrich with geofence name and vehicle number
	type AlertResponse struct {
		AlertID       string    `json:"alert_id"`
		GeofenceID    string    `json:"geofence_id"`
		GeofenceName  string    `json:"geofence_name"`
		VehicleID     string    `json:"vehicle_id"`
		VehicleNumber string    `json:"vehicle_number"`
		EventType     string    `json:"event_type"`
		Status        string    `json:"status"`
		CreatedAt     time.Time `json:"created_at"`
	}

	var results []AlertResponse
	for _, ac := range alertConfigs {
		ar := AlertResponse{
			AlertID:    ac.ID,
			GeofenceID: ac.GeofenceID,
			VehicleID:  ac.VehicleID,
			EventType:  ac.EventType,
			Status:     ac.Status,
			CreatedAt:  ac.CreatedAt,
		}
		var gf models.Geofence
		if err := config.DB.Collection("geofences").FindOne(ctx, bson.M{"_id": ac.GeofenceID}).Decode(&gf); err == nil {
			ar.GeofenceName = gf.Name
		}
		if ac.VehicleID != "" {
			var v models.Vehicle
			if err := config.DB.Collection("vehicles").FindOne(ctx, bson.M{"_id": ac.VehicleID}).Decode(&v); err == nil {
				ar.VehicleNumber = v.VehicleNumber
			}
		}
		results = append(results, ar)
	}
	if results == nil {
		results = []AlertResponse{}
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"alerts":  results,
		"time_ns": fmt.Sprintf("%d", time.Since(start).Nanoseconds()),
	})
}

func DeleteAlert(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	w.Header().Set("Content-Type", "application/json")

	id := mux.Vars(r)["id"]
	if id == "" {
		respondError(w, http.StatusBadRequest, "alert id is required", start)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	result, err := config.DB.Collection("alert_configs").DeleteOne(ctx, bson.M{"_id": id})
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to delete alert", start)
		return
	}
	if result.DeletedCount == 0 {
		respondError(w, http.StatusNotFound, "Alert not found", start)
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"deleted": true,
		"id":      id,
		"time_ns": fmt.Sprintf("%d", time.Since(start).Nanoseconds()),
	})
}
