---
title: Fix Google Drive access
description: Resolve a sign-in that succeeded without the permissions required for encrypted Storage.
category: troubleshooting
order: 2
updated: 2026-08-26
analyticsKey: docs_drive_permission_problems
---

## Recognize the problem

Google can authenticate your email even when the Drive permission checkboxes were not approved. In that state, ZeroDrive knows which account signed in but cannot load hidden vault metadata or manage encrypted Drive objects.

The app displays a Drive-access dialog before legal acceptance and blocks Storage operations that require the missing permission. File and sharing actions also show a user-safe reconnect message if the permission state changes later.

## Reconnect with Google

Use the dialog's logout action, sign in again, and approve both requested Drive permissions. Read Google's consent screen carefully rather than continuing with only the email permission.

The required scopes let ZeroDrive manage files used with the app and its own hidden configuration data. They do not grant general access to every unrelated Drive file.

## If access was revoked later

Google Account settings can revoke an application's permissions after sign-in. The next Drive request then fails even if a ZeroDrive login cookie still exists.

Sign out of ZeroDrive and reconnect. If the problem continues, remove the old ZeroDrive authorization from Google Account settings and complete sign-in again.

## What not to do

Do not create a new recovery phrase to solve a Google permission failure. Google authorization controls access to stored encrypted objects; the recovery phrase controls decryption. Changing one does not repair the other.
