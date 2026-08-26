---
title: Receive a shared file
description: Open the shared inbox, download plaintext, or save a fresh encrypted copy to Storage.
category: sharing
order: 4
updated: 2026-08-26
analyticsKey: docs_shared_with_me
---

## Open the inbox

**Shared With Me** lists finalized, unexpired files prepared for the current account's sharing identity. Protected metadata is decrypted locally so the inbox can show the filename and message without storing those values plainly in PostgreSQL.

If the inbox asks for Recovery & Access, enter the phrase that protects the sharing-key backup. A different phrase or identity may be unable to open files sent to an earlier key.

## Download

Download fetches the encrypted shared object, verifies and decrypts it in the browser, and saves plaintext to the device. The original share remains available until it expires or is revoked.

Once downloaded, the readable copy is outside ZeroDrive encryption. The recipient is responsible for where it is stored or sent next.

## Save to Storage

Save to Storage first verifies that your personal encrypted vault index is current. It then decrypts the shared object locally, creates a new personal-file Capsule, uploads that encrypted copy to your Google Drive, and updates your vault index.

This is a new independent encrypted copy. It does not move the sender's object and does not extend the original share's lifetime.

## Expiration

The inbox shows the expected expiry date. After expiry, backend cleanup changes the share lifecycle and removes its encrypted object. Save or download important files before that date.
