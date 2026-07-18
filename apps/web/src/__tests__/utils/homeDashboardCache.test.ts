import {
  readCachedHomeDashboardForUser,
  writeCachedHomeDashboard,
} from "../../utils/homeDashboardCache";
import type { VaultSetupState } from "../../utils/vaultSetupState";

const vaultSetup: VaultSetupState = {
  status: "vault_ready",
  badge: "Vault active",
  headline: "Welcome back to your private vault",
  description: "Ready",
  primaryActionLabel: "Open Storage",
  primaryActionPath: "/storage",
  tasks: [],
  shouldShowGuidance: false,
};

describe("home dashboard cache", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("returns cached dashboard state for the backend-confirmed user", () => {
    writeCachedHomeDashboard({
      userEmail: "owner@example.com",
      counts: { files: 2, folders: 1 },
      recent: [
        {
          id: "file-1",
          name: "notes.txt",
          mimeType: "text/plain",
          userEmail: "owner@example.com",
          uploadedDate: new Date("2026-07-19T00:00:00.000Z"),
          folderId: null,
        },
      ],
      canReadAnalytics: false,
      vaultSetup,
    });

    const cached = readCachedHomeDashboardForUser("OWNER@example.com");

    expect(cached?.counts).toEqual({ files: 2, folders: 1 });
    expect(cached?.recent[0].name).toBe("notes.txt");
    expect(cached?.recent[0].uploadedDate).toBeInstanceOf(Date);
    expect(cached?.vaultSetup?.headline).toBe(
      "Welcome back to your private vault",
    );
  });

  it("refuses cached dashboard state for a different backend-confirmed user", () => {
    writeCachedHomeDashboard({
      userEmail: "owner@example.com",
      counts: { files: 2, folders: 1 },
      recent: [],
      canReadAnalytics: false,
      vaultSetup,
    });

    expect(readCachedHomeDashboardForUser("other@example.com")).toBeNull();
  });
});
