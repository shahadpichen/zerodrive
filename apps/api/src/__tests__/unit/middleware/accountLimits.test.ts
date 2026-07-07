import { Request, Response } from "express";
import {
  accountLimit,
  clearAccountLimitsForTests,
} from "../../../middleware/accountLimits";

function requestFor(emailHash: string): Request {
  return {
    user: { email: "not-stored@example.invalid", emailHash },
  } as Request;
}

function response() {
  const res = {
    setHeader: jest.fn(),
    status: jest.fn(),
    json: jest.fn(),
  };
  res.status.mockReturnValue(res);
  return res as unknown as Response;
}

describe("ephemeral account limits", () => {
  beforeEach(() => {
    clearAccountLimitsForTests();
    jest.useRealTimers();
  });

  it("limits one account without affecting another", () => {
    const middleware = accountLimit({
      name: "test-limit",
      max: 2,
      windowMs: 60_000,
    });
    const firstNext = jest.fn();
    middleware(requestFor("a".repeat(64)), response(), firstNext);
    middleware(requestFor("a".repeat(64)), response(), firstNext);

    const blockedResponse = response();
    middleware(requestFor("a".repeat(64)), blockedResponse, firstNext);
    expect(blockedResponse.status).toHaveBeenCalledWith(429);

    const otherNext = jest.fn();
    middleware(requestFor("b".repeat(64)), response(), otherNext);
    expect(otherNext).toHaveBeenCalledTimes(1);
  });

  it("forgets counters after the short-lived window", () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-07-05T00:00:00Z"));
    const middleware = accountLimit({
      name: "expiring-limit",
      max: 1,
      windowMs: 1_000,
    });
    middleware(requestFor("a".repeat(64)), response(), jest.fn());

    const blockedResponse = response();
    middleware(requestFor("a".repeat(64)), blockedResponse, jest.fn());
    expect(blockedResponse.status).toHaveBeenCalledWith(429);

    jest.advanceTimersByTime(1_001);
    const next = jest.fn();
    middleware(requestFor("a".repeat(64)), response(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
