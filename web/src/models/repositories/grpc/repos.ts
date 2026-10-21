import * as pb from "@/proto/user_pb";
import type { GatewaySession } from "@/auth/session";
import type {
  CheckResult,
  Incident,
  Monitor,
  MonitorHistory,
  MonitorInput,
  MonitorInsight,
  MonitorPatch,
  ProfilePatch,
  StatusPage,
} from "../..";
import { ApiError } from "../../errors";
import {
  checkFrom,
  historyFrom,
  incidentFrom,
  insightFrom,
  monitorFrom,
  statusPageFrom,
  userFrom,
} from "./mappers";
import { call, monitorClientFor, userClientFor } from "./transport";

/**
 * Repositories — one method per backend RPC the UI uses, nothing more.
 * `proto.UserService` + `proto.MonitorService` over gRPC-Web (or the
 * TEST_MODE fake at the transport seam).
 */

function sessionFrom(r: pb.GetUserResponse): GatewaySession {
  return { token: r.getToken(), user: userFrom(r) };
}

/** Session minting — the allowlisted, unauthenticated RPCs. */
export const authRepo = {
  /** UserService/GoogleAuth — find-or-create by verified Google email. */
  google: (idToken: string): Promise<GatewaySession> =>
    call(
      async (md) =>
        sessionFrom(
          await userClientFor().googleAuth(
            new pb.GoogleAuthRequest().setIdToken(idToken),
            md,
          ),
        ),
      { authenticated: false },
    ),

  /** UserService/GetUser with a password — email sign-in. */
  password: (email: string, password: string): Promise<GatewaySession> =>
    call(
      async (md) =>
        sessionFrom(
          await userClientFor().getUser(
            new pb.GetUserRequest().setEmail(email).setPassword(password),
            md,
          ),
        ),
      { authenticated: false },
    ),

  /** UserService/CreateUser — returns no session; sign in afterwards. */
  register: (name: string, email: string, password: string) =>
    call(
      async (md) => {
        await userClientFor().createUser(
          new pb.CreateUserRequest()
            .setName(name)
            .setEmail(email)
            .setPassword(password),
          md,
        );
      },
      { authenticated: false },
    ),
};

/** UpdateUser / DeleteUser — always called with the signed-in user's id. */
export const accountRepo = {
  update: (id: string, patch: ProfilePatch) => {
    const req = new pb.UpdateUserRequest().setId(id);
    if (patch.name) req.setName(patch.name);
    if (patch.email) req.setEmail(patch.email);
    if (patch.password) req.setPassword(patch.password);
    return call(async (md) => {
      await userClientFor().updateUser(req, md);
    });
  },
  remove: (id: string) =>
    call(async (md) => {
      await userClientFor().deleteUser(
        new pb.DeleteUserRequest().setId(id),
        md,
      );
    }),
};

function monitorOrThrow(r: pb.MonitorResponse): Monitor {
  const m = r.getMonitor();
  if (!m) {
    throw new ApiError(500, {
      code: "internal",
      message: "the monitoring service returned no monitor",
    });
  }
  return monitorFrom(m);
}

