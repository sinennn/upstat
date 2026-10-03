package service

import (
	"context"
	"os"
	"time"

	"github.com/cuesoftinc/upstat/api/common/internal/config"
	"github.com/cuesoftinc/upstat/api/common/internal/model"
	pb "github.com/cuesoftinc/upstat/api/common/internal/proto"
	"github.com/cuesoftinc/upstat/api/common/internal/repository"
	"github.com/cuesoftinc/upstat/api/common/internal/util"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/status"
)

type MonitorServiceServer struct {
	pb.UnimplementedMonitorServiceServer
	MonitorRepo     repository.MonitorRepository
	CheckResultRepo repository.CheckResultRepository
	IncidentRepo    repository.IncidentRepository
	StatusPageRepo  repository.StatusPageRepository
	InsightGRPCConn *grpc.ClientConn
	InsightClient   pb.InsightServiceClient
}

func NewMonitorServiceServer(db *config.DB) *MonitorServiceServer {
	insightServiceAddr := os.Getenv("INSIGHT_SERVICE_GRPC_ADDRESS")
	if insightServiceAddr == "" {
		insightServiceAddr = "localhost:50051"
	}

	conn, err := grpc.NewClient(insightServiceAddr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil
	}

	var insightClient pb.InsightServiceClient
	if conn != nil {
		insightClient = pb.NewInsightServiceClient(conn)
	}

	return &MonitorServiceServer{
		MonitorRepo:     repository.NewMonitorRepository(db),
		CheckResultRepo: repository.NewCheckResultRepository(db),
		IncidentRepo:    repository.NewIncidentRepository(db),
		StatusPageRepo:  repository.NewStatusPageRepository(db),
		InsightGRPCConn: conn,
		InsightClient:   insightClient,
	}
}

func (s *MonitorServiceServer) CreateMonitor(ctx context.Context, req *pb.CreateMonitorRequest) (*pb.MonitorResponse, error) {
	ownerID, ok := util.UserIDFromContext(ctx)

	if !ok || ownerID == "" {
		return nil, status.Error(codes.Unauthenticated, "missing authenticated user")
	}

	if req.GetName() == "" || req.GetType() == "" || req.GetTarget() == "" {
		return nil, status.Error(codes.InvalidArgument, "name, type and target required")
	}

	interval := int(req.GetIntervalSeconds())
	if interval <= 0 {
		interval = 60
	}
	timeout := int(req.GetTimeoutSeconds())
	if timeout <= 0 {
		timeout = 10
	}
	threshold := int(req.GetFailureThreshold())
	if threshold <= 0 {
		threshold = 3
	}
	if timeout >= interval {
		return nil, status.Error(codes.InvalidArgument, "timeout must be below the check interval")
	}

	monitor, err := s.MonitorRepo.CreateMonitor(model.Monitor{
		OwnerId:             ownerID,
		Name:                req.GetName(),
		Target:              req.GetTarget(),
		Type:                req.GetType(),
		Active:              true,
		Status:              "unknown",
		IntervalSeconds:     interval,
		TimeoutSeconds:      timeout,
		FailureThreshold:    threshold,
		ConsecutiveFailures: 0,
	})

	if err != nil {
		return nil, status.Error(codes.Internal, "internal server error, could not create monitor")
	}

	return &pb.MonitorResponse{
		Monitor: monitorResponse(monitor),
		Status:  "success",
	}, nil

}

func (s *MonitorServiceServer) GetMonitor(ctx context.Context, req *pb.GetMonitorRequest) (*pb.MonitorResponse, error) {

	ownerID, ok := util.UserIDFromContext(ctx)

	if !ok || ownerID == "" {
		return nil, status.Error(codes.Unauthenticated, "User is not authenticated")
	}

	if req.GetId() == "" {
		return nil, status.Error(codes.InvalidArgument, "please pass a monitor id")
	}

	monitor, err := s.MonitorRepo.GetMonitor(req.GetId(), ownerID)

	if err != nil {
		// Uniform cross-owner + missing read: NotFound (never leak whether
		// the document exists for a different owner).
		return nil, status.Error(codes.NotFound, "monitor not found")
	}

	return &pb.MonitorResponse{
		Monitor: monitorResponse(monitor),
		Status:  "success",
	}, nil

}

