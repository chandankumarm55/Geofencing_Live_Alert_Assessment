package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"geofencing-backend/config"
	"geofencing-backend/models"
	"net/http"
	"strconv"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func GetViolationsHistory(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	w.Header().Set("Content-Type", "application/json")

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	filter := bson.M{}
	q := r.URL.Query()

	if v := q.Get("vehicle_id"); v != "" {
		filter["vehicle_id"] = v
	}
	if g := q.Get("geofence_id"); g != "" {
		filter["geofence_id"] = g
	}
	if sd := q.Get("start_date"); sd != "" {
		if t, err := time.Parse(time.RFC3339, sd); err == nil {
			if filter["timestamp"] == nil {
				filter["timestamp"] = bson.M{}
			}
			filter["timestamp"].(bson.M)["$gte"] = t
		}
	}
	if ed := q.Get("end_date"); ed != "" {
		if t, err := time.Parse(time.RFC3339, ed); err == nil {
			if filter["timestamp"] == nil {
				filter["timestamp"] = bson.M{}
			}
			filter["timestamp"].(bson.M)["$lte"] = t
		}
	}

	limit := int64(50)
	if l := q.Get("limit"); l != "" {
		if parsed, err := strconv.ParseInt(l, 10, 64); err == nil {
			if parsed > 0 && parsed <= 500 {
				limit = parsed
			}
		}
	}

	col := config.DB.Collection("violations")
	totalCount, _ := col.CountDocuments(ctx, filter)

	opts := options.Find().SetSort(bson.D{{Key: "timestamp", Value: -1}}).SetLimit(limit)
	cursor, err := col.Find(ctx, filter, opts)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to fetch violations", start)
		return
	}
	defer cursor.Close(ctx)

	var violations []models.Violation
	if err = cursor.All(ctx, &violations); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to parse violations", start)
		return
	}
	if violations == nil {
		violations = []models.Violation{}
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"violations":  violations,
		"total_count": totalCount,
		"time_ns":     fmt.Sprintf("%d", time.Since(start).Nanoseconds()),
	})
}
