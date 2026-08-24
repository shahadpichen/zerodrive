import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { UploadQueueTray } from "../../components/upload-queue-tray";
import { useUploadQueue } from "../../contexts/upload-queue-context";

jest.mock("../../contexts/upload-queue-context", () => ({
  useUploadQueue: jest.fn(),
}));

const mockUseUploadQueue = useUploadQueue as jest.MockedFunction<
  typeof useUploadQueue
>;
const retry = jest.fn();
const cancel = jest.fn().mockResolvedValue(true);
const clearCompleted = jest.fn();

describe("UploadQueueTray", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cancel.mockResolvedValue(true);
    mockUseUploadQueue.mockReturnValue({
      snapshot: {
        running: true,
        activeCount: 0,
        tasks: [
          {
            id: "failed-1",
            source: { sourceId: "failed-1" },
            name: "notes.txt",
            size: 9,
            mimeType: "text/plain",
            metadata: {
              userEmail: "owner@example.com",
              folderId: null,
              allowMetadataReplacement: false,
            },
            status: "failed",
            progress: 0.1,
            attempts: 1,
            error: {
              code: "NETWORK_INTERRUPTED",
              message: "The connection was interrupted.",
              stage: "upload",
              retryable: true,
              attempt: 1,
            },
            createdAt: 1,
            updatedAt: 2,
          },
        ],
      },
      enqueueUploads: jest.fn(),
      hasPendingUploads: jest.fn().mockReturnValue(false),
      tryAcquireUploadExclusion: jest.fn().mockReturnValue(jest.fn()),
      waitForTask: jest.fn(),
      retry,
      cancel,
      clearCompleted,
    });
  });

  it("shows failed uploads on authenticated pages and exposes retry/remove actions", async () => {
    render(
      <MemoryRouter initialEntries={["/storage"]}>
        <UploadQueueTray />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("complementary", { name: "Upload queue" }),
    ).toBeInTheDocument();
    expect(screen.getByText("notes.txt")).toBeInTheDocument();
    expect(
      screen.getByText(/failed · the connection was interrupted/i),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retry notes.txt" }));
    expect(retry).toHaveBeenCalledWith("failed-1");

    fireEvent.click(
      screen.getByRole("button", {
        name: "Remove notes.txt from uploads",
      }),
    );
    await waitFor(() => {
      expect(cancel).toHaveBeenCalledWith("failed-1");
    });
    expect(clearCompleted).toHaveBeenCalled();
  });

  it("stays hidden on public routes", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <UploadQueueTray />
      </MemoryRouter>,
    );
    expect(
      screen.queryByRole("complementary", { name: "Upload queue" }),
    ).not.toBeInTheDocument();
  });
});
