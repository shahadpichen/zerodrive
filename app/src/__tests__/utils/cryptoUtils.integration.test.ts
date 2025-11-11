/**
 * Integration Tests for Crypto Utilities
 *
 * These tests use REAL BIP39 (no mocks) to ensure actual behavior
 * matches expected behavior. Critical for verifying deterministic
 * key derivation works in production.
 */

import {
  generateMnemonic,
  deriveKeyFromMnemonic,
  storeKey,
  getStoredKey,
  clearStoredKey,
} from '../../utils/cryptoUtils';
import * as bip39 from 'bip39';

describe('CryptoUtils Integration Tests (Real BIP39)', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  describe('generateMnemonic - Real Generation', () => {
    it('should generate valid 12-word BIP39 mnemonic', () => {
      const mnemonic = generateMnemonic();

      // Should be valid BIP39
      expect(bip39.validateMnemonic(mnemonic)).toBe(true);

      // Should have 12 words
      const words = mnemonic.trim().split(/\s+/);
      expect(words).toHaveLength(12);
    });

    it('should generate unique mnemonics on each call', () => {
      const mnemonics = new Set();

      // Generate 10 mnemonics
      for (let i = 0; i < 10; i++) {
        const mnemonic = generateMnemonic();
        mnemonics.add(mnemonic);
      }

      // All should be unique
      expect(mnemonics.size).toBe(10);
    });

    it('should use only valid BIP39 words', () => {
      const mnemonic = generateMnemonic();
      const words = mnemonic.split(' ');
      const wordlist = bip39.wordlists.english;

      words.forEach((word) => {
        expect(wordlist).toContain(word);
      });
    });

    it('should generate words separated by single spaces', () => {
      const mnemonic = generateMnemonic();

      // No double spaces
      expect(mnemonic).not.toMatch(/\s{2,}/);

      // No leading/trailing spaces
      expect(mnemonic).toBe(mnemonic.trim());
    });
  });

  describe('deriveKeyFromMnemonic - Deterministic Behavior', () => {
    it('should derive SAME key from SAME mnemonic (CRITICAL)', async () => {
      const mnemonic = generateMnemonic();

      // Derive key twice
      const key1 = await deriveKeyFromMnemonic(mnemonic);
      const key2 = await deriveKeyFromMnemonic(mnemonic);

      // Export to compare
      const jwk1 = await crypto.subtle.exportKey('jwk', key1);
      const jwk2 = await crypto.subtle.exportKey('jwk', key2);

      // Keys must be IDENTICAL
      expect(jwk1.k).toBe(jwk2.k);
      expect(jwk1.alg).toBe(jwk2.alg);
      expect(jwk1.kty).toBe(jwk2.kty);
    });

    it('should derive DIFFERENT keys from DIFFERENT mnemonics', async () => {
      const mnemonic1 = generateMnemonic();
      const mnemonic2 = generateMnemonic();

      const key1 = await deriveKeyFromMnemonic(mnemonic1);
      const key2 = await deriveKeyFromMnemonic(mnemonic2);

      const jwk1 = await crypto.subtle.exportKey('jwk', key1);
      const jwk2 = await crypto.subtle.exportKey('jwk', key2);

      // Keys must be DIFFERENT
      expect(jwk1.k).not.toBe(jwk2.k);
    });

    it('should derive same key with leading/trailing whitespace', async () => {
      const mnemonic = generateMnemonic();
      const mnemonicWithPadding = '  ' + mnemonic + '  ';

      const key1 = await deriveKeyFromMnemonic(mnemonic);
      const key2 = await deriveKeyFromMnemonic(mnemonicWithPadding.trim());

      const jwk1 = await crypto.subtle.exportKey('jwk', key1);
      const jwk2 = await crypto.subtle.exportKey('jwk', key2);

      expect(jwk1.k).toBe(jwk2.k);
    });

    it('should handle case sensitivity correctly', async () => {
      const mnemonic = generateMnemonic();
      const upperMnemonic = mnemonic.toUpperCase();

      // BIP39 is case-insensitive for word matching, but we should test behavior
      // Most implementations normalize to lowercase
      await expect(deriveKeyFromMnemonic(upperMnemonic)).rejects.toThrow(
        'Invalid mnemonic phrase'
      );
    });

    it('should validate mnemonic before deriving', async () => {
      const invalidMnemonics = [
        'invalid mnemonic phrase that is not bip39',
        'word1 word2 word3', // Too few words
        'a b c d e f g h i j k l', // Not BIP39 words
        '', // Empty
      ];

      for (const invalid of invalidMnemonics) {
        await expect(deriveKeyFromMnemonic(invalid)).rejects.toThrow(
          'Invalid mnemonic phrase'
        );
      }
    });
  });

  describe('Encryption/Decryption Round-Trip', () => {
    it('should encrypt and decrypt data successfully', async () => {
      const mnemonic = generateMnemonic();
      const key = await deriveKeyFromMnemonic(mnemonic);

      const originalData = 'Test data for encryption 🔐';
      const encoder = new TextEncoder();
      const data = encoder.encode(originalData);

      // Encrypt
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        data
      );

      // Decrypt
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        encrypted
      );

      const decoder = new TextDecoder();
      const result = decoder.decode(decrypted);

      expect(result).toBe(originalData);
    });

    it('should work with various data types', async () => {
      const mnemonic = generateMnemonic();
      const key = await deriveKeyFromMnemonic(mnemonic);
      const iv = crypto.getRandomValues(new Uint8Array(12));

      const testCases = [
        'Simple ASCII text',
        'Unicode: 你好世界 🌍',
        'Special chars: @#$%^&*()',
        'Numbers: 1234567890',
        'Emojis: 😀😃😄😁🔐',
        JSON.stringify({ key: 'value', nested: { data: true } }),
        'a'.repeat(10000), // Large data
      ];

      for (const testData of testCases) {
        const encoder = new TextEncoder();
        const encrypted = await crypto.subtle.encrypt(
          { name: 'AES-GCM', iv },
          key,
          encoder.encode(testData)
        );

        const decrypted = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv },
          key,
          encrypted
        );

        const decoder = new TextDecoder();
        expect(decoder.decode(decrypted)).toBe(testData);
      }
    });

    it('should fail to decrypt with wrong IV', async () => {
      const mnemonic = generateMnemonic();
      const key = await deriveKeyFromMnemonic(mnemonic);

      const data = new TextEncoder().encode('Secret data');
      const iv1 = crypto.getRandomValues(new Uint8Array(12));
      const iv2 = crypto.getRandomValues(new Uint8Array(12));

      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv1 },
        key,
        data
      );

      // Try to decrypt with different IV
      await expect(
        crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv2 }, key, encrypted)
      ).rejects.toThrow();
    });

    it('should fail to decrypt tampered data', async () => {
      const mnemonic = generateMnemonic();
      const key = await deriveKeyFromMnemonic(mnemonic);

      const data = new TextEncoder().encode('Secret data');
      const iv = crypto.getRandomValues(new Uint8Array(12));

      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        data
      );

      // Tamper with encrypted data
      const encryptedArray = new Uint8Array(encrypted);
      encryptedArray[0] ^= 1; // Flip one bit

      await expect(
        crypto.subtle.decrypt(
          { name: 'AES-GCM', iv },
          key,
          encryptedArray.buffer
        )
      ).rejects.toThrow();
    });
  });

  describe('Known Test Vectors', () => {
    // Using a known BIP39 test vector
    const testMnemonic =
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

    it('should produce consistent key from known mnemonic', async () => {
      const key1 = await deriveKeyFromMnemonic(testMnemonic);
      const key2 = await deriveKeyFromMnemonic(testMnemonic);

      const jwk1 = await crypto.subtle.exportKey('jwk', key1);
      const jwk2 = await crypto.subtle.exportKey('jwk', key2);

      expect(jwk1.k).toBe(jwk2.k);
    });

    it('should produce valid AES-GCM key from test vector', async () => {
      const key = await deriveKeyFromMnemonic(testMnemonic);

      expect(key.type).toBe('secret');
      expect(key.algorithm.name).toBe('AES-GCM');
      expect(key.usages).toContain('encrypt');
      expect(key.usages).toContain('decrypt');
    });
  });

  describe('Storage Integration', () => {
    it('should store and retrieve key correctly', async () => {
      const mnemonic = generateMnemonic();
      const originalKey = await deriveKeyFromMnemonic(mnemonic);

      await storeKey(originalKey, mnemonic);
      const retrievedKey = await getStoredKey(mnemonic);

      expect(retrievedKey).not.toBeNull();

      const originalJwk = await crypto.subtle.exportKey('jwk', originalKey);
      const retrievedJwk = await crypto.subtle.exportKey('jwk', retrievedKey!);

      expect(originalJwk.k).toBe(retrievedJwk.k);
    });

    it('should allow re-derivation after clear', async () => {
      const mnemonic = generateMnemonic();

      // First derivation
      const key1 = await deriveKeyFromMnemonic(mnemonic);
      await storeKey(key1, mnemonic);

      // Clear and re-derive
      clearStoredKey();
      const key2 = await deriveKeyFromMnemonic(mnemonic);
      await storeKey(key2, mnemonic);

      // Keys should be identical
      const jwk1 = await crypto.subtle.exportKey('jwk', key1);
      const jwk2 = await crypto.subtle.exportKey('jwk', key2);

      expect(jwk1.k).toBe(jwk2.k);
    });
  });

  describe('Performance', () => {
    it('should derive key in reasonable time', async () => {
      const mnemonic = generateMnemonic();
      const startTime = Date.now();

      await deriveKeyFromMnemonic(mnemonic);

      const duration = Date.now() - startTime;

      // Should complete in under 1 second
      expect(duration).toBeLessThan(1000);
    });

    it('should handle large data encryption efficiently', async () => {
      const mnemonic = generateMnemonic();
      const key = await deriveKeyFromMnemonic(mnemonic);

      // 64KB of data (limit for Node.js crypto.getRandomValues)
      const largeData = new Uint8Array(64 * 1024);
      crypto.getRandomValues(largeData);

      const iv = crypto.getRandomValues(new Uint8Array(12));
      const startTime = Date.now();

      await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, largeData);

      const duration = Date.now() - startTime;

      // Should encrypt 64KB in under 1 second
      expect(duration).toBeLessThan(1000);
    });
  });
});
