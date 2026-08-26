---
title: Set up Recovery & Access
description: Create a recovery phrase or restore the phrase that already protects your encrypted files.
category: getting-started
order: 4
updated: 2026-08-26
analyticsKey: docs_recovery_access_setup
---

## Before you begin

Recovery & Access gives this browser the information it needs to encrypt and decrypt your personal files. You can create a new recovery phrase for a new vault or enter the phrase that already protects an existing vault.

Do not create a new phrase merely because an existing vault does not open. A different phrase creates different encryption keys and cannot unlock files protected by the original phrase.

![Recovery choice for a new or existing ZeroDrive vault](/docs/images/recovery-decision.svg)

*Create a phrase only for a genuinely new vault. Existing encrypted files require their original phrase.*

## Create a new vault

Open **Recovery & Access**, choose the option to create access, and save the displayed 12-word phrase somewhere you trust. A password manager or securely stored written copy is better than a screenshot or an unprotected note.

Confirm the phrase as requested. Once access is active, return to Home or Storage and upload the first file. ZeroDrive cannot send a reset email for this phrase.

## Recover an existing vault

Open **Recovery & Access**, enter the same 12 words in the same order, and continue. ZeroDrive normalizes ordinary spacing, but it cannot correct a missing or different word.

When you arrive from Storage or Share Files, a successful recovery returns you to that workflow. The encrypted file list is then checked with the restored access before write actions are allowed.

## After setup

Access remains available during normal navigation and reloads in the same tab session. Logging out, switching accounts, opening a separate tab, or starting a new browser session can require the phrase again.

The phrase is handled by the frontend and is not sent to the ZeroDrive API. Use Recovery & Access only on a device and browser you trust.
