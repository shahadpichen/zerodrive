export const HowItWorksContent = [
  {
    heading: "How It Works",
    content:
      "A simple, privacy-focused solution for secure file storage on Google Drive. Our open-source tool **encrypts your files locally** on your device and stores them in your Google Account.",
  },
  {
    heading: "Secure Your Google Drive Files",
    content:
      "Google Drive is convenient, but it lacks the privacy many users need. Our tool provides **end-to-end encryption**, ensuring that your files are **encrypted on your device** before they even leave. This way, **only you can access them**, no matter where they are stored. Your data remains private and secure, giving you peace of mind.",
  },
  {
    heading: "Local Encryption Process",
    content:
      "Files are encrypted directly in your browser using **AES-GCM** (Advanced Encryption Standard in Galois/Counter Mode), a **highly secure encryption algorithm** that provides both confidentiality and authenticity. This **military-grade encryption** happens before any data is uploaded to Google Drive, ensuring your files are completely secured before leaving your device.",
  },
  {
    heading: "Data Storage & Synchronization",
    content:
      "**Encrypted files** are stored on your Google Drive while file metadata is stored locally using **Dexie.js (IndexDB)**. To enable cross-browser access, this metadata is also **encrypted using the same AES-GCM encryption** and stored on Google Drive. During each login, ZeroDrive automatically fetches and syncs this encrypted metadata.",
  },
  {
    heading: "Open Source Control",
    content:
      "As an **open source solution**, our tool puts you in the driver's seat. You can **review the source code**, **customize the implementation**, **host on your own servers**, and ensure it meets your specific security requirements. With ZeroDrive, you're not just a user—you have **complete control** over your data security.",
  },
  {
    heading: "Key Features",
    content:
      "• **AES-GCM encryption**: Military-grade encryption for maximum security<br/>• **Privacy through E2E encryption**: Your files are encrypted before leaving your device<br/>• **Reliability of Google**: Leverage Google Drive's robust infrastructure<br/>• **Freedom of open-source**: Full transparency and customization options<br/>• **Cross-browser synchronization**: Access your files from any browser<br/>• **Local encryption**: All encryption happens directly in your browser",
  },
  {
    heading: "Technical Implementation",
    content:
      "ZeroDrive implements **AES-GCM encryption** using the **Web Crypto API**, providing a secure and standardized approach to cryptography. The encryption process, including **key generation and management**, happens entirely in your browser using JavaScript. **Each file is encrypted with a unique key**, and all encryption keys are themselves encrypted before being stored. We utilize **IndexDB** for local storage and **Google Drive's API** for cloud storage, creating a seamless and secure file management experience.",
  },
];
