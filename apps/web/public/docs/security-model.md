---
title: Security model and limitations
description: Learn what ZeroDrive protects, what it cannot protect, and where trust still remains.
category: privacy-security
order: 2
updated: 2026-08-26
analyticsKey: docs_security_model
---

## Trust boundary

ZeroDrive has an important boundary: your browser is where readable files should appear, and the server is where coordination should happen.

The browser is trusted with plaintext because Capsule creation and opening happen there. The backend is trusted as a coordinator, not as a place for plaintext files, recovery phrases, or unencrypted keys.

You can think of the server like a receptionist. It can check who is signed in, help route a share, and keep records that make the app work. But it should not be able to read the file itself.

The server may know operational information such as session state, that a share happened, share status, expiry, timestamps, encrypted size, rate-limit counters, and aggregate analytics.

The server should not know your recovery phrase, Capsule data keys, private sharing key, plaintext files, plaintext filenames, plaintext messages, or unencrypted shared-file keys.

## What it protects against

ZeroDrive is built to reduce trust in cloud storage and in the ZeroDrive backend. It cannot remove all risk, but it can make important attacks much harder.

It protects personal file contents from being readable directly by Google Drive. Google Drive should store encrypted files, not the original readable versions.

It protects shared file contents from being readable directly by the ZeroDrive backend. The backend coordinates shares, but the file should already be encrypted before storage receives it.

Capsule v1 authenticates both encrypted content and protected metadata. Altered, truncated, malformed, or wrong-key objects fail closed instead of returning unverified plaintext. Legacy ZeroDrive formats remain readable through Capsule’s compatibility readers, while ZeroDrive writes only Capsule v1.

It protects against a database dump immediately revealing plaintext shared-file metadata or obvious sender identity links. The database should not plainly say who sent a file or what the sensitive filename was.

It also protects against cross-user access problems when endpoints correctly use the authenticated account instead of trusting caller-supplied identifiers.

## Limitations

Some risks are outside what encryption can solve.

If your device or browser is compromised, malicious code may see decrypted data while the app is running. Encryption protects stored files, but it cannot hide a file from malware after you open it on screen.

If you lose your recovery phrase and no device still has the right key material, ZeroDrive cannot reset encryption access like a normal password.

If a recipient decrypts a file, ZeroDrive cannot prevent them from copying it, screenshotting it, re-uploading it, or sharing the plaintext elsewhere.

If Google Drive, object storage, email delivery, or the hosted ZeroDrive service has an outage, availability can still be affected. Zero-knowledge encryption protects privacy; it does not guarantee every provider is always online.
