export const content = [
  {
    heading: "An Encryption Layer for Your Google Drive",
    description:
      "ZeroDrive does not replace your Google Drive. It adds a <u>private encryption layer</u> on top of it. When you upload a file, your browser encrypts it first, then saves only the encrypted version to your own Google Drive. Google stores the protected copy, while the readable file stays on your device.",
  },
  {
    heading: "Your Storage, Your Keys, Open Source",
    description:
      "Your files stay in the Google account you already control, and your encryption keys are created in your browser. ZeroDrive is <u>open source</u>, so the encryption flow can be reviewed, self-hosted, or improved by the community. The goal is simple: keep the convenience of Google Drive, but make the file contents private before they reach storage.",
  },
  {
    heading: "Encrypted Sharing Without Sender Records",
    description:
      "Sharing works the same way: your browser encrypts the shared copy before upload, then locks it with the recipient’s <u>public sharing key</u>. The server can help route the encrypted share, but the share record does not store a sender user ID, sender email, or plaintext recipient email. The recipient’s browser uses their private key to unlock the file.\n\nYour <u>12-word recovery phrase</u> is what recreates the private keys this browser needs to open your encrypted files and restore encrypted key backups on another device. It is not stored by ZeroDrive and cannot be reset, so it should be saved somewhere safe.",
  },
  {
    description:
      "Privacy through E2E encryption; Reliability of Google; Freedom of open-source.",
  },

  // {
  //   description: "We hope you enjoy ZeroDrive! <br/> Regards, <br/> Shahad",
  // },
];
