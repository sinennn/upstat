package model

import (
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"time"
)

// NotificationOutbox is a durable, retried record of an incident lifecycle
// event. It exists so that "an incident opened/resolved" is never lost to a
// crash between the incident write and whatever notifies someone about it —
// the entry is written in the same request that changes the incident, and a
// worker (NotificationWorker) drains it independently, with its own lease
// and retry/backoff bookkeeping, same shape as the monitor check lease.
type NotificationOutbox struct {
	Id         primitive.ObjectID `json:"-" bson:"_id"`
	Kind       string             `json:"-" bson:"kind"` // "incident.opened" | "incident.resolved"
	MonitorID  string             `json:"-" bson:"monitorId"`
	IncidentID string             `json:"-" bson:"incidentId"`
	Payload    bson.M             `json:"-" bson:"payload"`

	Status        string     `json:"-" bson:"status"` // "pending" | "delivered" | "failed"
	Attempts      int        `json:"-" bson:"attempts"`
	LastError     string     `json:"-" bson:"lastError,omitempty"`
	NextAttemptAt time.Time  `json:"-" bson:"nextAttemptAt"`
	DeliveredAt   *time.Time `json:"-" bson:"deliveredAt,omitempty"`

	LockedBy    *string    `json:"-" bson:"lockedBy,omitempty"`
	LockedUntil *time.Time `json:"-" bson:"lockedUntil,omitempty"`

	CreatedAt time.Time `json:"-" bson:"createdAt"`
	UpdatedAt time.Time `json:"-" bson:"updatedAt"`
}
