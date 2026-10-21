// Command seed loads a demo account into the Upstat database: a user with
// email + password sign-in, a set of monitors against real public URLs (one
// deliberately unreachable, so a live incident opens within minutes), a
// public status page, and — with -backfill — 90 days of hourly check
// history with a few past outages, so the uptime strips are populated from
// the first page load.
//
// Backfilled history is synthetic demo data. Everything after the seed runs
// is produced by the real check worker.
//
//	go run ./cmd/seed                 # account + monitors + status page
//	go run ./cmd/seed -backfill       # ...plus 90 days of history
//	go run ./cmd/seed -reset -backfill  # wipe the demo account's data first
package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"math"
	"math/rand"
	"os"
	"time"

	"github.com/cuesoftinc/upstat/api/common/internal/config"
	"github.com/cuesoftinc/upstat/api/common/internal/model"
	"github.com/cuesoftinc/upstat/api/common/internal/repository"
	"github.com/cuesoftinc/upstat/api/common/internal/util"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

type demoMonitor struct {
	name, target, kind string
	baseMs             float64
	// past outages: days ago + hours long (backfill only)
	outages []outage
}

type outage struct {
	daysAgo float64
	hours   int
	reason  string
}

var monitors = []demoMonitor{
	{"Website", "https://example.com", "website", 120, []outage{
		{daysAgo: 37.4, hours: 2, reason: "503 Service Unavailable"},
	}},
	{"Edge API", "https://www.cloudflare.com/cdn-cgi/trace", "api", 45, nil},
	{"Search", "https://www.google.com", "website", 90, []outage{
		{daysAgo: 12.6, hours: 1, reason: "Get \"https://www.google.com\": context deadline exceeded"},
	}},
	{"Docs", "https://developer.mozilla.org", "website", 210, []outage{
		{daysAgo: 64.2, hours: 3, reason: "502 Bad Gateway"},
		{daysAgo: 5.1, hours: 1, reason: "503 Service Unavailable"},
	}},
	// Unresolvable on purpose: the real worker fails it, and after
	// failureThreshold checks an incident opens live during the demo.
	{"Legacy API", "https://legacy-api.upstat-demo.invalid/health", "api", 160, nil},
}

func main() {
	email := flag.String("email", "demo@upstat.app", "demo account email")
	password := flag.String("password", "upstat-demo", "demo account password")
	name := flag.String("name", "Demo User", "demo account display name")
	slug := flag.String("slug", "demo", "public status page slug (/status/<slug>)")
	backfill := flag.Bool("backfill", false, "insert 90 days of synthetic hourly check history")
	reset := flag.Bool("reset", false, "delete the demo account's monitors, checks, incidents and status page first")
	flag.Parse()

	config.LoadEnv()
	db := config.NewDBHandler()
	database := db.Client.Database(os.Getenv("MONGO_DB"))
	ctx := context.Background()

	users := repository.NewUserRepository(db)
	user, err := users.GetUser(*email)
	if err != nil {
		hashed := *password
		if _, err := util.HashPassword(&hashed); err != nil {
			log.Fatalf("hash password: %v", err)
		}
		if _, err := users.CreateUser(model.User{Name: *name, Email: *email, Password: hashed}); err != nil {
			log.Fatalf("create user: %v", err)
		}
		if user, err = users.GetUser(*email); err != nil {
			log.Fatalf("reload user: %v", err)
		}
		fmt.Printf("created user %s\n", *email)
	} else {
		fmt.Printf("user %s exists\n", *email)
	}
	ownerID := user.Id.Hex()

	monitorRepo := repository.NewMonitorRepository(db)
	existing, err := monitorRepo.ListMonitors(ownerID)
	if err != nil {
		log.Fatalf("list monitors: %v", err)
	}
	if *reset {
		ids := make([]string, 0, len(existing))
		for _, m := range existing {
			ids = append(ids, m.Id.Hex())
		}
		must(database.Collection("CheckResult").DeleteMany(ctx, bson.M{"monitorId": bson.M{"$in": ids}}))
		must(database.Collection("Incident").DeleteMany(ctx, bson.M{"monitorId": bson.M{"$in": ids}}))
		must(database.Collection("Monitor").DeleteMany(ctx, bson.M{"ownerId": ownerID}))
		must(database.Collection("StatusPage").DeleteMany(ctx, bson.M{"ownerId": ownerID}))
		fmt.Printf("reset: removed %d monitors and their history\n", len(existing))
		existing = nil
	}
	if len(existing) > 0 {
		fmt.Printf("demo account already has %d monitors — use -reset to rebuild\n", len(existing))
	} else {
		rng := rand.New(rand.NewSource(42))
		now := time.Now()
		for _, d := range monitors {
			m, err := monitorRepo.CreateMonitor(model.Monitor{
				OwnerId:          ownerID,
				Name:             d.name,
				Target:           d.target,
				Type:             d.kind,
				Active:           true,
				Status:           "unknown",
				IntervalSeconds:  30,
				TimeoutSeconds:   10,
				FailureThreshold: 3,
			})
			if err != nil {
				log.Fatalf("create monitor %s: %v", d.name, err)
			}
			fmt.Printf("monitor %-11s %s\n", d.name, d.target)
			if *backfill {
				n := backfillHistory(ctx, database, m, d, now, rng)
				fmt.Printf("  backfilled %d checks, %d past incidents\n", n, len(d.outages))
			}
		}
	}

	pages := database.Collection("StatusPage")
	if err := pages.FindOne(ctx, bson.M{"slug": *slug}).Err(); err == mongo.ErrNoDocuments {
		must(pages.InsertOne(ctx, model.StatusPage{
			Id: primitive.NewObjectID(), OwnerId: ownerID, Name: "Upstat Demo", Slug: *slug,
			CreatedAt: time.Now(), UpdatedAt: time.Now(),
		}))
		fmt.Printf("status page /status/%s created\n", *slug)
	}

	fmt.Printf("\nSign in with %s / %s\nPublic status page: /status/%s\n", *email, *password, *slug)
}

