// @vitest-environment node
import { describe, expect, it } from "vitest";
import { StudioSessionStore } from "../session";

describe("Studio launch sessions", () => {
  it("exchanges a launch token exactly once", () => {
    const store = new StudioSessionStore(1_000, 5_000);
    const token = store.issueLaunchToken(100);
    const session = store.exchangeLaunchToken(token, 200);
    expect(session?.csrfToken).toBeTruthy();
    expect(store.exchangeLaunchToken(token, 201)).toBeNull();
    expect(store.getSession(session?.sessionToken, 202)?.csrfToken).toBe(
      session?.csrfToken,
    );
  });

  it("forgets expired launch and session tokens", () => {
    const store = new StudioSessionStore(10, 20);
    const expiredLaunch = store.issueLaunchToken(100);
    expect(store.exchangeLaunchToken(expiredLaunch, 111)).toBeNull();
    const launch = store.issueLaunchToken(200);
    const session = store.exchangeLaunchToken(launch, 201)!;
    expect(store.getSession(session.sessionToken, 222)).toBeNull();
  });
});
