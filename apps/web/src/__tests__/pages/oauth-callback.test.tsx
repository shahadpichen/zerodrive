import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { toast as sonnerToast } from "sonner";
import OAuthCallback from "../../pages/oauth-callback";

jest.mock("../../contexts/app-context", () => ({
  useApp: () => ({ setUserInfo: jest.fn() }),
}));

jest.mock("sonner", () => ({
  toast: {
    loading: jest.fn(),
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
    info: jest.fn(),
    dismiss: jest.fn(),
  },
}));

const mockSonnerToast = sonnerToast as unknown as {
  success: jest.Mock;
  error: jest.Mock;
  warning: jest.Mock;
};

describe("OAuthCallback", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it("emits exactly one safe final notification when Google access is denied", async () => {
    render(
      <MemoryRouter
        initialEntries={[
          "/oauth-callback?error=access_denied&details=raw-google-response",
        ]}
      >
        <OAuthCallback />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Sign-in Failed")).toBeInTheDocument();
    await waitFor(() => expect(mockSonnerToast.error).toHaveBeenCalledTimes(1));

    expect(mockSonnerToast.error).toHaveBeenCalledWith(
      "Sign-in failed",
      expect.objectContaining({
        id: "auth:callback",
        description:
          "Access denied - You need to grant permissions to use ZeroDrive",
      }),
    );
    expect(mockSonnerToast.success).not.toHaveBeenCalled();
    expect(mockSonnerToast.warning).not.toHaveBeenCalled();
    expect(JSON.stringify(mockSonnerToast.error.mock.calls)).not.toContain(
      "raw-google-response",
    );
  });
});
