package service

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/cuesoftinc/upstat/api/common/internal/model"
	pb "github.com/cuesoftinc/upstat/api/common/internal/proto"
	"github.com/cuesoftinc/upstat/api/common/internal/repository"
	"github.com/cuesoftinc/upstat/api/common/internal/util"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

var errFakeNotFound = errors.New("fake: not found")

// authedContext builds an authenticated context through the real
// AuthenticateInterceptor using a generated JWT — the same path a
// gRPC-Web caller takes, minus the wire.
func authedContext(t *testing.T, userID, email string) context.Context {
	t.Helper()
	_ = os.Setenv("JWT_SECRET", "test-secret-for-unit-tests")
	token, err := util.GenerateToken(userID, email)
	if err != nil {
		t.Fatalf("could not generate token: %v", err)
	}
	md := metadata.Pairs("authorization", "Bearer "+token)
	ctx := metadata.NewIncomingContext(context.Background(), md)

	var captured context.Context
	_, err = util.AuthenticateInterceptor(
		ctx,
		new(pb.Empty),
		&grpc.UnaryServerInfo{FullMethod: "/proto.MonitorService/GetMonitor"},
		func(c context.Context, _ any) (any, error) {
			captured = c
			return nil, nil
		},
	)
	if err != nil {
		t.Fatalf("interceptor rejected a valid token: %v", err)
	}
	return captured
}

// svcFakeMonitorRepo embeds the interface and overrides only what a test needs;
// any other method panics on the nil embedded interface (never called here).
type svcFakeMonitorRepo struct {
	repository.MonitorRepository
	created []model.Monitor
	updated model.Monitor
	monitor *model.Monitor // GetMonitor returns this (ownership gate)
	list    []*model.Monitor
	err     error
}

func (f *svcFakeMonitorRepo) CreateMonitor(m model.Monitor) (*model.Monitor, error) {
	if f.err != nil {
		return nil, f.err
	}
	f.created = append(f.created, m)
	m.Id = primitive.NewObjectID()
	return &m, nil
}

func (f *svcFakeMonitorRepo) GetMonitor(id, ownerID string) (*model.Monitor, error) {
	if f.err != nil {
		return nil, f.err
	}
	if f.monitor == nil || f.monitor.Id.Hex() != id || f.monitor.OwnerId != ownerID {
		return nil, errFakeNotFound
	}
	return f.monitor, nil
}

func (f *svcFakeMonitorRepo) ListMonitors(ownerID string) ([]*model.Monitor, error) {
	if f.err != nil {
		return nil, f.err
	}
	var out []*model.Monitor
	for _, m := range f.list {
		if m.OwnerId == ownerID {
			out = append(out, m)
		}
	}
	return out, nil
}

func (f *svcFakeMonitorRepo) UpdateMonitor(id, ownerID string, m model.Monitor) (*model.Monitor, error) {
	f.updated = m
	return &m, nil
}

// svcFakeCheckRepo returns canned recent checks + daily aggregates.
type svcFakeCheckRepo struct {
	repository.CheckResultRepository
	checks     []*model.CheckResults
	aggregates []*model.DailyUptime
	err        error
}

func (f *svcFakeCheckRepo) ListRecentByMonitor(string, int64) ([]*model.CheckResults, error) {
	return f.checks, f.err
}
func (f *svcFakeCheckRepo) ListDailyUptime(string, time.Time) ([]*model.DailyUptime, error) {
	return f.aggregates, f.err
}

// svcFakeIncidentRepo embeds the interface and returns canned per-monitor lists.
type svcFakeIncidentRepo struct {
	repository.IncidentRepository
	byMonitor    []*model.Incident
	byMonitorIDs []*model.Incident
	err          error
}

func (f *svcFakeIncidentRepo) ListIncidentsByMonitor(string, int64) ([]*model.Incident, error) {
	return f.byMonitor, f.err
}
func (f *svcFakeIncidentRepo) ListIncidentsByMonitorIDs([]string, int64) ([]*model.Incident, error) {
	return f.byMonitorIDs, f.err
}

