import React, { useState, useEffect } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../components/ui/card";

const KeyTestPage: React.FC = () => {
  const [keyPair, setKeyPair] = useState<CryptoKeyPair | null>(null);
  const [publicKeyJwk, setPublicKeyJwk] = useState<JsonWebKey | null>(null);
  const [privateKeyJwk, setPrivateKeyJwk] = useState<JsonWebKey | null>(null);
  const [originalText, setOriginalText] = useState<string>("Hello, Crypto!");
  const [encryptedText, setEncryptedText] = useState<string>("");
  const [decryptedText, setDecryptedText] = useState<string>("");
  const [errorLog, setErrorLog] = useState<string>("");

  const RsaOaepParams = {
    name: "RSA-OAEP",
    modulusLength: 2048,
    publicExponent: new Uint8Array([0x01, 0x00, 0x01]), // 65537
    hash: "SHA-256", // Explicitly use SHA-256
  };

  const generateKeys = async () => {
    setErrorLog("");
    setEncryptedText("");
    setDecryptedText("");
    try {
      const newKeyPair = await crypto.subtle.generateKey(
        RsaOaepParams,
        true, // extractable
        ["encrypt", "decrypt"]
      );
      setKeyPair(newKeyPair);
      const pubJwk = await crypto.subtle.exportKey("jwk", newKeyPair.publicKey);
      const privJwk = await crypto.subtle.exportKey(
        "jwk",
        newKeyPair.privateKey
      );
      setPublicKeyJwk(pubJwk);
      setPrivateKeyJwk(privJwk);
      console.log("Generated Public Key JWK:", pubJwk);
      console.log("Generated Private Key JWK:", privJwk);
      setErrorLog(
        "New key pair generated successfully. Alg: " + (pubJwk.alg || "N/A")
      );
    } catch (e: any) {
      console.error("Key generation error:", e);
      setErrorLog(`Key generation error: ${e.message}`);
    }
  };

  useEffect(() => {
    generateKeys();
  }, []);

  const handleEncrypt = async () => {
    if (!keyPair || !keyPair.publicKey) {
      setErrorLog("Public key not available. Generate keys first.");
      return;
    }
    if (!originalText) {
      setErrorLog("No text to encrypt.");
      return;
    }
    setErrorLog("");
    setDecryptedText("");
    try {
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(originalText);

      const encryptedBuffer = await crypto.subtle.encrypt(
        { name: "RSA-OAEP" }, // Hash is inherent in the key
        keyPair.publicKey,
        dataBuffer
      );

      // Convert Uint8Array to a regular array before using spread syntax
      const byteArray = Array.from(new Uint8Array(encryptedBuffer));
      const base64Encrypted = btoa(String.fromCharCode(...byteArray));
      setEncryptedText(base64Encrypted);
      setErrorLog("Encryption successful.");
    } catch (e: any) {
      console.error("Encryption error:", e);
      setErrorLog(`Encryption error: ${e.message} (Name: ${e.name})`);
    }
  };

  const handleDecrypt = async () => {
    if (!keyPair || !keyPair.privateKey) {
      setErrorLog("Private key not available. Generate keys first.");
      return;
    }
    if (!encryptedText) {
      setErrorLog("No encrypted text to decrypt.");
      return;
    }
    setErrorLog("");
    try {
      const binaryString = atob(encryptedText);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const encryptedBuffer = bytes.buffer;

      const decryptedBuffer = await crypto.subtle.decrypt(
        { name: "RSA-OAEP" }, // Hash is inherent in the key
        keyPair.privateKey,
        encryptedBuffer
      );

      const decoder = new TextDecoder();
      const decrypted = decoder.decode(decryptedBuffer);
      setDecryptedText(decrypted);
      setErrorLog("Decryption successful.");
    } catch (e: any) {
      console.error("Decryption error:", e);
      setErrorLog(`Decryption error: ${e.message} (Name: ${e.name})`);
    }
  };

  return (
    <div className="container mx-auto p-4 min-h-screen flex justify-center items-center">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>RSA-OAEP Encryption/Decryption Test</CardTitle>
          <CardDescription>
            This page tests basic RSA-OAEP (SHA-256) operations in isolation.
            Keys are generated in the browser and not stored.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={generateKeys}>Generate New Key Pair</Button>

          {publicKeyJwk && privateKeyJwk && (
            <div className="space-y-2 text-xs p-2 border rounded bg-muted">
              <p>
                <strong>Public Key Algo:</strong> {publicKeyJwk.alg}
              </p>
              <p>
                <strong>Private Key Algo:</strong> {privateKeyJwk.alg}
              </p>
              <p>
                <strong>Public Key (n - modulus snippet):</strong>{" "}
                {publicKeyJwk.n?.substring(0, 30)}...
              </p>
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="originalText">Text to Encrypt:</Label>
            <Textarea
              id="originalText"
              value={originalText}
              onChange={(e) => setOriginalText(e.target.value)}
              rows={3}
            />
          </div>

          <Button onClick={handleEncrypt} disabled={!keyPair}>
            Encrypt
          </Button>

          <div className="space-y-1">
            <Label htmlFor="encryptedText">Encrypted Text (Base64):</Label>
            <Textarea
              id="encryptedText"
              value={encryptedText}
              readOnly
              rows={3}
              className="font-mono text-sm"
            />
          </div>

          <Button onClick={handleDecrypt} disabled={!keyPair || !encryptedText}>
            Decrypt
          </Button>

          <div className="space-y-1">
            <Label htmlFor="decryptedText">Decrypted Text:</Label>
            <Textarea
              id="decryptedText"
              value={decryptedText}
              readOnly
              rows={3}
            />
          </div>

          {errorLog && (
            <div
              className={`p-3 rounded-md text-sm ${
                errorLog.includes("error")
                  ? "bg-destructive/10 text-destructive"
                  : "bg-green-100 text-green-700"
              }`}
            >
              <strong>Log:</strong> {errorLog}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default KeyTestPage;
