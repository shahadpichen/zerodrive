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

Browser key material is cleared on logout and account changes. Google refresh
tokens use HTTP-only cookies. An active same-origin XSS can still access
decrypted files, short-lived access tokens, and keys currently in JavaScript
memory, so CSP and dependency integrity remain part of the security boundary.

## Deployment constraints

OAuth exchange codes and request rate-limit counters currently use in-process
memory with bounded TTLs. Production must run a single backend instance. Before
running multiple backend instances, move both stores to a shared TTL-capable
service such as Redis. Keep exchange-code values one-time-use and store only
HMAC-derived identifiers in that service, using a separate secret/domain from
recipient directory identifiers.
