/**
 * Unit Tests for File Decryption
 * Tests file decryption with AES-GCM
 */

import { decryptFile } from '../../utils/decryptFile';
import { generateKey, storeKey, generateMnemonic } from '../../utils/cryptoUtils';
import { encryptFile } from '../../utils/encryptFile';
import { setMnemonic, clearMnemonic } from '../../utils/mnemonicManager';

describe('DecryptFile', () => {
  let testMnemonic: string;

  beforeEach(() => {
    // Clear session storage before each test
    sessionStorage.clear();
    // Set up test mnemonic
    testMnemonic = generateMnemonic();
    setMnemonic(testMnemonic);
  });

  afterEach(() => {
    clearMnemonic();
  });

  describe('decryptFile', () => {
    it('should decrypt file successfully with correct key', async () => {
      // Generate and store encryption key
      const key = await generateKey();
      await storeKey(key);

      // Create and encrypt test file
      const originalContent = 'This is secret test content';
      const file = new File([originalContent], 'test.txt', { type: 'text/plain' });
      const encryptedBlob = await encryptFile(file);

      // Decrypt the file
      const decryptedBlob = await decryptFile(encryptedBlob);

      // Verify decrypted content matches original
      const decryptedText = await decryptedBlob.text();
      expect(decryptedText).toBe(originalContent);
      expect(decryptedBlob).toBeInstanceOf(Blob);
    });

    it('should throw error when no encryption key in sessionStorage', async () => {
      const file = new File(['test'], 'test.txt', { type: 'text/plain' });
      const blob = new Blob([file]);

      await expect(decryptFile(blob)).rejects.toThrow(
        'No encryption key found in session storage'
      );
    });

    it('should throw error when key format is invalid JSON', async () => {
      // Clear mnemonic so getStoredKey returns null
      clearMnemonic();

      // Store invalid encrypted data
      sessionStorage.setItem('aes-gcm-key', 'not-valid-json{');

      const blob = new Blob(['test']);

      // Should fail because getStoredKey() returns null
      await expect(decryptFile(blob)).rejects.toThrow(
        'No encryption key found in session storage'
      );

      // Restore mnemonic for other tests
      setMnemonic(testMnemonic);
    });

    it('should throw error when JWK is missing required fields', async () => {
      // Clear mnemonic so getStoredKey returns null
      clearMnemonic();

      // Store invalid encrypted data
      const invalidJWK = {
        kty: 'oct',
        // missing 'k' field
      };
      sessionStorage.setItem('aes-gcm-key', JSON.stringify(invalidJWK));

      const blob = new Blob(['test']);

      // Should fail because getStoredKey() returns null
      await expect(decryptFile(blob)).rejects.toThrow(
        'No encryption key found in session storage'
      );

      // Restore mnemonic for other tests
      setMnemonic(testMnemonic);
    });

    it('should throw error when JWK has wrong key type', async () => {
      // Clear mnemonic so getStoredKey returns null
      clearMnemonic();

      // Store invalid encrypted data
      const invalidJWK = {
        kty: 'RSA', // Should be 'oct' for AES
        k: 'somebase64value',
      };
      sessionStorage.setItem('aes-gcm-key', JSON.stringify(invalidJWK));

      const blob = new Blob(['test']);

      // Should fail because getStoredKey() returns null
      await expect(decryptFile(blob)).rejects.toThrow(
        'No encryption key found in session storage'
      );

      // Restore mnemonic for other tests
      setMnemonic(testMnemonic);
    });

    it('should throw error when file is too small (missing IV)', async () => {
      // Generate and store valid key
      const key = await generateKey();
      await storeKey(key);

      // Create blob that's too small (< 13 bytes: 12-byte IV + at least 1 byte data)
      const tooSmallBlob = new Blob([new Uint8Array(10)]);

      await expect(decryptFile(tooSmallBlob)).rejects.toThrow(
        'File is not properly encrypted (too small)'
      );
    });

    it('should throw error when decryption fails with wrong key', async () => {
      // Encrypt with one key
      const key1 = await generateKey();
      await storeKey(key1);

      const file = new File(['secret content'], 'test.txt', { type: 'text/plain' });
      const encryptedBlob = await encryptFile(file);

      // Try to decrypt with different key
      const key2 = await generateKey();
      await storeKey(key2);

      await expect(decryptFile(encryptedBlob)).rejects.toThrow(
        "the encryption key doesn't match the one used to encrypt this file"
      );
    });

    it('should throw error when encrypted data is corrupted', async () => {
      // Generate and store key
      const key = await generateKey();
      await storeKey(key);

      // Create and encrypt file
      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      const encryptedBlob = await encryptFile(file);

      // Corrupt the encrypted data
      const encryptedArray = new Uint8Array(await encryptedBlob.arrayBuffer());
      // Keep IV (first 12 bytes), corrupt encrypted data
      for (let i = 12; i < encryptedArray.length; i++) {
        encryptedArray[i] = Math.floor(Math.random() * 256);
      }
      const corruptedBlob = new Blob([encryptedArray]);

      await expect(decryptFile(corruptedBlob)).rejects.toThrow();
    });

    it('should handle binary file decryption correctly', async () => {
      // Generate and store key
      const key = await generateKey();
      await storeKey(key);

      // Create binary data
      const binaryData = new Uint8Array([0, 1, 2, 3, 255, 254, 253]);
      const file = new File([binaryData], 'binary.dat', {
        type: 'application/octet-stream',
      });

      // Encrypt and decrypt
      const encryptedBlob = await encryptFile(file);
      const decryptedBlob = await decryptFile(encryptedBlob);

      // Verify binary data matches
      const decryptedArray = new Uint8Array(await decryptedBlob.arrayBuffer());
      expect(decryptedArray).toEqual(binaryData);
    });

    it('should handle large file decryption', async () => {
      // Generate and store key
      const key = await generateKey();
      await storeKey(key);

      // Create larger file (1MB)
      const largeContent = 'x'.repeat(1024 * 1024);
      const file = new File([largeContent], 'large.txt', { type: 'text/plain' });

      // Encrypt and decrypt
      const encryptedBlob = await encryptFile(file);
      const decryptedBlob = await decryptFile(encryptedBlob);

      // Verify size matches
      expect(decryptedBlob.size).toBe(largeContent.length);

      // Verify first and last characters
      const decryptedText = await decryptedBlob.text();
      expect(decryptedText[0]).toBe('x');
      expect(decryptedText[decryptedText.length - 1]).toBe('x');
      expect(decryptedText.length).toBe(largeContent.length);
    });
  });
});
