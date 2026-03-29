# GeoTrack — Setup Guide

## Prerequisites
- Go 1.21+
- Node.js 18+
- Docker & Docker Compose (for MongoDB or full deployment)

---

## Option A: Run Locally (Recommended for Development)

### Step 1 — Start MongoDB via Docker
```powershell
docker run -d -p 27017:27017 --name mongo-geo mongo:7
```

### Step 2 — Start Backend
```powershell
cd Backend
go mod tidy
go run main.go
```
Backend runs at: http://localhost:8080

### Step 3 — Start Frontend
```powershell
cd Frontend
npm install
npm run dev
```
Frontend runs at: http://localhost:5173

---

## Option B: Full Docker Compose — Build Locally (One Command)

```powershell
cd C:\Users\Chand\OneDrive\Desktop\Geofencing
docker-compose up --build
```

- Frontend: http://localhost
- Backend: http://localhost:8080
- MongoDB: localhost:27017

---

## Option C: Run from Docker Hub Images (No Source Code Needed)

Pull and run pre-built images directly from Docker Hub — no cloning or building required.

### Docker Images

| Service  | Image                                       | Description         |
|----------|---------------------------------------------|---------------------|
| MongoDB  | `mongo:7`                                   | Database             |
| Backend  | `chandankumar55/geotrack-backend:latest`    | Go API server        |
| Frontend | `chandankumar55/geotrack-frontend:latest`   | React app via Nginx  |

### Method 1: Using docker-compose (Recommended)

Create a `docker-compose.yml` file anywhere on your machine:

```yaml
version: '3.9'

services:
  mongodb:
    image: mongo:7
    container_name: geo_mongodb
    restart: unless-stopped
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db
    networks:
      - geonet

  backend:
    image: chandankumar55/geotrack-backend:latest
    container_name: geo_backend
    restart: unless-stopped
    ports:
      - "8080:8080"
    environment:
      - MONGODB_URI=mongodb://mongodb:27017
      - DB_NAME=geofencing_db
      - PORT=8080
    depends_on:
      - mongodb
    networks:
      - geonet

  frontend:
    image: chandankumar55/geotrack-frontend:latest
    container_name: geo_frontend
    restart: unless-stopped
    ports:
      - "80:80"
    depends_on:
      - backend
    networks:
      - geonet

volumes:
  mongo_data:

networks:
  geonet:
    driver: bridge
```

Then run:

```powershell
docker-compose up -d
```

### Method 2: Using individual docker run commands

```powershell
# Step 1 — Pull all images
docker pull mongo:7
docker pull chandankumar55/geotrack-backend:latest
docker pull chandankumar55/geotrack-frontend:latest

# Step 2 — Create a network
docker network create geonet

# Step 3 — Start MongoDB
docker run -d --name geo_mongodb --network geonet -p 27017:27017 -v mongo_data:/data/db mongo:7

# Step 4 — Start Backend
docker run -d --name geo_backend --network geonet -p 8080:8080 -e MONGODB_URI=mongodb://geo_mongodb:27017 -e DB_NAME=geofencing_db -e PORT=8080 chandankumar55/geotrack-backend:latest

# Step 5 — Start Frontend
docker run -d --name geo_frontend --network geonet -p 80:80 chandankumar55/geotrack-frontend:latest
```

### Access the Application

| Service   | URL                        |
|-----------|----------------------------|
| Frontend  | http://localhost            |
| Backend   | http://localhost:8080       |
| Health    | http://localhost:8080/health|

### Stop & Clean Up

```powershell
# Stop all containers
docker-compose down

# Or if using individual containers
docker stop geo_frontend geo_backend geo_mongodb
docker rm geo_frontend geo_backend geo_mongodb
docker network rm geonet
```

---

## API Testing (curl examples)

### Create Geofence
```bash
curl -X POST http://localhost:8080/geofences \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Zone",
    "description": "Test geofence",
    "coordinates": [
      [12.97, 77.59],
      [12.98, 77.59],
      [12.98, 77.61],
      [12.97, 77.61],
      [12.97, 77.59]
    ],
    "category": "restricted_zone"
  }'
```

### Register Vehicle
```bash
curl -X POST http://localhost:8080/vehicles \
  -H "Content-Type: application/json" \
  -d '{
    "vehicle_number": "KA-01-AB-1234",
    "driver_name": "John Doe",
    "vehicle_type": "truck",
    "phone": "+1234567890"
  }'
```

### Update Vehicle Location
```bash
curl -X POST http://localhost:8080/vehicles/location \
  -H "Content-Type: application/json" \
  -d '{
    "vehicle_id": "veh_xxxxxxxx",
    "latitude": 12.975,
    "longitude": 77.60,
    "timestamp": "2025-01-15T10:35:00Z"
  }'
```

### Configure Alert
```bash
curl -X POST http://localhost:8080/alerts/configure \
  -H "Content-Type: application/json" \
  -d '{
    "geofence_id": "geo_xxxxxxxx",
    "event_type": "entry"
  }'
```

### Get Violations History
```bash
curl "http://localhost:8080/violations/history?limit=10"
```

---

## WebSocket Testing
```javascript
// Open browser console and run:
const ws = new WebSocket('ws://localhost:8080/ws/alerts')
ws.onmessage = (e) => console.log(JSON.parse(e.data))
```

---

## Architecture

```
Frontend (React/Vite + Leaflet) — Port 5173/80
    │
    ├── HTTP ──► Backend (Go/Gorilla) — Port 8080
    │                │
    └── WS ───►      └── MongoDB — Port 27017
```

### Key Design Decisions
- **MongoDB** for flexible document storage; no migrations needed
- **Ray-casting algorithm** for point-in-polygon (pure Go, no PostGIS)
- **Gorilla WebSocket** hub broadcasts alerts to all clients asynchronously
- **Rate limiting** on location updates (100ms window per vehicle)
- **Event detection** by comparing previous vs current geofence membership per vehicle
