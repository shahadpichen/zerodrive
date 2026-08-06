<h2 id="recovery-phrase">The recovery phrase</h2>

The recovery phrase is not a normal password. It is the long-term route back to your encryption keys. ZeroDrive does not store it, log it, or send it to the backend. The web app keeps it only in memory for the current tab, so a hard refresh or a new tab requires it again.

A password proves who you are to a service. A recovery phrase is more sensitive than that. It helps recreate the keys that open encrypted data. If someone else gets it, they may be able to unlock your files. If nobody has it, ZeroDrive cannot recreate your access for you.

This is why ZeroDrive warns users to save the phrase carefully. It is not a decoration or a backup code you can ignore. It is the real recovery path.

Store it in a trusted password manager, write it down and keep it somewhere safe, or use another secure backup method you trust. Do not send it to support, paste it into random websites, or store it in a public note.

<h2 id="browser-session">Browser session keys</h2>

ZeroDrive uses Capsule v1 inside your browser to encrypt and decrypt files. The active recovery phrase exists only in memory for the current tab. Encrypted sharing-key backups can be stored in Google Drive so the app can restore the recipient keys needed for historical shares on another device.

This means the browser tab is doing real security work. When a file is opened, the browser may temporarily hold the readable file and the key needed to decrypt it.

That is why logging out, avoiding untrusted browser extensions, and using trusted devices matters. If your device or browser is compromised, encryption cannot fully protect data that is already decrypted on screen.

When you log out or switch accounts, ZeroDrive should clear sensitive browser key material where possible. This reduces the chance that a later session accidentally keeps access to old decrypted data.

<h2 id="sharing-keys">Sharing keys</h2>

File sharing uses a public/private key pair. A simple way to picture this is a mailbox.

Your public key is like a mail slot. Other people can use it to send you locked Capsules. Your private key is the key that opens those Capsules. The mail slot can be public, but the opening key must stay private.

ZeroDrive can store your public key on the backend because it is only used to encrypt data for you. Your private key should stay under your control. It may be backed up to Google Drive only in encrypted form so you can recover it on another device.

When someone shares a file with you, their browser uses your public key, version, and fingerprint to prepare a recipient-encrypted Capsule. Your browser uses the matching private key to open it. The server does not need the private key or the readable file key.

<h2 id="safe-habits">Safe habits</h2>

The safest ZeroDrive habit is to treat your recovery phrase as seriously as your most sensitive password.

Use ZeroDrive on devices you trust. Keep your browser updated. Be careful with browser extensions that can read page content. Log out on shared computers. Do not paste your recovery phrase into websites that are not the real ZeroDrive app or a recovery tool you trust.

If you create a new key casually, you may make old files harder to access unless the app has the right key history and recovery path. Key changes should be deliberate, especially if you have important encrypted files.

ZeroDrive gives you more privacy, but it also gives you more responsibility. The service cannot protect a recovery phrase that is copied somewhere unsafe.
