import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  createUploadQueue,
  type UploadQueue,
  type UploadQueueSnapshot,
  type UploadQueueTaskStatus,
} from "@zerodrivehq/upload-queue";
import { useApp } from "./app-context";
import { useVaultData } from "./vault-data-context";
import {
  AUTH_SESSION_CLEARED_EVENT,
  AUTH_SESSION_CLEAR_REQUEST_EVENT,
  type AuthSessionClearRequestDetail,
} from "../utils/authEvents";
import {
  createVaultUploadQueueAdapter,
  type PreparedVaultUpload,
  type UploadedVaultUpload,
  type VaultUploadMetadata,
  type VaultUploadSource,
  type VaultUploadTask,
} from "../utils/vaultUploadQueueAdapter";
import type { FileMeta } from "../utils/dexieDB";
import { getSessionUser, setSessionUser } from "../utils/sessionManager";

export interface EnqueueVaultUploadInput {
  file: File;
  userEmail: string;
  folderId?: string | null;
  allowMetadataReplacement?: boolean;
}

type VaultUploadQueue = UploadQueue<
  VaultUploadSource,
  PreparedVaultUpload,
  UploadedVaultUpload,
  FileMeta,
  VaultUploadMetadata
>;

type VaultUploadSnapshot = UploadQueueSnapshot<
  VaultUploadSource,
  VaultUploadMetadata,
  FileMeta
>;

interface UploadQueueContextValue {
  snapshot: VaultUploadSnapshot;
  enqueueUploads(inputs: readonly EnqueueVaultUploadInput[]): string[];
  hasPendingUploads(userEmail: string): boolean;
  tryAcquireUploadExclusion(userEmail: string): (() => void) | null;
  waitForTask(taskId: string): Promise<VaultUploadTask>;
  retry(taskId: string): boolean;
  cancel(taskId: string): Promise<boolean>;
  clearCompleted(): number;
}

const UploadQueueContext = createContext<UploadQueueContextValue | null>(null);

const UNFINISHED_STATUSES = new Set<UploadQueueTaskStatus>([
  "waiting",
  "blocked",
  "preparing",
  "uploading",
  "committing",
  "paused",
]);

const TERMINAL_STATUSES = new Set<UploadQueueTaskStatus>([
  "complete",
  "failed",
  "canceled",
]);

function snapshotHasPendingUploads(
  snapshot: VaultUploadSnapshot,
  userEmail: string,
): boolean {
  const normalizedUserEmail = userEmail.trim().toLowerCase();
  if (!normalizedUserEmail) return false;

  return snapshot.tasks.some((task) => {
    if (task.metadata?.userEmail.trim().toLowerCase() !== normalizedUserEmail) {
      return false;
    }
    // Failed tasks remain manually retryable and may retain prepared/uploaded
    // artifacts. They must block destructive vault operations until canceled.
    return UNFINISHED_STATUSES.has(task.status) || task.status === "failed";
  });
}

