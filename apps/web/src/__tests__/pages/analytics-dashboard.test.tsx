import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AnalyticsDashboard from "../../pages/analytics-dashboard";
import apiClient from "../../utils/apiClient";

jest.mock("../../utils/apiClient", () => ({
  __esModule: true,
  ApiError: class ApiError extends Error {
    statusCode = 500;
  },
  default: { get: jest.fn() },
}));

jest.mock("sonner", () => ({
  toast: { error: jest.fn() },
}));

describe("admin analytics dashboard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (apiClient.get as jest.Mock).mockImplementation((endpoint: string) => {
      if (endpoint.startsWith("/analytics/summary")) {
        return Promise.resolve({
          success: true,
          data: {
            enabled: true,
            rangeDays: 30,
            totalEvents: 18,
            totals: {
              pageViews: 10,
              logins: 8,
              newUsers: 2,
              limitedScopeLogins: 1,
              filesAdded: 5,
              shares: 3,
              downloads: 2,
              invitations: 0,
              keySetups: 1,
              keyRotations: 1,
              sharesFinalized: 2,
              sharesRevoked: 1,
            },
            categories: {
              navigation: 10,
              auth: 8,
              files: 5,
              sharing: 8,
              keys: 2,
            },
          },
        });
      }
      if (endpoint.startsWith("/analytics/daily")) {
        return Promise.resolve({
          success: true,
          data: [
            {
              date: "2026-07-12",
              pageViews: 10,
              logins: 8,
              newUsers: 2,
              limitedScopeLogins: 1,
              filesAdded: 5,
              shares: 3,
              downloads: 2,
              invitations: 0,
              keySetups: 1,
              keyRotations: 1,
              sharesFinalized: 2,
              sharesRevoked: 1,
            },
          ],
        });
      }
      if (endpoint.startsWith("/analytics/monthly/dimensions")) {
        return Promise.resolve({
          success: true,
          data: [
            {
              metric: "page_view",
              dimension: "page",
              bucket: "storage",
              count: 40,
              suppressed: false,
            },
          ],
        });
      }
      if (endpoint.startsWith("/analytics/monthly")) {
        return Promise.resolve({
          success: true,
          data: [
            { month: "2025-01-01", pageViews: 80, totalEvents: 120 },
          ],
        });
      }
      return Promise.resolve({
        success: true,
        data: [
          {
            metric: "file_added_to_drive",
            dimension: "source",
            bucket: "upload",
            count: null,
            suppressed: true,
          },
          {
            metric: "page_view",
            dimension: "page",
            bucket: "docs_security_model",
            count: 12,
            suppressed: false,
          },
        ],
      });
    });
  });

  it("renders typed aggregate counters and suppresses low-volume buckets", async () => {
    render(
      <MemoryRouter>
        <AnalyticsDashboard />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("heading", {
        name: /understand zerodrive without tracking/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Successful logins")).toBeInTheDocument();
    expect(screen.getByText("Files added")).toBeInTheDocument();
    expect(
      screen.getByLabelText(/: 33 counted events$/),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("upload")).toBeInTheDocument();
      expect(screen.getByText("< 5")).toBeInTheDocument();
      expect(screen.getByText("Docs · Security model")).toBeInTheDocument();
    });
    expect(screen.getByText("Long-term monthly history")).toBeInTheDocument();
    expect(screen.getByText("January 2025")).toBeInTheDocument();
    expect(screen.getAllByText("Page views").length).toBeGreaterThan(0);
    expect(screen.getByText("Archived page attention")).toBeInTheDocument();
    expect(screen.getByText(/count events, not people/i)).toBeInTheDocument();

    const requestedEndpoints = (apiClient.get as jest.Mock).mock.calls.map(
      ([endpoint]) => endpoint as string,
    );
    expect(requestedEndpoints).toEqual(
      expect.arrayContaining([
        expect.stringMatching(
          /^\/analytics\/summary\?from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}$/,
        ),
        expect.stringMatching(
          /^\/analytics\/daily\?from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}$/,
        ),
        expect.stringMatching(
          /^\/analytics\/dimensions\?from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}$/,
        ),
        "/analytics/monthly?months=120",
        "/analytics/monthly/dimensions?months=120",
      ]),
    );
  });

  it("reloads exact daily aggregates when an operator selects a preset", async () => {
    render(
      <MemoryRouter>
        <AnalyticsDashboard />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", {
      name: /understand zerodrive without tracking/i,
    });
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(5));

    fireEvent.click(
      within(screen.getByLabelText("Analytics period")).getByRole("button"),
    );
    fireEvent.click(await screen.findByRole("button", { name: "7 days" }));

    await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(10));
    const summaryRequests = (apiClient.get as jest.Mock).mock.calls
      .map(([endpoint]) => endpoint as string)
      .filter((endpoint) => endpoint.startsWith("/analytics/summary?"));
    expect(summaryRequests).toHaveLength(2);

    const selected = new URLSearchParams(summaryRequests[1].split("?")[1]);
    const from = new Date(`${selected.get("from")}T00:00:00.000Z`);
    const to = new Date(`${selected.get("to")}T00:00:00.000Z`);
    expect((to.getTime() - from.getTime()) / 86_400_000).toBe(6);
  });
});
