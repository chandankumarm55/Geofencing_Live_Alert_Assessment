package models

import "time"

type Geofence struct {
	ID          string      `bson:"_id" json:"id"`
	Name        string      `bson:"name" json:"name"`
	Description string      `bson:"description" json:"description"`
	Coordinates [][]float64 `bson:"coordinates" json:"coordinates"`
	Category    string      `bson:"category" json:"category"`
	Status      string      `bson:"status" json:"status"`
	CreatedAt   time.Time   `bson:"created_at" json:"created_at"`
}

type Vehicle struct {
	ID              string         `bson:"_id" json:"id"`
	VehicleNumber   string         `bson:"vehicle_number" json:"vehicle_number"`
	DriverName      string         `bson:"driver_name" json:"driver_name"`
	VehicleType     string         `bson:"vehicle_type" json:"vehicle_type"`
	Phone           string         `bson:"phone" json:"phone"`
	Status          string         `bson:"status" json:"status"`
	CreatedAt       time.Time      `bson:"created_at" json:"created_at"`
	CurrentLocation *LocationPoint `bson:"current_location,omitempty" json:"current_location,omitempty"`
}

type LocationPoint struct {
	Latitude  float64   `bson:"latitude" json:"latitude"`
	Longitude float64   `bson:"longitude" json:"longitude"`
	Timestamp time.Time `bson:"timestamp" json:"timestamp"`
}

type LocationHistory struct {
	ID        string    `bson:"_id" json:"id"`
	VehicleID string    `bson:"vehicle_id" json:"vehicle_id"`
	Latitude  float64   `bson:"latitude" json:"latitude"`
	Longitude float64   `bson:"longitude" json:"longitude"`
	Timestamp time.Time `bson:"timestamp" json:"timestamp"`
}

type VehicleGeofence struct {
	VehicleID  string `bson:"vehicle_id"`
	GeofenceID string `bson:"geofence_id"`
}

type AlertConfig struct {
	ID         string    `bson:"_id" json:"alert_id"`
	GeofenceID string    `bson:"geofence_id" json:"geofence_id"`
	VehicleID  string    `bson:"vehicle_id" json:"vehicle_id"`
	EventType  string    `bson:"event_type" json:"event_type"`
	Status     string    `bson:"status" json:"status"`
	CreatedAt  time.Time `bson:"created_at" json:"created_at"`
}

type Violation struct {
	ID            string    `bson:"_id" json:"id"`
	VehicleID     string    `bson:"vehicle_id" json:"vehicle_id"`
	VehicleNumber string    `bson:"vehicle_number" json:"vehicle_number"`
	GeofenceID    string    `bson:"geofence_id" json:"geofence_id"`
	GeofenceName  string    `bson:"geofence_name" json:"geofence_name"`
	EventType     string    `bson:"event_type" json:"event_type"`
	Latitude      float64   `bson:"latitude" json:"latitude"`
	Longitude     float64   `bson:"longitude" json:"longitude"`
	Timestamp     time.Time `bson:"timestamp" json:"timestamp"`
}

type WSAlert struct {
	EventID   string     `json:"event_id"`
	EventType string     `json:"event_type"`
	Timestamp time.Time  `json:"timestamp"`
	Vehicle   WSVehicle  `json:"vehicle"`
	Geofence  WSGeofence `json:"geofence"`
	Location  WSLocation `json:"location"`
}

type WSVehicle struct {
	VehicleID     string `json:"vehicle_id"`
	VehicleNumber string `json:"vehicle_number"`
	DriverName    string `json:"driver_name"`
}

type WSGeofence struct {
	GeofenceID   string `json:"geofence_id"`
	GeofenceName string `json:"geofence_name"`
	Category     string `json:"category"`
}

type WSLocation struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
}
