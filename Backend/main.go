package main

import (
	"context"
	"encoding/json"
	"fmt"
	"geofencing-backend/config"
	"geofencing-backend/handlers"
	ws "geofencing-backend/websocket"
	"log"
	"net/http"
	"os"
	"runtime"
	"time"

	"github.com/gorilla/mux"
	"github.com/rs/cors"
)

var startTime = time.Now()

func main() {
	config.ConnectMongoDB()

	hub := ws.NewHub()
	go hub.Run()

	vh := &handlers.VehicleHandler{Hub: hub}

	r := mux.NewRouter()

	// ─── Root / Health ───
	r.HandleFunc("/", rootHandler).Methods("GET")
	r.HandleFunc("/health", healthHandler).Methods("GET")

	// ─── Geofence routes ───
	r.HandleFunc("/geofences", handlers.CreateGeofence).Methods("POST")
	r.HandleFunc("/geofences", handlers.GetGeofences).Methods("GET")
	r.HandleFunc("/geofences/{id}", handlers.DeleteGeofence).Methods("DELETE")

	// ─── Vehicle routes ───
	r.HandleFunc("/vehicles", vh.CreateVehicle).Methods("POST")
	r.HandleFunc("/vehicles", handlers.GetVehicles).Methods("GET")
	r.HandleFunc("/vehicles/{id}", handlers.DeleteVehicle).Methods("DELETE")
	r.HandleFunc("/vehicles/location", vh.UpdateLocation).Methods("POST")
	r.HandleFunc("/vehicles/location/{vehicle_id}", handlers.GetVehicleLocation).Methods("GET")

	// ─── Alert routes ───
	r.HandleFunc("/alerts/configure", handlers.ConfigureAlert).Methods("POST")
	r.HandleFunc("/alerts", handlers.GetAlerts).Methods("GET")
	r.HandleFunc("/alerts/{id}", handlers.DeleteAlert).Methods("DELETE")

	// ─── Violations ───
	r.HandleFunc("/violations/history", handlers.GetViolationsHistory).Methods("GET")

	// ─── WebSocket ───
	r.HandleFunc("/ws/alerts", hub.ServeWS)

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

	log.Printf("🚀 GeoTrack API starting on port %s", port)
	log.Fatal(http.ListenAndServe(":"+port, c.Handler(r)))
}

// healthHandler returns a JSON health check
func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	mongoStatus := "connected"
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	if err := config.Client.Ping(ctx, nil); err != nil {
		mongoStatus = "disconnected"
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":   "ok",
		"service":  "GeoTrack API",
		"mongodb":  mongoStatus,
		"uptime":   time.Since(startTime).String(),
		"go":       runtime.Version(),
	})
}