export const monitorsRepo = {
  list: (): Promise<Monitor[]> =>
    call(async (md) =>
      (await monitorClientFor().listMonitors(new pb.ListMonitorsRequest(), md))
        .getMonitorsList()
        .map(monitorFrom),
    ),

  get: (id: string): Promise<Monitor> =>
    call(async (md) =>
      monitorOrThrow(
        await monitorClientFor().getMonitor(
          new pb.GetMonitorRequest().setId(id),
          md,
        ),
      ),
    ),

  create: (input: MonitorInput): Promise<Monitor> => {
    const req = new pb.CreateMonitorRequest()
      .setName(input.name)
      .setType(input.type)
      .setTarget(input.target);
    // omitted → the backend's defaults (60s / 10s / 3)
    if (input.interval_seconds) req.setIntervalSeconds(input.interval_seconds);
    if (input.timeout_seconds) req.setTimeoutSeconds(input.timeout_seconds);
    if (input.failure_threshold)
      req.setFailureThreshold(input.failure_threshold);
    return call(async (md) =>
      monitorOrThrow(await monitorClientFor().createMonitor(req, md)),
    );
  },

  /** Patch: only the fields present in `patch` are sent. */
  update: (id: string, patch: MonitorPatch): Promise<Monitor> => {
    const req = new pb.UpdateMonitorRequest().setId(id);
    if (patch.name) req.setName(patch.name);
    if (patch.type) req.setType(patch.type);
    if (patch.target) req.setTarget(patch.target);
    if (patch.active !== undefined) req.setActive(patch.active);
    if (patch.muted !== undefined) req.setMuted(patch.muted);
    if (patch.interval_seconds !== undefined)
      req.setIntervalSeconds(patch.interval_seconds);
    if (patch.timeout_seconds !== undefined)
      req.setTimeoutSeconds(patch.timeout_seconds);
    if (patch.failure_threshold !== undefined)
      req.setFailureThreshold(patch.failure_threshold);
    return call(async (md) =>
      monitorOrThrow(await monitorClientFor().updateMonitor(req, md)),
    );
  },

  remove: (id: string): Promise<void> =>
    call(async (md) => {
      await monitorClientFor().deleteMonitor(
        new pb.DeleteMonitorRequest().setId(id),
        md,
      );
    }),

  /** 90 daily buckets + the most recent checks (default 100, max 500). */
  history: (id: string, limit?: number): Promise<MonitorHistory> => {
    const req = new pb.GetMonitorHistoryRequest().setMonitorId(id);
    if (limit) req.setLimit(limit);
    return call(async (md) =>
      historyFrom(id, await monitorClientFor().getMonitorHistory(req, md)),
    );
  },

  /**
   * GetRecentChecks — newest first. Backs the list sparklines: one cheap
   * call per monitor instead of a 90-day history aggregation.
   */
  recentChecks: (id: string, limit = 30): Promise<CheckResult[]> =>
    call(async (md) =>
      (
        await monitorClientFor().getRecentChecks(
          new pb.GetRecentChecksRequest().setMonitorId(id).setLimit(limit),
          md,
        )
      )
        .getChecksList()
        .map(checkFrom),
    ),

  insight: (id: string): Promise<MonitorInsight | null> =>
    call(async (md) => {
      const i = (
        await monitorClientFor().getMonitorInsight(
          new pb.GetMonitorInsightRequest().setMonitorId(id),
          md,
        )
      ).getInsight();
      return i ? insightFrom(i) : null;
    }),
};

export const incidentsRepo = {
  /**
   * The caller's incidents (newest first, max 100), optionally for one
   * monitor. Monitor names are joined client-side — the wire has only ids.
   */
  list: (monitorId?: string): Promise<Incident[]> =>
    call(async (md) => {
      const client = monitorClientFor();
      const req = new pb.ListIncidentsRequest();
      if (monitorId) req.setMonitorId(monitorId);
      const [incidents, monitors] = await Promise.all([
        client.listIncidents(req, md),
        client.listMonitors(new pb.ListMonitorsRequest(), md),
      ]);
      const names = new Map(
        monitors.getMonitorsList().map((m) => [m.getId(), m.getName()]),
      );
      return incidents.getIncidentsList().map((i) => incidentFrom(i, names));
    }),

  /** No GetIncident RPC exists — found within the caller's list. */
  get: async (id: string): Promise<Incident> => {
    const found = (await incidentsRepo.list()).find((i) => i.id === id);
    if (!found) {
      throw new ApiError(404, {
        code: "not_found",
        message: "incident not found",
      });
    }
    return found;
  },
};

/** GetStatusPage — public, by slug or by owner id. */
export const statusRepo = {
  bySlug: (slug: string): Promise<StatusPage> =>
    call(
      async (md) =>
        statusPageFrom(
          slug,
          await monitorClientFor().getStatusPage(
            new pb.GetStatusPageRequest().setSlug(slug),
            md,
          ),
        ),
      { authenticated: false },
    ),
  byOwner: (ownerId: string): Promise<StatusPage> =>
    call(
      async (md) =>
        statusPageFrom(
          "Status",
          await monitorClientFor().getStatusPage(
            new pb.GetStatusPageRequest().setOwnerId(ownerId),
            md,
          ),
        ),
      { authenticated: false },
    ),
};
