<h2 id="what-remains">What remains</h2>

If the hosted ZeroDrive service disappears, your personal encrypted files should still remain in your Google Drive. The hosted app is the interface, not the final owner of your encrypted personal files.

Accepted shared files that were saved into your own Storage should follow the same model as personal files. They become separately encrypted copies in your Google Drive.

The important word is “encrypted.” If ZeroDrive disappears, files may still exist, but they are not useful without the right recovery phrase or key material and a compatible way to decrypt them.

Keeping the encrypted file is only half of recovery. Keeping the key material is the other half.

<h2 id="what-you-need">What you need</h2>

Recovery is not just about downloading files from Google Drive. To turn encrypted ZeroDrive files back into readable files, you need matching pieces.

You need the encrypted ZeroDrive files, the correct 12-word recovery phrase or key material, a compatible ZeroDrive decryptor, the documented encrypted file format, and access to the Google Drive account holding the files.

If one of those pieces is missing, recovery may fail. For example, having the encrypted file without the recovery phrase is like having a locked safe without the key.

ZeroDrive also cannot recover files that were deleted directly from Google Drive, corrupted, partially uploaded, or overwritten.

<h2 id="planned-recovery-tooling">Planned recovery tooling</h2>

A recovery CLI or offline decryptor should be treated as planned recovery infrastructure unless it has been implemented and released.

The goal of this tool would be simple: let users recover their own files without depending on the hosted website. It should run on the user’s computer and should not upload the recovery phrase or encrypted files to another server.

The tool should ask for the recovery phrase interactively. It should not encourage users to put the recovery phrase directly into a command, because shell history, terminal logs, and process lists can preserve command arguments.

Example future shape:

`npx @zerodrive/recovery decrypt ./file.zd --out ./file.pdf`

This command is an intended recovery direction, not a promise that the tool is already released.

<h2 id="pending-shares">Pending shares</h2>

Pending shared files are different from personal files already stored in your Google Drive.

A pending share can depend on ZeroDrive’s backend, PostgreSQL records, object storage, and cleanup jobs. If a pending share was not saved or downloaded before the service disappeared, it may not be recoverable.

This is because a pending share is still part of the sharing system. It may rely on records and storage controlled by the ZeroDrive deployment.

For long-term access, recipients should save important incoming files into their own Storage after decrypting them.
