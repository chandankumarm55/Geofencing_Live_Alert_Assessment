package main

import (
	"geofencing-backend/config"
	"geofencing-backend/handlers"
	ws "geofencing-backend/websocket"
	"log"
	"net/http"
	"os"

	"github.com/gorilla/mux"
	"github.com/rs/cors"
)

func main() {
	// Load environment (Docker sets these; locally read from .env if needed)
	config.ConnectMongoDB()

	hub := ws.NewHub()
	go hub.Run()

	vh := &handlers.VehicleHandler{Hub: hub}

	r := mux.NewRouter()

	// Geofence routes
	r.HandleFunc("/geofences", handlers.CreateGeofence).Methods("POST")
	r.HandleFunc("/geofences", handlers.GetGeofences).Methods("GET")
	r.HandleFunc("/geofences/{id}", handlers.DeleteGeofence).Methods("DELETE")

	// Vehicle routes
	r.HandleFunc("/vehicles", vh.CreateVehicle).Methods("POST")
	r.HandleFunc("/vehicles", handlers.GetVehicles).Methods("GET")
	r.HandleFunc("/vehicles/{id}", handlers.DeleteVehicle).Methods("DELETE")
	r.HandleFunc("/vehicles/location", vh.UpdateLocation).Methods("POST")
	r.HandleFunc("/vehicles/location/{vehicle_id}", handlers.GetVehicleLocation).Methods("GET")

	// Alert routes
	r.HandleFunc("/alerts/configure", handlers.ConfigureAlert).Methods("POST")
	r.HandleFunc("/alerts", handlers.GetAlerts).Methods("GET")
	r.HandleFunc("/alerts/{id}", handlers.DeleteAlert).Methods("DELETE")

	// Violations
	r.HandleFunc("/violations/history", handlers.GetViolationsHistory).Methods("GET")

	// WebSocket
	r.HandleFunc("/ws/alerts", hub.ServeWS)

	// Health check
	r.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok"}`))
	}).Methods("GET")

	// CORS middleware
	c := cors.New(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"*"},
		AllowCredentials: false,
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Server starting on port %s", port)
	log.Fatal(http.ListenAndServe(":"+port, c.Handler(r)))
}
