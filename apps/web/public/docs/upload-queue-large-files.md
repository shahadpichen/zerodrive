---
title: Upload queue and large files
description: Understand queued uploads, navigation, completion, retry behavior, and large-file limits.
category: storage
order: 2
updated: 2026-08-26
analyticsKey: docs_upload_queue
---

## How the queue works

Files selected for upload enter one global in-app queue. The tray remains visible while you navigate between authenticated pages, so leaving Storage does not cancel ordinary in-app work.

Each item moves through preparation, encryption, upload, and metadata commit. A file is not complete merely because encrypted bytes reached Google Drive; it must also be added safely to the encrypted vault index.

## Closing or reloading the app

The queue is currently an in-memory browser queue. Reloading the page, closing the tab, or terminating a mobile web view can discard waiting work and the original file handles needed to retry it.

The browser warns before leaving when uploads are unfinished. Keep the tab open until the tray shows every item as completed or failed.

## Large files

ZeroDrive does not apply a fixed 100 MB limit. However, current encryption and preview paths can hold large buffers in browser memory. A several-hundred-megabyte file may take significant time and temporarily require much more memory than its visible size.

Network speed, device memory, browser limits, and Google Drive all affect the result. For large videos, downloading the encrypted file and opening the resulting plaintext locally may be more reliable than waiting for an in-browser preview.

## Failures and retries

A retryable failure remains in the tray with an explanation and retry action. Failed work can retain an uploaded encrypted object until cleanup or retry completes, which is why destructive vault actions are blocked while unfinished queue items remain.

Once all work reaches a terminal state, you can close the tray. Closing the completed tray does not delete uploaded files.
