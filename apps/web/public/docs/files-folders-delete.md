---
title: Files, folders, and deletion
description: Organize encrypted files and understand what move and delete actions change.
category: storage
order: 4
updated: 2026-08-26
analyticsKey: docs_files_folders_delete
---

## Create folders

Folders are organization records in the encrypted vault index. Creating a folder updates the protected index; it does not need to create a readable folder name in Google Drive.

Folder names become visible only after the index is decrypted in the browser. Choose names normally, but remember that anyone with working vault access can read the same organization data.

## Move and rename

Moving a file changes its folder relationship in the encrypted index. The underlying encrypted Drive object can remain the same. Renaming changes protected metadata rather than exposing the original name as a Drive object name.

ZeroDrive verifies the current remote index before allowing these writes. This reduces the chance that an old local view overwrites newer organization changes.

## Delete a file

Deleting removes the encrypted object from Google Drive and updates the vault index. This is not the same as deleting a plaintext copy you previously downloaded to the device.

Google Drive retention or trash behavior may still apply at the provider level. ZeroDrive should not be treated as a guaranteed secure-erasure tool for every provider backup.

## Delete all files

Delete All Files is deliberately treated as a dangerous action. It is blocked while queued or retryable uploads could later add files back to the index. Read the confirmation carefully and verify that the queue is finished first.

Keep independent backups of irreplaceable data. Encryption protects confidentiality, not accidental deletion.
