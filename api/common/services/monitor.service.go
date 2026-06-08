package services

import (
	"context"
	"github.com/CuesoftCloud/upstat/config"
	"github.com/CuesoftCloud/upstat/models"
	pb "github.com/CuesoftCloud/upstat/proto"
	"github.com/CuesoftCloud/upstat/repositories"
	"github.com/CuesoftCloud/upstat/utils"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"time"
)

type MonitorServiceServer struct {
	pb.UnimplementedMonitorServiceServer
	MonitorRepo repositories.MonitorRepository
}

func NewMonitorServiceServer(db *config.DB) *MonitorServiceServer {
	return &MonitorServiceServer{
		MonitorRepo: repositories.NewMonitorRepository(db),
	}
}

func (s *MonitorServiceServer) CreateMonitor(ctx context.Context, req *pb.CreateMonitorRequest) (*pb.MonitorResponse, error) {
	ownerID, ok := utils.UserIDFromContext(ctx)

	if !ok || ownerID == "" {
		return nil, status.Error(codes.Unauthenticated, "missing authentiacated user")
	}

	if req.GetName() == "" || req.GetType() == "" || req.GetTarget() == "" {
		return nil, status.Error(codes.InvalidArgument, "name, type and target required")
	}

	monitor, err := s.MonitorRepo.CreateMonitor(models.Monitor{
		OwnerId:             ownerID,
		Name:                req.GetName(),
		Target:              req.GetTarget(),
		Type:                req.GetType(),
		Active:              true,
		Status:              "unknown",
		IntervalSeconds:     60,
		TimeoutSeconds:      10,
		FailureThreshold:    3,
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

	ownerID, ok := utils.UserIDFromContext(ctx)

	if !ok || ownerID == "" {
		return nil, status.Error(codes.Unauthenticated, "User is not authenticated")
	}

	if req.GetId() == "" {
		return nil, status.Error(codes.InvalidArgument, "please pass a monitor id")
	}

	monitor, err := s.MonitorRepo.GetMonitor(req.GetId(), ownerID)

	if err != nil {
		return nil, err
	}

	return &pb.MonitorResponse{
		Monitor: monitorResponse(monitor),
		Status:  "success",
	}, nil

}

func (s *MonitorServiceServer) UpdateMonitor(ctx context.Context, req *pb.UpdateMonitorRequest) (*pb.MonitorResponse, error) {

	ownerID, ok := utils.UserIDFromContext(ctx)

	if !ok || ownerID == "" {
		return nil, status.Error(codes.Unauthenticated, "user is not authenticated")
	}

	if req.GetId() == "" || req.GetName() == "" || req.GetType() == "" || req.GetTarget() == "" {
		return nil, status.Error(codes.InvalidArgument, "id, name, type and target required")
	}

	monitor, err := s.MonitorRepo.UpdateMonitor(req.GetId(), ownerID, models.Monitor{
		OwnerId: ownerID,
		Name:    req.GetName(),
		Type:    req.GetType(),
		Target:  req.GetTarget(),
	})

	if err != nil {
		return nil, status.Error(codes.NotFound, "monitor not found")
	}

	return &pb.MonitorResponse{
		Monitor: monitorResponse(monitor),
		Status:  "success",
	}, nil

}

func (s *MonitorServiceServer) DeleteMonitor(ctx context.Context, req *pb.DeleteMonitorRequest) (*pb.DeleteMonitorResponse, error) {
	ownerID, ok := utils.UserIDFromContext(ctx)

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

	ownerID, ok := utils.UserIDFromContext(ctx)

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

func monitorsResponse(monitors []*models.Monitor) []*pb.Monitor {
	response := make([]*pb.Monitor, 0, len(monitors))

	for _, monitor := range monitors {
		response = append(response, monitorResponse(monitor))
	}

	return response
}

func monitorResponse(monitor *models.Monitor) *pb.Monitor {
	return &pb.Monitor{
		Id:        monitor.Id.Hex(),
		OwnerId:   monitor.OwnerId,
		Name:      monitor.Name,
		Target:    monitor.Target,
		Type:      monitor.Type,
		CreatedAt: monitor.CreatedAt.Format(time.RFC3339),
		UpdatedAt: monitor.UpdatedAt.Format(time.RFC3339),
	}
}
