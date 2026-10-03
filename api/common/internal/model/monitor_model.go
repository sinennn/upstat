package model

import (
	"go.mongodb.org/mongo-driver/bson/primitive"
	"time"
)

type Monitor struct {
	Id      primitive.ObjectID `json:"Id" bson:"_id"`
	OwnerId string             `json:"OwnerId" bson:"ownerId"`
	Name    string             `json:"Name" bson:"name"`
	Target  string             `json:"Target" bson:"target"`
	Type    string             `json:"Type" bson:"type"`

	Active              bool   `json:"Active" bson:"active"`
	Status              string `json:"Status" bson:"status"`
	IntervalSeconds     int    `json:"IntervalSeconds" bson:"intervalSeconds"`
	TimeoutSeconds      int    `json:"TimeOutSeconds" bson:"timeoutSeconds"`
	FailureThreshold    int    `json:"FailureThreshold" bson:"failureThreshold"`
	ConsecutiveFailures int    `json:"ConsecutiveFailures" bson:"consecutiveFailures"`
	// Muted suppresses alert/notification dispatch. UI state — never
	// exposed over the public status page or incident lifecycle.
	Muted bool `json:"Muted" bson:"muted,omitempty"`

	LastCheckedAt      *time.Time `json:"LastCheckedAt" bson:"lastCheckedAt"`
	LastResponseTimeMs int64      `json:"LastResponseTimeMs" bson:"lastResponseTimeMs"`
	LastStatusCode     int        `json:"LastStatusCode" bson:"lastStatusCode"`

	// LockedBy/LockedUntil back the check-claim lease that lets any number of
	// stateless worker replicas share the monitor set without duplicating
	// checks. Internal coordination only — never exposed over the API.
	LockedBy    *string    `json:"-" bson:"lockedBy,omitempty"`
	LockedUntil *time.Time `json:"-" bson:"lockedUntil,omitempty"`

	// Metric-alert thresholds, evaluated over a rolling window independent
	// of the consecutive-failure uptime status above — a monitor can be
	// "up" per the last check yet still be breaching an error-rate or
	// latency budget over the window. Zero disables the rule. The Active
	// flags are edge-detection state so a breach enqueues exactly one
	// notification, and recovery enqueues exactly one more.
	ErrorRateThresholdPct float64 `json:"ErrorRateThresholdPct" bson:"errorRateThresholdPct,omitempty"`
	LatencyThresholdMs    int64   `json:"LatencyThresholdMs" bson:"latencyThresholdMs,omitempty"`
	ErrorRateAlertActive  bool    `json:"-" bson:"errorRateAlertActive,omitempty"`
	LatencyAlertActive    bool    `json:"-" bson:"latencyAlertActive,omitempty"`

	CreatedAt time.Time `json:"Created_At" bson:"createdAt"`
	UpdatedAt time.Time `json:"Updated_At" bson:"updatedAt"`
}

type CheckResults struct {
	Id             primitive.ObjectID `json:"Id" bson:"Id"`
	MonitorID      string             `json:"MonitorID" bson:"monitorId"`
	CheckedAt      time.Time          `json:"checkedAt" bson:"checkedAt"`
	ResponseTimeMs int64              `json:"responseTimeMs" bson:"responseTimeMs"`
	Status         string             `json:"status" bson:"status"`
	StatusCode     int                `json:"statusCode" bson:"statusCode"`
	Error          string             `json:"error" bson:"error,omitempty"`
	Attempts       int                `json:"attempts" bson:"attempts"`
	CreatedAt      time.Time          `json:"createdAt" bson:"createdAt"`
}

type Incident struct {
	Id              primitive.ObjectID `json:"Id" bson:"_id,omitempty"`
	MonitorID       string             `json:"MonitorID" bson:"monitorId"`
	Title           string             `json:"Title" bson:"title"`
	FailureReason   string             `json:"FailureReason" bson:"failureReason"`
	Status          string             `json:"Status" bson:"status"`
	StartedAt       time.Time          `json:"StartedAt" bson:"startedAt"`
	ResolvedAt      *time.Time         `json:"ResolvedAt" bson:"resolvedAt,omitempty"`
	DurationSeconds int64              `json:"DurationSeconds" bson:"durationSeconds"`
	CreatedAt       time.Time          `json:"CreatedAt" bson:"createdAt"`
	UpdatedAt       time.Time          `json:"UpdatedAt" bson:"updatedAt"`
}

type MonitorInsight struct {
	Id                primitive.ObjectID `json:"Id" bson:"_id"`
	MonitorID         string             `json:"MonitorID" bson:"monitorId"`
	MonitorName       string             `json:"MonitorName" bson:"monitorName"`
	RiskScore         int                `json:"RiskScore" bson:"riskScore"`
	AnomalyDetected   bool               `json:"AnomalyDetected" bson:"anomalyDetected"`
	Severity          string             `json:"Severity" bson:"severity"`
	Summary           string             `json:"Summary" bson:"summary"`
	HumanReadable     string             `json:"HumanReadable" bson:"humanReadable"`
	RecommendedAction string             `json:"RecommendedAction" bson:"recommendedAction"`
	GeneratedAt       time.Time          `json:"GeneratedAt" bson:"generatedAt"`
	CreatedAt         time.Time          `json:"CreatedAt" bson:"createdAt"`
	UpdatedAt         time.Time          `json:"UpdatedAt" bson:"updatedAt"`
}

type StatusPage struct {
	Id        primitive.ObjectID `json:"Id" bson:"_id,omitempty"`
	OwnerId   string             `json:"OwnerId" bson:"ownerId"`
	Name      string             `json:"Name" bson:"name"`
	Slug      string             `json:"Slug" bson:"slug"`
	CreatedAt time.Time          `json:"Created_At" bson:"createdAt"`
	UpdatedAt time.Time          `json:"Updated_At" bson:"updatedAt"`
}

// DailyUptime is a per-day aggregate of CheckResults for one monitor —
// a view row produced by CheckResultRepository.ListDailyUptime, never
// persisted. The same raw CheckResult data the RollupWorker aggregates.
type DailyUptime struct {
	Date       string `json:"date" bson:"_id"`
	Total      int64  `json:"total" bson:"total"`
	Successful int64  `json:"successful" bson:"successful"`
}
