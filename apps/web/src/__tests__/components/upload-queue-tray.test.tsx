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
    expect(
      screen.queryByRole("button", { name: "Close finished uploads" }),
    ).not.toBeInTheDocument();

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

  it("allows the tray to be closed only after every upload is finished", () => {
    mockUseUploadQueue.mockReturnValue({
      snapshot: {
        running: true,
        activeCount: 0,
        tasks: [
          {
            id: "complete-1",
            source: { sourceId: "complete-1" },
            name: "photo.heic",
            size: 12,
            mimeType: "image/heic",
            metadata: {
              userEmail: "owner@example.com",
              folderId: null,
              allowMetadataReplacement: false,
            },
            status: "complete",
            progress: 1,
            attempts: 1,
            result: {
              id: "drive-file-id",
              name: "photo.heic",
              mimeType: "image/heic",
              uploadedDate: new Date("2026-08-25T00:00:00.000Z"),
              userEmail: "owner@example.com",
              folderId: null,
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

    render(
      <MemoryRouter initialEntries={["/storage"]}>
        <UploadQueueTray />
      </MemoryRouter>,
    );

    expect(screen.getByText("1 finished")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Clear finished" }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Close finished uploads" }),
    );
    expect(clearCompleted).toHaveBeenCalledTimes(1);
  });

  it("keeps a large queue inside a bounded scroll region", () => {
    mockUseUploadQueue.mockReturnValue({
      snapshot: {
        running: true,
        activeCount: 2,
        tasks: Array.from({ length: 100 }, (_, index) => ({
          id: `upload-${index + 1}`,
          source: { sourceId: `upload-${index + 1}` },
          name: `file-${index + 1}.mov`,
          size: 1,
          mimeType: "video/quicktime",
          metadata: {
            userEmail: "owner@example.com",
            folderId: null,
            allowMetadataReplacement: false,
          },
          status: "waiting" as const,
          progress: 0,
          attempts: 0,
          createdAt: index,
          updatedAt: index,
        })),
      },
      enqueueUploads: jest.fn(),
      hasPendingUploads: jest.fn().mockReturnValue(true),
      tryAcquireUploadExclusion: jest.fn().mockReturnValue(null),
      waitForTask: jest.fn(),
      retry,
      cancel,
      clearCompleted,
    });

    render(
      <MemoryRouter initialEntries={["/storage"]}>
        <UploadQueueTray />
      </MemoryRouter>,
    );

    expect(screen.getByText("100 active · 100 total")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Close finished uploads" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("file-1.mov")).toBeInTheDocument();
    expect(screen.getByText("file-100.mov")).toBeInTheDocument();
    expect(screen.getByTestId("upload-queue-scroll-region")).toHaveClass(
      "max-h-80",
      "overflow-y-auto",
    );
  });
});
