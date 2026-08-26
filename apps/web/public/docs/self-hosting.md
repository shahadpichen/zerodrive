---
title: Self-hosting overview
description: Understand the services, secrets, and responsibilities in a ZeroDrive deployment.
category: self-hosting
order: 1
updated: 2026-08-26
analyticsKey: docs_self_hosting
---

## What you run

Self-hosting means you run the ZeroDrive stack yourself instead of depending on the hosted service.

A full deployment needs the frontend website, backend API, PostgreSQL database, object storage for shared files, Google OAuth, Google Drive API access, email delivery, and HTTPS.

In simpler terms, you run the website, the server, the database, the shared-file storage, and the email setup. You get more control, but you also become responsible for updates, backups, secrets, and uptime.

For local development, `pnpm infra:up` starts PostgreSQL, MinIO, and pgAdmin. The backend runs at `http://localhost:3001`, and the frontend runs at `http://localhost:3000`.

For production, you need proper domains, HTTPS, backups, monitoring, and a secure place to store secrets.

## Environment

Use the repository’s current `.env.example` files as the source of truth.

Environment variables are settings and secrets the app reads when it starts. They tell ZeroDrive where the database is, where the frontend lives, how Google OAuth should redirect users, and what secrets are used to protect tokens and private email lookups.

Important backend values include `JWT_SECRET`, `DIRECTORY_HMAC_SECRET`, `GOOGLE_REDIRECT_URI`, `MINIO_*`, `MAILGUN_*`, `APP_URL`, and `ALLOWED_ORIGINS`.

The main frontend value is `REACT_APP_API_URL`. `REACT_APP_RSA_PBKDF2_SALT` is needed only when an existing deployment must read historical sharing-key records created before Capsule v1. New sharing-key backups do not use that deployment salt.

Never commit real production values to GitHub.

## Secret management

Secret management is where many self-hosted apps become unsafe. A strong encryption design can still fail if production secrets are weak, reused, committed to GitHub, or logged accidentally.

Use a strong random `JWT_SECRET`. Use an independent strong `DIRECTORY_HMAC_SECRET`. Do not reuse the old email hash salt as the directory HMAC secret.

Keep the directory HMAC secret outside PostgreSQL. If an attacker only gets a database dump, they should not also get the secret needed to test email guesses against private lookup identifiers.

Rotating the directory secret later requires a planned identifier migration. Do not change it casually in production.

## Keep the same privacy boundaries

Self-hosting changes who controls the infrastructure. It does not mean the backend should receive plaintext files, recovery phrases, private keys, or unencrypted file keys.

If you host ZeroDrive yourself, you are choosing to trust your own server instead of the public hosted service. That can be good for control and transparency, but the product should still be designed so the server does not need readable user files in order to work.

Keep the same zero-knowledge boundaries: encrypt files before upload, keep recovery phrases client-side, keep private keys private, and avoid storing plaintext recipient emails or sender identity in privacy-sensitive share records.
