---
title: How ZeroDrive works
description: Understand where your files go, who can read them, and what ZeroDrive coordinates.
category: getting-started
order: 1
updated: 2026-08-26
analyticsKey: docs_how_it_works
---

## The simple mental model

ZeroDrive is easiest to understand if you imagine every file being placed inside a locked box before it leaves your computer. Google Drive holds encrypted personal files. A ZeroDrive deployment's object storage holds temporary recipient-encrypted shares. Neither should hold the private key that opens the file.

This is different from many normal cloud storage apps. Usually, a file is uploaded first and then the provider protects it inside their own systems. ZeroDrive tries to protect the file earlier. Your browser turns the readable file into an encrypted file before storage receives it.

So the simple version is this: your browser locks and unlocks files, storage holds encrypted files, and the ZeroDrive server helps coordinate login and sharing. The server should help move locked boxes around, not open them. ZeroDrive uses the open-source Capsule format for those locked files and encrypted indexes.

Your browser is the most trusted part of this model because it is where encryption and decryption happen. When a file becomes readable, it becomes readable inside your browser after your key is available. That is why your recovery phrase, browser session, and device security matter so much.

![ZeroDrive architecture showing browser encryption before Google Drive and shared object storage](/docs/images/zerodrive-architecture.svg)

*Personal files go to Google Drive as encrypted objects. Shared copies use separate recipient-encrypted object storage while the API coordinates delivery.*

## Personal files

When you add a file to Storage, ZeroDrive handles the original file in your browser first. The app writes a Capsule v1 encrypted object locally and uploads only that encrypted object to your Google Drive.

In normal words, Google Drive stores the locked version. If someone opens that file directly from Google Drive, it should look like meaningless data unless they also have the correct ZeroDrive key.

This lets ZeroDrive use Google Drive for what it is good at: storing and syncing files. But the privacy of the file comes from ZeroDrive encrypting it before upload, not from Google Drive being able to read it.

The original filename, file type, and content are authenticated inside the encrypted Capsule. Google Drive receives an opaque `.zd` object name. ZeroDrive’s encrypted vault index keeps the information needed to organize files and folders without making the original name the Drive object name.

The upload flow is: choose a file, create the Capsule in the browser, upload it, and update the encrypted vault index. The download flow is the reverse: fetch the Capsule, verify and decrypt it in the browser, then show or save the readable version.

## Shared files

Shared files use a different storage path from personal files. When you share a file, ZeroDrive creates a recipient-encrypted Capsule intended for that recipient. That shared Capsule is stored in object storage through backend-authorized upload and download links.

The important idea is that sharing does not give someone your whole Google Drive, your recovery phrase, or your main ZeroDrive key. A shared file is prepared as a separate encrypted package. The recipient receives only what is needed to open that one package.

For new shares, the database stores a small recipient-encrypted metadata Capsule, the encrypted object location, the recipient key version and fingerprint, expiry information, and lifecycle status. The content Capsule carries its protected data key, so the database does not need a separate wrapped file key. It does not store the readable file, readable filename, plaintext recipient email, or sender identity in the share record.

This is why sharing can work without the server reading the file. The server coordinates the delivery. The browser does the private encryption and decryption work.

## Share lifecycle

A shared file moves through a small lifecycle, like a package being prepared, delivered, and eventually cleaned up.

When a share is pending, ZeroDrive has started creating the share but the upload or finalization is not complete. When it is active, the recipient can access the encrypted file. When it is deleting, cleanup is in progress or waiting to retry. Once cleanup finishes, the share is deleted.

Most users do not need to think about these states. They exist so ZeroDrive can recover safely from interrupted uploads, failed network requests, or cleanup problems. They also help prevent abandoned shared files from staying around forever.

This lifecycle is part of the privacy model. If an upload never completes, it should not remain forever. If a share expires or is revoked, ZeroDrive should be able to remove the encrypted shared object and the related record.
