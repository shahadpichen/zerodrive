import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  UploadQueueProvider,
  useUploadQueue,
} from "../../contexts/upload-queue-context";
import { createVaultUploadQueueAdapter } from "../../utils/vaultUploadQueueAdapter";
import { useApp } from "../../contexts/app-context";
import { useVaultData } from "../../contexts/vault-data-context";
import {
  AUTH_SESSION_CLEARED_EVENT,
  prepareForAuthSessionClear,
} from "../../utils/authEvents";

jest.mock("../../contexts/app-context", () => ({
  useApp: jest.fn(() => ({
    refreshAll: jest.fn().mockResolvedValue(undefined),
    setDecryptionError: jest.fn(),
  })),
}));

jest.mock("../../contexts/vault-data-context", () => ({
  useVaultData: jest.fn(() => ({
    refreshVaultFromLocal: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock("../../utils/vaultUploadQueueAdapter", () => ({
  createVaultUploadQueueAdapter: jest.fn(),
}));

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

const mockCreateAdapter = createVaultUploadQueueAdapter as jest.Mock;
const mockUseApp = useApp as jest.Mock;
const mockUseVaultData = useVaultData as jest.Mock;

function QueueHarness({ page }: { page: string }) {
  const {
    snapshot,
    enqueueUploads,
    hasPendingUploads,
    tryAcquireUploadExclusion,
  } = useUploadQueue();
  const exclusionReleaseRef = React.useRef<(() => void) | null>(null);
  const [enqueueResult, setEnqueueResult] = React.useState("idle");

  const enqueueTestFile = () => {
    try {
      enqueueUploads([
        {
          file: new File(["plaintext"], "notes.txt", {
            type: "text/plain",
          }),
          userEmail: "owner@example.com",
        },
      ]);
      setEnqueueResult("queued");
    } catch {
      setEnqueueResult("blocked");
    }
  };

  return (
    <div>
      <p>{page}</p>
      <p data-testid="statuses">
        {snapshot.tasks.map((task) => task.status).join(",") || "empty"}
      </p>
      <p data-testid="pending">
        {String(hasPendingUploads("owner@example.com"))}
      </p>
      <p data-testid="enqueue-result">{enqueueResult}</p>
      <button onClick={enqueueTestFile}>Upload</button>
      <button
        onClick={() => {
          exclusionReleaseRef.current =
            tryAcquireUploadExclusion("owner@example.com");
        }}
      >
        Acquire exclusion
      </button>
      <button
        onClick={() => {
          exclusionReleaseRef.current?.();
          exclusionReleaseRef.current = null;
        }}
      >
        Release exclusion
      </button>
    </div>
  );
}

describe("UploadQueueProvider", () => {
  let finishPreparing: (() => void) | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    window.sessionStorage.clear();
    mockUseApp.mockReturnValue({
      refreshAll: jest.fn().mockResolvedValue(undefined),
      setDecryptionError: jest.fn(),
    });
    mockUseVaultData.mockReturnValue({
      refreshVaultFromLocal: jest.fn().mockResolvedValue(undefined),
    });
    Object.defineProperty(global.crypto, "randomUUID", {
      configurable: true,
      value: jest.fn(() => "00000000-0000-4000-8000-000000000001"),
    });

    mockCreateAdapter.mockReturnValue({
      prepare: jest.fn(
        () =>
          new Promise((resolve) => {
            finishPreparing = () => resolve({ encrypted: true });
          }),
      ),
      upload: jest.fn().mockResolvedValue({ driveFileId: "drive-file-1" }),
      commit: jest.fn().mockResolvedValue({
        id: "drive-file-1",
        name: "notes.txt",
        mimeType: "text/plain",
        userEmail: "owner@example.com",
        uploadedDate: new Date(),
        folderId: null,
      }),
      cleanup: jest.fn(),
    });
  });

  it("keeps an active upload across child page changes and warns before leaving", async () => {
    const view = render(
      <UploadQueueProvider>
        <QueueHarness page="Storage" />
      </UploadQueueProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Upload" }));
    await waitFor(() => {
      expect(screen.getByTestId("statuses")).toHaveTextContent("preparing");
      expect(screen.getByTestId("pending")).toHaveTextContent("true");
    });

    const beforeUnload = new Event("beforeunload", {
      bubbles: false,
      cancelable: true,
    });
    window.dispatchEvent(beforeUnload);
    expect(beforeUnload.defaultPrevented).toBe(true);

    view.rerender(
      <UploadQueueProvider>
        <QueueHarness page="Home" />
      </UploadQueueProvider>,
    );
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByTestId("statuses")).toHaveTextContent("preparing");

    finishPreparing?.();
    await waitFor(() => {
      expect(screen.getByTestId("statuses")).toHaveTextContent("complete");
      expect(screen.getByTestId("pending")).toHaveTextContent("false");
    });
  });

  it("prevents an upload from being enqueued during an exclusive vault operation", () => {
    render(
      <UploadQueueProvider>
        <QueueHarness page="Storage" />
      </UploadQueueProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Acquire exclusion" }));
    fireEvent.click(screen.getByRole("button", { name: "Upload" }));

    expect(screen.getByTestId("enqueue-result")).toHaveTextContent("blocked");
    expect(screen.getByTestId("statuses")).toHaveTextContent("empty");

    fireEvent.click(screen.getByRole("button", { name: "Release exclusion" }));
  });

  it("cancels failed tasks and runs cleanup when the auth session is cleared", async () => {
    const cleanup = jest.fn().mockResolvedValue(undefined);
    mockCreateAdapter.mockReturnValue({
      prepare: jest.fn().mockRejectedValue(new Error("encryption failed")),
      upload: jest.fn(),
      commit: jest.fn(),
      cleanup,
    });

    render(
      <UploadQueueProvider>
        <QueueHarness page="Storage" />
      </UploadQueueProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Upload" }));
    await waitFor(() => {
      expect(screen.getByTestId("statuses")).toHaveTextContent("failed");
      expect(screen.getByTestId("pending")).toHaveTextContent("true");
    });

    await prepareForAuthSessionClear();
    await waitFor(() => expect(cleanup).toHaveBeenCalled());
    await waitFor(() => {
      expect(screen.getByTestId("statuses")).toHaveTextContent("canceled");
      expect(screen.getByTestId("pending")).toHaveTextContent("false");
    });
  });
});
