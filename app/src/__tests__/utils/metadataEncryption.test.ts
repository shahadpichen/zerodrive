/**
 * Unit Tests for Metadata Encryption
 * Tests encryption and decryption of file metadata using AES-GCM
 */

import {
  encryptMetadata,
  decryptMetadata,
} from '../../utils/metadataEncryption';

// Mock dependencies
jest.mock('../../utils/cryptoUtils');
jest.mock('../../utils/logger');

const mockGetStoredKey = jest.fn();

jest.mock('../../utils/cryptoUtils', () => ({
  getStoredKey: (...args: any[]) => mockGetStoredKey(...args),
}));

describe('MetadataEncryption', () => {
  let mockKey: CryptoKey;

  beforeAll(async () => {
    // Generate a real crypto key for testing
    mockKey = await crypto.subtle.generateKey(
      {
        name: 'AES-GCM',
        length: 256,
      },
      true,
      ['encrypt', 'decrypt']
    );
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetStoredKey.mockResolvedValue(mockKey);
  });

  describe('encryptMetadata', () => {
    it('should encrypt metadata successfully', async () => {
      const metadata = { files: [{ id: '123', name: 'test.txt' }] };

      const encryptedBlob = await encryptMetadata(metadata);

      expect(encryptedBlob).toBeInstanceOf(Blob);
      expect(encryptedBlob.type).toBe('application/octet-stream');
      expect(encryptedBlob.size).toBeGreaterThan(12); // At least IV + some data
    });

    it('should prepend IV to encrypted data', async () => {
      const metadata = { test: 'value' };

      const encryptedBlob = await encryptMetadata(metadata);
      const arrayBuffer = await encryptedBlob.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);

      // IV should be first 12 bytes
      expect(data.byteLength).toBeGreaterThan(12);
    });

    it('should throw error when encryption key is not available', async () => {
      mockGetStoredKey.mockResolvedValue(null);

      const metadata = { test: 'value' };

      await expect(encryptMetadata(metadata)).rejects.toThrow(
        'No encryption key found for metadata encryption'
      );
    });

    it('should encrypt different metadata to different ciphertexts', async () => {
      const metadata1 = { data: 'first' };
      const metadata2 = { data: 'second' };

      const blob1 = await encryptMetadata(metadata1);
      const blob2 = await encryptMetadata(metadata2);

      const buffer1 = await blob1.arrayBuffer();
      const buffer2 = await blob2.arrayBuffer();

      // Encrypted data should be different
      expect(new Uint8Array(buffer1)).not.toEqual(new Uint8Array(buffer2));
    });

    it('should encrypt same metadata to different ciphertexts (different IVs)', async () => {
      const metadata = { data: 'same' };

      const blob1 = await encryptMetadata(metadata);
      const blob2 = await encryptMetadata(metadata);

      const buffer1 = await blob1.arrayBuffer();
      const buffer2 = await blob2.arrayBuffer();

      // Even with same plaintext, ciphertext should differ (due to random IV)
      expect(new Uint8Array(buffer1)).not.toEqual(new Uint8Array(buffer2));
    });

    it('should handle empty metadata object', async () => {
      const metadata = {};

      const encryptedBlob = await encryptMetadata(metadata);

      expect(encryptedBlob).toBeInstanceOf(Blob);
      expect(encryptedBlob.size).toBeGreaterThan(0);
    });

    it('should handle complex nested metadata', async () => {
      const metadata = {
        files: [
          {
            id: '123',
            name: 'test.txt',
            nested: { prop1: 'value1', prop2: 42 },
          },
        ],
        folders: [{ id: 'folder-1', children: ['file-1', 'file-2'] }],
      };

      const encryptedBlob = await encryptMetadata(metadata);

      expect(encryptedBlob).toBeInstanceOf(Blob);
    });

    it('should handle metadata with special characters', async () => {
      const metadata = {
        name: 'Test @#$% & Special',
        emoji: '🔒🔐',
      };

      const encryptedBlob = await encryptMetadata(metadata);

      expect(encryptedBlob).toBeInstanceOf(Blob);
      expect(encryptedBlob.size).toBeGreaterThan(12);
    });

    it('should handle large metadata objects', async () => {
      const largeMetadata = {
        files: Array.from({ length: 1000 }, (_, i) => ({
          id: `file-${i}`,
          name: `test-${i}.txt`,
          size: Math.random() * 10000,
        })),
      };

      const encryptedBlob = await encryptMetadata(largeMetadata);

      expect(encryptedBlob).toBeInstanceOf(Blob);
      expect(encryptedBlob.size).toBeGreaterThan(1000);
    });

    it('should handle metadata with null values', async () => {
      const metadata = {
        name: 'test',
        value: null,
        nested: { prop: null },
      };

      const encryptedBlob = await encryptMetadata(metadata);

      expect(encryptedBlob).toBeInstanceOf(Blob);
    });

    it('should throw error with custom message on encryption failure', async () => {
      mockGetStoredKey.mockResolvedValue(undefined);

      await expect(encryptMetadata({ test: 'data' })).rejects.toThrow(
        'Failed to encrypt metadata'
      );
    });
  });

  describe('decryptMetadata', () => {
    it('should decrypt encrypted metadata successfully', async () => {
      const originalMetadata = { files: [{ id: '123', name: 'test.txt' }] };

      const encryptedBlob = await encryptMetadata(originalMetadata);
      const decryptedMetadata = await decryptMetadata(encryptedBlob);

      expect(decryptedMetadata).toEqual(originalMetadata);
    });

    it('should throw error when decryption key is not available', async () => {
      const metadata = { test: 'value' };
      const encryptedBlob = await encryptMetadata(metadata);

      mockGetStoredKey.mockResolvedValue(null);

      await expect(decryptMetadata(encryptedBlob)).rejects.toThrow(
        'No encryption key found for metadata decryption'
      );
    });

    it('should throw error when encrypted blob is too small', async () => {
      const tinyBlob = new Blob([new Uint8Array(10)]); // Only 10 bytes

      await expect(decryptMetadata(tinyBlob)).rejects.toThrow(
        'Encrypted metadata is too small'
      );
    });

    it('should throw error when encrypted blob is minimum size (12 bytes)', async () => {
      const tinyBlob = new Blob([new Uint8Array(12)]); // Exactly 12 bytes (only IV)

      await expect(decryptMetadata(tinyBlob)).rejects.toThrow(
        'Encrypted metadata is too small'
      );
    });

    it('should decrypt with different key and fail', async () => {
      const metadata = { test: 'value' };

      const encryptedBlob = await encryptMetadata(metadata);

      // Generate a different key
      const differentKey = await crypto.subtle.generateKey(
        {
          name: 'AES-GCM',
          length: 256,
        },
        true,
        ['encrypt', 'decrypt']
      );

      mockGetStoredKey.mockResolvedValue(differentKey);

      await expect(decryptMetadata(encryptedBlob)).rejects.toThrow(
        "Metadata decryption failed: The encryption key doesn't match"
      );
    });

    it('should handle corrupted encrypted data', async () => {
      const metadata = { test: 'value' };
      const encryptedBlob = await encryptMetadata(metadata);

      // Corrupt the encrypted data
      const arrayBuffer = await encryptedBlob.arrayBuffer();
      const corruptedData = new Uint8Array(arrayBuffer);
      corruptedData[20] = corruptedData[20] ^ 0xff; // Flip bits

      const corruptedBlob = new Blob([corruptedData]);

      await expect(decryptMetadata(corruptedBlob)).rejects.toThrow();
    });

    it('should decrypt empty metadata object', async () => {
      const originalMetadata = {};

      const encryptedBlob = await encryptMetadata(originalMetadata);
      const decryptedMetadata = await decryptMetadata(encryptedBlob);

      expect(decryptedMetadata).toEqual(originalMetadata);
    });

    it('should decrypt complex nested metadata', async () => {
      const originalMetadata = {
        files: [
          {
            id: '123',
            name: 'test.txt',
            nested: { prop1: 'value1', prop2: 42 },
          },
        ],
        folders: [{ id: 'folder-1', children: ['file-1', 'file-2'] }],
      };

      const encryptedBlob = await encryptMetadata(originalMetadata);
      const decryptedMetadata = await decryptMetadata(encryptedBlob);

      expect(decryptedMetadata).toEqual(originalMetadata);
    });

    it('should decrypt metadata with special characters', async () => {
      const originalMetadata = {
        name: 'Test @#$% & Special',
        emoji: '🔒🔐',
      };

      const encryptedBlob = await encryptMetadata(originalMetadata);
      const decryptedMetadata = await decryptMetadata(encryptedBlob);

      expect(decryptedMetadata).toEqual(originalMetadata);
    });

    it('should decrypt large metadata objects', async () => {
      const originalMetadata = {
        files: Array.from({ length: 1000 }, (_, i) => ({
          id: `file-${i}`,
          name: `test-${i}.txt`,
          size: i * 100,
        })),
      };

      const encryptedBlob = await encryptMetadata(originalMetadata);
      const decryptedMetadata = await decryptMetadata(encryptedBlob);

      expect(decryptedMetadata).toEqual(originalMetadata);
    });

    it('should decrypt metadata with null values', async () => {
      const originalMetadata = {
        name: 'test',
        value: null,
        nested: { prop: null },
      };

      const encryptedBlob = await encryptMetadata(originalMetadata);
      const decryptedMetadata = await decryptMetadata(encryptedBlob);

      expect(decryptedMetadata).toEqual(originalMetadata);
    });

    it('should handle tampered IV', async () => {
      const metadata = { test: 'value' };
      const encryptedBlob = await encryptMetadata(metadata);

      // Tamper with IV (first 12 bytes)
      const arrayBuffer = await encryptedBlob.arrayBuffer();
      const tamperedData = new Uint8Array(arrayBuffer);
      tamperedData[0] = tamperedData[0] ^ 0xff;

      const tamperedBlob = new Blob([tamperedData]);

      await expect(decryptMetadata(tamperedBlob)).rejects.toThrow();
    });

    it('should preserve data types after encryption and decryption', async () => {
      const originalMetadata = {
        string: 'text',
        number: 42,
        boolean: true,
        array: [1, 2, 3],
        object: { nested: 'value' },
        null: null,
      };

      const encryptedBlob = await encryptMetadata(originalMetadata);
      const decryptedMetadata = await decryptMetadata(encryptedBlob);

      expect(decryptedMetadata).toEqual(originalMetadata);
      expect(typeof decryptedMetadata.string).toBe('string');
      expect(typeof decryptedMetadata.number).toBe('number');
      expect(typeof decryptedMetadata.boolean).toBe('boolean');
      expect(Array.isArray(decryptedMetadata.array)).toBe(true);
      expect(typeof decryptedMetadata.object).toBe('object');
    });
  });

  describe('Round-trip Encryption/Decryption', () => {
    it('should handle multiple encryption/decryption cycles', async () => {
      let metadata = { counter: 0 };

      for (let i = 0; i < 10; i++) {
        metadata.counter = i;
        const encrypted = await encryptMetadata(metadata);
        const decrypted = await decryptMetadata(encrypted);
        expect(decrypted).toEqual(metadata);
      }
    });

    it('should handle concurrent encryption operations', async () => {
      const metadataSet = [
        { id: 1, data: 'first' },
        { id: 2, data: 'second' },
        { id: 3, data: 'third' },
      ];

      const encryptedBlobs = await Promise.all(
        metadataSet.map((m) => encryptMetadata(m))
      );

      const decryptedData = await Promise.all(
        encryptedBlobs.map((blob) => decryptMetadata(blob))
      );

      expect(decryptedData).toEqual(metadataSet);
    });

    it('should maintain data integrity with unicode characters', async () => {
      const metadata = {
        languages: {
          chinese: '你好世界',
          arabic: 'مرحبا بالعالم',
          russian: 'Привет мир',
          emoji: '👋🌍',
        },
      };

      const encryptedBlob = await encryptMetadata(metadata);
      const decryptedMetadata = await decryptMetadata(encryptedBlob);

      expect(decryptedMetadata).toEqual(metadata);
    });

    it('should handle metadata with Date objects (serialized)', async () => {
      const metadata = {
        timestamp: new Date().toISOString(),
        files: [
          {
            id: '123',
            uploadedDate: new Date('2024-01-01').toISOString(),
          },
        ],
      };

      const encryptedBlob = await encryptMetadata(metadata);
      const decryptedMetadata = await decryptMetadata(encryptedBlob);

      expect(decryptedMetadata).toEqual(metadata);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty blob', async () => {
      const emptyBlob = new Blob([]);

      await expect(decryptMetadata(emptyBlob)).rejects.toThrow(
        'Encrypted metadata is too small'
      );
    });

    it('should handle blob with only IV (no encrypted data)', async () => {
      const ivOnlyBlob = new Blob([new Uint8Array(12)]);

      await expect(decryptMetadata(ivOnlyBlob)).rejects.toThrow();
    });

    it('should handle very large metadata (performance test)', async () => {
      const largeMetadata = {
        files: Array.from({ length: 10000 }, (_, i) => ({
          id: `file-${i}`,
          name: `long-file-name-with-many-characters-${i}.txt`,
          metadata: {
            nested: { level1: { level2: { level3: `value-${i}` } } },
          },
        })),
      };

      const encryptedBlob = await encryptMetadata(largeMetadata);
      const decryptedMetadata = await decryptMetadata(encryptedBlob);

      expect(decryptedMetadata.files.length).toBe(10000);
      expect(decryptedMetadata).toEqual(largeMetadata);
    }, 10000); // Allow 10 seconds for this test

    it('should throw generic error for unknown encryption errors', async () => {
      // Mock crypto.subtle.encrypt to throw unknown error
      const originalEncrypt = crypto.subtle.encrypt;
      crypto.subtle.encrypt = jest
        .fn()
        .mockRejectedValue(new Error('Unknown crypto error'));

      await expect(encryptMetadata({ test: 'data' })).rejects.toThrow(
        'Failed to encrypt metadata'
      );

      crypto.subtle.encrypt = originalEncrypt;
    });

    it('should differentiate OperationError from generic decryption errors', async () => {
      const metadata = { test: 'value' };
      const encryptedBlob = await encryptMetadata(metadata);

      // Mock crypto.subtle.decrypt to throw OperationError
      const originalDecrypt = crypto.subtle.decrypt;
      const operationError = new Error('Operation failed');
      operationError.name = 'OperationError';
      crypto.subtle.decrypt = jest.fn().mockRejectedValue(operationError);

      await expect(decryptMetadata(encryptedBlob)).rejects.toThrow(
        "Metadata decryption failed: The encryption key doesn't match"
      );

      crypto.subtle.decrypt = originalDecrypt;
    });

    it('should handle metadata with array of primitives', async () => {
      const metadata = {
        numbers: [1, 2, 3, 4, 5],
        strings: ['a', 'b', 'c'],
        booleans: [true, false, true],
        mixed: [1, 'two', true, null],
      };

      const encryptedBlob = await encryptMetadata(metadata);
      const decryptedMetadata = await decryptMetadata(encryptedBlob);

      expect(decryptedMetadata).toEqual(metadata);
    });
  });
});
