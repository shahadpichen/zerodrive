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
import * as bip39 from 'bip39';

// Mock bip39
jest.mock('bip39', () => ({
  generateMnemonic: jest.fn(),
  validateMnemonic: jest.fn(),
  mnemonicToSeedSync: jest.fn(),
}));

describe('CryptoUtils', () => {
  beforeEach(() => {
    // Clear storage before each test
    sessionStorage.clear();
    jest.clearAllMocks();
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

      const storedValue = sessionStorage.getItem('aes-gcm-key');
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

      const storedValue = sessionStorage.getItem('aes-gcm-key');
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
});
