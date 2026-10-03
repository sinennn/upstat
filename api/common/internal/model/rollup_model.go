package model

import (
	"go.mongodb.org/mongo-driver/bson/primitive"
	"time"
)

// CheckResultRollup is an hourly pre-aggregation of CheckResults for one
// monitor, keyed on (monitorId, bucketStart). It exists so trend/history
// reads don't have to scan raw check rows — the same reason ad-click event
// systems aggregate into time-bucketed rollups instead of querying the raw
// event table for every request.
type CheckResultRollup struct {
	Id          primitive.ObjectID `json:"-" bson:"_id"`
	MonitorID   string             `json:"MonitorID" bson:"monitorId"`
	BucketStart time.Time          `json:"BucketStart" bson:"bucketStart"` // hour-truncated, UTC

	TotalChecks       int64   `json:"TotalChecks" bson:"totalChecks"`
	SuccessfulChecks  int64   `json:"SuccessfulChecks" bson:"successfulChecks"`
	AvgResponseTimeMs float64 `json:"AvgResponseTimeMs" bson:"avgResponseTimeMs"`
	MinResponseTimeMs int64   `json:"MinResponseTimeMs" bson:"minResponseTimeMs"`
	MaxResponseTimeMs int64   `json:"MaxResponseTimeMs" bson:"maxResponseTimeMs"`

	CreatedAt time.Time `json:"CreatedAt" bson:"createdAt"`
	UpdatedAt time.Time `json:"UpdatedAt" bson:"updatedAt"`
}