func (s *MonitorServiceServer) UpdateMonitor(ctx context.Context, req *pb.UpdateMonitorRequest) (*pb.MonitorResponse, error) {

	ownerID, ok := util.UserIDFromContext(ctx)

	if !ok || ownerID == "" {
		return nil, status.Error(codes.Unauthenticated, "user is not authenticated")
	}

	if req.GetId() == "" {
		return nil, status.Error(codes.InvalidArgument, "id is required")
	}

	// Patch semantics: load the caller's monitor, then overlay only the
	// request fields that are present. This lets a partial update (e.g. a
	// mute toggle, or an active flip) mutate one facet without clobbering
	// the others, and keeps the owner-scoped read as the authorization gate.
	current, err := s.MonitorRepo.GetMonitor(req.GetId(), ownerID)
	if err != nil {
		return nil, status.Error(codes.NotFound, "monitor not found")
	}

	next := *current
	next.Name = current.Name
	next.Type = current.Type
	next.Target = current.Target
	next.Active = current.Active
	next.Muted = current.Muted
	next.IntervalSeconds = current.IntervalSeconds
	next.TimeoutSeconds = current.TimeoutSeconds
	next.FailureThreshold = current.FailureThreshold

	if req.GetName() != "" {
		next.Name = req.GetName()
	}
	if req.GetType() != "" {
		next.Type = req.GetType()
	}
	if req.GetTarget() != "" {
		next.Target = req.GetTarget()
	}
	if req.Active != nil {
		next.Active = req.GetActive()
	}
	if req.Muted != nil {
		next.Muted = req.GetMuted()
	}
	if req.IntervalSeconds != nil {
		next.IntervalSeconds = int(req.GetIntervalSeconds())
	}
	if req.TimeoutSeconds != nil {
		next.TimeoutSeconds = int(req.GetTimeoutSeconds())
	}
	if req.FailureThreshold != nil {
		next.FailureThreshold = int(req.GetFailureThreshold())
	}

	if next.TimeoutSeconds >= next.IntervalSeconds {
		return nil, status.Error(codes.InvalidArgument, "timeout must be below the check interval")
	}

	updated, err := s.MonitorRepo.UpdateMonitor(req.GetId(), ownerID, next)
	if err != nil {
		return nil, status.Error(codes.NotFound, "monitor not found")
	}

	return &pb.MonitorResponse{
		Monitor: monitorResponse(updated),
		Status:  "success",
	}, nil

}

func (s *MonitorServiceServer) DeleteMonitor(ctx context.Context, req *pb.DeleteMonitorRequest) (*pb.DeleteMonitorResponse, error) {
	ownerID, ok := util.UserIDFromContext(ctx)

	if !ok || ownerID == "" {
		return nil, status.Error(codes.Unauthenticated, "user is not authenticated")
	}

	if req.GetId() == "" {
		return nil, status.Error(codes.InvalidArgument, "monitor ID is required")
	}

	result, err := s.MonitorRepo.DeleteMonitor(req.GetId(), ownerID)
	if err != nil {
		return nil, err
	}

	if result.DeletedCount == 0 {
		return nil, status.Error(codes.NotFound, "monitor was not found; nothing was deleted")
	}

	return &pb.DeleteMonitorResponse{
		Data:   "Monitor Deleted",
		Status: "success",
	}, nil
}

func (s *MonitorServiceServer) ListMonitors(ctx context.Context, req *pb.ListMonitorsRequest) (*pb.ListMonitorsResponse, error) {

	ownerID, ok := util.UserIDFromContext(ctx)

	if !ok || ownerID == "" {
		return nil, status.Error(codes.Unauthenticated, "user is not authenticated")
	}

	monitor, err := s.MonitorRepo.ListMonitors(ownerID)

	if err != nil {
		return nil, err
	}

	return &pb.ListMonitorsResponse{
		Monitors: monitorsResponse(monitor),
	}, nil

}

