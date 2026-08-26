---
title: Use encrypted Storage
description: Understand how ZeroDrive organizes encrypted files and folders in your Google Drive.
category: storage
order: 1
updated: 2026-08-26
analyticsKey: docs_using_storage
---

## Storage is an encrypted view

The Storage page is ZeroDrive's view of encrypted objects stored in your own Google Drive. It is not a second cloud-storage account. ZeroDrive adds an encryption and organization layer on top of Google Drive.

The files shown in the interface come from an encrypted vault index stored in Google's hidden application-data area. The index contains the protected structure needed to display names, folders, and file references after your browser unlocks it.

## Search and sort

Use search to filter the decrypted names currently available in the browser. Filters and sorting operate on the local view; they do not send filenames to the ZeroDrive backend.

Grid and list views change presentation only. They do not create another copy of the file or modify encryption.

## Refresh safely

Refresh asks Google Drive for the current encrypted vault index and verifies it before enabling metadata-writing actions. During verification, upload, move, folder, and deletion actions stay blocked to prevent stale local data from replacing a valid remote index.

If verification reports a different recovery phrase, review Recovery & Access before changing anything. A network error is different from a decryption mismatch and should normally be retried rather than treated as an empty vault.

## Work across tabs and devices

Two tabs or devices can read the same Google Drive, but concurrent metadata edits can conflict. ZeroDrive coordinates writes within the current browser, not across every device connected to the account.

Before making changes on another device, refresh and confirm it can open the latest vault. Avoid simultaneous large edits from multiple devices.
