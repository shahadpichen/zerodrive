import { toast as sonnerToast } from "sonner";
import { GoogleDriveRequestError } from "../../utils/googleDriveRequest";
import { RecoveryPhraseChangedError } from "../../utils/mnemonicManager";
import {
  getSafeNotificationCopy,
  userNotifications,
} from "../../utils/userNotifications";

jest.mock("sonner", () => ({
  toast: {
    loading: jest.fn(() => "toast-id"),
    success: jest.fn(() => "toast-id"),
    error: jest.fn(() => "toast-id"),
    warning: jest.fn(() => "toast-id"),
    info: jest.fn(() => "toast-id"),
    dismiss: jest.fn(),
  },
}));

describe("userNotifications", () => {
  beforeEach(() => jest.clearAllMocks());

  it("updates one operation by preserving its stable id", () => {
    userNotifications.loading("Downloading…", { id: "download:file-1" });
    userNotifications.success("File downloaded", { id: "download:file-1" });

    expect(sonnerToast.loading).toHaveBeenCalledWith(
      "Downloading…",
      expect.objectContaining({ id: "download:file-1" }),
    );
    expect(sonnerToast.success).toHaveBeenCalledWith(
      "File downloaded",
      expect.objectContaining({ id: "download:file-1" }),
    );
  });

  it("keeps concurrent operations on separate notification ids", () => {
    userNotifications.loading("Downloading first file…", {
      id: "download:file-1",
    });
    userNotifications.loading("Downloading second file…", {
      id: "download:file-2",
    });

    expect(sonnerToast.loading).toHaveBeenNthCalledWith(
      1,
      "Downloading first file…",
      expect.objectContaining({ id: "download:file-1" }),
    );
    expect(sonnerToast.loading).toHaveBeenNthCalledWith(
      2,
      "Downloading second file…",
      expect.objectContaining({ id: "download:file-2" }),
    );
  });

  it("maps encrypted-data errors without exposing their raw message", () => {
    const rawMessage =
      "ciphertext object secret-123 could not be authenticated";
    const error = Object.assign(new Error(rawMessage), {
      name: "CapsuleApplicationError",
      code: "ENCRYPTED_DATA_DAMAGED",
    });
    const copy = getSafeNotificationCopy(error, {
      title: "Fallback",
      description: "Fallback description",
    });

    expect(copy.title).toBe("Encrypted data could not be opened");
    expect(JSON.stringify(copy)).not.toContain(rawMessage);
  });

  it("maps Google authorization errors without response details", () => {
    const secretResponse = "private Google response";
    const copy = getSafeNotificationCopy(
      new GoogleDriveRequestError("raw error", 403, secretResponse),
      { title: "Fallback", description: "Fallback description" },
    );

    expect(copy).toEqual({
      title: "Google Drive access is required",
      description:
        "Reconnect Google Drive and allow the requested file permissions.",
    });
    expect(JSON.stringify(copy)).not.toContain(secretResponse);
  });

  it("maps recovery phrase changes to retry guidance", () => {
    expect(
      getSafeNotificationCopy(new RecoveryPhraseChangedError(), {
        title: "Fallback",
        description: "Fallback description",
      }),
    ).toEqual({
      title: "Vault access changed",
      description: "Retry using the recovery phrase that is active now.",
    });
  });

  it("uses a static fallback for unknown errors", () => {
    const fallback = {
      title: "File could not be downloaded",
      description: "Retry the download.",
    };
    expect(
      getSafeNotificationCopy(new Error("private identifier"), fallback),
    ).toEqual(fallback);
  });
});
