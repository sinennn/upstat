package service

import (
	"context"
	"github.com/cuesoftinc/upstat/api/common/internal/config"
	"github.com/cuesoftinc/upstat/api/common/internal/model"
	"github.com/cuesoftinc/upstat/api/common/internal/repository"
	"github.com/cuesoftinc/upstat/api/common/internal/util"
	"log/slog"
	"sync"
	"time"
)

// Notifier delivers a single outbox entry. LogNotifier is the only sink
// wired up today — no email/webhook/Slack provider exists in this codebase
// yet. A real channel is a second implementation of this interface plugged
// into NotificationWorker; the outbox and its retry/lease bookkeeping don't
// change when that lands.
type Notifier interface {
	Deliver(ctx context.Context, entry *model.NotificationOutbox) error
}

// LogNotifier turns "no notification channel exists yet" into a durable,
// retried record instead of what happened before this outbox existed:
// nothing (see the old inline CreateIncident call in processMonitor).
type LogNotifier struct{}

func (LogNotifier) Deliver(_ context.Context, entry *model.NotificationOutbox) error {
	slog.Info("notification delivered",
		"kind", entry.Kind,
		"monitorId", entry.MonitorID,
		"incidentId", entry.IncidentID,
		"payload", entry.Payload,
	)
	return nil
}

// NotificationWorker drains the NotificationOutbox. Like MonitorWorker, it
// holds no state other replicas depend on: any number of instances can run
// this against the same database via NotificationRepo.Claim.
type NotificationWorker struct {
	NotificationRepo repository.NotificationRepository
	Notifier         Notifier
	Concurrency      int
	PollInterval     time.Duration
	LeaseDuration    time.Duration
	MaxAttempts      int
	WorkerID         string
}

func NewNotificationWorker(db *config.DB) *NotificationWorker {
	return &NotificationWorker{
		NotificationRepo: repository.NewNotificationRepository(db),
		Notifier:         LogNotifier{},
		Concurrency:      10,
		PollInterval:     5 * time.Second,
		LeaseDuration:    30 * time.Second,
		MaxAttempts:      5,
		WorkerID:         util.NewWorkerID(),
	}
}

func (w *NotificationWorker) Start(ctx context.Context) {
	ticker := time.NewTicker(w.PollInterval)
	defer ticker.Stop()

	w.runOnce()

	for {
		select {
		case <-ctx.Done():
			slog.Info("notification worker stopped")
			return
		case <-ticker.C:
			w.runOnce()
		}
	}
}

func (w *NotificationWorker) runOnce() {
	entries, err := w.NotificationRepo.ListPending(int64(w.Concurrency * 5))
	if err != nil {
		slog.Error("could not list pending notifications", "error", err)
		return
	}

	sem := make(chan struct{}, w.Concurrency)
	var wg sync.WaitGroup

	for _, entry := range entries {
		wg.Add(1)
		sem <- struct{}{}

		go func(e *model.NotificationOutbox) {
			defer wg.Done()
			defer func() { <-sem }()
			w.deliver(e)
		}(entry)
	}
	wg.Wait()
}

func (w *NotificationWorker) deliver(entry *model.NotificationOutbox) {
	claimed, err := w.NotificationRepo.Claim(entry.Id, w.WorkerID, w.LeaseDuration)
	if err != nil {
		slog.Error("could not claim notification", "error", err, "notification", entry.Id.Hex())
		return
	}
	if !claimed {
		// another replica already holds the lease for this tick
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := w.Notifier.Deliver(ctx, entry); err != nil {
		giveUp := entry.Attempts+1 >= w.MaxAttempts
		nextAttempt := time.Now().Add(deliveryBackoff(entry.Attempts))

		if markErr := w.NotificationRepo.MarkFailed(entry.Id, err.Error(), nextAttempt, giveUp); markErr != nil {
			slog.Error("could not record notification failure", "error", markErr, "notification", entry.Id.Hex())
		}
		slog.Error("notification delivery failed", "error", err, "notification", entry.Id.Hex(), "giveUp", giveUp)
		return
	}

	if err := w.NotificationRepo.MarkDelivered(entry.Id); err != nil {
		slog.Error("could not mark notification delivered", "error", err, "notification", entry.Id.Hex())
	}
}

// deliveryBackoff is a capped exponential delay: 5s, 10s, 20s, 40s, 80s.
func deliveryBackoff(attempts int) time.Duration {
	delay := 5 * time.Second
	for i := 0; i < attempts; i++ {
		delay *= 2
		if delay >= 80*time.Second {
			return 80 * time.Second
		}
	}
	return delay
}
