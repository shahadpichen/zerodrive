import { getStoredKey } from './cryptoUtils';

/**
 * Tests if the stored encryption key works correctly
 * by performing a full encrypt/decrypt cycle
 */
export async function testEncryptionKey(): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    const key = await getStoredKey();

    if (!key) {
      return {
        success: false,
        message: "No encryption key found in storage"
      };
    }

    // Test data with special characters
    const testString = "ZeroDrive Test Data 🔐✓";
    const encoder = new TextEncoder();
    const data = encoder.encode(testString);

    // Encrypt the test data
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      data
    );

    // Decrypt the encrypted data
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      encrypted
    );

    // Verify the result
    const decoder = new TextDecoder();
    const result = decoder.decode(decrypted);

    if (result === testString) {
      return {
        success: true,
        message: "✅ Your encryption key works perfectly!"
      };
    } else {
      return {
        success: false,
        message: "❌ Decryption mismatch - key may be corrupted"
      };
    }
  } catch (error) {
    console.error('Key test failed:', error);
    return {
      success: false,
      message: "❌ Encryption test failed - key may be invalid"
    };
  }
}
