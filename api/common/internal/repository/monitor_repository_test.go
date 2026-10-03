package repository_test

import (
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/cuesoftinc/upstat/api/common/internal/model"
	"github.com/cuesoftinc/upstat/api/common/internal/repository"
)

func createTestMonitor(t *testing.T) *model.Monitor {
	t.Helper()
	repo := repository.NewMonitorRepository(testDB)
	monitor, err := repo.CreateMonitor(model.Monitor{
		OwnerId:          "owner-1",
		Name:             "test monitor",
		Target:           "https://example.com",
		Type:             "http",
		Active:           true,
		IntervalSeconds:  60,
		FailureThreshold: 3,
	})
	if err != nil {
		t.Fatalf("could not create monitor: %v", err)
	}
	return monitor
}

// TestClaimMonitor_MutualExclusion is the correctness property the whole
// stateless-worker design depends on: with N replicas racing to claim the
// same monitor at the same instant, exactly one must win.
func TestClaimMonitor_MutualExclusion(t *testing.T) {
	resetCollections(t)
	repo := repository.NewMonitorRepository(testDB)
	monitor := createTestMonitor(t)

	const workers = 8
	results := make(chan bool, workers)
	var wg sync.WaitGroup

	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			claimed, err := repo.ClaimMonitor(monitor.Id, fmt.Sprintf("worker-%d", i), time.Minute)
			if err != nil {
				t.Errorf("unexpected error: %v", err)
				return
			}
			results <- claimed
		}(i)
	}
	wg.Wait()
	close(results)

	claims := 0
	for r := range results {
		if r {
			claims++
		}
	}
	if claims != 1 {
		t.Fatalf("expected exactly one successful claim out of %d concurrent attempts, got %d", workers, claims)
	}
}

func TestClaimMonitor_ExpiredLeaseIsReclaimable(t *testing.T) {
	resetCollections(t)
	repo := repository.NewMonitorRepository(testDB)
	monitor := createTestMonitor(t)

	claimed, err := repo.ClaimMonitor(monitor.Id, "worker-a", 50*time.Millisecond)
	if err != nil || !claimed {
		t.Fatalf("expected first claim to succeed, got claimed=%v err=%v", claimed, err)
	}

	// Still held: a second worker must not be able to claim it yet.
	claimed, err = repo.ClaimMonitor(monitor.Id, "worker-b", time.Minute)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if claimed {
		t.Fatalf("expected claim to be rejected while the lease is still held")
	}

	time.Sleep(150 * time.Millisecond)

	claimed, err = repo.ClaimMonitor(monitor.Id, "worker-b", time.Minute)
	if err != nil || !claimed {
		t.Fatalf("expected claim to succeed after lease expiry, got claimed=%v err=%v", claimed, err)
	}
}

func TestUpdateAfterCheck_ReleasesLeaseImmediately(t *testing.T) {
	resetCollections(t)
	repo := repository.NewMonitorRepository(testDB)
	monitor := createTestMonitor(t)

	claimed, err := repo.ClaimMonitor(monitor.Id, "worker-a", time.Minute)
	if err != nil || !claimed {
		t.Fatalf("expected claim to succeed, got claimed=%v err=%v", claimed, err)
	}

	if err := repo.UpdateAfterCheck(monitor.Id, "up", 200, 42, 0); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Lease should be released immediately by UpdateAfterCheck — no need to
	// wait out the full TTL for the next replica to pick the monitor up.
	claimed, err = repo.ClaimMonitor(monitor.Id, "worker-b", time.Minute)
	if err != nil || !claimed {
		t.Fatalf("expected immediate reclaim after UpdateAfterCheck, got claimed=%v err=%v", claimed, err)
	}
}

func TestSetMetricAlertState_Persists(t *testing.T) {
	resetCollections(t)
	repo := repository.NewMonitorRepository(testDB)
	monitor := createTestMonitor(t)

	if err := repo.SetMetricAlertState(monitor.Id, true, false); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	got, err := repo.GetMonitor(monitor.Id.Hex(), monitor.OwnerId)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !got.ErrorRateAlertActive || got.LatencyAlertActive {
		t.Fatalf("expected ErrorRateAlertActive=true, LatencyAlertActive=false, got %+v", got)
	}
}