func (s *MonitorServiceServer) GetStatusPage(
	ctx context.Context,
	req *pb.GetStatusPageRequest,
) (*pb.GetStatusPageResponse, error) {
	ownerID := req.GetOwnerId()
	pageName := ""

	// A public slug resolves to an owner through the StatusPage document —
	// /status/{slug} must never require knowing a raw owner id.
	if ownerID == "" && req.GetSlug() != "" {
		page, err := s.StatusPageRepo.GetBySlug(req.GetSlug())
		if err != nil {
			return nil, status.Error(codes.NotFound, "status page not found")
		}
		ownerID = page.OwnerId
		pageName = page.Name
	}

	if ownerID == "" {
		return nil, status.Error(codes.InvalidArgument, "owner_id or slug is required")
	}
	monitors, err := s.MonitorRepo.ListMonitors(ownerID)
	if err != nil {
		return nil, status.Error(codes.Internal, "could not list monitors")
	}

	monitorIDs := monitorIDs(monitors)

	activeIncidents, err := s.IncidentRepo.ListActiveIncidentsByMonitors(monitorIDs)
	if err != nil {
		return nil, status.Error(codes.Internal, "could not list active incidents")
	}

	historicalIncidents, err := s.IncidentRepo.ListResolvedIncidentsByMonitors(monitorIDs, 50)
	if err != nil {
		return nil, status.Error(codes.Internal, "could not list historical incidents")
	}

	totalChecks, successfulChecks, uptimePercentage, err := s.recentUptimeStats(monitors)
	if err != nil {
		return nil, status.Error(codes.Internal, "could not calculate uptime statistics")
	}

	components, err := s.statusPageComponents(monitors)
	if err != nil {
		return nil, status.Error(codes.Internal, "could not build status page components")
	}

	if pageName == "" {
		pageName = req.GetSlug()
	}

	return &pb.GetStatusPageResponse{
		Monitors:            monitorsResponse(monitors),
		ActiveIncidents:     incidentsResponse(activeIncidents),
		HistoricalIncidents: incidentsResponse(historicalIncidents),
		UptimePercentage:    uptimePercentage,
		TotalChecks:         totalChecks,
		SuccessfulChecks:    successfulChecks,
		Components:          components,
		PageName:            pageName,
	}, nil
}

// statusPageComponents renders one row per monitor from the same persisted
// CheckResult data the detail view uses — no second metrics system. Each row
// carries the 90-day daily strip, the window uptime percentage (derived from
// the same daily buckets so the row and its strip cannot disagree) and the
// observed p95 response time.
func (s *MonitorServiceServer) statusPageComponents(monitors []*model.Monitor) ([]*pb.StatusPageComponent, error) {
	const days = 90

	components := make([]*pb.StatusPageComponent, 0, len(monitors))

	for _, monitor := range monitors {
		monitorID := monitor.Id.Hex()

		daily, err := s.CheckResultRepo.ListDailyUptime(monitorID, time.Now().AddDate(0, 0, -days))
		if err != nil {
			return nil, err
		}

		// CountTotalSince/CountSuccessfulSince are the same raw counters the
		// rollup aggregates; used here so a row with data outside the daily
		// window still reports honestly instead of silently reading 0%.
		since := time.Now().AddDate(0, 0, -days)
		total, err := s.CheckResultRepo.CountTotalSince(monitorID, since)
		if err != nil {
			return nil, err
		}
		successful, err := s.CheckResultRepo.CountSuccessfulSince(monitorID, since)
		if err != nil {
			return nil, err
		}

		uptimePct := 0.0
		if total > 0 {
			uptimePct = (float64(successful) / float64(total)) * 100
		}

		p95, err := s.CheckResultRepo.P95ResponseTimeSince(monitorID, since)
		if err != nil {
			return nil, err
		}

		components = append(components, &pb.StatusPageComponent{
			MonitorId:   monitorID,
			Name:        monitor.Name,
			Status:      monitor.Status,
			HasUptime:   total > 0,
			UptimePct:   uptimePct,
			Days:        uptimeDays(daily, monitor.IntervalSeconds, days),
			P95Ms:       p95,
			LastCheckAt: formatOptionalTime(monitor.LastCheckedAt),
		})
	}

	return components, nil
}

