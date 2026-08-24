import { createUploadQueue, type UploadQueue } from "@zerodrivehq/upload-queue";
import {
  createVaultUploadQueueAdapter,
  type PreparedVaultUpload,
  type UploadedVaultUpload,
  type VaultUploadMetadata,
  type VaultUploadSource,
  type VaultUploadTask,
} from "../../utils/vaultUploadQueueAdapter";
import type { FileMeta } from "../../utils/dexieDB";
import {
  addFile,
  getAllFilesForUser,
  getFileByIdForUser,
  getFoldersForUser,
  sendToGoogleDrive,
} from "../../utils/dexieDB";
import { encryptFile } from "../../utils/encryptFile";
import { googleDriveFetch } from "../../utils/googleDriveRequest";
import { getSessionUser } from "../../utils/sessionManager";
import {
  assertRecoveryPhraseGeneration,
  assertRecoveryPhraseSessionCurrent,
  captureActiveRecoveryPhraseSession,
} from "../../utils/mnemonicManager";

jest.mock("../../utils/dexieDB", () => ({
  addFile: jest.fn(),
  deleteFileFromDB: jest.fn(),
  getAllFilesForUser: jest.fn(),
  getFileByIdForUser: jest.fn(),
  getFoldersForUser: jest.fn(),
  sendToGoogleDrive: jest.fn(),
}));

jest.mock("../../utils/encryptFile", () => ({
  encryptFile: jest.fn(),
}));

jest.mock("../../utils/mnemonicManager", () => ({
  captureActiveRecoveryPhraseSession: jest.fn(() => ({
    phrase:
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
    generation: 1,
  })),
  assertRecoveryPhraseSessionCurrent: jest.fn(),
  assertRecoveryPhraseGeneration: jest.fn(),
  RecoveryPhraseChangedError: class RecoveryPhraseChangedError extends Error {},
}));

jest.mock("../../utils/analyticsTracker", () => ({
  trackFileAddedToDrive: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../utils/vaultMetadataWriteGuard", () => ({
  assertCanWriteVaultMetadata: jest.fn(),
}));

jest.mock("../../utils/googleDriveRequest", () => {
  const actual = jest.requireActual("../../utils/googleDriveRequest");
  return {
    ...actual,
    googleDriveFetch: jest.fn(),
  };
});

jest.mock("../../utils/sessionManager", () => ({
  getSessionUser: jest.fn(() => "owner@example.com"),
}));

type TestQueue = UploadQueue<
  VaultUploadSource,
  PreparedVaultUpload,
  UploadedVaultUpload,
  FileMeta,
  VaultUploadMetadata
>;

const mockEncryptFile = encryptFile as jest.MockedFunction<typeof encryptFile>;
const mockGoogleDriveFetch = googleDriveFetch as jest.MockedFunction<
  typeof googleDriveFetch
>;
const mockGetFileByIdForUser = getFileByIdForUser as jest.MockedFunction<
  typeof getFileByIdForUser
>;

function waitForTerminal(queue: TestQueue, taskId: string) {
  return new Promise<VaultUploadTask>((resolve) => {
    let unsubscribe = () => {};
    unsubscribe = queue.subscribe((snapshot) => {
      const task = snapshot.tasks.find((candidate) => candidate.id === taskId);
      if (task && ["complete", "failed", "canceled"].includes(task.status)) {
        unsubscribe();
        resolve(task);
      }
    });
  });
}

function waitForStatus(
  queue: TestQueue,
  taskId: string,
  expectedStatus: VaultUploadTask["status"],
) {
  return new Promise<VaultUploadTask>((resolve) => {
    let unsubscribe = () => {};
    unsubscribe = queue.subscribe((snapshot) => {
      const task = snapshot.tasks.find((candidate) => candidate.id === taskId);
      if (task?.status === expectedStatus) {
        unsubscribe();
        resolve(task);
      }
    });
  });
}

