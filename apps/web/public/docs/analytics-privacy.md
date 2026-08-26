---
title: Privacy-safe analytics
description: Understand which aggregate counters an operator can see and which identifying data is excluded.
category: privacy-security
order: 3
updated: 2026-08-26
analyticsKey: docs_analytics_privacy
---

## What analytics answer

A deployment operator can see aggregate questions such as how many file uploads completed, how many shares were finalized, and which reviewed product or documentation pages received attention.

These are event totals, not user timelines. The dashboard cannot inspect one person's navigation or reconstruct which account handled a particular file.

## What is not collected

Analytics exclude account identifiers, emails, IP addresses, user agents, filenames, object keys, capabilities, browser fingerprints, session identifiers, raw URLs, query strings, and referrers.

Page views use an explicit allowlist such as `storage` or `docs_security_model`. Unknown routes are not converted into arbitrary database labels.

## Retention

Exact daily counters are retained for 400 days. Older daily rows are combined into monthly totals and page buckets that have no automatic expiry. The count is preserved while the time detail changes from a day to a month.

Four hundred days is a deployment choice, not a cryptographic requirement. It keeps slightly more than one year of daily comparison while bounding the daily tables. Permanent monthly history supports long-term product trends.

## Deployment control

Analytics are disabled by default. A self-hosting operator must enable them and configure an administrator allowlist. Only an authorized operator can open the analytics dashboard.

ZeroDrive does not load third-party advertising or behavioral analytics scripts for this system. Aggregates remain in the deployment's PostgreSQL database.
