---
title: Use ZeroDrive on another device
description: Restore vault access and sharing history without transferring plaintext files or private keys manually.
category: recovery
order: 2
updated: 2026-08-26
analyticsKey: docs_another_device
---

## Sign in to the same account

Use the Google account that owns the encrypted Storage objects and hidden ZeroDrive application data. A recovery phrase cannot compensate for signing into the wrong Drive account.

Approve the required Google Drive permissions if the new browser does not already have them. ZeroDrive needs access to its encrypted objects and private application-data area.

## Recover vault access

Open **Recovery & Access** and enter the original 12-word phrase. The phrase recreates the key material needed to open the personal vault index and file Capsules.

ZeroDrive checks the encrypted index before enabling writes. If the phrase does not match, do not start fresh unless you intentionally want to replace the visible vault index for that account.

## Recover sharing history

The same recovery session can open the encrypted sharing-key backup stored in Google's application-data area. Historical key versions are restored so shares sent before a key rotation remain readable.

If the backup is missing or belongs to another phrase, personal Storage access may still work while old Shared With Me items remain unavailable. These are separate capabilities even though the Recovery & Access page coordinates them.

## Finish safely

Open one personal file and one historical shared file before relying on the new device. Log out when using a shared computer; logout clears the account-bound recovery session and local private-key records where supported.
