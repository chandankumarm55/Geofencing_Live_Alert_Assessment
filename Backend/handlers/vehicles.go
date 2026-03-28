package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"geofencing-backend/config"
	"geofencing-backend/models"
	"geofencing-backend/services"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/mux"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

// VehicleHandler holds a reference to the WebSocket hub
type VehicleHandler struct {
	Hub services.AlertHub
}

// Per-vehicle rate limiter (max 10 req/s per vehicle)
var (
	rateLimiter = make(map[string]time.Time)
	rateMu      sync.Mutex
)

func (vh *VehicleHandler) CreateVehicle(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	w.Header().Set("Content-Type", "application/json")

	var req struct {
		VehicleNumber string `json:"vehicle_number"`
		DriverName    string `json:"driver_name"`
		VehicleType   string `json:"vehicle_type"`
		Phone         string `json:"phone"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body", start)
		return
	}
	if req.VehicleNumber == "" {
		respondError(w, http.StatusBadRequest, "vehicle_number is required", start)
		return
	}
	if req.DriverName == "" {
		respondError(w, http.StatusBadRequest, "driver_name is required", start)
		return
	}
	if req.VehicleType == "" {
		respondError(w, http.StatusBadRequest, "vehicle_type is required", start)
		return
	}
	if req.Phone == "" {
		respondError(w, http.StatusBadRequest, "phone is required", start)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	col := config.DB.Collection("vehicles")
	count, _ := col.CountDocuments(ctx, bson.M{"vehicle_number": req.VehicleNumber})
	if count > 0 {
		respondError(w, http.StatusConflict, "vehicle_number already exists", start)
		return
	}

	vehicle := models.Vehicle{
		ID:            services.GenerateID("veh"),
		VehicleNumber: req.VehicleNumber,
		DriverName:    req.DriverName,
		VehicleType:   req.VehicleType,
		Phone:         req.Phone,
		Status:        "active",
		CreatedAt:     time.Now(),
	}
	if _, err := col.InsertOne(ctx, vehicle); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to create vehicle", start)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"id":             vehicle.ID,
		"vehicle_number": vehicle.VehicleNumber,
		"status":         vehicle.Status,
		"time_ns":        fmt.Sprintf("%d", time.Since(start).Nanoseconds()),
	})
}

func GetVehicles(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	w.Header().Set("Content-Type", "application/json")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cursor, err := config.DB.Collection("vehicles").Find(ctx, bson.M{})
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to fetch vehicles", start)
		return
	}
	defer cursor.Close(ctx)

	var vehicles []models.Vehicle
	if err = cursor.All(ctx, &vehicles); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to parse vehicles", start)
		return
	}
	if vehicles == nil {
		vehicles = []models.Vehicle{}
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"vehicles": vehicles,
		"time_ns":  fmt.Sprintf("%d", time.Since(start).Nanoseconds()),
	})
}

func (vh *VehicleHandler) UpdateLocation(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	w.Header().Set("Content-Type", "application/json")

	var req struct {
		VehicleID string  `json:"vehicle_id"`
		Latitude  float64 `json:"latitude"`
		Longitude float64 `json:"longitude"`
		Timestamp string  `json:"timestamp"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body", start)
		return
	}
	if req.VehicleID == "" {
		respondError(w, http.StatusBadRequest, "vehicle_id is required", start)
		return
	}
	if req.Latitude < -90 || req.Latitude > 90 {
		respondError(w, http.StatusBadRequest, "latitude must be between -90 and 90", start)
		return
	}
	if req.Longitude < -180 || req.Longitude > 180 {
		respondError(w, http.StatusBadRequest, "longitude must be between -180 and 180", start)
		return
	}

	// Rate limiting: max 10 req/s per vehicle (100ms window)
	rateMu.Lock()
	if last, ok := rateLimiter[req.VehicleID]; ok && time.Since(last) < 100*time.Millisecond {
		rateMu.Unlock()
		respondError(w, http.StatusTooManyRequests, "Rate limit exceeded. Wait 100ms before next update.", start)
		return
	}
	rateLimiter[req.VehicleID] = time.Now()
	rateMu.Unlock()

	ts := time.Now()
	if req.Timestamp != "" {
		if t, err := time.Parse(time.RFC3339, req.Timestamp); err == nil {
			ts = t
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	vehiclesCol := config.DB.Collection("vehicles")
	var vehicle models.Vehicle
	if err := vehiclesCol.FindOne(ctx, bson.M{"_id": req.VehicleID}).Decode(&vehicle); err == mongo.ErrNoDocuments {
		respondError(w, http.StatusNotFound, "Vehicle not found", start)
		return
	} else if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to find vehicle", start)
		return
	}

	// Update current_location
	locPoint := models.LocationPoint{Latitude: req.Latitude, Longitude: req.Longitude, Timestamp: ts}
	vehiclesCol.UpdateOne(ctx, bson.M{"_id": req.VehicleID}, bson.M{"$set": bson.M{"current_location": locPoint}})

	// Store in history
	config.DB.Collection("location_history").InsertOne(ctx, models.LocationHistory{
		ID:        services.GenerateID("loc"),
		VehicleID: req.VehicleID,
		Latitude:  req.Latitude,
		Longitude: req.Longitude,
		Timestamp: ts,
	})

	// Detect geofence events
	events, currentGeofences, _ := services.DetectGeofenceEvents(ctx, req.VehicleID, req.Latitude, req.Longitude)

	// Async alert triggering
	if len(events) > 0 && vh.Hub != nil {
		go services.CheckAndTriggerAlerts(context.Background(), req.VehicleID, vehicle, events, req.Latitude, req.Longitude, vh.Hub)
	}

	type GFInfo struct {
		GeofenceID   string `json:"geofence_id"`
		GeofenceName string `json:"geofence_name"`
		Status       string `json:"status"`
	}
	var gfResp []GFInfo
	for _, gf := range currentGeofences {
		gfResp = append(gfResp, GFInfo{GeofenceID: gf.ID, GeofenceName: gf.Name, Status: "inside"})
	}
	if gfResp == nil {
		gfResp = []GFInfo{}
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"vehicle_id":        req.VehicleID,
		"location_updated":  true,
		"current_geofences": gfResp,
		"time_ns":           fmt.Sprintf("%d", time.Since(start).Nanoseconds()),
	})
}