// backfillHistory writes hourly checks for the 90 days before now (stopping
// an hour short so the worker's live checks follow on), plus a resolved
// incident per outage window.
func backfillHistory(ctx context.Context, db *mongo.Database, m *model.Monitor, d demoMonitor, now time.Time, rng *rand.Rand) int {
	start := now.Add(-90 * 24 * time.Hour).Truncate(time.Hour)
	end := now.Add(-time.Hour)
	docs := make([]any, 0, 90*24)
	for t := start; t.Before(end); t = t.Add(time.Hour) {
		// a gentle daily load curve plus noise, in milliseconds
		hour := float64(t.UTC().Hour())
		cycle := 1 + 0.25*math.Sin((hour-8)/24*2*math.Pi)
		rt := int64(d.baseMs * cycle * (0.85 + rng.Float64()*0.35))
		check := model.CheckResults{
			Id: primitive.NewObjectID(), MonitorID: m.Id.Hex(), CheckedAt: t,
			ResponseTimeMs: rt, Status: "up", StatusCode: 200, Attempts: 1, CreatedAt: t,
		}
		for _, o := range d.outages {
			from := now.Add(-time.Duration(o.daysAgo * float64(24*time.Hour)))
			if !t.Before(from) && t.Before(from.Add(time.Duration(o.hours)*time.Hour)) {
				check.Status, check.StatusCode, check.Error, check.Attempts = "down", 503, o.reason, 3
			}
		}
		docs = append(docs, check)
	}
	must(db.Collection("CheckResult").InsertMany(ctx, docs))

	for _, o := range d.outages {
		started := now.Add(-time.Duration(o.daysAgo * float64(24*time.Hour)))
		resolved := started.Add(time.Duration(o.hours) * time.Hour)
		must(db.Collection("Incident").InsertOne(ctx, model.Incident{
			Id: primitive.NewObjectID(), MonitorID: m.Id.Hex(), Title: d.name + " is down",
			FailureReason: o.reason, Status: "resolved", StartedAt: started, ResolvedAt: &resolved,
			DurationSeconds: int64(o.hours) * 3600, CreatedAt: started, UpdatedAt: resolved,
		}))
	}
	return len(docs)
}

func must[T any](_ T, err error) {
	if err != nil {
		log.Fatal(err)
	}
}
