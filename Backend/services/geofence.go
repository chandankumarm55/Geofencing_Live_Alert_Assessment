package services

import (
	"context"
	"fmt"
	"geofencing-backend/config"
	"geofencing-backend/models"
	"log"
	"math/rand"
	"time"

	"go.mongodb.org/mongo-driver/bson"
)

// GenerateID creates prefixed random IDs like "geo_abc12345"
func GenerateID(prefix string) string {
	const chars = "abcdefghijklmnopqrstuvwxyz0123456789"
	src := rand.NewSource(time.Now().UnixNano())
	r := rand.New(src)
	b := make([]byte, 8)
	for i := range b {
		b[i] = chars[r.Intn(len(chars))]
	}
	return fmt.Sprintf("%s_%s", prefix, string(b))
}

// IsPointInPolygon uses ray-casting algorithm
func IsPointInPolygon(lat, lng float64, polygon [][]float64) bool {
	n := len(polygon)
	if n < 3 {
		return false
	}
	inside := false
	j := n - 1
	for i := 0; i < n; i++ {
		iLat, iLng := polygon[i][0], polygon[i][1]
		jLat, jLng := polygon[j][0], polygon[j][1]
		if ((iLng > lng) != (jLng > lng)) &&
			(lat < (jLat-iLat)*(lng-iLng)/(jLng-iLng)+iLat) {
			inside = !inside
		}
		j = i
	}
	return inside
}

// AlertHub interface for WebSocket broadcasting
type AlertHub interface {
	Broadcast(alert models.WSAlert)
}

// GeofenceEvent represents an entry or exit event
type GeofenceEvent struct {
	GeofenceID   string
	GeofenceName string
	Category     string
	EventType    string // "entry" or "exit"
}

// DetectGeofenceEvents checks which geofences changed and returns events + current geofences
func DetectGeofenceEvents(ctx context.Context, vehicleID string, lat, lng float64) ([]GeofenceEvent, []models.Geofence, error) {
	// Get all active geofences
	geofencesCol := config.DB.Collection("geofences")
	cursor, err := geofencesCol.Find(ctx, bson.M{"status": "active"})
	if err != nil {
		return nil, nil, err
	}
	defer cursor.Close(ctx)

	var allGeofences []models.Geofence
	if err = cursor.All(ctx, &allGeofences); err != nil {
		return nil, nil, err
	}

	// Find current geofences for this point
	currentGeofenceIDs := make(map[string]bool)
	var currentGeofences []models.Geofence
	for _, gf := range allGeofences {
		if IsPointInPolygon(lat, lng, gf.Coordinates) {
			currentGeofenceIDs[gf.ID] = true
			currentGeofences = append(currentGeofences, gf)
		}
	}

	// Get previous geofences
	vgCol := config.DB.Collection("vehicle_geofences")
	prevCursor, err := vgCol.Find(ctx, bson.M{"vehicle_id": vehicleID})
	if err != nil {
		return nil, currentGeofences, err
	}
	defer prevCursor.Close(ctx)

	var prevVehicleGeofences []models.VehicleGeofence
	prevCursor.All(ctx, &prevVehicleGeofences)

	prevGeofenceIDs := make(map[string]bool)
	for _, vg := range prevVehicleGeofences {
		prevGeofenceIDs[vg.GeofenceID] = true
	}

	// Build geofence lookup map
	geofenceLookup := make(map[string]models.Geofence)
	for _, gf := range allGeofences {
		geofenceLookup[gf.ID] = gf
	}

	// Detect events
	var events []GeofenceEvent

	// Entry events: in current but not in previous
	for gfID := range currentGeofenceIDs {
		if !prevGeofenceIDs[gfID] {
			if gf, ok := geofenceLookup[gfID]; ok {
				events = append(events, GeofenceEvent{
					GeofenceID:   gfID,
					GeofenceName: gf.Name,
					Category:     gf.Category,
					EventType:    "entry",
				})
			}
		}
	}

	// Exit events: in previous but not in current
	for gfID := range prevGeofenceIDs {
		if !currentGeofenceIDs[gfID] {
			if gf, ok := geofenceLookup[gfID]; ok {
				events = append(events, GeofenceEvent{
					GeofenceID:   gfID,
					GeofenceName: gf.Name,
					Category:     gf.Category,
					EventType:    "exit",
				})
			}
		}
	}

	// Update vehicle_geofences: delete old, insert new
	if _, err = vgCol.DeleteMany(ctx, bson.M{"vehicle_id": vehicleID}); err != nil {
		log.Printf("Error clearing vehicle geofences: %v", err)
	}

	if len(currentGeofenceIDs) > 0 {
		var docs []interface{}
		for gfID := range currentGeofenceIDs {
			docs = append(docs, models.VehicleGeofence{
				VehicleID:  vehicleID,
				GeofenceID: gfID,
			})
		}
		if _, err = vgCol.InsertMany(ctx, docs); err != nil {
			log.Printf("Error inserting vehicle geofences: %v", err)
		}
	}

	return events, currentGeofences, nil
}

// CheckAndTriggerAlerts finds matching alert configs and broadcasts WebSocket alerts
func CheckAndTriggerAlerts(ctx context.Context, vehicleID string, vehicle models.Vehicle, events []GeofenceEvent, lat, lng float64, hub AlertHub) {
	alertConfigsCol := config.DB.Collection("alert_configs")
	violationsCol := config.DB.Collection("violations")

	for _, event := range events {
		filter := bson.M{
			"geofence_id": event.GeofenceID,
			"status":      "active",
			"$or": bson.A{
				bson.M{"event_type": event.EventType},
				bson.M{"event_type": "both"},
			},
		}

		cursor, err := alertConfigsCol.Find(ctx, filter)
		if err != nil {
			log.Printf("Error finding alert configs: %v", err)
			continue
		}

		var alertConfigs []models.AlertConfig
		cursor.All(ctx, &alertConfigs)
		cursor.Close(ctx)

		triggered := false
		for _, ac := range alertConfigs {
			if ac.VehicleID != "" && ac.VehicleID != vehicleID {
				continue
			}
			triggered = true
			break
		}

		if !triggered && len(alertConfigs) == 0 {
			continue
		}

		// Record violation
		violation := models.Violation{
			ID:            GenerateID("viol"),
			VehicleID:     vehicleID,
			VehicleNumber: vehicle.VehicleNumber,
			GeofenceID:    event.GeofenceID,
			GeofenceName:  event.GeofenceName,
			EventType:     event.EventType,
			Latitude:      lat,
			Longitude:     lng,
			Timestamp:     time.Now(),
		}
		violationsCol.InsertOne(ctx, violation)

		// Broadcast WebSocket alert
		wsAlert := models.WSAlert{
			EventID:   GenerateID("evt"),
			EventType: event.EventType,
			Timestamp: violation.Timestamp,
			Vehicle: models.WSVehicle{
				VehicleID:     vehicleID,
				VehicleNumber: vehicle.VehicleNumber,
				DriverName:    vehicle.DriverName,
			},
			Geofence: models.WSGeofence{
				GeofenceID:   event.GeofenceID,
				GeofenceName: event.GeofenceName,
				Category:     event.Category,
			},
			Location: models.WSLocation{
				Latitude:  lat,
				Longitude: lng,
			},
		}
		hub.Broadcast(wsAlert)
	}
}