func (s *MonitorServiceServer) GetRecentChecks(ctx context.Context, req *pb.GetRecentChecksRequest) (*pb.GetRecentChecksResponse, error) {
	if req.GetMonitorId() == "" {
		return nil, status.Error(codes.InvalidArgument, "monitor_id is required")
	}

	limit := req.GetLimit()
	if limit <= 0 {
		limit = 50
	}

	checks, err := s.CheckResultRepo.ListRecentByMonitor(req.GetMonitorId(), int64(limit))
	if err != nil {
		return nil, status.Error(codes.Internal, "could not retrieve recent checks")
	}

	protoChecks := make([]*pb.MonitorCheck, 0, len(checks))
	for _, check := range checks {
		protoChecks = append(protoChecks, &pb.MonitorCheck{
			MonitorId:    check.MonitorID,
			Success:      check.Status == "up",
			ResponseTime: int32(check.ResponseTimeMs),
			StatusCode:   int32(check.StatusCode),
			CheckedAt:    check.CheckedAt.Format(time.RFC3339),
		})
	}

	return &pb.GetRecentChecksResponse{
		Checks: protoChecks,
	}, nil
}

func (s *MonitorServiceServer) GetMonitorHistory(ctx context.Context, req *pb.GetMonitorHistoryRequest) (*pb.GetMonitorHistoryResponse, error) {
	ownerID, ok := util.UserIDFromContext(ctx)
	if !ok || ownerID == "" {
		return nil, status.Error(codes.Unauthenticated, "user is not authenticated")
	}
	if req.GetMonitorId() == "" {
		return nil, status.Error(codes.InvalidArgument, "monitor_id is required")
	}

	// Owner-scoped read gate: a caller can only view its own monitor's data.
	if _, err := s.MonitorRepo.GetMonitor(req.GetMonitorId(), ownerID); err != nil {
		return nil, status.Error(codes.NotFound, "monitor not found")
	}

	days := int(req.GetDays())
	if days <= 0 {
		days = 90
	}
	if days > 90 {
		days = 90
	}

	limit := int64(req.GetLimit())
	if limit <= 0 {
		limit = 100
	}
	if limit > 500 {
		limit = 500
	}

	checks, err := s.CheckResultRepo.ListRecentByMonitor(req.GetMonitorId(), limit)
	if err != nil {
		return nil, status.Error(codes.Internal, "could not retrieve recent checks")
	}

	protoChecks := make([]*pb.MonitorCheck, 0, len(checks))
	for _, check := range checks {
		protoChecks = append(protoChecks, &pb.MonitorCheck{
			MonitorId:    check.MonitorID,
			Success:      check.Status == "up",
			ResponseTime: int32(check.ResponseTimeMs),
			StatusCode:   int32(check.StatusCode),
			CheckedAt:    check.CheckedAt.Format(time.RFC3339),
		})
	}

	// Per-day uptime aggregates from the persisted CheckResult data. Gaps
	// (no checks on a day) render as nodata days; down_minutes is estimated
	// from failed checks × the check interval, honest about its resolution.
	// The monitor's interval is read from the persisted record.
	monitor, err := s.MonitorRepo.GetMonitor(req.GetMonitorId(), ownerID)
	if err != nil {
		return nil, status.Error(codes.NotFound, "monitor not found")
	}
	intervalSeconds := monitor.IntervalSeconds
	if intervalSeconds <= 0 {
		intervalSeconds = 60
	}

	since := time.Now().UTC().AddDate(0, 0, -days)

	aggregates, err := s.CheckResultRepo.ListDailyUptime(req.GetMonitorId(), since)
	if err != nil {
		return nil, status.Error(codes.Internal, "could not aggregate uptime")
	}

	var total int64
	var successful int64
	for _, agg := range aggregates {
		total += agg.Total
		successful += agg.Successful
	}

	response := &pb.GetMonitorHistoryResponse{
		RecentChecks: protoChecks,
		Days:         uptimeDays(aggregates, intervalSeconds, days),
	}
	if total > 0 {
		response.HasUptime = true
		response.OverallUptimePct = (float64(successful) / float64(total)) * 100
	}

	return response, nil
}

