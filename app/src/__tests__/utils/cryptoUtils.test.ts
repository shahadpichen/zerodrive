/**
 * Unit Tests for Crypto Utilities
 * Tests encryption key generation, storage, and mnemonic operations
 */

import {
  generateKey,
  storeKey,
  getStoredKey,
  clearStoredKey,
  generateMnemonic,
  deriveKeyFromMnemonic,
} from '../../utils/cryptoUtils';
import { setMnemonic, clearMnemonic } from '../../utils/mnemonicManager';
import * as bip39 from 'bip39';

// Mock bip39
jest.mock('bip39', () => ({
  generateMnemonic: jest.fn(),
  validateMnemonic: jest.fn(),
  mnemonicToSeedSync: jest.fn(),
}));

// Test mnemonic for all tests
const TEST_MNEMONIC = 'test wallet brave hello world ocean cloud mountain river lake forest tree';

describe('CryptoUtils', () => {
  beforeEach(() => {
    // Clear storage before each test
    sessionStorage.clear();
    jest.clearAllMocks();

    // Set test mnemonic in memory cache for tests
    (bip39.validateMnemonic as jest.Mock).mockReturnValue(true);
    (bip39.mnemonicToSeedSync as jest.Mock).mockReturnValue(
      new Uint8Array(64).fill(1) // Mock seed
    );
    setMnemonic(TEST_MNEMONIC);
  });

  afterEach(() => {
    // Clear mnemonic after each test
    clearMnemonic();
  });

  describe('generateKey', () => {
    it('should generate AES-GCM 256-bit key', async () => {
      const key = await generateKey();

      expect(key).toBeTruthy();
      expect(key.type).toBe('secret');
      expect(key.algorithm.name).toBe('AES-GCM');
    });

    it('should generate key with encrypt and decrypt usages', async () => {
      const key = await generateKey();

      expect(key.usages).toContain('encrypt');
      expect(key.usages).toContain('decrypt');
    });

    it('should generate exportable key', async () => {
      const key = await generateKey();

      expect(key.extractable).toBe(true);
    });

    it('should generate different keys on each call', async () => {
      const key1 = await generateKey();
      const key2 = await generateKey();

      const jwk1 = await crypto.subtle.exportKey('jwk', key1);
      const jwk2 = await crypto.subtle.exportKey('jwk', key2);

      expect(jwk1.k).not.toBe(jwk2.k);
    });
  });

  describe('storeKey and getStoredKey', () => {
    it('should store key in sessionStorage', async () => {
      const key = await generateKey();

      await storeKey(key);

      const storedValue = sessionStorage.getItem('aes-key');
      expect(storedValue).toBeTruthy();
      expect(() => JSON.parse(storedValue!)).not.toThrow();
    });

    it('should retrieve stored key', async () => {
      const originalKey = await generateKey();
      await storeKey(originalKey);

      const retrievedKey = await getStoredKey();

      expect(retrievedKey).toBeTruthy();
      expect(retrievedKey!.type).toBe('secret');
      expect(retrievedKey!.algorithm.name).toBe('AES-GCM');
    });

    it('should return null when no key is stored', async () => {
      const key = await getStoredKey();

      expect(key).toBeNull();
    });

    it('should preserve key properties after store and retrieve', async () => {
      const originalKey = await generateKey();
      await storeKey(originalKey);

      const retrievedKey = await getStoredKey();

      expect(retrievedKey!.usages).toContain('encrypt');
      expect(retrievedKey!.usages).toContain('decrypt');
      expect(retrievedKey!.extractable).toBe(true);
    });

    it('should store and retrieve the same key material', async () => {
      const originalKey = await generateKey();
      await storeKey(originalKey);

      const retrievedKey = await getStoredKey();

      const originalJwk = await crypto.subtle.exportKey('jwk', originalKey);
      const retrievedJwk = await crypto.subtle.exportKey('jwk', retrievedKey!);

      expect(originalJwk.k).toBe(retrievedJwk.k);
    });
  });

  describe('clearStoredKey', () => {
    it('should remove key from sessionStorage', async () => {
      const key = await generateKey();
      await storeKey(key);

      clearStoredKey();

      const storedValue = sessionStorage.getItem('aes-key');
      expect(storedValue).toBeNull();
    });

    it('should make getStoredKey return null after clearing', async () => {
      const key = await generateKey();
      await storeKey(key);

      clearStoredKey();

      const retrievedKey = await getStoredKey();
      expect(retrievedKey).toBeNull();
    });

    it('should not throw error when clearing non-existent key', () => {
      expect(() => clearStoredKey()).not.toThrow();
    });
  });

  describe('generateMnemonic', () => {
    it('should call bip39.generateMnemonic with 128 bits', () => {
      (bip39.generateMnemonic as jest.Mock).mockReturnValue('test mnemonic phrase');

      const mnemonic = generateMnemonic();

      expect(bip39.generateMnemonic).toHaveBeenCalledWith(128);
      expect(mnemonic).toBe('test mnemonic phrase');
    });

    it('should return a string', () => {
      (bip39.generateMnemonic as jest.Mock).mockReturnValue('word1 word2 word3 word4');

      const mnemonic = generateMnemonic();

      expect(typeof mnemonic).toBe('string');
      expect(mnemonic.length).toBeGreaterThan(0);
    });
  });

  describe('deriveKeyFromMnemonic', () => {
    it('should derive key from valid mnemonic', async () => {
      const mnemonic = 'test mnemonic phrase';
      const mockSeed = new Uint8Array(64).fill(1);

      (bip39.validateMnemonic as jest.Mock).mockReturnValue(true);
      (bip39.mnemonicToSeedSync as jest.Mock).mockReturnValue(mockSeed);

      const key = await deriveKeyFromMnemonic(mnemonic);

      expect(key).toBeTruthy();
      expect(key.type).toBe('secret');
      expect(key.algorithm.name).toBe('AES-GCM');
    });

    it('should validate mnemonic before deriving key', async () => {
      const mnemonic = 'valid mnemonic';
      const mockSeed = new Uint8Array(64).fill(1);

      (bip39.validateMnemonic as jest.Mock).mockReturnValue(true);
      (bip39.mnemonicToSeedSync as jest.Mock).mockReturnValue(mockSeed);

      await deriveKeyFromMnemonic(mnemonic);

      expect(bip39.validateMnemonic).toHaveBeenCalledWith(mnemonic);
    });

    it('should throw error for invalid mnemonic', async () => {
      const invalidMnemonic = 'invalid phrase';

      (bip39.validateMnemonic as jest.Mock).mockReturnValue(false);

      await expect(deriveKeyFromMnemonic(invalidMnemonic)).rejects.toThrow('Invalid mnemonic phrase');
    });

    it('should derive key with encrypt and decrypt usages', async () => {
      const mnemonic = 'test mnemonic';
      const mockSeed = new Uint8Array(64).fill(1);

      (bip39.validateMnemonic as jest.Mock).mockReturnValue(true);
      (bip39.mnemonicToSeedSync as jest.Mock).mockReturnValue(mockSeed);

      const key = await deriveKeyFromMnemonic(mnemonic);

      expect(key.usages).toContain('encrypt');
      expect(key.usages).toContain('decrypt');
    });

    it('should derive same key from same mnemonic', async () => {
      const mnemonic = 'test mnemonic phrase';
      const mockSeed = new Uint8Array(64).fill(42);

      (bip39.validateMnemonic as jest.Mock).mockReturnValue(true);
      (bip39.mnemonicToSeedSync as jest.Mock).mockReturnValue(mockSeed);

      const key1 = await deriveKeyFromMnemonic(mnemonic);
      const key2 = await deriveKeyFromMnemonic(mnemonic);

      const jwk1 = await crypto.subtle.exportKey('jwk', key1);
      const jwk2 = await crypto.subtle.exportKey('jwk', key2);

      expect(jwk1.k).toBe(jwk2.k);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string mnemonic', async () => {
      (bip39.validateMnemonic as jest.Mock).mockReturnValue(false);

      await expect(deriveKeyFromMnemonic('')).rejects.toThrow(
        'Invalid mnemonic phrase'
      );
    });

    it('should handle mnemonic with only spaces', async () => {
      (bip39.validateMnemonic as jest.Mock).mockReturnValue(false);

      await expect(deriveKeyFromMnemonic('   ')).rejects.toThrow(
        'Invalid mnemonic phrase'
      );
    });

    it('should handle mnemonic with extra whitespace', async () => {
      const mockSeed = new Uint8Array(64).fill(1);
      (bip39.validateMnemonic as jest.Mock).mockReturnValue(true);
      (bip39.mnemonicToSeedSync as jest.Mock).mockReturnValue(mockSeed);

      const mnemonicWithSpaces = '  word1  word2  word3  ';
      await expect(
        deriveKeyFromMnemonic(mnemonicWithSpaces)
      ).resolves.toBeTruthy();
    });

    it('should handle corrupted sessionStorage data', async () => {
      sessionStorage.setItem('aes-key', 'not-valid-json');

      // Should return null instead of throwing
      const key = await getStoredKey();
      expect(key).toBeNull();
    });

    it('should handle partial key data in storage', async () => {
      sessionStorage.setItem('aes-key', JSON.stringify({ kty: 'oct' }));

      // Should return null for invalid/partial data
      const key = await getStoredKey();
      expect(key).toBeNull();
    });

    it('should handle very long mnemonic', async () => {
      const longMnemonic = 'word '.repeat(100);
      (bip39.validateMnemonic as jest.Mock).mockReturnValue(false);

      await expect(deriveKeyFromMnemonic(longMnemonic)).rejects.toThrow(
        'Invalid mnemonic phrase'
      );
    });

    it('should handle special characters in mnemonic', async () => {
      const specialCharMnemonic = 'word1 @#$% word2 word3';
      (bip39.validateMnemonic as jest.Mock).mockReturnValue(false);

      await expect(deriveKeyFromMnemonic(specialCharMnemonic)).rejects.toThrow(
        'Invalid mnemonic phrase'
      );
    });

    it('should handle numbers in mnemonic', async () => {
      const numberMnemonic = '123 456 789';
      (bip39.validateMnemonic as jest.Mock).mockReturnValue(false);

      await expect(deriveKeyFromMnemonic(numberMnemonic)).rejects.toThrow(
        'Invalid mnemonic phrase'
      );
    });

    it('should handle clearStoredKey when key does not exist', () => {
      expect(() => clearStoredKey()).not.toThrow();
      expect(sessionStorage.getItem('aes-key')).toBeNull();
    });

    it('should handle multiple rapid store/retrieve cycles', async () => {
      for (let i = 0; i < 10; i++) {
        const key = await generateKey();
        await storeKey(key);
        const retrieved = await getStoredKey();
        expect(retrieved).toBeTruthy();
        clearStoredKey();
      }
    });
  });

  describe('Concurrency', () => {
    it('should handle concurrent key generation', async () => {
      const keys = await Promise.all([
        generateKey(),
        generateKey(),
        generateKey(),
      ]);

      // All keys should be different
      const jwks = await Promise.all(
        keys.map((k) => crypto.subtle.exportKey('jwk', k))
      );

      expect(jwks[0].k).not.toBe(jwks[1].k);
      expect(jwks[1].k).not.toBe(jwks[2].k);
      expect(jwks[0].k).not.toBe(jwks[2].k);
    });

    it('should handle concurrent mnemonic generation', () => {
      (bip39.generateMnemonic as jest.Mock).mockImplementation((bits) => {
        return `mnemonic-${Date.now()}-${Math.random()}`;
      });

      const mnemonics = Array.from({ length: 5 }, () => generateMnemonic());

      // All should be different
      const uniqueMnemonics = new Set(mnemonics);
      expect(uniqueMnemonics.size).toBe(5);
    });
  });
});
