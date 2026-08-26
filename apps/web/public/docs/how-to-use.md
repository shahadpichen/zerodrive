---
title: Quick start
description: Sign in, set up Recovery & Access, upload a file, and prepare secure sharing.
category: getting-started
order: 2
updated: 2026-08-26
analyticsKey: docs_how_to_use
---

## First-time setup

The first setup is the most important part of using ZeroDrive. You sign in with Google, create your encryption key, and save the recovery phrase. After that, the app should feel close to a normal file manager.

The recovery phrase is the unusual part. Treat it like the master key to a safe. If you lose it, ZeroDrive cannot simply send a reset email to unlock old encrypted files.

That may feel stricter than normal apps, but it is also the point of ZeroDrive. A normal password reset works because the service has enough control to help you regain access. ZeroDrive is designed so the service should not have that kind of control over your encrypted files.

For a new user, the safe path is simple: sign in with Google, create a new key, write down or save the 12-word recovery phrase, and only then start uploading important files.

If you want to receive encrypted shares from other people, create your sharing identity too. This creates the recipient keys other users need to prepare encrypted files specifically for you.

## Upload and download

Use Storage for your own private files. Uploading means “lock this file and put the locked version in Google Drive.” Downloading means “get the locked file back and unlock it in my browser.”

The app tries to hide the technical encryption work. You do not need to choose algorithms, manage key files manually, or understand every storage detail. The habit that matters is to use ZeroDrive to manage ZeroDrive files instead of editing encrypted files directly from Google Drive.

When you upload, choose or drag a file into Storage. ZeroDrive creates a Capsule v1 encrypted object locally, uploads it with an opaque `.zd` name, and updates the encrypted app file list. When you download, ZeroDrive fetches the Capsule, verifies and decrypts it locally, and gives you the readable file with its original name and type.

If decryption fails, the app is not refusing arbitrarily. It usually means the current browser does not have the right key, the recovery phrase is wrong, or the encrypted file was changed outside ZeroDrive.

## Share and receive

Sharing is like preparing a locked package for one specific person. Before you can send it, the recipient needs a ZeroDrive sharing identity so your browser knows how to lock the package for them.

To send a file, go to Share Files, choose a local file or a file already in your storage, enter the recipient email, and let ZeroDrive prepare the encrypted share. The recipient email is used to find the recipient’s sharing key. It should not become a plain permanent label inside the shared-file database record.

To receive a file, go to Shared With Me. If your key is not active in the current browser tab, unlock or recover it with your recovery phrase. After that, ZeroDrive can decrypt the shared file locally.

When receiving a file, you can download it or save it into your own Storage. Saving creates your own encrypted copy in your Google Drive. It does not move the sender’s original file and does not reveal the sender’s keys.

## Common problems

Most problems in ZeroDrive come from one of three things: the wrong key, the wrong Google account, or a recipient who has not finished setting up sharing.

If ZeroDrive says the key is missing, use the same 12-word recovery phrase you saved earlier. This often happens after changing devices, clearing browser storage, or opening a new browser.

If decryption fails, the recovery phrase may be wrong, the encrypted file may have been changed outside ZeroDrive, or the file may belong to a different account or key.

If a recipient cannot receive a share, they may not have created a sharing identity yet, or the email you entered may not match the account they use with ZeroDrive.

The important thing to remember is that ZeroDrive cannot bypass encryption to “just open the file anyway.” If the key is wrong, the safe behavior is to fail.
