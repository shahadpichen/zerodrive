import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
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
            categories: { auth: 8, files: 5, sharing: 8, keys: 2 },
          },
        });
      }
      if (endpoint.startsWith("/analytics/daily")) {
        return Promise.resolve({
          success: true,
          data: [
            {
              date: "2026-07-12",
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

    await waitFor(() => {
      expect(screen.getByText("upload")).toBeInTheDocument();
      expect(screen.getByText("< 5")).toBeInTheDocument();
    });
    expect(screen.getByText(/count events, not people/i)).toBeInTheDocument();
  });
});
