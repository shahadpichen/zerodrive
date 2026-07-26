<h2 id="sharing-flow">The sharing flow</h2>

When Alice shares with Bob, Alice does not share her recovery phrase or personal-vault key. Her browser creates a Capsule v1 object with a fresh data key and wraps access to that Capsule for Bob’s public sharing key.

In plain language, the shared file gets its own temporary lock. Bob receives the ability to open that one lock, but he does not receive Alice’s main ZeroDrive key and he does not get access to Alice’s Google Drive.

This is safer than sending someone your recovery phrase or uploading an unencrypted attachment somewhere else. The share is prepared for one recipient, and the file content is still encrypted before it reaches storage.

The flow is: Alice chooses a file, ZeroDrive finds Bob’s public sharing key, Alice’s browser creates the recipient-encrypted content and metadata Capsules, and Bob’s browser opens them locally with the matching private key.

The server helps coordinate the process, but it should not see the readable file or the unencrypted file key.

<h2 id="encrypted-metadata">Encrypted metadata</h2>

Metadata is the information around a file. The file content might be private, but the filename can still reveal a lot.

For example, a name like `medical-report.pdf`, `passport-scan.png`, or `company-acquisition-plan.docx` can be sensitive even before the file is opened.

ZeroDrive’s sharing design avoids storing those readable details in the database. Instead, the app stores a small recipient-encrypted metadata Capsule, so the inbox can reveal the details locally without downloading the full content object and a database dump does not expose them directly.

A Capsule v1 share record still needs some information to work. It stores the metadata Capsule, recipient key version and fingerprint, a random-looking storage key, status, expiry, timestamps, and retry state. Historical shares can still contain the older wrapped-key fields, but new Capsule shares do not use a separate database file-key envelope.

<h2 id="key-pinning">Key pinning</h2>

Public keys can change over time. Maybe a user recovered their account on a new device, rotated keys, or replaced an old sharing key.

ZeroDrive pins recipient key fingerprints after first contact. A fingerprint is a short identity label for a public key. If the same recipient later appears with a different fingerprint, ZeroDrive can warn the sender before another file is encrypted.

This is similar to secure messaging apps warning you that a contact’s security identity changed.

Key pinning does not make first contact perfect. The first time Alice shares with Bob, Alice still trusts the directory to return Bob’s real public key. Pinning helps detect unexpected changes after that first contact.

<h2 id="saving-shares">Saving shared files</h2>

In Shared With Me, a recipient can download a decrypted file or save it into personal storage.

Downloading gives the recipient the readable file on their device. Saving creates the recipient’s own ZeroDrive-encrypted copy in their Google Drive.

This distinction matters. The original shared object can still expire or be cleaned up, but the saved copy belongs to the recipient’s personal encrypted storage.

Saving a shared file does not move the sender’s original file, does not reveal the sender’s keys, and does not give the recipient access to anything beyond that decrypted file.
