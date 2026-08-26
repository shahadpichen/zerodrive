---
title: If ZeroDrive disappears
description: Understand what remains recoverable and which files still depend on hosted sharing infrastructure.
category: recovery
order: 3
updated: 2026-08-26
analyticsKey: docs_if_zerodrive_disappears
---

## What remains

If the hosted ZeroDrive service disappears, your personal encrypted files should still remain in your Google Drive. The hosted app is the interface, not the final owner of your encrypted personal files.

Accepted shared files that were saved into your own Storage should follow the same model as personal files. They become separately encrypted copies in your Google Drive.

The important word is “encrypted.” If ZeroDrive disappears, files may still exist, but they are not useful without the right recovery phrase or key material and a compatible way to decrypt them.

Keeping the encrypted file is only half of recovery. Keeping the key material is the other half.

## What you need

Recovery is not just about downloading files from Google Drive. To turn encrypted ZeroDrive files back into readable files, you need matching pieces.

You need the encrypted `.zd` files, the correct 12-word recovery phrase or legacy key material, a compatible Capsule decryptor, and access to the Google Drive account holding the files.

If one of those pieces is missing, recovery may fail. For example, having the encrypted file without the recovery phrase is like having a locked safe without the key.

ZeroDrive also cannot recover files that were deleted directly from Google Drive, corrupted, partially uploaded, or overwritten.

## Offline recovery tooling

ZeroDrive publishes the open-source `@zerodrivehq/recovery` CLI for offline recovery. It uses the same Capsule implementation as the web app and does not depend on the hosted ZeroDrive website.

The tool runs on the user’s computer and should not upload the recovery phrase or encrypted files to another server. Download the encrypted `.zd` objects from Google Drive before using it.

The tool should ask for the recovery phrase interactively. It should not encourage users to put the recovery phrase directly into a command, because shell history, terminal logs, and process lists can preserve command arguments.

Consult the package’s current README for the exact commands and supported legacy formats:

`npx @zerodrivehq/recovery`

Enter sensitive recovery material only when the tool prompts for it. Do not place a recovery phrase directly in command arguments, shell history, scripts, screenshots, or issue reports.

## Pending shares

Pending shared files are different from personal files already stored in your Google Drive.

A pending share can depend on ZeroDrive’s backend, PostgreSQL records, object storage, and cleanup jobs. If a pending share was not saved or downloaded before the service disappeared, it may not be recoverable.

This is because a pending share is still part of the sharing system. It may rely on records and storage controlled by the ZeroDrive deployment.

For long-term access, recipients should save important incoming files into their own Storage after decrypting them.
