import React, { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  RotateCcw,
  UploadCloud,
  WifiOff,
  X,
} from "lucide-react";
import type { UploadQueueTaskStatus } from "@zerodrivehq/upload-queue";
import { useUploadQueue } from "../contexts/upload-queue-context";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";

const AUTHENTICATED_PATHS = [
  "/home",
  "/storage",
  "/recovery-access",
  "/key-management",
  "/share",
  "/shared-with-me",
  "/admin/",
];

const ACTIVE_STATUSES = new Set<UploadQueueTaskStatus>([
  "waiting",
  "blocked",
  "preparing",
  "uploading",
  "committing",
  "paused",
]);

const NON_RETRYABLE_ERROR_CODES = new Set([
  "UPLOAD_SOURCE_MISSING",
  "UPLOAD_ACCOUNT_CHANGED",
  "VAULT_ACCESS_CHANGED",
]);

const statusLabel = (status: UploadQueueTaskStatus): string => {
  switch (status) {
    case "waiting":
      return "Waiting";
    case "blocked":
      return "Waiting for connection";
    case "preparing":
      return "Encrypting in this browser";
    case "uploading":
      return "Uploading encrypted file";
    case "committing":
      return "Updating Storage";
    case "complete":
      return "Complete";
    case "failed":
      return "Failed";
    case "paused":
      return "Paused";
    case "canceled":
      return "Canceled";
  }
};

export function UploadQueueTray() {
  const location = useLocation();
  const { snapshot, retry, cancel, clearCompleted } = useUploadQueue();
  const [collapsed, setCollapsed] = useState(false);
  const tasks = useMemo(
    () => [...snapshot.tasks].sort((a, b) => a.createdAt - b.createdAt),
    [snapshot.tasks],
  );
  const activeCount = tasks.filter((task) =>
    ACTIVE_STATUSES.has(task.status),
  ).length;
  const canClear = tasks.some(
    (task) => task.status === "complete" || task.status === "canceled",
  );
  const isAuthenticatedPath = AUTHENTICATED_PATHS.some((path) =>
    path.endsWith("/")
      ? location.pathname.startsWith(path)
      : location.pathname === path,
  );

  if (!isAuthenticatedPath || tasks.length === 0) return null;

  return (
    <aside
      className="fixed bottom-4 right-4 z-40 w-[min(26rem,calc(100vw-2rem))] border bg-background text-foreground shadow-lg"
      aria-label="Upload queue"
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <UploadCloud className="h-4 w-4 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold">Uploads</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {activeCount > 0
                ? `${activeCount} active · ${tasks.length} total`
                : `${tasks.length} finished`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {canClear && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearCompleted}
              className="h-7 px-2 text-[11px]"
            >
              Clear finished
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? "Expand uploads" : "Collapse uploads"}
          >
            {collapsed ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {!collapsed && (
        <div
          className="max-h-80 overflow-y-auto"
          data-testid="upload-queue-scroll-region"
        >
          {tasks.map((task) => {
            const active = ACTIVE_STATUSES.has(task.status);
            const failed = task.status === "failed";
            const canRetry =
              failed &&
              (!task.error?.code ||
                !NON_RETRYABLE_ERROR_CODES.has(task.error.code));
            return (
              <div
                key={task.id}
                className="space-y-2 border-b px-4 py-3 last:border-b-0"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2">
                    {task.status === "complete" ? (
                      <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                    ) : task.status === "blocked" ? (
                      <WifiOff className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    ) : active && task.status !== "paused" ? (
                      <Loader2 className="mt-0.5 h-4 w-4 flex-shrink-0 animate-spin" />
                    ) : (
                      <UploadCloud className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p
                        className="truncate text-xs font-medium"
                        title={task.name}
                      >
                        {task.name}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {statusLabel(task.status)}
                        {failed && task.error?.message
                          ? ` · ${task.error.message}`
                          : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-1">
                    {canRetry && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => retry(task.id)}
                        aria-label={`Retry ${task.name}`}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {(active || failed) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => {
                          void cancel(task.id).then(() => clearCompleted());
                        }}
                        aria-label={
                          failed
                            ? `Remove ${task.name} from uploads`
                            : `Cancel ${task.name}`
                        }
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
                <Progress
                  value={Math.round(task.progress * 100)}
                  className="h-1"
                  aria-label={`${task.name} progress`}
                />
              </div>
            );
          })}
        </div>
      )}
    </aside>
  );
}
