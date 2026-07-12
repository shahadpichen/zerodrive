# Security model

ZeroDrive provides recipient-exclusive, authenticated encryption. It does not
provide cryptographic proof of sender identity.

The sharing database stores a secret-derived recipient lookup ID, encrypted
metadata, wrapped file keys, opaque object keys, lifecycle state, and anonymous
management-capability hashes. It must never store sender account identifiers or
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

Browser key material is cleared on logout and account changes. Google refresh
tokens use HTTP-only cookies. An active same-origin XSS can still access
decrypted files, short-lived access tokens, and keys currently in JavaScript
memory, so CSP and dependency integrity remain part of the security boundary.

## Privacy-preserving analytics

ZeroDrive does not load third-party analytics or advertising scripts. Product
analytics are first-party daily counters stored in
`analytics_daily_summary` and single-dimension aggregate buckets stored in
`analytics_daily_dimensions`. They contain no event rows, account identifiers,
emails, IP addresses, session identifiers, file identifiers, filenames,
capabilities, or browser fingerprints. Authentication, sharing, invitation,
and shared-file access counters are incremented by the backend. The frontend
may report only the predefined file-added event because direct Google Drive
uploads do not pass through the backend. Analytics are disabled by default,
retained for at most 365 days when enabled, and never sent to a central service.

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
