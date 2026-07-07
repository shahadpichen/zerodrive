export interface DocsSectionLink {
  id: string;
  title: string;
}

export interface DocsPage {
  slug: string;
  title: string;
  cardTitle: string;
  eyebrow: string;
  summary: string;
  readingTime: string;
  sections: DocsSectionLink[];
}

export const docsPages: DocsPage[] = [
  {
    slug: "how-it-works",
    title: "How ZeroDrive works",
    cardTitle: "How it works",
    eyebrow: "The big picture",
    summary:
      "A simple explanation of where your files go, who can read them, and what ZeroDrive does in the middle.",
    readingTime: "8 min read",
    sections: [
      { id: "mental-model", title: "The simple mental model" },
      { id: "personal-files", title: "Personal files" },
      { id: "shared-files", title: "Shared files" },
      { id: "share-lifecycle", title: "Share lifecycle" },
    ],
  },
  {
    slug: "how-to-use",
    title: "How to use ZeroDrive",
    cardTitle: "How to use",
    eyebrow: "User guide",
    summary:
      "A practical walkthrough for signing in, saving your recovery phrase, storing files, and sharing safely.",
    readingTime: "8 min read",
    sections: [
      { id: "first-time-setup", title: "First-time setup" },
      { id: "upload-and-download", title: "Upload and download" },
      { id: "share-and-receive", title: "Share and receive" },
      { id: "common-problems", title: "Common problems" },
    ],
  },
  {
    slug: "keys-and-recovery",
    title: "Keys and recovery phrase",
    cardTitle: "Keys and recovery",
    eyebrow: "Critical",
    summary:
      "Learn what the recovery phrase protects, how browser keys work, and why ZeroDrive cannot reset encryption access.",
    readingTime: "7 min read",
    sections: [
      { id: "recovery-phrase", title: "The recovery phrase" },
      { id: "browser-session", title: "Browser session keys" },
      { id: "sharing-keys", title: "Sharing keys" },
      { id: "safe-habits", title: "Safe habits" },
    ],
  },
  {
    slug: "secure-sharing",
    title: "Secure file sharing",
    cardTitle: "Secure sharing",
    eyebrow: "Sharing model",
    summary:
      "See how ZeroDrive prepares an encrypted file for one recipient without exposing your main key.",
    readingTime: "9 min read",
    sections: [
      { id: "sharing-flow", title: "The sharing flow" },
      { id: "encrypted-metadata", title: "Encrypted metadata" },
      { id: "key-pinning", title: "Key pinning" },
      { id: "saving-shares", title: "Saving shared files" },
    ],
  },
  {
    slug: "privacy-model",
    title: "Privacy and database model",
    cardTitle: "Privacy model",
    eyebrow: "Database privacy",
    summary:
      "Understand how ZeroDrive avoids storing obvious sender identity and plaintext recipient emails in share records.",
    readingTime: "9 min read",
    sections: [
      { id: "recipient-lookup", title: "Recipient lookup" },
      { id: "sender-anonymity", title: "Sender anonymity" },
      { id: "analytics", title: "Analytics" },
      { id: "remaining-metadata", title: "Remaining metadata" },
    ],
  },
  {
    slug: "security-model",
    title: "Security model and limitations",
    cardTitle: "Security model",
    eyebrow: "Threat model",
    summary:
      "What ZeroDrive protects against, what it does not protect against, and where users still need caution.",
    readingTime: "8 min read",
    sections: [
      { id: "trust-boundary", title: "Trust boundary" },
      { id: "protects-against", title: "What it protects" },
      { id: "limitations", title: "Limitations" },
    ],
  },
  {
    slug: "if-zerodrive-disappears",
    title: "If ZeroDrive disappears",
    cardTitle: "If ZeroDrive disappears",
    eyebrow: "Portability",
    summary:
      "What remains recoverable if the hosted service goes away, and what still depends on recovery tooling.",
    readingTime: "7 min read",
    sections: [
      { id: "what-remains", title: "What remains" },
      { id: "what-you-need", title: "What you need" },
      { id: "planned-recovery-tooling", title: "Recovery tooling" },
      { id: "pending-shares", title: "Pending shares" },
    ],
  },
  {
    slug: "self-hosting",
    title: "Self-hosting ZeroDrive",
    cardTitle: "Self-hosting",
    eyebrow: "Deployment",
    summary:
      "Run the frontend, backend, PostgreSQL, MinIO/S3, Google OAuth, and email configuration yourself.",
    readingTime: "8 min read",
    sections: [
      { id: "what-you-run", title: "What you run" },
      { id: "environment", title: "Environment" },
      { id: "secret-management", title: "Secret management" },
      { id: "same-privacy-rules", title: "Same privacy rules" },
    ],
  },
];

export function getDocsPage(slug: string | undefined) {
  return docsPages.find((page) => page.slug === slug);
}
