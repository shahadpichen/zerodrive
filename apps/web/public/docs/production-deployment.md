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

## Configure domains and HTTPS

Give the frontend and API stable HTTPS origins. Set the canonical application origin, allowed origins, secure-cookie behavior, and trusted proxy configuration explicitly. Do not construct redirects from an untrusted request Host header.

Test OAuth callback URLs exactly as registered in Google Cloud Console. Development localhost callbacks should not be accepted accidentally by production configuration.

## Configure secrets

Generate independent, strong values for JWT signing and directory HMAC lookup. Configure non-default database and object-storage credentials. Keep all secrets outside the repository and application logs.

Never reuse the directory HMAC secret as a password or publish it with a database backup. Changing identity secrets after production data exists requires a planned migration.

## Run migrations and checks

Deploy additive database migrations before code that requires them. ZeroDrive records migration checksums and refuses startup if an applied migration file changes later, so never edit an already-applied migration.

Run API and web type checks, security tests, the production web build, and real PostgreSQL migration integration tests. Confirm object upload, finalization, expiry cleanup, OAuth refresh, Recovery & Access, and Save to Storage.

## Operate the service

Monitor availability and aggregate failures without logging emails, capabilities, tokens, object keys, request bodies, or file metadata. Configure an email provider only for workflows that actually send invitations or operational messages.

Keep the deployment updated, review dependency advisories, test backups, and document how users can obtain encrypted personal files and offline recovery tooling if the hosted interface becomes unavailable.