export function UploadQueueProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { refreshAll, setDecryptionError } = useApp();
  const { refreshVaultFromLocal } = useVaultData();
  const sourceFilesRef = useRef(new Map<string, File>());
  const previousStatusesRef = useRef(new Map<string, UploadQueueTaskStatus>());
  const uploadExclusionsRef = useRef(new Set<string>());
  // Issue #50 intentionally keeps v1 in memory: the provider survives SPA
  // navigation, while beforeunload protects refresh/close. Durable IndexedDB
  // sources and resumable uploads are a separate follow-up.
  const [queue] = useState<VaultUploadQueue>(() => {
    const adapter = createVaultUploadQueueAdapter({
      get: (sourceId) => sourceFilesRef.current.get(sourceId),
      release: (sourceId) => sourceFilesRef.current.delete(sourceId),
    });
    return createUploadQueue({
      adapter,
      concurrency: 2,
      serializeCommit: true,
      getCommitKey: (task) => task.metadata?.userEmail ?? "vault",
      retry: {
        maxAttempts: 3,
        backoffMs: (attempt) => Math.min(1_000 * 2 ** (attempt - 1), 8_000),
      },
    });
  });
  const [snapshot, setSnapshot] = useState<VaultUploadSnapshot>(
    queue.getSnapshot(),
  );

  useEffect(() => {
    queue.start();
    const unsubscribe = queue.subscribe((nextSnapshot) => {
      setSnapshot(nextSnapshot);

      for (const task of nextSnapshot.tasks) {
        const previousStatus = previousStatusesRef.current.get(task.id);
        if (previousStatus === task.status) continue;
        previousStatusesRef.current.set(task.id, task.status);

        if (task.status === "complete" && task.result) {
          setDecryptionError(false);
          void refreshVaultFromLocal(task.result.userEmail, {
            metadataStatus: "ready",
          })
            .then(() => refreshAll())
            .catch(() => {
              // The upload is already committed. A later page refresh will
              // hydrate the same IndexedDB state if this UI refresh fails.
            });
        }
      }
    });

    return () => {
      unsubscribe();
      queue.stop();
    };
  }, [queue, refreshAll, refreshVaultFromLocal, setDecryptionError]);

  useEffect(() => {
    const wakeQueue = () => queue.wake();
    window.addEventListener("online", wakeQueue);
    return () => window.removeEventListener("online", wakeQueue);
  }, [queue]);

  useEffect(() => {
    const cancelRetainedTasks = () => {
      const retained = queue
        .getSnapshot()
        .tasks.filter(
          (task) => task.status !== "complete" && task.status !== "canceled",
        );
      return Promise.allSettled(
        retained.map((task) => queue.cancel(task.id)),
      ).finally(() => sourceFilesRef.current.clear());
    };
    const prepareForClearedSession = (event: Event) => {
      const request = event as CustomEvent<AuthSessionClearRequestDetail>;
      request.detail.waitUntil(cancelRetainedTasks());
    };
    const cancelForClearedSession = () => {
      void cancelRetainedTasks();
    };
    window.addEventListener(
      AUTH_SESSION_CLEAR_REQUEST_EVENT,
      prepareForClearedSession,
    );
    window.addEventListener(
      AUTH_SESSION_CLEARED_EVENT,
      cancelForClearedSession,
    );
    return () => {
      window.removeEventListener(
        AUTH_SESSION_CLEAR_REQUEST_EVENT,
        prepareForClearedSession,
      );
      window.removeEventListener(
        AUTH_SESSION_CLEARED_EVENT,
        cancelForClearedSession,
      );
    };
  }, [queue]);

  const hasUnfinishedUploads = snapshot.tasks.some((task) =>
    UNFINISHED_STATUSES.has(task.status),
  );

  useEffect(() => {
    if (!hasUnfinishedUploads) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [hasUnfinishedUploads]);

  const enqueueUploads = useCallback(
    (inputs: readonly EnqueueVaultUploadInput[]) => {
      const normalizedInputs = inputs.map((input) => ({
        input,
        userEmail: input.userEmail.trim().toLowerCase(),
      }));
      if (
        normalizedInputs.some(({ userEmail }) =>
          uploadExclusionsRef.current.has(userEmail),
        )
      ) {
        throw new Error(
          "Storage is deleting files. Wait for it to finish before adding more files.",
        );
      }

      const taskIds: string[] = [];
      for (const {
        input,
        userEmail: normalizedUserEmail,
      } of normalizedInputs) {
        const sessionUser = getSessionUser()?.trim().toLowerCase();
        if (sessionUser && sessionUser !== normalizedUserEmail) {
          throw new Error(
            "The signed-in account changed. Refresh before adding more files.",
          );
        }
        if (!sessionUser) setSessionUser(normalizedUserEmail);

        const taskId = crypto.randomUUID();
        sourceFilesRef.current.set(taskId, input.file);
        try {
          queue.enqueue(
            { sourceId: taskId },
            {
              id: taskId,
              name: input.file.name,
              size: input.file.size,
              mimeType: input.file.type,
              metadata: {
                userEmail: normalizedUserEmail,
                folderId: input.folderId ?? null,
                allowMetadataReplacement:
                  input.allowMetadataReplacement === true,
              },
            },
          );
          taskIds.push(taskId);
        } catch (error) {
          sourceFilesRef.current.delete(taskId);
          throw error;
        }
      }
      queue.start();
      return taskIds;
    },
    [queue],
  );

  const hasPendingUploads = useCallback(
    (userEmail: string) =>
      snapshotHasPendingUploads(queue.getSnapshot(), userEmail),
    [queue],
  );

  const tryAcquireUploadExclusion = useCallback(
    (userEmail: string) => {
      const normalizedUserEmail = userEmail.trim().toLowerCase();
      if (
        !normalizedUserEmail ||
        uploadExclusionsRef.current.has(normalizedUserEmail) ||
        snapshotHasPendingUploads(queue.getSnapshot(), normalizedUserEmail)
      ) {
        return null;
      }

      uploadExclusionsRef.current.add(normalizedUserEmail);
      let released = false;
      return () => {
        if (released) return;
        released = true;
        uploadExclusionsRef.current.delete(normalizedUserEmail);
      };
    },
    [queue],
  );

  const waitForTask = useCallback(
    (taskId: string) =>
      new Promise<VaultUploadTask>((resolve, reject) => {
        let settledDuringSubscribe = false;
        let unsubscribe = () => {};
        const finishIfTerminal = (nextSnapshot: VaultUploadSnapshot) => {
          const task = nextSnapshot.tasks.find((item) => item.id === taskId);
          if (!task) {
            reject(new Error("Upload task was not found."));
            settledDuringSubscribe = true;
            return;
          }
          if (!TERMINAL_STATUSES.has(task.status)) return;
          settledDuringSubscribe = true;
          unsubscribe();
          resolve(task);
        };
        unsubscribe = queue.subscribe(finishIfTerminal);
        if (settledDuringSubscribe) unsubscribe();
      }),
    [queue],
  );

  const value: UploadQueueContextValue = {
    snapshot,
    enqueueUploads,
    hasPendingUploads,
    tryAcquireUploadExclusion,
    waitForTask,
    retry: (taskId) => queue.retry(taskId),
    cancel: (taskId) => queue.cancel(taskId),
    clearCompleted: () => queue.clearCompleted(),
  };

  return (
    <UploadQueueContext.Provider value={value}>
      {children}
    </UploadQueueContext.Provider>
  );
}

export function useUploadQueue(): UploadQueueContextValue {
  const value = useContext(UploadQueueContext);
  if (!value) {
    throw new Error("useUploadQueue must be used within UploadQueueProvider");
  }
  return value;
}

export function useOptionalUploadQueue(): UploadQueueContextValue | null {
  return useContext(UploadQueueContext);
}

export { UNFINISHED_STATUSES };
