import * as jspb from "google-protobuf";
import { describe, expect, it } from "vitest";
import * as pb from "@/proto/user_pb";
import {
  historyFrom,
  incidentFrom,
  monitorFrom,
  monitorStatusFrom,
  overallFrom,
  statusPageFrom,
} from "./mappers";

/** Encodes a message the way the Go server would (standard proto3 wire). */
function encode(write: (w: jspb.BinaryWriter) => void): Uint8Array {
  const w = new jspb.BinaryWriter();
  write(w);
  return w.getResultBuffer();
}

function monitorBytes(
  overrides: { status?: string; active?: boolean; lastChecked?: string } = {},
) {
  return encode((w) => {
    w.writeString(1, "65f0a1b2c3d4e5f601234567");
    w.writeString(2, "owner-1");
    w.writeString(3, "API");
    w.writeString(4, "api");
    w.writeString(5, "https://api.example.com/health");
    w.writeString(6, "2026-09-01T00:00:00Z");
    w.writeString(7, "2026-09-02T00:00:00Z");
    w.writeBool(8, overrides.active ?? true);
    w.writeString(9, overrides.status ?? "up");
    w.writeInt32(10, 60);
    w.writeInt32(11, 10);
    w.writeInt32(12, 3);
    w.writeInt32(13, 0);
    if (overrides.lastChecked !== "") {
      w.writeString(14, overrides.lastChecked ?? "2026-09-02T00:00:00Z");
    }
    w.writeInt64(15, 182);
    w.writeInt32(16, 200);
    w.writeBool(17, true);
  });
}

describe("proto wire layer", () => {
  it("decodes a server-encoded Monitor field-for-field", () => {
    const m = pb.Monitor.deserializeBinary(monitorBytes());
    expect(m.getId()).toBe("65f0a1b2c3d4e5f601234567");
    expect(m.getTarget()).toBe("https://api.example.com/health");
    expect(m.getIntervalSeconds()).toBe(60);
    expect(m.getLastResponseTimeMs()).toBe(182);
    expect(m.getMuted()).toBe(true);
  });

  it("decodes nested + repeated messages (ListMonitorsResponse)", () => {
    const bytes = encode((w) => {
      w.writeBytes(1, monitorBytes());
      w.writeBytes(1, monitorBytes({ status: "down" }));
    });
    const r = pb.ListMonitorsResponse.deserializeBinary(bytes);
    expect(r.getMonitorsList().map((m) => m.getStatus())).toEqual([
      "up",
      "down",
    ]);
  });

  it("sends proto3-optional false explicitly (mute off must reach the server)", () => {
    const bytes = new pb.UpdateMonitorRequest()
      .setId("m1")
      .setMuted(false)
      .serializeBinary();
    const reader = new jspb.BinaryReader(bytes);
    const seen: Record<number, unknown> = {};
    while (reader.nextField()) {
      const n = reader.getFieldNumber();
      seen[n] = n === 1 ? reader.readString() : reader.readBool();
    }
    expect(seen).toEqual({ 1: "m1", 6: false });
  });
});

describe("monitor mapping", () => {
  it("derives the UI-only states the backend does not have", () => {
    expect(monitorStatusFrom("up", false, "x")).toBe("paused");
    expect(monitorStatusFrom("unknown", true, "")).toBe("pending");
    expect(monitorStatusFrom("unknown", true, "2026-09-02T00:00:00Z")).toBe(
      "nodata",
    );
    expect(monitorStatusFrom("down", true, "x")).toBe("down");
  });

  it("maps proto3 zero values to null", () => {
    const fresh = monitorFrom(
      pb.Monitor.deserializeBinary(
        monitorBytes({ status: "unknown", lastChecked: "" }),
      ),
    );
    expect(fresh.status).toBe("pending");
    expect(fresh.last_checked_at).toBeNull();
    expect(fresh.last_response_time_ms).toBeNull();
  });

  it("marks no-data days null in the history strip", () => {
    const bytes = encode((w) => {
      w.writeBytes(
        2,
        encode((d) => {
          d.writeBool(1, false);
          d.writeString(2, "2026-09-01");
        }),
      );
      w.writeBytes(
        2,
        encode((d) => {
          d.writeBool(1, true);
          d.writeString(2, "2026-09-02");
          d.writeDouble(3, 99.5);
          d.writeInt64(4, 7);
        }),
      );
      w.writeDouble(3, 99.5);
      w.writeBool(4, true);
    });
    const h = historyFrom(
      "m1",
      pb.GetMonitorHistoryResponse.deserializeBinary(bytes),
    );
    expect(h.days).toEqual([
      { date: "2026-09-01", uptime_pct: null, down_minutes: 0 },
      { date: "2026-09-02", uptime_pct: 99.5, down_minutes: 7 },
    ]);
    expect(h.uptime_90d_pct).toBe(99.5);
  });
});

