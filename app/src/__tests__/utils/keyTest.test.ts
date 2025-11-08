/**
 * Tests for Key Testing Utility
 *
 * Tests the "Test Your Key" feature that validates
 * encryption keys work correctly
 */

import { testEncryptionKey } from '../../utils/keyTest';
import {
  generateKey,
  storeKey,
  clearStoredKey,
  generateMnemonic,
  deriveKeyFromMnemonic,
} from '../../utils/cryptoUtils';

describe('testEncryptionKey', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  describe('Success Cases', () => {
    it('should return success when key is valid', async () => {
      const key = await generateKey();
      await storeKey(key);

      const result = await testEncryptionKey();

      expect(result.success).toBe(true);
      expect(result.message).toContain('✅');
      expect(result.message).toContain('works perfectly');
    });

    it('should return success for key derived from mnemonic', async () => {
      const mnemonic = generateMnemonic();
      const key = await deriveKeyFromMnemonic(mnemonic);
      await storeKey(key);

      const result = await testEncryptionKey();

      expect(result.success).toBe(true);
      expect(result.message).toContain('✅');
    });

    it('should handle multiple consecutive tests', async () => {
      const key = await generateKey();
      await storeKey(key);

      // Run test multiple times
      for (let i = 0; i < 5; i++) {
        const result = await testEncryptionKey();
        expect(result.success).toBe(true);
      }
    });

    it('should work after key recovery', async () => {
      const mnemonic = generateMnemonic();
      const key = await deriveKeyFromMnemonic(mnemonic);
      await storeKey(key);

      // Clear and recover
      clearStoredKey();
      const recoveredKey = await deriveKeyFromMnemonic(mnemonic);
      await storeKey(recoveredKey);

      const result = await testEncryptionKey();
      expect(result.success).toBe(true);
    });
  });

  describe('Failure Cases', () => {
    it('should return error when no key is stored', async () => {
      const result = await testEncryptionKey();

      expect(result.success).toBe(false);
      expect(result.message).toContain('No encryption key found');
    });

    it('should return error after key is cleared', async () => {
      const key = await generateKey();
      await storeKey(key);

      clearStoredKey();

      const result = await testEncryptionKey();

      expect(result.success).toBe(false);
      expect(result.message).toContain('No encryption key found');
    });
  });

  describe('Message Format', () => {
    it('should include success emoji in success message', async () => {
      const key = await generateKey();
      await storeKey(key);

      const result = await testEncryptionKey();

      expect(result.message).toContain('✅');
    });

    it('should include error emoji in error message', async () => {
      const result = await testEncryptionKey();

      expect(result.message).toContain('❌');
    });

    it('should have user-friendly success message', async () => {
      const key = await generateKey();
      await storeKey(key);

      const result = await testEncryptionKey();

      expect(result.message.toLowerCase()).toContain('work');
      expect(result.message.toLowerCase()).toContain('key');
    });

    it('should have clear error message for no key', async () => {
      const result = await testEncryptionKey();

      expect(result.message.toLowerCase()).toContain('no');
      expect(result.message.toLowerCase()).toContain('key');
      expect(result.message.toLowerCase()).toContain('found');
    });
  });

  describe('Data Handling', () => {
    it('should handle test data with special characters', async () => {
      const key = await generateKey();
      await storeKey(key);

      // The test uses "ZeroDrive Test Data 🔐✓" internally
      const result = await testEncryptionKey();

      expect(result.success).toBe(true);
    });

    it('should return consistent results for same key', async () => {
      const key = await generateKey();
      await storeKey(key);

      const results = await Promise.all([
        testEncryptionKey(),
        testEncryptionKey(),
        testEncryptionKey(),
      ]);

      // All should succeed
      results.forEach((result) => {
        expect(result.success).toBe(true);
      });

      // All should have same message
      const messages = results.map((r) => r.message);
      expect(new Set(messages).size).toBe(1);
    });
  });

  describe('Return Value Structure', () => {
    it('should return object with success and message properties', async () => {
      const result = await testEncryptionKey();

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('message');
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.message).toBe('string');
    });

    it('should have non-empty message', async () => {
      const result = await testEncryptionKey();

      expect(result.message.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle corrupted key gracefully', async () => {
      // Store invalid data
      sessionStorage.setItem('aes-gcm-key', 'invalid-json-data');

      const result = await testEncryptionKey();

      expect(result.success).toBe(false);
      expect(result.message).toBeTruthy();
    });

    it('should handle partially valid key data', async () => {
      // Store incomplete JWK
      sessionStorage.setItem('aes-gcm-key', JSON.stringify({ kty: 'oct' }));

      const result = await testEncryptionKey();

      // Should either fail or handle gracefully
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('message');
    });
  });

  describe('Performance', () => {
    it('should complete quickly', async () => {
      const key = await generateKey();
      await storeKey(key);

      const startTime = Date.now();
      await testEncryptionKey();
      const duration = Date.now() - startTime;

      // Should complete in under 100ms
      expect(duration).toBeLessThan(100);
    });

    it('should not significantly impact stored key', async () => {
      const key = await generateKey();
      await storeKey(key);

      const beforeJwk = await crypto.subtle.exportKey('jwk', key);

      // Run test
      await testEncryptionKey();

      const retrievedKey = (await require('../../utils/cryptoUtils').getStoredKey())!;
      const afterJwk = await crypto.subtle.exportKey('jwk', retrievedKey);

      // Key should be unchanged
      expect(afterJwk.k).toBe(beforeJwk.k);
    });
  });
});