// rootHandler shows a nice HTML landing page
func rootHandler(w http.ResponseWriter, r *http.Request) {
	mongoStatus := "✅ Connected"
	mongoClass := "ok"
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	if err := config.Client.Ping(ctx, nil); err != nil {
		mongoStatus = "❌ Disconnected"
		mongoClass = "err"
	}

	uptime := time.Since(startTime)
	hours := int(uptime.Hours())
	mins := int(uptime.Minutes()) % 60
	secs := int(uptime.Seconds()) % 60
	uptimeStr := fmt.Sprintf("%dh %dm %ds", hours, mins, secs)

	dbName := os.Getenv("DB_NAME")
	if dbName == "" {
		dbName = "geofencing_db"
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	fmt.Fprintf(w, `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>GeoTrack API</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Inter',sans-serif;background:#0f172a;color:#e2e8f0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:2rem}
.container{max-width:680px;width:100%%}
.header{text-align:center;margin-bottom:2.5rem}
.logo{width:64px;height:64px;border-radius:16px;background:linear-gradient(135deg,#3b82f6,#1d4ed8);display:flex;align-items:center;justify-content:center;margin:0 auto 1rem;box-shadow:0 8px 30px rgba(59,130,246,0.35);font-size:28px}
h1{font-size:2rem;font-weight:700;margin-bottom:0.25rem}
.subtitle{color:#64748b;font-size:0.95rem}
.card{background:#1e293b;border:1px solid #334155;border-radius:12px;padding:1.25rem;margin-bottom:1rem}
.card h2{font-size:0.85rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;margin-bottom:0.875rem}
.row{display:flex;justify-content:space-between;align-items:center;padding:0.5rem 0;border-bottom:1px solid #293548}
.row:last-child{border-bottom:none}
.label{color:#94a3b8;font-size:0.875rem}
.value{font-weight:600;font-size:0.875rem}
.ok{color:#4ade80}
.err{color:#f87171}
.badge{display:inline-block;padding:2px 10px;border-radius:999px;font-size:0.72rem;font-weight:700}
.badge-get{background:rgba(34,197,94,0.15);color:#4ade80}
.badge-post{background:rgba(59,130,246,0.15);color:#60a5fa}
.badge-del{background:rgba(239,68,68,0.15);color:#f87171}
.badge-ws{background:rgba(168,85,247,0.15);color:#c084fc}
.endpoints .row{gap:0.75rem}
.path{font-family:'Courier New',monospace;font-size:0.82rem;color:#e2e8f0;flex:1}
.footer{text-align:center;color:#475569;font-size:0.78rem;margin-top:1.5rem}
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <div class="logo">🌍</div>
    <h1>GeoTrack API</h1>
    <p class="subtitle">Geofencing & Vehicle Tracking System</p>
  </div>

  <div class="card">
    <h2>System Status</h2>
    <div class="row"><span class="label">API Server</span><span class="value ok">✅ Running</span></div>
    <div class="row"><span class="label">MongoDB</span><span class="value %s">%s</span></div>
    <div class="row"><span class="label">Database</span><span class="value" style="color:#60a5fa">%s</span></div>
    <div class="row"><span class="label">Uptime</span><span class="value" style="color:#fbbf24">%s</span></div>
    <div class="row"><span class="label">Go Version</span><span class="value" style="color:#94a3b8">%s</span></div>
    <div class="row"><span class="label">WebSocket</span><span class="value ok">✅ Active</span></div>
  </div>

  <div class="card endpoints">
    <h2>API Endpoints</h2>
    <div class="row"><span class="badge badge-get">GET</span><span class="path">/geofences</span></div>
    <div class="row"><span class="badge badge-post">POST</span><span class="path">/geofences</span></div>
    <div class="row"><span class="badge badge-del">DEL</span><span class="path">/geofences/{id}</span></div>
    <div class="row"><span class="badge badge-get">GET</span><span class="path">/vehicles</span></div>
    <div class="row"><span class="badge badge-post">POST</span><span class="path">/vehicles</span></div>
    <div class="row"><span class="badge badge-del">DEL</span><span class="path">/vehicles/{id}</span></div>
    <div class="row"><span class="badge badge-post">POST</span><span class="path">/vehicles/location</span></div>
    <div class="row"><span class="badge badge-get">GET</span><span class="path">/vehicles/location/{id}</span></div>
    <div class="row"><span class="badge badge-post">POST</span><span class="path">/alerts/configure</span></div>
    <div class="row"><span class="badge badge-get">GET</span><span class="path">/alerts</span></div>
    <div class="row"><span class="badge badge-del">DEL</span><span class="path">/alerts/{id}</span></div>
    <div class="row"><span class="badge badge-get">GET</span><span class="path">/violations/history</span></div>
    <div class="row"><span class="badge badge-ws">WS</span><span class="path">/ws/alerts</span></div>
    <div class="row"><span class="badge badge-get">GET</span><span class="path">/health</span></div>
  </div>

  <p class="footer">GeoTrack API v1.0 &middot; Built with Go + MongoDB</p>
</div>
</body>
</html>`, mongoClass, mongoStatus, dbName, uptimeStr, runtime.Version())
}
