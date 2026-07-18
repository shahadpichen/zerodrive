import {
  dismissOnboardingGuidance,
  getVaultSetupState,
  isOnboardingGuidanceDismissed,
  ONBOARDING_DISMISS_KEY,
  VaultSetupSnapshot,
} from "../../utils/vaultSetupState";

const baseSnapshot: VaultSetupSnapshot = {
  isAuthenticated: true,
  hasGoogleTokens: true,
  hasPrimaryKey: true,
  hasRecoveryPhrase: true,
  fileCount: 1,
  folderCount: 0,
  hasSharingKeys: true,
  guidanceDismissed: false,
};

describe("vault setup state", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("guides users to create or recover access when no primary key exists", () => {
    const state = getVaultSetupState({
      ...baseSnapshot,
      hasPrimaryKey: false,
      hasRecoveryPhrase: false,
      fileCount: 0,
      hasSharingKeys: false,
    });

    expect(state.status).toBe("needs_key");
    expect(state.primaryActionPath).toBe("/key-management");
    expect(state.shouldShowGuidance).toBe(true);
    expect(state.tasks.find((task) => task.id === "key")?.complete).toBe(
      false,
    );
  });

  it("guides key-ready empty vaults to upload the first encrypted file", () => {
    const state = getVaultSetupState({
      ...baseSnapshot,
      fileCount: 0,
      folderCount: 0,
      hasSharingKeys: false,
    });

    expect(state.status).toBe("key_ready_empty_vault");
    expect(state.primaryActionLabel).toBe("Upload first encrypted file");
    expect(state.primaryActionPath).toBe("/storage");
    expect(state.tasks.find((task) => task.id === "first_file")?.complete).toBe(
      false,
    );
    expect(state.tasks.find((task) => task.id === "sharing")?.optional).toBe(
      true,
    );
  });

  it("shows only optional sharing guidance when the vault already has files", () => {
    const state = getVaultSetupState({
      ...baseSnapshot,
      hasSharingKeys: false,
    });

    expect(state.status).toBe("vault_ready");
    expect(state.primaryActionPath).toBe("/storage");
    expect(state.shouldShowGuidance).toBe(true);
    expect(state.tasks.find((task) => task.id === "first_file")?.complete).toBe(
      true,
    );
  });

  it("respects local-only dismissal for non-critical guidance", () => {
    expect(isOnboardingGuidanceDismissed()).toBe(false);

    dismissOnboardingGuidance();

    expect(localStorage.getItem(ONBOARDING_DISMISS_KEY)).toBe("true");
    expect(isOnboardingGuidanceDismissed()).toBe(true);
    expect(
      getVaultSetupState({
        ...baseSnapshot,
        hasSharingKeys: false,
        guidanceDismissed: true,
      }).shouldShowGuidance,
    ).toBe(false);
  });
});
