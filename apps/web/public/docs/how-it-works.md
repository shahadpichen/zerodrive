<h2 id="mental-model">The simple mental model</h2>

ZeroDrive is easiest to understand if you imagine every file being placed inside a locked box before it leaves your computer. Google Drive or ZeroDrive storage may hold the locked box, but they should not hold the key that opens it.

This is different from many normal cloud storage apps. Usually, a file is uploaded first and then the provider protects it inside their own systems. ZeroDrive tries to protect the file earlier. Your browser turns the readable file into an encrypted file before storage receives it.

So the simple version is this: your browser locks and unlocks files, storage holds encrypted files, and the ZeroDrive server helps coordinate login and sharing. The server should help move locked boxes around, not open them.

Your browser is the most trusted part of this model because it is where encryption and decryption happen. When a file becomes readable, it becomes readable inside your browser after your key is available. That is why your recovery phrase, browser session, and device security matter so much.

<h2 id="personal-files">Personal files</h2>

When you add a file to Storage, ZeroDrive handles the original file in your browser first. The app encrypts it locally and uploads only the encrypted version to your Google Drive.

In normal words, Google Drive stores the locked version. If someone opens that file directly from Google Drive, it should look like meaningless data unless they also have the correct ZeroDrive key.

This lets ZeroDrive use Google Drive for what it is good at: storing and syncing files. But the privacy of the file comes from ZeroDrive encrypting it before upload, not from Google Drive being able to read it.

The upload flow is: choose a file, encrypt it in the browser, upload the encrypted file, and keep enough encrypted metadata for ZeroDrive to show and manage the file later. The download flow is the reverse: fetch the encrypted file, decrypt it in the browser, then show or save the readable version.

<h2 id="shared-files">Shared files</h2>

Shared files use a different path from personal files. When you share a file, ZeroDrive creates an encrypted copy intended for the recipient. That shared encrypted file is stored in object storage through backend-authorized upload and download links.

The important idea is that sharing does not give someone your whole Google Drive, your recovery phrase, or your main ZeroDrive key. A shared file is prepared as a separate encrypted package. The recipient receives only what is needed to open that one package.

The database stores records needed to manage the share: encrypted details, a file key locked for the recipient, expiry information, and lifecycle status. It should not store the readable file, readable filename, or sender identity directly in the share record.

This is why sharing can work without the server reading the file. The server coordinates the delivery. The browser does the private encryption and decryption work.

<h2 id="share-lifecycle">Share lifecycle</h2>

A shared file moves through a small lifecycle, like a package being prepared, delivered, and eventually cleaned up.

When a share is pending, ZeroDrive has started creating the share but the upload or finalization is not complete. When it is active, the recipient can access the encrypted file. When it is deleting, cleanup is in progress or waiting to retry. Once cleanup finishes, the share is deleted.

Most users do not need to think about these states. They exist so ZeroDrive can recover safely from interrupted uploads, failed network requests, or cleanup problems. They also help prevent abandoned shared files from staying around forever.

This lifecycle is part of the privacy model. If an upload never completes, it should not remain forever. If a share expires or is revoked, ZeroDrive should be able to remove the encrypted shared object and the related record.
