---
title: Production deployment checklist
description: Prepare domains, OAuth, secrets, storage, migrations, email, and operational checks for self-hosting.
category: self-hosting
order: 2
updated: 2026-08-26
analyticsKey: docs_production_deployment
---

## Prepare infrastructure

Run PostgreSQL for application records and privacy-safe analytics, S3-compatible object storage for temporary shared-file objects, the Express API, and the React frontend. Personal Storage objects remain in each user's Google Drive.

Use managed or carefully backed-up infrastructure for production. PostgreSQL and object storage serve different data and need separate backup and recovery plans.

The repository includes a complete single-VPS operator runbook under `ops/production/README.md`. It explains the host firewall, Docker, Nginx, TLS, environment setup, verification, backups, updates, and rollback sequence. Read and understand it before running production commands.

## Configure domains and HTTPS

Give the frontend and API stable HTTPS origins. Set the canonical application origin, allowed origins, secure-cookie behavior, and trusted proxy configuration explicitly. Do not construct redirects from an untrusted request Host header.

The standard hosted layout uses `zerodrive.xyz` for the web app, `api.zerodrive.xyz` for the API, and `files.zerodrive.xyz` for encrypted shared-file transfer. PostgreSQL and the MinIO administration console must not be exposed to the internet.

Test OAuth callback URLs exactly as registered in Google Cloud Console. Development localhost callbacks should not be accepted accidentally by production configuration.

## Configure secrets

Generate independent, strong values for JWT signing and directory HMAC lookup. Configure non-default database and object-storage credentials. Keep all secrets outside the repository and application logs.

Never reuse the directory HMAC secret as a password or publish it with a database backup. Changing identity secrets after production data exists requires a planned migration.

Keep the master secret inventory in a password manager. The VPS still needs a permission-restricted runtime environment file so the service can restart after a reboot. Browser variables beginning with `REACT_APP_` are public build settings, not secret storage.

## Run migrations and checks

Deploy additive database migrations before code that requires them. ZeroDrive records migration checksums and refuses startup if an applied migration file changes later, so never edit an already-applied migration.

Run API and web type checks, security tests, the production web build, and real PostgreSQL migration integration tests. Confirm object upload, finalization, expiry cleanup, OAuth refresh, Recovery & Access, and Save to Storage.

## Operate the service

Monitor availability and aggregate failures without logging emails, capabilities, tokens, object keys, request bodies, or file metadata. Configure an email provider only for workflows that actually send invitations or operational messages.

Keep the deployment updated, review dependency advisories, test backups, and document how users can obtain encrypted personal files and offline recovery tooling if the hosted interface becomes unavailable.

A backup stored only on the same VPS does not protect against server loss. Maintain an encrypted off-server copy of both the PostgreSQL dump and MinIO encrypted-object mirror, and regularly prove that they can be restored.