function incidentBytes(status: "active" | "resolved") {
  return encode((w) => {
    w.writeString(1, "65f0a1b2c3d4e5f6abcdef12");
    w.writeString(2, "65f0a1b2c3d4e5f601234567");
    w.writeString(3, "API is down");
    w.writeString(4, "HTTP 503");
    w.writeString(5, status);
    w.writeString(6, "2026-09-02T10:00:00Z");
    if (status === "resolved") {
      w.writeString(7, "2026-09-02T10:45:00Z");
      w.writeInt64(8, 2700);
    }
  });
}

describe("incident mapping", () => {
  it("joins the monitor name and keeps the backend fields", () => {
    const i = incidentFrom(
      pb.Incident.deserializeBinary(incidentBytes("active")),
      new Map([["65f0a1b2c3d4e5f601234567", "API"]]),
    );
    expect(i).toEqual({
      id: "65f0a1b2c3d4e5f6abcdef12",
      monitor_id: "65f0a1b2c3d4e5f601234567",
      monitor_name: "API",
      title: "API is down",
      failure_reason: "HTTP 503",
      status: "active",
      started_at: "2026-09-02T10:00:00Z",
      resolved_at: null,
      duration_seconds: null,
    });
  });

  it("carries resolve time and duration once resolved", () => {
    const i = incidentFrom(
      pb.Incident.deserializeBinary(incidentBytes("resolved")),
    );
    expect(i).toMatchObject({
      status: "resolved",
      resolved_at: "2026-09-02T10:45:00Z",
      duration_seconds: 2700,
      monitor_name: null,
    });
  });
});

describe("status page mapping", () => {
  it("orders open incidents first and derives the overall banner", () => {
    const component = (status: string) =>
      encode((c) => {
        c.writeString(
          1,
          status === "down" ? "65f0a1b2c3d4e5f601234567" : "web-monitor",
        );
        c.writeString(2, status === "down" ? "API" : "Web");
        c.writeString(3, status);
        c.writeBool(4, true);
        c.writeDouble(5, 99.9);
        c.writeInt64(8, 120);
        c.writeString(9, "2026-09-02T11:00:00Z");
      });
    const bytes = encode((w) => {
      w.writeBytes(2, incidentBytes("active"));
      w.writeBytes(3, incidentBytes("resolved"));
      w.writeString(7, "Acme");
      w.writeBytes(8, component("up"));
      w.writeBytes(8, component("down"));
    });
    const page = statusPageFrom(
      "acme",
      pb.GetStatusPageResponse.deserializeBinary(bytes),
    );
    expect(page.name).toBe("Acme");
    expect(page.overall).toBe("partial_outage");
    expect(page.updated_at).toBe("2026-09-02T11:00:00Z");
    expect(page.components[1]).toMatchObject({
      name: "API",
      status: "down",
      p95_ms: 120,
    });
    expect(page.active_incidents.map((i) => i.status)).toEqual(["active"]);
    expect(page.past_incidents.map((i) => i.status)).toEqual(["resolved"]);
    // incidents are named from the components on the same page
    expect(page.past_incidents[0].monitor_name).toBe("API");
  });

  it("is operational with no down components and no open incidents", () => {
    expect(overallFrom([], 0)).toBe("operational");
    expect(overallFrom([], 1)).toBe("degraded");
  });
});
