import {
  describeMissingGoogleDriveScopes,
  ensureGoogleDrivePermissionForAction,
  getMissingRequiredGoogleDriveScopes,
  getMissingStoredGoogleDriveScopes,
  hasRequiredGoogleDriveScopes,
} from "../../utils/googleDrivePermissions";
import { login } from "../../utils/authService";
import { toast } from "sonner";

jest.mock("../../utils/authService", () => ({
  login: jest.fn(),
}));

jest.mock("sonner", () => ({
  toast: {
    warning: jest.fn(),
  },
}));

const requiredScopes =
  "https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.appdata";

describe("googleDrivePermissions", () => {
  beforeEach(() => {
    sessionStorage.clear();
    jest.clearAllMocks();
  });

  it("accepts the selected-file and appDataFolder scopes ZeroDrive needs", () => {
    expect(hasRequiredGoogleDriveScopes(requiredScopes)).toBe(true);
    expect(getMissingRequiredGoogleDriveScopes(requiredScopes)).toEqual([]);
  });

  it("requires hidden appDataFolder metadata access", () => {
    const missing = getMissingRequiredGoogleDriveScopes(
      "https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/drive.file",
    );

    expect(missing).toEqual(["drive.appdata"]);
  });

  it("requires selected-file Drive access", () => {
    const missing = getMissingRequiredGoogleDriveScopes(
      "https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/drive.appdata",
    );

    expect(missing).toEqual(["drive.file"]);
  });

  it("reads missing scopes from stored Google tokens", () => {
    sessionStorage.setItem(
      "google-tokens",
      JSON.stringify({
        accessToken: "token",
        expiresAt: new Date(Date.now() + 60000).toISOString(),
        scope: "https://www.googleapis.com/auth/drive.file",
        userEmail: "person@example.com",
      }),
    );

    expect(getMissingStoredGoogleDriveScopes()).toEqual(["drive.appdata"]);
  });

  it("does not block when token scope is absent from storage", () => {
    expect(getMissingStoredGoogleDriveScopes()).toEqual([]);
    expect(ensureGoogleDrivePermissionForAction("upload")).toBe(true);
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it("shows an action toast when required scopes are missing", () => {
    sessionStorage.setItem(
      "google-tokens",
      JSON.stringify({
        accessToken: "token",
        expiresAt: new Date(Date.now() + 60000).toISOString(),
        scope: "https://www.googleapis.com/auth/drive.file",
        userEmail: "person@example.com",
      }),
    );

    expect(ensureGoogleDrivePermissionForAction("save")).toBe(false);
    expect(toast.warning).toHaveBeenCalledWith(
      "Google Drive permission is incomplete",
      expect.objectContaining({
        description:
          "Grant Drive access before saving this shared file to Storage.",
      }),
    );

    const options = (toast.warning as jest.Mock).mock.calls[0][1];
    options.action.onClick();
    expect(login).toHaveBeenCalledTimes(1);
  });

  it("describes the missing permission in plain language", () => {
    expect(describeMissingGoogleDriveScopes(["drive.file", "drive.appdata"])).toBe(
      "ZeroDrive needs permission for encrypted files and hidden vault metadata.",
    );
  });
});
