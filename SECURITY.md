# Security model

ZeroDrive writes personal files, vault indexes, shared files, shared metadata,
and sharing-key backups with `@zerodrivehq/capsule` v1. Capsule creation and
opening happen in the frontend. The recovery phrase remains in the frontend
browser-tab session and is never sent to the API. It is held in memory while
the app runs and in account-bound `sessionStorage` so the same tab can retain
vault access across a reload. Capsule’s legacy readers keep
historical ZeroDrive objects readable; the application writes no legacy format.

ZeroDrive provides recipient-exclusive, authenticated encryption. It does not
provide cryptographic proof of sender identity.

For Capsule v1 shares, the sharing database stores a secret-derived recipient
lookup ID, a recipient-encrypted metadata Capsule, recipient key version and
fingerprint, opaque object keys, lifecycle state, and anonymous
management-capability hashes. It stores wrapped file-key envelopes only for
historical legacy shares. It must never store sender account identifiers or
plaintext recipient email addresses. The directory HMAC secret must be supplied
outside PostgreSQL and rotated only with a planned identifier migration.

Recipient public-key fingerprints are pinned after first contact. First-contact
trust still depends on the directory service; changed fingerprints require
explicit sender confirmation.

The authenticated public-key directory necessarily reveals whether a submitted
email address has registered a sharing key. Per-account and per-IP rate limits
reduce bulk probing but do not provide private contact discovery. Avoid treating
directory membership as confidential until a capability-based or OPRF-based
discovery protocol replaces direct email lookup.

Browser key material is cleared on logout and account changes. Reloading the
same tab keeps vault access, while a new tab or a new browser session normally
requires recovery-phrase entry again. Browser session restoration or tab
duplication may also copy or restore
`sessionStorage`, depending on the browser. Google refresh tokens use HTTP-only
cookies. An active same-origin XSS can still access decrypted files,
short-lived access tokens, and recovery material available to that tab, so CSP
and dependency integrity remain part of the security boundary.

## Privacy-preserving analytics

ZeroDrive does not load third-party analytics or advertising scripts. Product
analytics are first-party aggregate counters stored in
`analytics_daily_summary` and single-dimension aggregate buckets stored in
`analytics_daily_dimensions`. They contain no event rows, account identifiers,
emails, IP addresses, session identifiers, file identifiers, filenames,
capabilities, browser fingerprints, raw URLs, query strings, or referrers.
Authentication, sharing, invitation, and shared-file access counters are
incremented by the backend. The frontend may report only reviewed event and
page keys because direct Google Drive uploads and public page navigation do not
pass through authenticated backend routes. The database rejects unreviewed
page buckets. Analytics are disabled by default and never sent to a central
service.

Exact daily counters are retained for the latest 400-day window. Before older
daily rows are deleted, the API combines them into monthly counters in
`analytics_monthly_summary` and `analytics_monthly_dimensions`. Monthly rows
have no automatic expiry, so long-term trends remain available without keeping
visitors, sessions, or individual navigation histories.

Analytics reads require a valid Google-authenticated ZeroDrive session whose
verified email appears in the deployment-only `ANALYTICS_ADMIN_EMAILS`
allowlist. The allowlist is never returned to the browser or stored in the
database. Low-volume dimension buckets are suppressed in API responses.

## Deployment constraints

OAuth exchanges use encrypted self-contained capabilities and PostgreSQL stores
only their one-time SHA-256 hashes and expiry times. This supports multiple
backend instances without storing Google tokens or account identifiers in the
database. Request rate-limit counters remain in-process; deploy a shared rate
limit store before relying on a global quota across multiple instances.
