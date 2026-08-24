import { toast as sonnerToast } from "sonner";

export type NotificationId = string | number;

export interface NotificationAction {
  label: string;
  onClick: () => void;
}

export interface NotificationOptions {
  id?: NotificationId;
  description?: string;
  action?: NotificationAction;
}

export interface SafeNotificationCopy {
  title: string;
  description: string;
}

function hasErrorName(error: unknown, name: string): error is Error {
  return error instanceof Error && error.name === name;
}

function readStringProperty(error: unknown, property: string): string | null {
  if (!error || typeof error !== "object") return null;
  const value = (error as Record<string, unknown>)[property];
  return typeof value === "string" ? value : null;
}

function readNumberProperty(error: unknown, property: string): number | null {
  if (!error || typeof error !== "object") return null;
  const value = (error as Record<string, unknown>)[property];
  return typeof value === "number" ? value : null;
}

const SUCCESS_DURATION_MS = 4_000;
const INFO_DURATION_MS = 4_000;
const WARNING_DURATION_MS = 7_000;
const ERROR_DURATION_MS = 7_000;

function optionsWithDuration(options: NotificationOptions, duration: number) {
  return { ...options, duration };
}

export function getSafeNotificationCopy(
  error: unknown,
  fallback: SafeNotificationCopy,
): SafeNotificationCopy {
  if (hasErrorName(error, "CapsuleApplicationError")) {
    switch (readStringProperty(error, "code")) {
      case "ACCESS_REQUIRED":
        return {
          title: "Vault access required",
          description:
            "Open Recovery & Access and enter the recovery phrase for this vault.",
        };
      case "INVALID_RECOVERY_PHRASE":
        return {
          title: "Check your recovery phrase",
          description:
            "The recovery phrase is not valid. Check the words and their order.",
        };
      case "RECOVERY_PHRASE_MISMATCH":
        return {
          title: "This recovery phrase does not match",
          description:
            "Use the recovery phrase that was active when this encrypted data was created.",
        };
      case "NO_MATCHING_SHARING_KEY":
        return {
          title: "Sharing access is unavailable",
          description:
            "Recover the sharing identity that was used when this file was sent.",
        };
      case "ENCRYPTED_DATA_DAMAGED":
        return {
          title: "Encrypted data could not be opened",
          description:
            "The encrypted copy may be incomplete or damaged. Download it again and retry.",
        };
      case "UNSUPPORTED_ENCRYPTED_FORMAT":
        return {
          title: "Encrypted format is not supported",
          description:
            "Update ZeroDrive or use a compatible recovery tool to open this file.",
        };
      case "ENCRYPTION_FAILED":
        return {
          title: "Encryption could not be completed",
          description:
            "Retry the operation. Your original file was not changed.",
        };
    }
  }

  if (hasErrorName(error, "GoogleDriveRequestError")) {
    const status = readNumberProperty(error, "status");
    if (status === 401) {
      return {
        title: "Reconnect Google Drive",
        description: "Sign in again, then retry this operation.",
      };
    }
    if (status === 403) {
      return {
        title: "Google Drive access is required",
        description:
          "Reconnect Google Drive and allow the requested file permissions.",
      };
    }
    if ((status !== null && status >= 500) || status === 0) {
      return {
        title: "Google Drive is temporarily unavailable",
        description: "Wait a moment and retry the operation.",
      };
    }
  }

  if (hasErrorName(error, "RecoveryPhraseChangedError")) {
    return {
      title: "Vault access changed",
      description: "Retry using the recovery phrase that is active now.",
    };
  }

  return fallback;
}

export const userNotifications = {
  loading(title: string, options: NotificationOptions = {}): NotificationId {
    return sonnerToast.loading(title, {
      ...options,
      duration: Number.POSITIVE_INFINITY,
    });
  },

  success(title: string, options: NotificationOptions = {}): NotificationId {
    return sonnerToast.success(
      title,
      optionsWithDuration(options, SUCCESS_DURATION_MS),
    );
  },

  error(title: string, options: NotificationOptions = {}): NotificationId {
    return sonnerToast.error(
      title,
      optionsWithDuration(options, ERROR_DURATION_MS),
    );
  },

  warning(title: string, options: NotificationOptions = {}): NotificationId {
    return sonnerToast.warning(
      title,
      optionsWithDuration(options, WARNING_DURATION_MS),
    );
  },

  info(title: string, options: NotificationOptions = {}): NotificationId {
    return sonnerToast.info(
      title,
      optionsWithDuration(options, INFO_DURATION_MS),
    );
  },

  errorFrom(
    error: unknown,
    fallback: SafeNotificationCopy,
    options: Omit<NotificationOptions, "description"> = {},
  ): NotificationId {
    const copy = getSafeNotificationCopy(error, fallback);
    return sonnerToast.error(
      copy.title,
      optionsWithDuration(
        { ...options, description: copy.description },
        ERROR_DURATION_MS,
      ),
    );
  },

  dismiss(id: NotificationId): void {
    sonnerToast.dismiss(id);
  },
};
