export const termsOfService = [
  {
    heading: "Agreement to these terms",
    content:
      "These Terms explain the rules for using ZeroDrive. When this document says “ZeroDrive”, “we”, “our”, “us”, or “the service”, it refers to the ZeroDrive project and the hosted ZeroDrive application where applicable. The hosted app may ask you to accept the current Terms of Service and acknowledge the Privacy Policy before Storage and private sharing are enabled for your account.",
  },
  {
    heading: "What ZeroDrive is",
    content:
      "ZeroDrive is a free and open-source tool that adds client-side encryption to files stored in your own Google Drive. ZeroDrive is not a replacement cloud storage provider. It uses your Google Account and Google Drive as the storage location, while the browser encrypts files before they are uploaded.",
  },
  {
    heading: "Google account and Drive access",
    content:
      "You need a Google Account to use the hosted ZeroDrive app. ZeroDrive asks Google for your account email for sign-in and limited Drive permissions so it can save encrypted files and hidden app metadata in your Google Drive. You are responsible for keeping your Google Account secure. If you revoke Google access, delete Drive files, lose access to the Google Account, or Google Drive is unavailable, ZeroDrive may not be able to show or update your vault.",
  },
  {
    heading: "Your recovery phrase",
    content:
      "Your recovery phrase protects your vault access. ZeroDrive cannot reset it, recover it, or use it to open your files for you. If you lose the phrase and no compatible key backup is available, your encrypted files may become unrecoverable. You are responsible for saving the recovery phrase somewhere safe before relying on ZeroDrive for important files.",
  },
  {
    heading: "Encryption and zero-knowledge limits",
    content:
      "ZeroDrive is designed so files are encrypted in your browser before upload. The server should not receive plaintext files or the private keys needed to decrypt them. However, security also depends on your device, browser, extensions, Google Account, and the ZeroDrive code you run. If your device or browser is compromised, encryption cannot protect against everything.",
  },
  {
    heading: "File sharing",
    content:
      "ZeroDrive sharing is designed to encrypt a shared file for the selected recipient. Share records should not store a sender user ID, sender email, or plaintext recipient email. You are responsible for choosing the correct recipient and for understanding that email notifications or invitations may involve an email provider processing the recipient address.",
  },
  {
    heading: "Your content",
    content:
      "You keep ownership of the files you upload, encrypt, save, download, or share through ZeroDrive. You are responsible for your content and for making sure your use of ZeroDrive is lawful. Do not use ZeroDrive to store, share, or distribute content that violates laws, rights, or platform rules.",
  },
  {
    heading: "Open-source software",
    content:
      "ZeroDrive is open source, which means the code can be reviewed, self-hosted, modified, or improved by the community under the license provided in the repository. The hosted service may include operational configuration, deployment settings, or infrastructure that are separate from your own self-hosted use.",
  },
  {
    heading: "Availability and changes",
    content:
      "ZeroDrive is provided on an “as is” and “as available” basis. We may change, pause, remove, or discontinue hosted features as the project evolves. Bugs, outages, third-party service changes, Google API changes, browser changes, or infrastructure failures may affect the service. Keep your own backups and recovery phrase for important data.",
  },
  {
    heading: "No warranty",
    content:
      "We work to make ZeroDrive safe and reliable, but we do not promise that it will be error-free, uninterrupted, secure against every threat, or suitable for every use case. You use ZeroDrive at your own risk, especially for sensitive or irreplaceable files.",
  },
  {
    heading: "Limitation of liability",
    content:
      "To the maximum extent allowed by law, ZeroDrive and its maintainers are not liable for indirect, incidental, special, consequential, exemplary, or punitive damages, including loss of data, loss of access, account issues, third-party service failures, or inability to decrypt files. Some jurisdictions do not allow certain limitations, so parts of this section may not apply to you.",
  },
  {
    heading: "Updates to these Terms",
    content:
      "These Terms may be updated as ZeroDrive changes. Material updates should be reflected in the product or documentation. Continuing to use ZeroDrive after updates means you accept the updated Terms.",
  },
  {
    heading: "Contact",
    content:
      "If you have questions about these Terms, open an issue in the ZeroDrive repository or contact the project maintainers. Last updated: August 2026.",
  },
];