func newTestMonitor() *model.Monitor {
	return &model.Monitor{
		Id:               primitive.NewObjectID(),
		OwnerId:          "owner-a",
		Name:             "checkout",
		Target:           "https://example.com",
		Type:             "website",
		Active:           true,
		Status:           "up",
		IntervalSeconds:  60,
		TimeoutSeconds:   10,
		FailureThreshold: 3,
	}
}

func TestMonitorService_RequiresAuth(t *testing.T) {
	srv := &MonitorServiceServer{
		MonitorRepo:     &svcFakeMonitorRepo{},
		CheckResultRepo: &svcFakeCheckRepo{},
		IncidentRepo:    &svcFakeIncidentRepo{},
	}

	cases := []struct {
		name string
		call func(ctx context.Context) error
	}{
		{"CreateMonitor", func(ctx context.Context) error {
			_, err := srv.CreateMonitor(ctx, &pb.CreateMonitorRequest{Name: "n", Target: "https://x", Type: "website"})
			return err
		}},
		{"GetMonitor", func(ctx context.Context) error {
			_, err := srv.GetMonitor(ctx, &pb.GetMonitorRequest{Id: "x"})
			return err
		}},
		{"ListMonitors", func(ctx context.Context) error {
			_, err := srv.ListMonitors(ctx, &pb.ListMonitorsRequest{})
			return err
		}},
		{"GetMonitorHistory", func(ctx context.Context) error {
			_, err := srv.GetMonitorHistory(ctx, &pb.GetMonitorHistoryRequest{MonitorId: "x"})
			return err
		}},
		{"ListIncidents", func(ctx context.Context) error {
			_, err := srv.ListIncidents(ctx, &pb.ListIncidentsRequest{})
			return err
		}},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := tc.call(context.Background())
			if status.Code(err) != codes.Unauthenticated {
				t.Fatalf("expected Unauthenticated, got %v", err)
			}
		})
	}
}

