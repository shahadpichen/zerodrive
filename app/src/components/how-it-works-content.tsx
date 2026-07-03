export const HowItWorksContent = [
  {
    heading: "Your Keys, Your Files, Your Privacy",
    content:
      "ZeroDrive uses a <u>12-word recovery phrase</u> (BIP39 mnemonic) to generate your master encryption key. This phrase is the <u>only way</u> to access your encrypted files, and we never store it. You can write it down, save it in a password manager, or memorize it—but keep it safe. Without it, your files are permanently inaccessible.",
  },
  {
    heading: "Personal File Encryption",
    content:
      "When you upload a file, ZeroDrive encrypts it <u>locally in your browser</u> using <u>AES-256-GCM</u>, a military-grade encryption standard. Your 12-word phrase derives a unique encryption key that never leaves your device. The encrypted file is then uploaded to your <u>Google Drive</u>, where it appears as an unreadable binary blob. Even Google cannot decrypt your files.",
  },
  {
    heading: "Secure File Sharing with Public-Key Cryptography",
    content:
      "To share files securely, ZeroDrive generates an <u>RSA-2048 key pair</u> for your account. Your <u>public key</u> is stored on our server (hashed with your email for privacy), while your <u>private key</u> stays in your browser and never leaves. When someone shares a file with you, they encrypt a unique file key with your public key. Only you can decrypt it with your private key—ensuring true end-to-end encryption.",
  },
  {
    heading: "How Sharing Works Step-by-Step",
    content:
      "1. **Sender** generates a random AES-256 key for the file<br/>2. File is encrypted with this key and uploaded to Google Drive<br/>3. The file key is encrypted with the **recipient's RSA public key**<br/>4. Encrypted key is stored in our database along with file metadata<br/>5. **Recipient** downloads the file and uses their **RSA private key** to decrypt the file key<br/>6. File is then decrypted locally using the recovered AES key<br/>7. **Important**: Unclaimed files are automatically deleted after 7 days for security<br/><br/>At no point does our server see the plaintext file or the unencrypted file key.",
  },
  {
    heading: "Automatic File Expiration",
    content:
      "For security and storage management, shared files that are **not accessed by the recipient within 7 days** are automatically deleted from our servers. This ensures:<br/><br/>• **Privacy**: Unclaimed files don't linger in storage<br/>• **Security**: Reduces exposure window for sensitive data<br/>• **Clean Storage**: Prevents database bloat from abandoned shares<br/><br/>Once the recipient accepts and downloads the file, it's permanently available in their account. The 7-day timer only applies to **pending** file shares that haven't been claimed yet.",
  },
  {
    heading: "Zero-Knowledge Architecture",
    content:
      "ZeroDrive is built on a <u>zero-knowledge</u> principle. Our server acts only as a coordinator for public key exchange and metadata storage. We never have access to:<br/><br/>• Your 12-word recovery phrase<br/>• Your master encryption key<br/>• Your RSA private key<br/>• Plaintext files or file keys<br/>• Unencrypted file metadata<br/><br/>All encryption and decryption happens <u>client-side in your browser</u> using the Web Crypto API.",
  },
  {
    heading: "Open Source for Complete Transparency",
    content:
      "As an <u>open-source</u> project, every line of ZeroDrive's code is available for review on GitHub. Security researchers, developers, and privacy advocates can audit our implementation to verify that we do exactly what we claim. You can also <u>self-host</u> the entire stack—frontend, backend, and database—on your own infrastructure for maximum control.",
  },
];
