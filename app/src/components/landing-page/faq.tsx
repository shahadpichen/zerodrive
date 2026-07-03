import React from "react";

const FAQS: { q: string; a: string }[] = [
  {
    q: "What if I lose my recovery phrase?",
    a: "Then your files can't be recovered — by anyone, including us. That's the cost of true zero-knowledge encryption: no backdoor for us means no backdoor for anyone. Write your phrase down and store it safely.",
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
              <span className="text-[#3182ce]">+</span>
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
