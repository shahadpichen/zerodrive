---
title: Upload your first encrypted file
description: Follow the first Storage upload from your device to an encrypted object in Google Drive.
category: getting-started
order: 5
updated: 2026-08-26
analyticsKey: docs_first_upload
---

## What you need

Sign in with the required Google Drive permissions and make sure Recovery & Access is active. Storage cannot safely write a new encrypted file list until the current vault has been checked.

If this is an existing vault and ZeroDrive cannot open its encrypted file list, stop and confirm that you entered the correct recovery phrase. Starting fresh can replace the index that makes older files visible in ZeroDrive.

## Choose a file

Open **Storage**, select **Upload**, and choose one or more files. You can also drag files into the upload area. The upload tray shows waiting, encrypting, uploading, and completed work without requiring you to remain on the Storage route.

ZeroDrive does not impose its old 100 MB application limit. Large files are still limited by available browser memory, network reliability, Google Drive limits, and the current whole-file encryption implementation.

## What happens during upload

Your browser reads the original file, creates an authenticated Capsule v1 encrypted object, and sends only that object to Google Drive. The original filename and media type are protected inside the encrypted data rather than used as the Drive object name.

After the object upload succeeds, ZeroDrive updates the encrypted vault index in Google's private application-data area. The file appears in Storage only after that metadata commit succeeds.

## Confirm the result

Wait for the upload tray to show completion. Open or download the new file once to confirm the browser can decrypt it. Keep the recovery phrase before treating ZeroDrive as the only route to an important file.
