import { beforeEach, describe, expect, it, vi } from "vitest";
import * as pb from "@/proto/user_pb";
import {
  FAKE_STATUS_SLUG,
  FAKE_USER,
  fakeMonitorClient,
  fakeUserClient,
  resetFakeBackend,
} from "./fake-backend";

/**
 * The fake is only useful if it behaves like api/common — these pin it to
 * the Go handlers' observable contract (codes, messages, defaults).
 */

async function signIn() {
  const r = await fakeUserClient.getUser(
    new pb.GetUserRequest()
      .setEmail(FAKE_USER.email)
      .setPassword(FAKE_USER.password),
  );
  return { authorization: `Bearer ${r.getToken()}` };
}

async function rejects(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    return e as { code: number; message: string };
  }
  throw new Error("expected rejection");
}

beforeEach(() => {
  vi.useRealTimers();
  resetFakeBackend();
});

describe("fake UserService", () => {
  it("GetUser without a password is PermissionDenied (anti-enumeration)", async () => {
    const e = await rejects(
      fakeUserClient.getUser(new pb.GetUserRequest().setEmail(FAKE_USER.email)),
    );
    expect(e).toMatchObject({ code: 7, message: "authentication required" });
  });

  it("wrong password is Unauthenticated; unknown email is NotFound", async () => {
    expect(
      await rejects(
        fakeUserClient.getUser(
          new pb.GetUserRequest().setEmail(FAKE_USER.email).setPassword("nope"),
        ),
      ),
    ).toMatchObject({ code: 16, message: "invalid login credentials" });
    expect(
      await rejects(
        fakeUserClient.getUser(
          new pb.GetUserRequest().setEmail("x@y.z").setPassword("nope"),
        ),
      ),
    ).toMatchObject({ code: 5, message: "user not found" });
  });

  it("CreateUser then GetUser signs the new account in", async () => {
    await fakeUserClient.createUser(
      new pb.CreateUserRequest()
        .setName("Kemi")
        .setEmail("kemi@x.io")
        .setPassword("pw"),
    );
    const r = await fakeUserClient.getUser(
      new pb.GetUserRequest().setEmail("kemi@x.io").setPassword("pw"),
    );
    expect(r.getName()).toBe("Kemi");
    expect(r.getToken()).not.toBe("");
    expect(
      await rejects(
        fakeUserClient.createUser(
          new pb.CreateUserRequest()
            .setName("K")
            .setEmail("kemi@x.io")
            .setPassword("pw"),
        ),
      ),
    ).toMatchObject({ code: 6, message: "email already exists" });
  });
});

describe("fake MonitorService", () => {
  it("requires a bearer session", async () => {
    expect(
      await rejects(
        fakeMonitorClient.listMonitors(new pb.ListMonitorsRequest()),
      ),
    ).toMatchObject({ code: 16, message: "missing authorization header" });
  });

  it("CreateMonitor applies 60/10/3 defaults and starts unknown", async () => {
    const md = await signIn();
    const r = await fakeMonitorClient.createMonitor(
      new pb.CreateMonitorRequest()
        .setName("New")
        .setType("api")
        .setTarget("https://example.com"),
      md,
    );
    const m = r.getMonitor()!;
    expect([
      m.getIntervalSeconds(),
      m.getTimeoutSeconds(),
      m.getFailureThreshold(),
      m.getStatus(),
      m.getLastCheckedAt(),
    ]).toEqual([60, 10, 3, "unknown", ""]);
  });

  it("rejects timeout ≥ interval", async () => {
    const md = await signIn();
    expect(
      await rejects(
        fakeMonitorClient.createMonitor(
          new pb.CreateMonitorRequest()
            .setName("x")
            .setType("api")
            .setTarget("https://example.com")
            .setIntervalSeconds(10)
            .setTimeoutSeconds(10),
          md,
        ),
      ),
    ).toMatchObject({
      code: 3,
      message: "timeout must be below the check interval",
    });
  });

  it("scopes reads to the owner (another user's monitor is NotFound)", async () => {
    const owner = await signIn();
    const theirs = (
      await fakeMonitorClient.listMonitors(new pb.ListMonitorsRequest(), owner)
    ).getMonitorsList()[0];
    await fakeUserClient.createUser(
      new pb.CreateUserRequest()
        .setName("Other")
        .setEmail("o@x.io")
        .setPassword("pw"),
    );
    const other = await fakeUserClient.getUser(
      new pb.GetUserRequest().setEmail("o@x.io").setPassword("pw"),
    );
    const md = { authorization: `Bearer ${other.getToken()}` };
    expect(
      await rejects(
        fakeMonitorClient.getMonitor(
          new pb.GetMonitorRequest().setId(theirs.getId()),
          md,
        ),
      ),
    ).toMatchObject({ code: 5, message: "monitor not found" });
  });

  it("the worker opens an incident at the threshold and resolves on success", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const md = await signIn();
    const m = (
      await fakeMonitorClient.createMonitor(
        new pb.CreateMonitorRequest()
          .setName("Broken")
          .setType("api")
          .setTarget("https://down.example.com")
          .setIntervalSeconds(30)
          .setTimeoutSeconds(5)
          .setFailureThreshold(2),
        md,
      )
    ).getMonitor()!;
    const get = async () =>
      (
        await fakeMonitorClient.getMonitor(
          new pb.GetMonitorRequest().setId(m.getId()),
          md,
        )
      ).getMonitor()!;
    const incidents = async () =>
      (
        await fakeMonitorClient.listIncidents(
          new pb.ListIncidentsRequest().setMonitorId(m.getId()),
          md,
        )
      ).getIncidentsList();

    vi.advanceTimersByTime(30_000); // first check: 1 failure, below threshold
    expect((await get()).getStatus()).toBe("unknown");
    expect(await incidents()).toHaveLength(0);

    vi.advanceTimersByTime(30_000); // second failure → down + incident
    expect((await get()).getStatus()).toBe("down");
    const [open] = await incidents();
    expect(open.getTitle()).toBe("Broken is down");
    expect(open.getStatus()).toBe("active");

    // point it at a healthy target: the next check resolves the incident
    await fakeMonitorClient.updateMonitor(
      new pb.UpdateMonitorRequest()
        .setId(m.getId())
        .setTarget("https://ok.example.com"),
      md,
    );
    vi.advanceTimersByTime(30_000);
    expect((await get()).getStatus()).toBe("up");
    const [resolved] = await incidents();
    expect(resolved.getStatus()).toBe("resolved");
    expect(resolved.getDurationSeconds()).toBe(30);
  });

  it("GetStatusPage is public and resolves the seeded slug", async () => {
    const r = await fakeMonitorClient.getStatusPage(
      new pb.GetStatusPageRequest().setSlug(FAKE_STATUS_SLUG),
    );
    expect(r.getPageName()).toBe("Upstat");
    expect(r.getComponentsList().length).toBeGreaterThan(0);
    expect(
      await rejects(
        fakeMonitorClient.getStatusPage(
          new pb.GetStatusPageRequest().setSlug("nope"),
        ),
      ),
    ).toMatchObject({ code: 5, message: "status page not found" });
  });
});
