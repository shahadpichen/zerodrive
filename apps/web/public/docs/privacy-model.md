<h2 id="recipient-lookup">Recipient lookup</h2>

Email addresses are useful because people know how to share with an email. But storing plaintext emails in privacy-sensitive database rows would create an identity map.

Plain email hashes are also weak. Email addresses are easy to guess. If a database stores a simple hash of an email, an attacker can hash common emails and compare them.

ZeroDrive’s model uses a backend-only private lookup value. The backend can temporarily use the recipient email to find the recipient’s public key, but the database should store a secret-derived identifier instead of the plaintext email.

The non-technical idea is this: ZeroDrive may need an email for a moment, but it should not keep that email written plainly into the share record.

<h2 id="sender-anonymity">Sender anonymity</h2>

Shared-file rows should not directly store who sent the file. They should not store sender user IDs, sender emails, sender email hashes, sender IP addresses, or sender user agents.

This is one of the most important privacy goals of the project. If someone gets the database, they may see that a share exists, but the share record should not directly say “this came from user@example.com.”

Senders still need to manage shares, so ZeroDrive uses a management capability. Think of it as a secret claim ticket created in the sender’s browser.

The database stores only a hash of that capability. The sender’s browser keeps or backs up the real capability privately. When the sender wants to revoke or update a share, the browser proves it has the capability without the share row needing to store sender identity.

<h2 id="analytics">Analytics</h2>

Analytics can be useful. They help answer questions like “are people using file sharing?” or “did uploads fail more often today?”

But analytics should not become a second identity database. ZeroDrive does not use third-party analytics or advertising scripts. Analytics are disabled by default. When a deployment enables them, it stores first-party daily aggregate counters in its own PostgreSQL database rather than detailed event streams tied to people.

The counters exclude account identifiers, emails, IP addresses, filenames, object keys, capabilities, browser fingerprints, and session identifiers. Coarse breakdowns are stored independently, low-volume buckets are hidden, and records older than 365 days are deleted. Only deployment-configured administrators can read them.

The goal is to learn whether the product works without tracking exactly who did what with which file.

<h2 id="remaining-metadata">Remaining metadata</h2>

Zero-knowledge file content does not mean zero metadata.

The server may still see timestamps, approximate encrypted sizes, status, expiry, rate-limit counters, and that a lookup happened. Email providers may process recipient emails to deliver invitations.

This is worth being honest about. Encryption protects file contents and sensitive details, but a working web app still needs some operational information.

The privacy goal is to reduce what is stored, avoid obvious identity links, and document the remaining metadata clearly.
