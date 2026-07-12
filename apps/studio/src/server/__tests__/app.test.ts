// @vitest-environment node
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createStudioApp } from "../app";
import { loadStudioConfig } from "../config";
import { StudioSessionStore } from "../session";

function setup() {
  const config = loadStudioConfig({ NODE_ENV: "test" });
  const sessions = new StudioSessionStore(1_000, 10_000);
  const launchToken = sessions.issueLaunchToken();
  const database = {
    getOverview: vi.fn().mockResolvedValue({ profile: "local" }),
    listRelations: vi.fn().mockResolvedValue([]),
    getRelationDetails: vi.fn(),
    getRows: vi.fn(),
    insertRow: vi.fn(),
    updateRow: vi.fn(),
    deleteRow: vi.fn(),
    executeQuery: vi.fn(),
  };
  return {
    config,
    sessions,
    launchToken,
    database,
    app: createStudioApp(config, { database: database as never, sessions }),
  };
}

describe("Studio HTTP boundary", () => {
  it("exchanges one launch link and protects APIs with the session cookie", async () => {
    const { app, launchToken } = setup();
    expect((await request(app).get("/api/session")).status).toBe(401);
    const launch = await request(app).get(`/launch?token=${launchToken}`);
    expect(launch.status).toBe(303);
    expect(launch.headers["set-cookie"]?.[0]).toContain("HttpOnly");
    expect(
      (await request(app).get(`/launch?token=${launchToken}`)).status,
    ).toBe(401);
    const session = await request(app)
      .get("/api/session")
      .set("Cookie", launch.headers["set-cookie"]);
    expect(session.status).toBe(200);
    expect(session.body.csrfToken).toBeTruthy();
  });

  it("requires the exact origin and CSRF token for query execution", async () => {
    const { app, launchToken, config, database } = setup();
    const launch = await request(app).get(`/launch?token=${launchToken}`);
    const cookie = launch.headers["set-cookie"];
    const session = await request(app)
      .get("/api/session")
      .set("Cookie", cookie);
    expect(
      (
        await request(app)
          .post("/api/query")
          .set("Cookie", cookie)
          .send({ sql: "SELECT 1" })
      ).status,
    ).toBe(403);
    const response = await request(app)
      .post("/api/query")
      .set("Cookie", cookie)
      .set("Origin", config.clientOrigin)
      .set("X-Studio-CSRF", session.body.csrfToken)
      .send({ sql: "SELECT 1" });
    expect(response.status).toBe(200);
    expect(database.executeQuery).toHaveBeenCalledWith("SELECT 1", false);
  });
});