func GetVehicleLocation(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	w.Header().Set("Content-Type", "application/json")

	vehicleID := mux.Vars(r)["vehicle_id"]
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var vehicle models.Vehicle
	if err := config.DB.Collection("vehicles").FindOne(ctx, bson.M{"_id": vehicleID}).Decode(&vehicle); err == mongo.ErrNoDocuments {
		respondError(w, http.StatusNotFound, "Vehicle not found", start)
		return
	} else if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to find vehicle", start)
		return
	}

	cursor, _ := config.DB.Collection("vehicle_geofences").Find(ctx, bson.M{"vehicle_id": vehicleID})
	defer cursor.Close(ctx)
	var vehicleGeofences []models.VehicleGeofence
	cursor.All(ctx, &vehicleGeofences)

	type GFInfo struct {
		GeofenceID   string `json:"geofence_id"`
		GeofenceName string `json:"geofence_name"`
		Category     string `json:"category"`
	}
	var gfInfos []GFInfo
	for _, vg := range vehicleGeofences {
		var gf models.Geofence
		if err := config.DB.Collection("geofences").FindOne(ctx, bson.M{"_id": vg.GeofenceID}).Decode(&gf); err == nil {
			gfInfos = append(gfInfos, GFInfo{GeofenceID: gf.ID, GeofenceName: gf.Name, Category: gf.Category})
		}
	}
	if gfInfos == nil {
		gfInfos = []GFInfo{}
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"vehicle_id":        vehicle.ID,
		"vehicle_number":    vehicle.VehicleNumber,
		"current_location":  vehicle.CurrentLocation,
		"current_geofences": gfInfos,
		"time_ns":           fmt.Sprintf("%d", time.Since(start).Nanoseconds()),
	})
}

func DeleteVehicle(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	w.Header().Set("Content-Type", "application/json")

	id := mux.Vars(r)["id"]
	if id == "" {
		respondError(w, http.StatusBadRequest, "vehicle id is required", start)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	result, err := config.DB.Collection("vehicles").DeleteOne(ctx, bson.M{"_id": id})
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to delete vehicle", start)
		return
	}
	if result.DeletedCount == 0 {
		respondError(w, http.StatusNotFound, "Vehicle not found", start)
		return
	}

	// Cascade: remove related records
	config.DB.Collection("alert_configs").DeleteMany(ctx, bson.M{"vehicle_id": id})
	config.DB.Collection("vehicle_geofences").DeleteMany(ctx, bson.M{"vehicle_id": id})
	config.DB.Collection("location_history").DeleteMany(ctx, bson.M{"vehicle_id": id})

	json.NewEncoder(w).Encode(map[string]interface{}{
		"deleted": true,
		"id":      id,
		"time_ns": fmt.Sprintf("%d", time.Since(start).Nanoseconds()),
	})
}