// uptimeDays renders a fixed-width, oldest-first window of per-day uptime
// rows from sparse daily aggregates. A day with no checks is emitted with
// HasData=false so the strip renders a nodata gap rather than a fake 100%.
// down_minutes is derived from failed checks × the check interval — an
// estimate at check resolution, capped at a full day.
func uptimeDays(aggregates []*model.DailyUptime, intervalSeconds, days int) []*pb.MonitorUptimeDay {
	now := time.Now().UTC()
	startOfToday := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)

	byDate := make(map[string]*model.DailyUptime, len(aggregates))
	for _, agg := range aggregates {
		byDate[agg.Date] = agg
	}

	response := make([]*pb.MonitorUptimeDay, 0, days)
	for i := days - 1; i >= 0; i-- {
		date := startOfToday.AddDate(0, 0, -i).Format("2006-01-02")
		agg, ok := byDate[date]
		if !ok || agg.Total == 0 {
			response = append(response, &pb.MonitorUptimeDay{Date: date, HasData: false})
			continue
		}

		downMinutes := int64(0)
		if agg.Total > agg.Successful {
			downMinutes = (agg.Total - agg.Successful) * int64(intervalSeconds) / 60
			if downMinutes > 1440 {
				downMinutes = 1440
			}
		}

		response = append(response, &pb.MonitorUptimeDay{
			Date:        date,
			HasData:     true,
			UptimePct:   (float64(agg.Successful) / float64(agg.Total)) * 100,
			DownMinutes: downMinutes,
		})
	}

	return response
}

func formatOptionalTime(value *time.Time) string {
	if value == nil {
		return ""
	}
	return value.Format(time.RFC3339)
}

func (s *MonitorServiceServer) ListIncidents(ctx context.Context, req *pb.ListIncidentsRequest) (*pb.ListIncidentsResponse, error) {
	ownerID, ok := util.UserIDFromContext(ctx)
	if !ok || ownerID == "" {
		return nil, status.Error(codes.Unauthenticated, "user is not authenticated")
	}

	if req.GetMonitorId() != "" {
		// Owner-scoped: the monitor must belong to the caller.
		if _, err := s.MonitorRepo.GetMonitor(req.GetMonitorId(), ownerID); err != nil {
			return nil, status.Error(codes.NotFound, "monitor not found")
		}
		incidents, err := s.IncidentRepo.ListIncidentsByMonitor(req.GetMonitorId(), 100)
		if err != nil {
			return nil, status.Error(codes.Internal, "could not list incidents")
		}
		return &pb.ListIncidentsResponse{Incidents: incidentsResponse(incidents)}, nil
	}

	monitors, err := s.MonitorRepo.ListMonitors(ownerID)
	if err != nil {
		return nil, status.Error(codes.Internal, "could not list monitors")
	}

	incidents, err := s.IncidentRepo.ListIncidentsByMonitorIDs(monitorIDs(monitors), 100)
	if err != nil {
		return nil, status.Error(codes.Internal, "could not list incidents")
	}

	return &pb.ListIncidentsResponse{Incidents: incidentsResponse(incidents)}, nil
}

