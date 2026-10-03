package repository_test

import (
	"context"
	"fmt"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
	"time"

	"github.com/cuesoftinc/upstat/api/common/internal/config"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// testDB is a connection to an ephemeral, disposable mongod started for this
// test binary's lifetime only — the same mongo:7 the project runs in
// docker-compose, just launched directly since Docker isn't assumed to be
// running wherever `go test` runs. No shared/dev database is touched.
var testDB *config.DB

func TestMain(m *testing.M) {
	code, err := runWithMongo(m)
	if err != nil {
		fmt.Fprintln(os.Stderr, "mongod test harness error:", err)
		os.Exit(1)
	}
	os.Exit(code)
}

func runWithMongo(m *testing.M) (int, error) {
	if _, err := exec.LookPath("mongod"); err != nil {
		return 0, fmt.Errorf("mongod not found on PATH — install MongoDB locally to run repository tests: %w", err)
	}

	port, err := freePort()
	if err != nil {
		return 0, err
	}

	dbDir, err := os.MkdirTemp("", "upstat-mongo-test-*")
	if err != nil {
		return 0, err
	}
	defer os.RemoveAll(dbDir)

	cmd := exec.Command("mongod",
		"--dbpath", dbDir,
		"--port", fmt.Sprintf("%d", port),
		"--bind_ip", "127.0.0.1",
		"--logpath", filepath.Join(dbDir, "mongod.log"),
		"--noauth",
	)
	if err := cmd.Start(); err != nil {
		return 0, fmt.Errorf("starting mongod: %w", err)
	}
	defer func() {
		_ = cmd.Process.Kill()
		_ = cmd.Wait()
	}()

	uri := fmt.Sprintf("mongodb://127.0.0.1:%d", port)
	if err := waitForMongo(uri, 30*time.Second); err != nil {
		return 0, err
	}

	os.Setenv("MONGO_URI", uri)
	os.Setenv("MONGO_DB", "UpstatTest")

	testDB = config.NewDBHandler()

	return m.Run(), nil
}

func freePort() (int, error) {
	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return 0, err
	}
	defer l.Close()
	return l.Addr().(*net.TCPAddr).Port, nil
}

func waitForMongo(uri string, timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	var lastErr error

	for time.Now().Before(deadline) {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		client, err := mongo.Connect(ctx, options.Client().ApplyURI(uri))
		if err == nil {
			err = client.Ping(ctx, nil)
		}
		if err == nil {
			_ = client.Disconnect(context.Background())
			cancel()
			return nil
		}
		lastErr = err
		cancel()
		time.Sleep(200 * time.Millisecond)
	}

	return fmt.Errorf("mongod did not become ready within %s: %w", timeout, lastErr)
}

// resetCollections drops every collection this package's tests touch, so
// each test starts from empty state without needing its own database.
func resetCollections(t *testing.T) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	db := testDB.Client.Database(os.Getenv("MONGO_DB"))
	for _, name := range []string{"Monitor", "CheckResult", "Incident", "NotificationOutbox", "CheckResultRollup", "StatusPage"} {
		if err := db.Collection(name).Drop(ctx); err != nil {
			t.Fatalf("could not reset collection %s: %v", name, err)
		}
	}
}
