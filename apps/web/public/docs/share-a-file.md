---
title: Share a file
description: Encrypt a device or Storage file for one recipient and finalize its temporary shared copy.
category: sharing
order: 3
updated: 2026-08-26
analyticsKey: docs_share_file
---

## Before sharing

Recovery & Access and your sharing identity must be active. The recipient must also have created a ZeroDrive sharing identity under the email address you enter.

ZeroDrive checks the recipient's current public key before encryption. If a previously recognized recipient now has a different fingerprint, review the warning rather than accepting the change automatically.

## Choose the source

You can choose a file from the device or select one already in Storage. A Storage file is decrypted locally before ZeroDrive creates a separate recipient-encrypted share. The recipient never receives access to your Google Drive or recovery phrase.

Add an optional message only if needed. The message and filename are protected for the recipient rather than stored as plaintext share metadata.

## Review and send

The review step confirms the recipient, source file, and expiration. When you continue, the browser creates recipient-encrypted content and metadata Capsules, uploads the encrypted content, and asks the backend to finalize the share.

A share is not visible to the recipient until finalization succeeds. Interrupted pending uploads expire and cleanup can retry safely.

## After sending

The shared object is a separate encrypted copy in ZeroDrive's configured object storage, not the personal object in your Google Drive. It remains available until its expiry or revocation lifecycle removes it.

The share record deliberately omits sender user ID and plaintext recipient email. Sender management uses a secret browser-held capability rather than attaching sender identity to the database row.
