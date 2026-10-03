/**
 * @fileoverview gRPC-Web client stub for `proto.MonitorService`
 * (source: `src/proto/user.proto`; package `proto` — matches the Go backend).
 * Serves the real uptime/monitoring vertical: monitors CRUD, status pages,
 * check history, uptime stats, incidents, and monitor insights.
 */

/* eslint-disable */
import * as grpcWeb from "grpc-web";

import * as user_pb from "./user_pb";

const PREFIX = "/proto.MonitorService";

function descriptor<REQ, RESP>(
  method: string,
  requestType: new () => REQ,
  responseType: { deserializeBinary(bytes: Uint8Array): RESP },
) {
  return new grpcWeb.MethodDescriptor(
    PREFIX + "/" + method,
    grpcWeb.MethodType.UNARY,
    requestType,
    responseType as unknown as new (...args: unknown[]) => RESP,
    (request: REQ) => (request as { serializeBinary(): Uint8Array }).serializeBinary(),
    (bytes: Uint8Array) => responseType.deserializeBinary(bytes),
  );
}

export class MonitorServiceClient {
  client_: grpcWeb.GrpcWebClientBase;
  hostname_: string;

  constructor(hostname: string, _credentials?: null, _options?: null) {
    this.client_ = new grpcWeb.GrpcWebClientBase({ format: "text" });
    this.hostname_ = hostname.replace(/\/+$/, "");
  }

  createMonitor(
    request: user_pb.CreateMonitorRequest,
    metadata?: grpcWeb.Metadata,
  ): Promise<user_pb.MonitorResponse> {
    return this.client_.thenableCall(
      this.hostname_ + PREFIX + "/CreateMonitor",
      request,
      metadata ?? {},
      descriptor("CreateMonitor", user_pb.CreateMonitorRequest, user_pb.MonitorResponse),
    );
  }

  updateMonitor(
    request: user_pb.UpdateMonitorRequest,
    metadata?: grpcWeb.Metadata,
  ): Promise<user_pb.MonitorResponse> {
    return this.client_.thenableCall(
      this.hostname_ + PREFIX + "/UpdateMonitor",
      request,
      metadata ?? {},
      descriptor("UpdateMonitor", user_pb.UpdateMonitorRequest, user_pb.MonitorResponse),
    );
  }

  getMonitor(
    request: user_pb.GetMonitorRequest,
    metadata?: grpcWeb.Metadata,
  ): Promise<user_pb.MonitorResponse> {
    return this.client_.thenableCall(
      this.hostname_ + PREFIX + "/GetMonitor",
      request,
      metadata ?? {},
      descriptor("GetMonitor", user_pb.GetMonitorRequest, user_pb.MonitorResponse),
    );
  }

  listMonitors(
    request: user_pb.ListMonitorsRequest,
    metadata?: grpcWeb.Metadata,
  ): Promise<user_pb.ListMonitorsResponse> {
    return this.client_.thenableCall(
      this.hostname_ + PREFIX + "/ListMonitors",
      request,
      metadata ?? {},
      descriptor("ListMonitors", user_pb.ListMonitorsRequest, user_pb.ListMonitorsResponse),
    );
  }

  deleteMonitor(
    request: user_pb.DeleteMonitorRequest,
    metadata?: grpcWeb.Metadata,
  ): Promise<user_pb.DeleteMonitorResponse> {
    return this.client_.thenableCall(
      this.hostname_ + PREFIX + "/DeleteMonitor",
      request,
      metadata ?? {},
      descriptor("DeleteMonitor", user_pb.DeleteMonitorRequest, user_pb.DeleteMonitorResponse),
    );
  }

  getStatusPage(
    request: user_pb.GetStatusPageRequest,
    metadata?: grpcWeb.Metadata,
  ): Promise<user_pb.GetStatusPageResponse> {
    return this.client_.thenableCall(
      this.hostname_ + PREFIX + "/GetStatusPage",
      request,
      metadata ?? {},
      descriptor("GetStatusPage", user_pb.GetStatusPageRequest, user_pb.GetStatusPageResponse),
    );
  }

  getRecentChecks(
    request: user_pb.GetRecentChecksRequest,
    metadata?: grpcWeb.Metadata,
  ): Promise<user_pb.GetRecentChecksResponse> {
    return this.client_.thenableCall(
      this.hostname_ + PREFIX + "/GetRecentChecks",
      request,
      metadata ?? {},
      descriptor("GetRecentChecks", user_pb.GetRecentChecksRequest, user_pb.GetRecentChecksResponse),
    );
  }

  getMonitorHistory(
    request: user_pb.GetMonitorHistoryRequest,
    metadata?: grpcWeb.Metadata,
  ): Promise<user_pb.GetMonitorHistoryResponse> {
    return this.client_.thenableCall(
      this.hostname_ + PREFIX + "/GetMonitorHistory",
      request,
      metadata ?? {},
      descriptor("GetMonitorHistory", user_pb.GetMonitorHistoryRequest, user_pb.GetMonitorHistoryResponse),
    );
  }

  getMonitorInsight(
    request: user_pb.GetMonitorInsightRequest,
    metadata?: grpcWeb.Metadata,
  ): Promise<user_pb.GetMonitorInsightResponse> {
    return this.client_.thenableCall(
      this.hostname_ + PREFIX + "/GetMonitorInsight",
      request,
      metadata ?? {},
      descriptor("GetMonitorInsight", user_pb.GetMonitorInsightRequest, user_pb.GetMonitorInsightResponse),
    );
  }

  listIncidents(
    request: user_pb.ListIncidentsRequest,
    metadata?: grpcWeb.Metadata,
  ): Promise<user_pb.ListIncidentsResponse> {
    return this.client_.thenableCall(
      this.hostname_ + PREFIX + "/ListIncidents",
      request,
      metadata ?? {},
      descriptor("ListIncidents", user_pb.ListIncidentsRequest, user_pb.ListIncidentsResponse),
    );
  }
}
