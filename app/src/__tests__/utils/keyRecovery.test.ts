/**
 * Key Recovery Flow Tests
 *
 * CRITICAL TESTS: These ensure users can always recover their files
 * if they have their mnemonic phrase. A failure here means users
 * could permanently lose access to their data!
 */

import {
  generateMnemonic,
  deriveKeyFromMnemonic,
  storeKey,
  getStoredKey,
  clearStoredKey,
} from '../../utils/cryptoUtils';

describe('Key Recovery Flow - CRITICAL', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  describe('Complete Recovery Cycle', () => {
    it('should decrypt data encrypted before storage was cleared', async () => {
      // 1. Generate mnemonic and derive key
      const mnemonic = generateMnemonic();
      const originalKey = await deriveKeyFromMnemonic(mnemonic);
      await storeKey(originalKey, mnemonic);

      // 2. Encrypt test data with original key
      const testData = 'Secret file content that must be recoverable';
      const encoder = new TextEncoder();
      const data = encoder.encode(testData);
      const iv = crypto.getRandomValues(new Uint8Array(12));

      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        originalKey,
        data
      );

      // 3. Simulate browser close - clear storage
      clearStoredKey();
      const keyAfterClear = await getStoredKey(mnemonic);
      expect(keyAfterClear).toBeNull();

      // 4. Simulate user reopening browser and recovering key from mnemonic
      const recoveredKey = await deriveKeyFromMnemonic(mnemonic);
      await storeKey(recoveredKey, mnemonic);

      // 5. Decrypt with recovered key - MUST WORK!
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        recoveredKey,
        encrypted
      );

      const decoder = new TextDecoder();
      const result = decoder.decode(decrypted);

      expect(result).toBe(testData);
    });

    it('should decrypt multiple files encrypted with same key', async () => {
      const mnemonic = generateMnemonic();
      const originalKey = await deriveKeyFromMnemonic(mnemonic);

      // Encrypt multiple pieces of data
      const files = [
        'File 1 content',
        'File 2 content with special chars: 🔐',
        'File 3: Very important data!',
      ];

      const encryptedFiles = await Promise.all(
        files.map(async (content) => {
          const encoder = new TextEncoder();
          const iv = crypto.getRandomValues(new Uint8Array(12));
          const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            originalKey,
            encoder.encode(content)
          );
          return { encrypted, iv };
        })
      );

      // Clear storage and recover
      clearStoredKey();
      const recoveredKey = await deriveKeyFromMnemonic(mnemonic);

      // Decrypt all files with recovered key
      const decryptedFiles = await Promise.all(
        encryptedFiles.map(async ({ encrypted, iv }) => {
          const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            recoveredKey,
            encrypted
          );
          const decoder = new TextDecoder();
          return decoder.decode(decrypted);
        })
      );

      // All files should decrypt correctly
      expect(decryptedFiles).toEqual(files);
    });

    it('should handle recovery after multiple storage clears', async () => {
      const mnemonic = generateMnemonic();
      const testData = 'Persistent data';
      const encoder = new TextEncoder();
      const iv = crypto.getRandomValues(new Uint8Array(12));

      // First encryption
      const key1 = await deriveKeyFromMnemonic(mnemonic);
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key1,
        encoder.encode(testData)
      );

      // Clear and recover multiple times
      for (let i = 0; i < 3; i++) {
        clearStoredKey();
        expect(await getStoredKey(mnemonic)).toBeNull();

        const recoveredKey = await deriveKeyFromMnemonic(mnemonic);
        const decrypted = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv },
          recoveredKey,
          encrypted
        );

        const decoder = new TextDecoder();
        expect(decoder.decode(decrypted)).toBe(testData);
      }
    });
  });

  describe('Recovery Failures', () => {
    it('should fail to decrypt with wrong mnemonic', async () => {
      // Encrypt with first mnemonic
      const mnemonic1 = generateMnemonic();
      const key1 = await deriveKeyFromMnemonic(mnemonic1);

      const testData = 'Secret data';
      const encoder = new TextEncoder();
      const iv = crypto.getRandomValues(new Uint8Array(12));

      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key1,
        encoder.encode(testData)
      );

      // Try to decrypt with different mnemonic
      const mnemonic2 = generateMnemonic();
      const key2 = await deriveKeyFromMnemonic(mnemonic2);

      await expect(
        crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key2, encrypted)
      ).rejects.toThrow();
    });

    it('should reject invalid mnemonic during recovery', async () => {
      const mnemonic = generateMnemonic();
      const words = mnemonic.split(' ');

      // Change one word to create an invalid mnemonic
      // (BIP39 mnemonics have checksums, so changing any word makes it invalid)
      words[5] = words[5] === 'abandon' ? 'ability' : 'abandon';
      const invalidMnemonic = words.join(' ');

      // Should reject invalid mnemonic before attempting decryption
      await expect(deriveKeyFromMnemonic(invalidMnemonic)).rejects.toThrow(
        'Invalid mnemonic phrase'
      );
    });
  });

  describe('Long-term Recovery', () => {
    it('should decrypt data encrypted weeks ago (simulated)', async () => {
      // Simulate scenario: User encrypted files, then came back weeks later
      const mnemonic = generateMnemonic();
      const oldKey = await deriveKeyFromMnemonic(mnemonic);

      // "Old" encrypted data
      const oldData = 'File from 2 weeks ago';
      const encoder = new TextEncoder();
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        oldKey,
        encoder.encode(oldData)
      );

      // User comes back weeks later, recovers key
      const newKey = await deriveKeyFromMnemonic(mnemonic);

      // Should still decrypt
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        newKey,
        encrypted
      );

      const decoder = new TextDecoder();
      expect(decoder.decode(decrypted)).toBe(oldData);
    });
  });

  describe('Cross-Device Recovery', () => {
    it('should derive same key on different "devices"', async () => {
      const mnemonic = generateMnemonic();

      // Simulate Device 1
      sessionStorage.clear();
      const device1Key = await deriveKeyFromMnemonic(mnemonic);
      const device1Jwk = await crypto.subtle.exportKey('jwk', device1Key);

      // Simulate Device 2 (clear storage)
      sessionStorage.clear();
      const device2Key = await deriveKeyFromMnemonic(mnemonic);
      const device2Jwk = await crypto.subtle.exportKey('jwk', device2Key);

      // Keys should be identical
      expect(device1Jwk.k).toBe(device2Jwk.k);
      expect(device1Jwk.alg).toBe(device2Jwk.alg);
      expect(device1Jwk.kty).toBe(device2Jwk.kty);
    });

    it('should decrypt files encrypted on Device A using Device B', async () => {
      const mnemonic = generateMnemonic();

      // Device A: Encrypt file
      const deviceAKey = await deriveKeyFromMnemonic(mnemonic);
      const testData = 'File from Device A';
      const encoder = new TextEncoder();
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        deviceAKey,
        encoder.encode(testData)
      );

      // Device B: Recover key and decrypt
      sessionStorage.clear(); // Simulate different device
      const deviceBKey = await deriveKeyFromMnemonic(mnemonic);
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        deviceBKey,
        encrypted
      );

      const decoder = new TextDecoder();
      expect(decoder.decode(decrypted)).toBe(testData);
    });
  });

  describe('Data Integrity', () => {
    it('should preserve data integrity after recovery', async () => {
      const mnemonic = generateMnemonic();
      const originalKey = await deriveKeyFromMnemonic(mnemonic);

      // Large data with various characters
      const largeData = 'Lorem ipsum '.repeat(1000) + '🔐✓ Special chars: @#$%^&*()';
      const encoder = new TextEncoder();
      const iv = crypto.getRandomValues(new Uint8Array(12));

      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        originalKey,
        encoder.encode(largeData)
      );

      // Recover and decrypt
      clearStoredKey();
      const recoveredKey = await deriveKeyFromMnemonic(mnemonic);
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        recoveredKey,
        encrypted
      );

      const decoder = new TextDecoder();
      const result = decoder.decode(decrypted);

      // Exact match - no data loss
      expect(result).toBe(largeData);
      expect(result.length).toBe(largeData.length);
    });

    it('should handle binary data correctly', async () => {
      const mnemonic = generateMnemonic();
      const originalKey = await deriveKeyFromMnemonic(mnemonic);

      // Simulate binary file (image, PDF, etc.)
      const binaryData = new Uint8Array(1000);
      for (let i = 0; i < binaryData.length; i++) {
        binaryData[i] = i % 256;
      }

      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        originalKey,
        binaryData
      );

      // Recover and decrypt
      clearStoredKey();
      const recoveredKey = await deriveKeyFromMnemonic(mnemonic);
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        recoveredKey,
        encrypted
      );

      const resultArray = new Uint8Array(decrypted);

      // Binary data should match exactly
      expect(resultArray.length).toBe(binaryData.length);
      expect(resultArray).toEqual(binaryData);
    });
  });
});
