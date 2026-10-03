package service

import (
	"context"
	"github.com/cuesoftinc/upstat/api/common/internal/config"
	"github.com/cuesoftinc/upstat/api/common/internal/model"
	"github.com/cuesoftinc/upstat/api/common/internal/repository"
	"log/slog"
	"sync"
	"time"
)

// RollupWorker periodically pre-aggregates raw CheckResults into hourly
// buckets (CheckResultRollup), the same reason ad-click event systems
// aggregate raw events instead of scanning them on every read: as
// CheckResults grows, computing stats by scanning raw rows on demand (see
// CheckResultRepo.CountSuccessfulSince) gets slower; a rollup keeps history
// reads bounded.
//
// Each tick recomputes the current (in-progress) hour and the previous
// (just-closed) hour, both from raw data via UpsertHourlyRollup, and upserts
// the result. That recomputation is idempotent, so — unlike MonitorWorker —
// no lease is needed: any number of replicas can run this concurrently and
// simply do some redundant work, never conflicting writes.
type RollupWorker struct {
	MonitorRepo  repository.MonitorRepository
	RollupRepo   repository.RollupRepository
	PollInterval time.Duration
	Concurrency  int
}

func NewRollupWorker(db *config.DB) *RollupWorker {
	return &RollupWorker{
		MonitorRepo:  repository.NewMonitorRepository(db),
		RollupRepo:   repository.NewRollupRepository(db),
		PollInterval: 60 * time.Second,
		Concurrency:  10,
	}
}

func (w *RollupWorker) Start(ctx context.Context) {
	ticker := time.NewTicker(w.PollInterval)
	defer ticker.Stop()

	w.runOnce()

	for {
		select {
		case <-ctx.Done():
			slog.Info("rollup worker stopped")
			return
		case <-ticker.C:
			w.runOnce()
		}
	}
}

func (w *RollupWorker) runOnce() {
	monitors, err := w.MonitorRepo.ListActiveMonitors()
	if err != nil {
		slog.Error("could not list active monitors for rollup", "error", err)
		return
	}

	currentBucket := time.Now().UTC().Truncate(time.Hour)
	previousBucket := currentBucket.Add(-time.Hour)

	sem := make(chan struct{}, w.Concurrency)
	var wg sync.WaitGroup

	for _, monitor := range monitors {
		wg.Add(1)
		sem <- struct{}{}

		go func(m *model.Monitor) {
			defer wg.Done()
			defer func() { <-sem }()

			for _, bucket := range [...]time.Time{currentBucket, previousBucket} {
				if _, err := w.RollupRepo.UpsertHourlyRollup(m.Id.Hex(), bucket); err != nil {
					slog.Error("could not roll up check results", "error", err, "monitor", m.Id.Hex(), "bucket", bucket)
				}
			}
		}(monitor)
	}
	wg.Wait()
}