describe("vault upload queue adapter", () => {
  const sourceFiles = new Map<string, File>();
  const sourceStore = {
    get: (sourceId: string) => sourceFiles.get(sourceId),
    release: (sourceId: string) => sourceFiles.delete(sourceId),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    sourceFiles.clear();
    Object.defineProperty(global.crypto, "randomUUID", {
      configurable: true,
      value: jest.fn(() => "00000000-0000-4000-8000-000000000001"),
    });
    (getSessionUser as jest.Mock).mockReturnValue("owner@example.com");
    (captureActiveRecoveryPhraseSession as jest.Mock).mockReturnValue({
      phrase:
        "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
      generation: 1,
    });
    (assertRecoveryPhraseSessionCurrent as jest.Mock).mockImplementation(
      () => undefined,
    );
    (assertRecoveryPhraseGeneration as jest.Mock).mockImplementation(
      () => undefined,
    );
    mockEncryptFile.mockResolvedValue(
      new Blob(["capsule-ciphertext"], { type: "application/octet-stream" }),
    );
    mockGoogleDriveFetch.mockImplementation(async (url) => {
      if (String(url).includes("generateIds")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ ids: ["drive-file-1"] }),
        } as Response;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: "drive-file-1" }),
      } as Response;
    });
    mockGetFileByIdForUser.mockResolvedValue(undefined);
    (getAllFilesForUser as jest.Mock).mockResolvedValue([]);
    (getFoldersForUser as jest.Mock).mockResolvedValue([]);
    (sendToGoogleDrive as jest.Mock).mockResolvedValue(undefined);
  });

  function createQueue(): TestQueue {
    return createUploadQueue({
      adapter: createVaultUploadQueueAdapter(sourceStore),
      concurrency: 2,
      serializeCommit: true,
      getCommitKey: (task) => task.metadata?.userEmail ?? "vault",
      retry: { maxAttempts: 2, backoffMs: () => 0 },
    });
  }

  function enqueue(queue: TestQueue, file: File, taskId = "upload-1") {
    sourceFiles.set(taskId, file);
    return queue.enqueue(
      { sourceId: taskId },
      {
        id: taskId,
        name: file.name,
        size: file.size,
        mimeType: file.type,
        metadata: {
          userEmail: "owner@example.com",
          folderId: null,
          allowMetadataReplacement: false,
        },
      },
    );
  }

  it("encrypts before upload and commits the encrypted vault index", async () => {
    const queue = createQueue();
    const sourceFile = new File(["plaintext"], "notes.txt", {
      type: "text/plain",
    });
    const taskId = enqueue(queue, sourceFile);
    const terminal = waitForTerminal(queue, taskId);
    queue.start();

    const task = await terminal;
    expect(task.status).toBe("complete");
    expect(mockEncryptFile).toHaveBeenCalledWith(
      sourceFile,
      expect.any(String),
      expect.any(String),
    );
    const request = mockGoogleDriveFetch.mock.calls[1][1];
    expect(request?.body).toBeInstanceOf(FormData);
    expect((request?.body as FormData).get("file")).not.toBe(sourceFile);
    expect(addFile).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "drive-file-1",
        name: "notes.txt",
        userEmail: "owner@example.com",
      }),
    );
    expect(sendToGoogleDrive).toHaveBeenCalledWith([], [], {
      userEmail: "owner@example.com",
      allowMetadataReplacement: false,
      recoveryPhraseSession: expect.objectContaining({ generation: 1 }),
      showToast: false,
    });
    expect(sourceFiles.has(taskId)).toBe(false);
  });

  it("retries only the metadata commit after an upload succeeds", async () => {
    let fileExists = false;
    mockGetFileByIdForUser.mockImplementation(async () =>
      fileExists
        ? ({
            id: "drive-file-1",
            name: "notes.txt",
            mimeType: "text/plain",
            userEmail: "owner@example.com",
            uploadedDate: new Date(),
            folderId: null,
          } as FileMeta)
        : undefined,
    );
    (addFile as jest.Mock).mockImplementation(async () => {
      fileExists = true;
    });
    (sendToGoogleDrive as jest.Mock)
      .mockRejectedValueOnce(new TypeError("connection lost"))
      .mockResolvedValueOnce(undefined);

    const queue = createQueue();
    const taskId = enqueue(
      queue,
      new File(["plaintext"], "notes.txt", { type: "text/plain" }),
    );
    const terminal = waitForTerminal(queue, taskId);
    queue.start();

    expect((await terminal).status).toBe("complete");
    expect(mockEncryptFile).toHaveBeenCalledTimes(1);
    expect(mockGoogleDriveFetch).toHaveBeenCalledTimes(2);
    expect(addFile).toHaveBeenCalledTimes(1);
    expect(sendToGoogleDrive).toHaveBeenCalledTimes(2);
  });

  it("does not impose the former 100 MB Storage limit", async () => {
    const largeFile = new File(["x"], "large.bin");
    Object.defineProperty(largeFile, "size", {
      configurable: true,
      value: 101 * 1024 * 1024,
    });
    const queue = createQueue();
    const taskId = enqueue(queue, largeFile);
    const terminal = waitForTerminal(queue, taskId);
    queue.start();

    const task = await terminal;
    expect(task.status).toBe("complete");
    expect(mockEncryptFile).toHaveBeenCalledWith(
      largeFile,
      expect.any(String),
      expect.any(String),
    );
    expect(mockGoogleDriveFetch).toHaveBeenCalled();
    expect(sourceFiles.has(taskId)).toBe(false);
  });

  it("reuses a generated Drive ID after an ambiguous upload failure", async () => {
    let uploadAttempts = 0;
    mockGoogleDriveFetch.mockImplementation(async (url) => {
      const requestUrl = String(url);
      if (requestUrl.includes("generateIds")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ ids: ["stable-drive-id"] }),
        } as Response;
      }
      if (requestUrl.includes("upload/drive")) {
        uploadAttempts += 1;
        if (uploadAttempts === 1) {
          throw new TypeError("connection lost after acceptance");
        }
        return { ok: false, status: 409 } as Response;
      }
      return { ok: true, status: 200 } as Response;
    });

    const queue = createQueue();
    const taskId = enqueue(
      queue,
      new File(["plaintext"], "notes.txt", { type: "text/plain" }),
    );
    const terminal = waitForTerminal(queue, taskId);
    queue.start();

    expect((await terminal).status).toBe("complete");
    expect(
      mockGoogleDriveFetch.mock.calls.filter(([url]) =>
        String(url).includes("generateIds"),
      ),
    ).toHaveLength(1);
    const uploadForms = mockGoogleDriveFetch.mock.calls
      .filter(([url]) => String(url).includes("upload/drive"))
      .map(([, request]) => request?.body as FormData);
    expect(uploadForms).toHaveLength(2);
    for (const form of uploadForms) {
      const metadata = JSON.parse(
        await (form.get("metadata") as Blob).text(),
      ) as { id: string };
      expect(metadata.id).toBe("stable-drive-id");
    }
  });

  it("removes the known Drive object when cancellation follows upload acceptance", async () => {
    const queue = createQueue();
    let cancellation: Promise<boolean> | undefined;
    mockGoogleDriveFetch.mockImplementation(async (url) => {
      const requestUrl = String(url);
      if (requestUrl.includes("generateIds")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ ids: ["cancel-drive-id"] }),
        } as Response;
      }
      if (requestUrl.includes("upload/drive")) {
        return {
          ok: true,
          status: 200,
          json: async () => {
            cancellation = queue.cancel("upload-1");
            return { id: "cancel-drive-id" };
          },
        } as Response;
      }
      return { ok: true, status: 204 } as Response;
    });

    const taskId = enqueue(
      queue,
      new File(["plaintext"], "notes.txt", { type: "text/plain" }),
    );
    const terminal = waitForTerminal(queue, taskId);
    queue.start();

    expect((await terminal).status).toBe("canceled");
    await expect(cancellation).resolves.toBe(true);
    expect(mockGoogleDriveFetch).toHaveBeenCalledWith(
      "https://www.googleapis.com/drive/v3/files/cancel-drive-id",
      { method: "DELETE" },
    );
  });

  it("finishes an authoritative metadata commit when cancellation arrives late", async () => {
    let finishCommit: (() => void) | undefined;
    let markCommitStarted: (() => void) | undefined;
    const commitStarted = new Promise<void>((resolve) => {
      markCommitStarted = resolve;
    });
    (sendToGoogleDrive as jest.Mock).mockImplementation(() => {
      markCommitStarted?.();
      return new Promise<void>((resolve) => {
        finishCommit = resolve;
      });
    });

    const queue = createQueue();
    const taskId = enqueue(
      queue,
      new File(["plaintext"], "notes.txt", { type: "text/plain" }),
    );
    queue.start();
    await waitForStatus(queue, taskId, "committing");
    await commitStarted;

    const cancellation = queue.cancel(taskId);
    finishCommit?.();

    await expect(cancellation).resolves.toBe(true);
    expect(queue.getTask(taskId)?.status).toBe("complete");
    expect(sourceFiles.has(taskId)).toBe(false);
  });
});
