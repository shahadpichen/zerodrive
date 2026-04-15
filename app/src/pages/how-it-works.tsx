import React from "react";
import Header from "../components/landing-page/header";
import Markdown from "markdown-to-jsx";
import Footer from "../components/landing-page/footer";
import { HowItWorksContent } from "../components/how-it-works-content";

function HowItWorks() {
  return (
    <main className="container mx-auto w-full relative">
      <Header />

      {/* Hero Section */}
      <div className="lg:px-[10vw] px-5 mx-auto mt-20 max-w-screen-xl sm:px-6">
        <div className="text-center mb-16">
          <h1 className="text-xl sm:text-2xl md:text-3xl">
            How ZeroDrive{" "}
            <span className="text-black dark:text-white">Protects</span> Your
            Files
          </h1>
          <p className="text-muted-foreground font-light mt-6">
            End-to-end encryption, zero-knowledge architecture, and open-source
            transparency—all working together to keep your data private.
          </p>
        </div>

        {/* BIP39 Mnemonic Diagram */}
        <div className="mb-20">
          <h2 className="text-2xl text-center mb-[20px]">
            Your Keys, Your Files, Your Privacy
          </h2>
          <div className="grid md:grid-cols-3 gap-6 mb-6">
            <div className="border-2 rounded-lg p-6">
              <div className="flex flex-col items-center text-center">
                <h3 className=" mb-2">1. Generate Mnemonic</h3>
                <p className="text-sm text-muted-foreground font-light">
                  12-word recovery phrase (BIP39 standard)
                </p>
                <div className="mt-4 text-xs bg-muted px-3 py-2 rounded font-mono">
                  witch collapse practice...
                </div>
              </div>
            </div>
            <div className="border-2 rounded-lg p-6">
              <div className="flex flex-col items-center text-center">
                <h3 className=" mb-2">2. Derive Encryption Key</h3>
                <p className="text-sm text-muted-foreground font-light">
                  SHA-256 hash of seed → AES-256 key
                </p>
                <div className="mt-4 text-xs bg-muted px-3 py-2 rounded font-mono">
                  256-bit Master Key
                </div>
              </div>
            </div>
            <div className="border-2 rounded-lg p-6">
              <div className="flex flex-col items-center text-center">
                <h3 className=" mb-2">3. Encrypt Files</h3>
                <p className="text-sm text-muted-foreground font-light">
                  Files encrypted locally before upload
                </p>
                <div className="mt-4 text-xs bg-muted px-3 py-2 rounded font-mono">
                  AES-256-GCM
                </div>
              </div>
            </div>
          </div>
          <div className="text-center">
            <Markdown className="inline-block text-left font-light text-base">
              {HowItWorksContent[0].content}
            </Markdown>
          </div>
        </div>

        {/* File Sharing Architecture */}
        <div className="mb-20">
          <h2 className="text-2xl text-center mb-[20px]">
            Secure File Sharing Architecture
          </h2>

          {/* RSA Key Pair Generation */}
          <div className="grid md:grid-cols-2 gap-8 mb-10">
            <div className="border-2 p-8">
              <div className="flex items-center gap-3 mb-4">
                <h3 className="text-lg text-black dark:text-white">
                  RSA Public Key
                </h3>
              </div>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <span className="font-light">
                    Stored on our server (PostgreSQL)
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-light">
                    Associated with SHA-256(email)
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-light">
                    Used to encrypt file keys for you
                  </span>
                </li>
              </ul>
            </div>

            <div className="border-2 p-8">
              <div className="flex items-center gap-3 mb-4">
                <h3 className="text-lg text-black dark:text-white">
                  RSA Private Key
                </h3>
              </div>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <span className="font-light">
                    Stored in IndexedDB (browser only)
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-light">
                    NEVER transmitted to server
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-light">
                    Decrypts file keys shared with you
                  </span>
                </li>
              </ul>
            </div>
          </div>

          <div className="text-center mb-10">
            <Markdown className="inline-block text-left font-light text-base">
              {HowItWorksContent[2].content}
            </Markdown>
          </div>

          {/* Step-by-Step Sharing Flow */}
          <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl p-8 mb-6">
            <h2 className="text-2xl text-center mb-[20px]">
              Step-by-Step: Alice Shares a File with Bob
            </h2>

            <div className="space-y-6">
              {/* Step 1 */}
              <div className="flex gap-4 items-start">
                <div className="flex-1">
                  <h4 className=" mb-1 text-black dark:text-white">
                    1. Generate Random File Key
                  </h4>
                  <p className="text-sm text-muted-foreground font-light">
                    Alice generates a brand new AES-256 key just for this file
                  </p>
                  <div className="mt-2 bg-muted/50 border border-border rounded p-2 text-xs font-mono text-foreground">
                    fileKey = crypto.generateKey("AES-GCM", 256)
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex gap-4 items-start">
                <div className="flex-1">
                  <h4 className=" mb-1 text-black dark:text-white">
                    2. Encrypt File Content
                  </h4>
                  <p className="text-sm text-muted-foreground font-light">
                    File is encrypted with the random key and uploaded to Google
                    Drive
                  </p>
                  <div className="mt-2 bg-muted/50 border border-border rounded p-2 text-xs font-mono text-foreground">
                    encryptedFile = AES-GCM(fileContent, fileKey, randomIV)
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex gap-4 items-start">
                <div className="flex-1">
                  <h4 className=" mb-1 text-black dark:text-white">
                    3. Fetch Bob's Public Key
                  </h4>
                  <p className="text-sm text-muted-foreground font-light">
                    Alice retrieves Bob's RSA public key from our server
                  </p>
                  <div className="mt-2 bg-muted/50 border border-border rounded p-2 text-xs font-mono text-foreground">
                    bobPublicKey = GET /api/public-keys/SHA256(bob@email.com)
                  </div>
                </div>
              </div>

              {/* Step 4 */}
              <div className="flex gap-4 items-start">
                <div className="flex-1">
                  <h4 className=" mb-1 text-black dark:text-white">
                    4. Encrypt File Key for Bob
                  </h4>
                  <p className="text-sm text-muted-foreground font-light">
                    The file key is encrypted with Bob's public key (only Bob
                    can decrypt it)
                  </p>
                  <div className="mt-2 bg-muted/50 border border-border rounded p-2 text-xs font-mono text-foreground">
                    encryptedFileKey = RSA-OAEP(fileKey, bobPublicKey)
                  </div>
                </div>
              </div>

              {/* Step 5 */}
              <div className="flex gap-4 items-start">
                <div className="flex-1">
                  <h4 className=" mb-1 text-black dark:text-white">
                    5. Store Metadata in Database
                  </h4>
                  <p className="text-sm text-muted-foreground font-light">
                    Encrypted file key + metadata saved to PostgreSQL
                  </p>
                  <div className="mt-2 bg-muted/50 border border-border rounded p-2 text-xs font-mono text-foreground">
                    POST /api/shared-files {"{"} encrypted_file_key, file_id,
                    ... {"}"}
                  </div>
                </div>
              </div>

              {/* Step 6 */}
              <div className="flex gap-4 items-start">
                <div className="flex-1">
                  <h4 className=" mb-1 text-black dark:text-white">
                    6. Bob Decrypts & Downloads
                  </h4>
                  <p className="text-sm text-muted-foreground font-light">
                    Bob uses his private key to decrypt the file key, then
                    decrypts the file
                  </p>
                  <div className="mt-2 bg-muted/50 border border-border rounded p-2 text-xs font-mono text-foreground space-y-1">
                    <div>
                      fileKey = RSA-OAEP-decrypt(encryptedFileKey,
                      bobPrivateKey)
                    </div>
                    <div>file = AES-GCM-decrypt(encryptedFile, fileKey)</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center">
            <Markdown className="inline-block text-left font-light text-base">
              {HowItWorksContent[3].content}
            </Markdown>
          </div>

          {/* Auto-Deletion Notice */}
          <div className="bg-blue-50 dark:bg-blue-950/20 border-l-4 border-blue-500 dark:border-blue-400 p-6 rounded-r-lg mt-6">
            <div className="flex items-start gap-3 text-blue-900 dark:text-blue-100">
              <div>
                <p className="text-lg mb-2 text-black dark:text-white">
                  ⏱️ 7-Day Auto-Deletion Policy
                </p>
                <p className="font-light">
                  Shared files that remain{" "}
                  <strong className="text-black dark:text-white">
                    unclaimed for 7 days
                  </strong>{" "}
                  are automatically removed from our servers for security and
                  privacy. Once the recipient downloads and decrypts the file,
                  it's permanently saved to their account.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Automatic File Expiration */}
        <div className="mb-20">
          <h2 className="text-2xl text-center mb-[20px]">
            {HowItWorksContent[4].heading}
          </h2>
          <div className="text-center">
            <Markdown className="inline-block text-left font-light text-base">
              {HowItWorksContent[4].content}
            </Markdown>
          </div>
        </div>

        {/* Zero-Knowledge Architecture */}
        <div className="mb-20">
          <h2 className="text-2xl text-center mb-[20px]">
            {HowItWorksContent[5].heading}
          </h2>

          <div className="text-center">
            <Markdown className="inline-block text-left font-light text-base">
              {HowItWorksContent[5].content}
            </Markdown>
          </div>
        </div>

        {/* Open Source Section */}
        <div className="mb-20">
          <h2 className="text-2xl text-center mb-[20px]">
            {HowItWorksContent[6].heading}
          </h2>

          <div className="text-center">
            <Markdown className="inline-block text-left font-light text-base">
              {HowItWorksContent[6].content}
            </Markdown>
          </div>
        </div>

        {/* Warning Box */}
        <div className="bg-rose-50 dark:bg-rose-950/20 border-l-4 border-rose-500 dark:border-rose-400 p-6 rounded-r-lg mb-20">
          <div className="flex items-start gap-3 text-rose-900 dark:text-rose-100">
            <div>
              <p className=" text-lg mb-2 text-black dark:text-white">
                ⚠️ Important Security Notice
              </p>
              <ul className="list-disc ml-5 space-y-1 font-light">
                <li>
                  Step-by-Step: Alice Shares a File with Bob If you lose your{" "}
                  <strong className="text-black dark:text-white">
                    12-word recovery phrase
                  </strong>
                  , your encrypted data will be permanently inaccessible. There
                  is no password reset.
                </li>
                <li>
                  Do not delete or modify encrypted files directly on Google
                  Drive as this may corrupt your data.
                </li>
                <li>
                  Never share your recovery phrase or private keys with
                  anyone—not even ZeroDrive support.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
}

export default HowItWorks;
