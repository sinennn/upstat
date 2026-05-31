package models

import (
"time"
"go.mongodb.org/mongo-driver/bson/primitive"

)

type Monitor struct{
	Id primitive.ObjectID `json:"Id" bson:"_id"`
	OwnerId string `json:"OwnerId" bson:"ownerId"`
	Name string `json:"Name" bson:"name"`
	Target string `json:"Target" bson:"target"`
	Type string `json:"Type" bson:"type"`
	CreatedAt time.Time `json:"Created_At" bson:"createdAt"`
	UpdatedAt time.Time `json:"Updated_At" bson:"updatedAt"`
}

type CheckResult struct{
	Id primitive.ObjectID `json:"Id" bson:"Id"`
	MonitorID string `json:"MonitorID" bson:"MonitorId"`
	StatusCode int `json:"StatusCode" bson:"StausCode"`
	ResponseTime int64 `json:"ResponseTime" bson:"ResponseTime"`
	Available bool `json:"Available" bson:"Available"`
}

type Incident struct{
	Id primitive.ObjectID `json:"Id" bson:"Id"`
	MonitorID string `json:"MonitorID" bson:"MonitorId"`
	Title string `json:"Title" bson:"Title"`
	Description string `json:"Description" bson:"Description"`
	StartedAt time.Time `json:"StartedAt" bson:"StartedAt"`
	ResolvedAt *time.Time `json:"ResolvedAt" bson:"ResolvedAt"`
}

type StatusPage struct{
	Id primitive.ObjectID `json:"Id" bson:"Id"`
	OwnerId string `json:"OwnerId" bson:"OwnerId"`
	Name string `json:"Name" bson:"Name"`
	Slug string `json:"Slug" bson:"Slug"`
	CreatedAt time.Time `json:"Created_At" bson:"Created_At"`
	UpdatedAt time.Time `json:"Updated_At" bson:"updated_At"`
}


