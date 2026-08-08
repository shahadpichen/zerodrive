import React from "react";
import { Link } from "react-router-dom";

const FAQS: { q: string; a: React.ReactNode }[] = [
  {
    q: "What if I lose my recovery phrase?",
    a: "Then your files can't be recovered — by anyone, including us. That's the cost of true zero-knowledge encryption: no backdoor for us means no backdoor for anyone. Write your phrase down and store it safely.",
  },
  {
    q: "What happens if ZeroDrive disappears?",
    a: (
      <>
        Your personal encrypted files should still remain in your Google Drive,
        but recovery depends on having your recovery phrase and a compatible
        decryptor.{" "}
        <Link
          to="/docs/if-zerodrive-disappears"
          className="font-medium underline underline-offset-4"
        >
          Read the full recovery model
        </Link>
        .
      </>
    ),
  },
  {
    q: "Can ZeroDrive read my files?",
    a: "No. Files are encrypted on your device before they're uploaded. We only ever hold ciphertext, and the decryption key never reaches our servers.",
  },
  {
    q: "Is it really free?",
    a: "Yes. Your encrypted files live in your own Google Drive, so there's no storage bill for us to pass on to you.",
  },
  {
    q: "Where are my files stored?",
    a: "Encrypted, in your own Google Drive. You keep full ownership and can revoke access at any time.",
  },
  {
    q: "Why did Google email me about ZeroDrive access?",
    a: "Google sends account-access emails when you authorize an app. ZeroDrive asks for your Google account email for sign-in and limited Drive access to store encrypted files and hidden app metadata in your own Google Drive. Your files are encrypted before upload, so ZeroDrive cannot read the original files.",
  },
  {
    q: "Is it open source?",
    a: "Entirely. You can audit every line, check the cryptography, or self-host it.",
  },
];

function Faq() {
  return (
    <div className="text-center">
      <h2 className="mb-[20px] text-2xl text-center">Frequently asked</h2>

      <div className="mx-auto md:w-[85%] border text-left">
        {FAQS.map((item, i) => (
          <div key={i} className="border-b px-4 py-4 last:border-b-0">
            <div className="flex gap-2.5 text-[0.92rem] font-medium">
              <span className="text-[hsl(var(--link))]">+</span>
              <span>{item.q}</span>
            </div>
            <p className="mt-2 pl-[22px] text-sm font-light leading-relaxed">
              {item.a}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Faq;
