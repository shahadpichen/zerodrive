import React from "react";

// A standard BIP39 example phrase, shown purely as an illustration.
const PHRASE = [
  "witch",
  "collapse",
  "practice",
  "feed",
  "shame",
  "open",
  "despair",
  "creek",
  "road",
  "again",
  "ice",
  "least",
];

const POINTS: React.ReactNode[] = [
  <>
    Generated on your device using the <strong>BIP39</strong> standard — 12
    words drawn from a fixed 2048-word list.
  </>,
  <>
    They deterministically derive your <strong>AES-256 encryption key</strong>{" "}
    (SHA-256 of the seed) — same words, same key, every time.
  </>,
  <>
    <strong>Order matters.</strong> The exact sequence is what reproduces your
    key; shuffle it and nothing decrypts.
  </>,
  <>
    The phrase <strong>never leaves your device</strong> and is never sent to
    our servers — so no one but you can derive your key.
  </>,
  <>
    It’s the <strong>only way to recover</strong> your files on a new device.
    Write it down and store it somewhere safe.
  </>,
];

function RecoveryPhrase() {
  return (
    <div className="mx-auto md:w-[85%] mt-10 border text-left">
      {/* header */}
      <div className="flex items-center justify-between px-4 py-3 border-b text-sm">
        <span className="font-medium">Your 12-word recovery phrase</span>
        <span className="text-xs text-muted-foreground">BIP39 standard</span>
      </div>

      {/* the 12 words — hairlines via 1px gap over the border color */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-border">
        {PHRASE.map((word, i) => (
          <div
            key={i}
            className="flex items-baseline gap-2 px-4 py-3 bg-background"
          >
            <span className="w-5 text-xs text-muted-foreground">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="text-[0.95rem]">{word}</span>
          </div>
        ))}
      </div>

      {/* how the phrase works */}
      <div className="px-4 py-4 border-t">
        <ul className="space-y-2">
          {POINTS.map((point, i) => (
            <li
              key={i}
              className="relative pl-6 text-sm font-light leading-relaxed"
            >
              <span className="absolute left-0 text-[#3182ce]">→</span>
              {point}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default RecoveryPhrase;
