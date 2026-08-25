export const privacyPolicy = [
  {
    heading: "The simple privacy model",
    content:
      "ZeroDrive is built as an encryption layer on top of your own Google Drive. The product is designed so your files are encrypted before they leave your browser. That means ZeroDrive should not receive your original files, your recovery phrase, or the private keys needed to read your vault.",
  },
  {
    heading: "What ZeroDrive asks Google for",
    content:
      "ZeroDrive uses Google sign-in so the app can connect the browser session to the correct Google Drive. We ask for your basic Google profile, including name, email address, and profile picture, so the interface can show the correct account. We also ask for limited Drive access for files ZeroDrive creates or uses, and app data access for hidden ZeroDrive metadata such as the vault index and encrypted key backups. Google may send you an account-access email after you approve these permissions; that email is controlled by Google and summarizes the access you granted.",
  },
  {
    heading: "Files and vault metadata",
    content:
      "Your readable files are encrypted in the browser before upload. Google Drive stores the encrypted copies. ZeroDrive also stores encrypted vault metadata, such as the list of files and folders ZeroDrive needs to show your vault. This metadata is encrypted before it is saved. If your recovery phrase is missing or incorrect, ZeroDrive cannot open that encrypted metadata for you.",
  },
  {
    heading: "Recovery phrase and local browser storage",
    content:
      "Your recovery phrase is used to recreate the keys needed to open your vault and restore encrypted key backups. The phrase is processed in your browser and is not sent to the ZeroDrive server. To keep the vault unlocked when you reload the same tab, the hosted app stores the phrase in that tab's browser session storage and binds it to the signed-in account. ZeroDrive clears it when you sign out or switch accounts. A new tab, a different browser, clearing browser data, or ending the browser session normally requires the phrase again; some browsers may restore session storage when they restore a closed session. Code running under the same website origin, including a successful cross-site scripting attack or a compromised same-origin dependency, could access recovery material available to that tab.",
  },
  {
    heading: "Sharing and recipient privacy",
    content:
      "When you share a file, your browser encrypts it for the chosen recipient before upload. The sharing database stores encrypted share data and privacy-safe lookup identifiers. Share records are designed not to store a sender user ID, sender email, plaintext recipient email, Google account ID, IP address, user agent, request ID, or session ID. Email delivery providers may still process recipient email addresses when notification or invitation emails are sent.",
  },
  {
    heading: "Account and legal records",
    content:
      "ZeroDrive needs minimal account-level information to operate, such as the email address returned by Google sign-in and privacy-safe lookup identifiers derived from it. When you accept the current Terms of Service and acknowledge this Privacy Policy, ZeroDrive stores a minimal legal acceptance record with a non-reversible account lookup ID, the accepted document versions, and the acceptance time. That legal record is kept separate from file sharing records.",
  },
  {
    heading: "Analytics, logs, and diagnostics",
    content:
      "ZeroDrive does not use third-party advertising trackers or personal analytics. A deployment may enable first-party aggregate counters to understand whether core features work and which reviewed product or documentation pages receive attention. The browser sends only a fixed page label such as Storage or Security documentation—not a raw URL, query string, referrer, visitor ID, or session ID. The counters are designed not to include emails, account identifiers, IP addresses, sessions, filenames, file IDs, browser fingerprints, or exact file sizes. Exact daily counters are kept for the latest 400-day window and then combined into permanent monthly totals, so long-term product trends remain without preserving anyone's browsing history. Low-volume breakdowns are hidden from analytics responses. Operational logs should avoid request bodies, cookies, tokens, object keys, capabilities, and email addresses.",
  },
  {
    heading: "What ZeroDrive cannot do",
    content:
      "ZeroDrive cannot read your plaintext files, recover a lost recovery phrase, reset your encryption keys, or guarantee that Google Drive itself will always be available. Because your encrypted files live in your Google Drive, Google's own privacy policy and account controls also apply to the encrypted copies stored there.",
  },
  {
    heading: "Your controls",
    content:
      "You can delete encrypted files from your ZeroDrive vault, revoke ZeroDrive's Google access from your Google Account settings, clear local browser storage, or self-host the open-source project. Revoking Google access may stop ZeroDrive from reading or writing encrypted files in your Drive until you sign in again.",
  },
  {
    heading: "Changes and contact",
    content:
      "This policy may change as ZeroDrive evolves. Material privacy changes should be reflected in the product and documentation. If you have questions, open an issue in the ZeroDrive repository or contact the project maintainers. Last updated: August 2026.",
  },
];