func (s *MonitorServiceServer) GetMonitorInsight(ctx context.Context, req *pb.GetMonitorInsightRequest) (*pb.GetMonitorInsightResponse, error) {
	if req.GetMonitorId() == "" {
		return nil, status.Error(codes.InvalidArgument, "monitor_id is required")
	}

	if s.InsightClient == nil {
		return nil, status.Error(codes.Unavailable, "insight service not available")
	}

	insightResp, err := s.InsightClient.GetMonitorInsight(ctx, req)
	if err != nil {
		return nil, err
	}

	return insightResp, nil
}

func (s *MonitorServiceServer) recentUptimeStats(monitors []*model.Monitor) (int64, int64, float64, error) {
	since := time.Now().Add(-24 * time.Hour)

	var totalChecks int64
	var successfulChecks int64

	for _, monitor := range monitors {
		monitorID := monitor.Id.Hex()

		total, err := s.CheckResultRepo.CountTotalSince(monitorID, since)
		if err != nil {
			return 0, 0, 0, err
		}

		successful, err := s.CheckResultRepo.CountSuccessfulSince(monitorID, since)
		if err != nil {
			return 0, 0, 0, err
		}

		totalChecks += total
		successfulChecks += successful
	}

	if totalChecks == 0 {
		return 0, 0, 0, nil
	}

	uptimePercentage := (float64(successfulChecks) / float64(totalChecks)) * 100
	return totalChecks, successfulChecks, uptimePercentage, nil
}

func monitorIDs(monitors []*model.Monitor) []string {
	ids := make([]string, 0, len(monitors))

	for _, monitor := range monitors {
		ids = append(ids, monitor.Id.Hex())
	}

	return ids
}

func monitorsResponse(monitors []*model.Monitor) []*pb.Monitor {
	response := make([]*pb.Monitor, 0, len(monitors))

	for _, monitor := range monitors {
		response = append(response, monitorResponse(monitor))
	}

	return response
}

func monitorResponse(monitor *model.Monitor) *pb.Monitor {
	lastCheckedAt := ""
	if monitor.LastCheckedAt != nil {
		lastCheckedAt = monitor.LastCheckedAt.Format(time.RFC3339)
	}

	return &pb.Monitor{
		Id:                  monitor.Id.Hex(),
		OwnerId:             monitor.OwnerId,
		Name:                monitor.Name,
		Target:              monitor.Target,
		Type:                monitor.Type,
		CreatedAt:           monitor.CreatedAt.Format(time.RFC3339),
		UpdatedAt:           monitor.UpdatedAt.Format(time.RFC3339),
		Active:              monitor.Active,
		Status:              monitor.Status,
		IntervalSeconds:     int32(monitor.IntervalSeconds),
		TimeoutSeconds:      int32(monitor.TimeoutSeconds),
		FailureThreshold:    int32(monitor.FailureThreshold),
		ConsecutiveFailures: int32(monitor.ConsecutiveFailures),
		Muted:               monitor.Muted,
		LastCheckedAt:       lastCheckedAt,
		LastResponseTimeMs:  monitor.LastResponseTimeMs,
		LastStatusCode:      int32(monitor.LastStatusCode),
	}
}

func incidentsResponse(incidents []*model.Incident) []*pb.Incident {
	response := make([]*pb.Incident, 0, len(incidents))

	for _, incident := range incidents {
		response = append(response, incidentResponse(incident))
	}

	return response
}

func incidentResponse(incident *model.Incident) *pb.Incident {
	resolvedAt := ""
	if incident.ResolvedAt != nil {
		resolvedAt = incident.ResolvedAt.Format(time.RFC3339)
	}

	return &pb.Incident{
		Id:              incident.Id.Hex(),
		MonitorId:       incident.MonitorID,
		Title:           incident.Title,
		FailureReason:   incident.FailureReason,
		Status:          incident.Status,
		StartedAt:       incident.StartedAt.Format(time.RFC3339),
		ResolvedAt:      resolvedAt,
		DurationSeconds: incident.DurationSeconds,
	}
}