func TestMonitorService_CreateMonitor_Defaults(t *testing.T) {
	repo := &svcFakeMonitorRepo{}
	srv := &MonitorServiceServer{MonitorRepo: repo}
	ctx := authedContext(t, "owner-a", "a@example.com")

	resp, err := srv.CreateMonitor(ctx, &pb.CreateMonitorRequest{Name: "n", Target: "https://x", Type: "website"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.GetStatus() != "success" || resp.Monitor == nil {
		t.Fatalf("unexpected response: %+v", resp)
	}
	if resp.Monitor.GetIntervalSeconds() != 60 || resp.Monitor.GetTimeoutSeconds() != 10 || resp.Monitor.GetFailureThreshold() != 3 {
		t.Fatalf("expected default scheduling fields, got %+v", resp.Monitor)
	}
	if !resp.Monitor.GetActive() || resp.Monitor.GetStatus() != "unknown" {
		t.Fatalf("expected active+new monitor, got %+v", resp.Monitor)
	}
	if len(repo.created) != 1 || repo.created[0].OwnerId != "owner-a" {
		t.Fatalf("expected owner-scoped create, got %+v", repo.created)
	}
}

func TestMonitorService_OwnershipIsolation(t *testing.T) {
	monitor := newTestMonitor() // owner-a
	repo := &svcFakeMonitorRepo{monitor: monitor, list: []*model.Monitor{monitor}}
	srv := &MonitorServiceServer{MonitorRepo: repo}
	ctxB := authedContext(t, "owner-b", "b@example.com")

	// owner-b cannot read owner-a's monitor, its history, or its incidents.
	if _, err := srv.GetMonitor(ctxB, &pb.GetMonitorRequest{Id: monitor.Id.Hex()}); status.Code(err) != codes.NotFound {
		t.Fatalf("expected NotFound for cross-owner GetMonitor, got %v", err)
	}
	if _, err := srv.GetMonitorHistory(ctxB, &pb.GetMonitorHistoryRequest{MonitorId: monitor.Id.Hex()}); status.Code(err) != codes.NotFound {
		t.Fatalf("expected NotFound for cross-owner GetMonitorHistory, got %v", err)
	}
	if _, err := srv.ListIncidents(ctxB, &pb.ListIncidentsRequest{MonitorId: monitor.Id.Hex()}); status.Code(err) != codes.NotFound {
		t.Fatalf("expected NotFound for cross-owner ListIncidents, got %v", err)
	}

	// owner-b's feed is empty because ListMonitors is owner-scoped.
	list, err := srv.ListMonitors(ctxB, &pb.ListMonitorsRequest{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(list.GetMonitors()) != 0 {
		t.Fatalf("expected empty list for other owner, got %v", list.GetMonitors())
	}
}

func TestMonitorService_UpdateMonitor_PatchSemantics(t *testing.T) {
	monitor := newTestMonitor() // interval 60, active true
	repo := &svcFakeMonitorRepo{monitor: monitor}
	srv := &MonitorServiceServer{MonitorRepo: repo}
	ctx := authedContext(t, "owner-a", "a@example.com")

	// Mute-only patch must not deactivate the monitor or reset scheduling.
	resp, err := srv.UpdateMonitor(ctx, &pb.UpdateMonitorRequest{Id: monitor.Id.Hex(), Muted: boolPtr(true)})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !resp.GetMonitor().GetActive() || !resp.GetMonitor().GetMuted() {
		t.Fatalf("expected active preserved + muted set, got %+v", resp.GetMonitor())
	}
	if resp.GetMonitor().GetIntervalSeconds() != 60 || resp.GetMonitor().GetTimeoutSeconds() != 10 {
		t.Fatalf("expected scheduling fields preserved, got %+v", resp.GetMonitor())
	}
}

func TestMonitorService_GetMonitorHistory_DayAggregation(t *testing.T) {
	monitor := newTestMonitor()
	yday := time.Now().UTC().AddDate(0, 0, -1).Format("2006-01-02")
	today := time.Now().UTC().Format("2006-01-02")

	srv := &MonitorServiceServer{
		MonitorRepo: &svcFakeMonitorRepo{monitor: monitor},
		CheckResultRepo: &svcFakeCheckRepo{
			checks: []*model.CheckResults{{MonitorID: monitor.Id.Hex(), Status: "up", ResponseTimeMs: 120}},
			aggregates: []*model.DailyUptime{
				{Date: today, Total: 10, Successful: 10},
				{Date: yday, Total: 10, Successful: 5},
			},
		},
	}
	ctx := authedContext(t, "owner-a", "a@example.com")

	resp, err := srv.GetMonitorHistory(ctx, &pb.GetMonitorHistoryRequest{MonitorId: monitor.Id.Hex(), Days: 90})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(resp.GetDays()) != 90 {
		t.Fatalf("expected 90 day buckets, got %d", len(resp.GetDays()))
	}
	if !resp.GetHasUptime() {
		t.Fatalf("expected has_uptime true")
	}
	// overall = (10+5)/(10+10) = 75%
	if resp.GetOverallUptimePct() != 75 {
		t.Fatalf("expected overall 75%% uptime, got %v", resp.GetOverallUptimePct())
	}
	if len(resp.GetRecentChecks()) != 1 || !resp.GetRecentChecks()[0].GetSuccess() {
		t.Fatalf("expected recent checks passthrough, got %+v", resp.GetRecentChecks())
	}
}

func TestMonitorService_ListIncidents_OwnerScoped(t *testing.T) {
	monitor := newTestMonitor()
	inc := &model.Incident{Id: primitive.NewObjectID(), MonitorID: monitor.Id.Hex(), Title: "checkout is down", Status: "active", StartedAt: time.Now()}
	srv := &MonitorServiceServer{
		MonitorRepo:  &svcFakeMonitorRepo{monitor: monitor, list: []*model.Monitor{monitor}},
		IncidentRepo: &svcFakeIncidentRepo{byMonitorIDs: []*model.Incident{inc}},
	}
	ctx := authedContext(t, "owner-a", "a@example.com")

	resp, err := srv.ListIncidents(ctx, &pb.ListIncidentsRequest{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(resp.GetIncidents()) != 1 || resp.GetIncidents()[0].GetTitle() != "checkout is down" {
		t.Fatalf("unexpected incidents: %+v", resp.GetIncidents())
	}
}

func boolPtr(b bool) *bool { return &b }
