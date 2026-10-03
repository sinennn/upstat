import type * as grpcWeb from "grpc-web";

import { env } from "@/config/env";
import { getSessionToken } from "@/auth/session";
import { MonitorServiceClient } from "@/proto/MonitorServiceClientPb";
import { UserServiceClient } from "@/proto/UserServiceClientPb";
import { ApiError } from "../../errors";
import { fakeMonitorClient, fakeUserClient } from "./fake-backend";

/**
 * gRPC-Web transport — the real backend seam for the uptime/monitoring
 * vertical.
 *
 *   view → controller → repository (grpc/*) → this transport →
 *   gRPC-Web → Envoy (:8082) → api/common gRPC (:8080) → Mongo
 *
 * This module and its siblings under `grpc/` are the ONLY place the app
 * speaks gRPC; views never see it (enforced by `check:boundaries`) and
 * controllers never touch it.
 */

/**
 * gRPC status codes we can receive (grpc-web `StatusCode` enum values).
 * Declared numerically rather than imported from the enum so this file does
 * not need a value import of `grpc-web` (types only).
 */
const GRPC_INVALID_ARGUMENT = 3;
const GRPC_NOT_FOUND = 5;
const GRPC_ALREADY_EXISTS = 6;
const GRPC_PERMISSION_DENIED = 7;
const GRPC_FAILED_PRECONDITION = 9;
const GRPC_UNIMPLEMENTED = 12;
const GRPC_INTERNAL = 13;
const GRPC_UNAVAILABLE = 14;
const GRPC_UNAUTHENTICATED = 16;

/**
 * gRPC status → (HTTP-equivalent status, stable snake_case code).
 *
 * The repositories speak the ecosystem error envelope (models/errors.ts);
 * gRPC has its own code space, so every RPC failure is normalized here —
 * once, at the boundary — instead of leaking `RpcError` into controllers.
 */
function envelopeFor(code: number): { status: number; code: string } {
  switch (code) {
    case GRPC_INVALID_ARGUMENT:
      return { status: 422, code: "bad_shape" };
    case GRPC_NOT_FOUND:
      // Cross-tenant reads always read `not_found` (errors.ts contract):
      // the backend returns NotFound for another owner's monitor.
      return { status: 404, code: "not_found" };
    case GRPC_ALREADY_EXISTS:
      return { status: 409, code: "already_exists" };
    case GRPC_PERMISSION_DENIED:
      return { status: 403, code: "forbidden" };
    case GRPC_FAILED_PRECONDITION:
      return { status: 412, code: "failed_precondition" };
    case GRPC_UNIMPLEMENTED:
      return { status: 501, code: "unimplemented" };
    case GRPC_UNAUTHENTICATED:
      return { status: 401, code: "unauthenticated" };
    case GRPC_UNAVAILABLE:
      return { status: 503, code: "unavailable" };
    case GRPC_INTERNAL:
    default:
      return { status: 500, code: "internal" };
  }
}

/** The RPC surface the repositories use — real client or TEST_MODE fake. */
export type MonitorRpc = Pick<
  MonitorServiceClient,
  | "createMonitor"
  | "updateMonitor"
  | "getMonitor"
  | "listMonitors"
  | "deleteMonitor"
  | "getStatusPage"
  | "getRecentChecks"
  | "getMonitorHistory"
  | "getMonitorInsight"
  | "listIncidents"
>;

export type UserRpc = Pick<
  UserServiceClient,
  "getUser" | "googleAuth" | "createUser" | "updateUser" | "deleteUser"
>;

let monitorClient: MonitorRpc | null = null;
let userClient: UserRpc | null = null;

/**
 * `proto.MonitorService` — the Envoy gRPC-Web endpoint, or in TEST_MODE the
 * in-memory fake that mirrors the Go handlers (fake-backend.ts).
 */
export function monitorClientFor(): MonitorRpc {
  if (!monitorClient) {
    monitorClient = env.testMode
      ? fakeMonitorClient
      : new MonitorServiceClient(env.envoyUrl);
  }
  return monitorClient;
}

/** `proto.UserService` — real client, or the TEST_MODE fake. */
export function userClientFor(): UserRpc {
  if (!userClient) {
    userClient = env.testMode
      ? fakeUserClient
      : new UserServiceClient(env.envoyUrl);
  }
  return userClient;
}

/**
 * Request metadata carrying the gateway session. `authorization` is on the
 * Envoy CORS allow-list (deploy/helm/envoy/envoy.yaml), so the browser
 * preflight passes it through untouched.
 */
export function authMetadata(): grpcWeb.Metadata {
  const token = getSessionToken();
  return token ? { authorization: `Bearer ${token}` } : {};
}

export interface RpcCallOptions {
  /** Send the bearer session (authenticated RPCs). Default: true. */
  authenticated?: boolean;
}

/**
 * Runs a unary gRPC-Web call and normalizes failures into `ApiError`.
 *
 * `RpcError.code` is the numeric gRPC status and `message` is the backend's
 * `status.Error` text (e.g. "monitor not found"); both are preserved so the
 * UI copy stays truthful to what the service actually rejected.
 */
export async function call<T>(
  run: (metadata: grpcWeb.Metadata) => Promise<T>,
  options: RpcCallOptions = {},
): Promise<T> {
  const authenticated = options.authenticated ?? true;
  const metadata = authenticated ? authMetadata() : {};
  try {
    return await run(metadata);
  } catch (e) {
    const rpc = e as { code?: number; message?: string };
    if (typeof rpc?.code === "number") {
      const { status, code } = envelopeFor(rpc.code);
      throw new ApiError(status, {
        code,
        message: rpc.message || "the monitoring service rejected the request",
      });
    }
    // Transport-level failure (Envoy unreachable, CORS, offline): the
    // backend never answered, so report it as unavailable rather than
    // pretending it was a bad request.
    throw new ApiError(503, {
      code: "unavailable",
      message: e instanceof Error ? e.message : "the backend is unreachable",
    });
  }
}
