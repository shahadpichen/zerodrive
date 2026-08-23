import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import {
  GoogleDrivePermissionGate,
  GoogleDrivePermissionProvider,
  GoogleDrivePermissionReminder,
} from "../../components/google-drive-permission-gate";
import {
  LegalAcceptanceGate,
  LegalAcceptanceProvider,
} from "../../components/legal-acceptance-gate";
import apiClient from "../../utils/apiClient";
import { login, logout } from "../../utils/authService";

jest.mock("../../utils/authService", () => ({
  login: jest.fn(),
  logout: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../utils/apiClient", () => ({
  __esModule: true,
  default: {
    legalAcceptance: {
      getStatus: jest.fn(),
      accept: jest.fn(),
    },
  },
}));

const mockGetStatus = apiClient.legalAcceptance
  .getStatus as jest.MockedFunction<typeof apiClient.legalAcceptance.getStatus>;
const mockLogin = login as jest.MockedFunction<typeof login>;
const mockLogout = logout as jest.MockedFunction<typeof logout>;

const missingAppDataScope =
  "https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/drive.file";

function storeScope(scope: string) {
  sessionStorage.setItem(
    "google-tokens",
    JSON.stringify({
      accessToken: "token",
      expiresAt: new Date(Date.now() + 60000).toISOString(),
      scope,
      userEmail: "person@example.com",
    }),
  );
}

function renderPermissionGate(requirePermission = true) {
  return render(
    <MemoryRouter>
      <GoogleDrivePermissionProvider>
        <GoogleDrivePermissionGate requirePermission={requirePermission}>
          <div>Drive content</div>
        </GoogleDrivePermissionGate>
      </GoogleDrivePermissionProvider>
    </MemoryRouter>,
  );
}

describe("GoogleDrivePermissionGate", () => {
  beforeEach(() => {
    sessionStorage.clear();
    jest.clearAllMocks();
  });

  it("blocks Drive-backed pages when a required scope is missing", async () => {
    storeScope(missingAppDataScope);

    renderPermissionGate(true);

    expect(
      await screen.findByText(/grant google drive access first/i),
    ).toBeInTheDocument();
    expect(screen.queryByText("Drive content")).toBeNull();
    expect(
      await screen.findByRole("heading", {
        name: /google drive permission is incomplete/i,
      }),
    ).toBeInTheDocument();
  });

  it("lets read-only pages render while still offering a permission reminder", async () => {
    storeScope(missingAppDataScope);

    render(
      <MemoryRouter>
        <GoogleDrivePermissionProvider>
          <GoogleDrivePermissionGate requirePermission={false}>
            <GoogleDrivePermissionReminder />
            <div>Read-only content</div>
          </GoogleDrivePermissionGate>
        </GoogleDrivePermissionProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Read-only content")).toBeInTheDocument();
    fireEvent.click(
      await screen.findByRole("button", {
        name: /not now/i,
      }),
    );
    const reminder = screen.getByRole("button", {
      name: /grant drive access/i,
    });
    expect(reminder).toBeInTheDocument();

    fireEvent.click(reminder);
    expect(
      await screen.findByRole("heading", {
        name: /google drive permission is incomplete/i,
      }),
    ).toBeInTheDocument();
  });

  it("redirects to Google when the user chooses to grant access", async () => {
    storeScope(missingAppDataScope);

    renderPermissionGate(true);

    fireEvent.click(
      await screen.findByRole("button", {
        name: /grant google drive access/i,
      }),
    );

    expect(mockLogin).toHaveBeenCalledTimes(1);
  });

  it("can log out from the missing-permission dialog", async () => {
    storeScope(missingAppDataScope);

    renderPermissionGate(true);

    fireEvent.click(await screen.findByRole("button", { name: /log out/i }));

    await waitFor(() => expect(mockLogout).toHaveBeenCalledTimes(1));
  });

  it("does not show the legal dialog on top of missing Drive permission", async () => {
    storeScope(missingAppDataScope);
    mockGetStatus.mockResolvedValue({
      accepted: false,
      required: true,
      termsVersion: "2026-08",
      privacyVersion: "2026-08",
      acceptedAt: null,
    });

    render(
      <MemoryRouter>
        <LegalAcceptanceProvider>
          <GoogleDrivePermissionProvider>
            <GoogleDrivePermissionGate requirePermission={false}>
              <LegalAcceptanceGate requireAcceptance={false}>
                <div>Home content</div>
              </LegalAcceptanceGate>
            </GoogleDrivePermissionGate>
          </GoogleDrivePermissionProvider>
        </LegalAcceptanceProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Home content")).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", {
        name: /google drive permission is incomplete/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /review terms and privacy/i }),
    ).toBeNull();
  });
});
