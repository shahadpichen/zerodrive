---
title: Common problems
description: Diagnose vault access, encrypted metadata, upload, preview, and sharing failures safely.
category: troubleshooting
order: 1
updated: 2026-08-26
analyticsKey: docs_common_problems
---

## Vault access is missing

Open **Recovery & Access** and enter the phrase that protects this vault. Reloading the same tab can restore an account-bound session, but logout, account switching, a new tab, or a new browser session can require the phrase again.

If you do not have the original phrase, ZeroDrive cannot reset old encrypted files through email or an administrator action.

## The encrypted file list will not open

First confirm the Google account and recovery phrase. If the message appears only briefly while a valid vault is being checked, wait for verification to finish. If it remains, avoid uploads, folder changes, and deletion until the mismatch is understood.

Starting fresh rewrites the encrypted vault index with the current key. Older encrypted objects may remain in Google Drive but stop appearing in ZeroDrive. The confirmation deliberately requires extra acknowledgement.

## Upload or preview failed

Check the upload tray for a retryable failure. Keep the tab open until encryption, upload, and metadata commit all complete. For a very large preview, download the file after the one-minute guidance appears.

Network and Google Drive errors should be retried. A decryption or integrity error should not be treated as a network failure; verify Recovery & Access instead.

## Sharing is unavailable

Both sender and recipient need a sharing identity. Make sure the recipient email matches their ZeroDrive account. If a known recipient's public key changed, verify the change before continuing.

For Shared With Me, recover the identity version that existed when the file was sent. Personal vault access alone does not guarantee that every historical recipient key backup is available.
