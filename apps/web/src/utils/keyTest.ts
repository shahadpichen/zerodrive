import {
  createPersonalFileCapsule,
  openPersonalFileCapsule,
} from "./capsuleAdapter";
import { hasMnemonic } from "./mnemonicManager";

/**
 * Verify the currently active recovery phrase through the same Capsule v1
 * personal-file contract used by Storage.
 */
export async function testEncryptionKey(): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    if (!hasMnemonic()) {
      return {
        success: false,
        message: "No recovery phrase is active in this browser tab.",
      };
    }

    const testString = "ZeroDrive Test Data 🔐✓";
    const encrypted = await createPersonalFileCapsule(
      new File([testString], "capsule-access-test.txt", {
        type: "text/plain",
      }),
      crypto.randomUUID(),
    );
    const opened = await openPersonalFileCapsule(encrypted.encryptedBlob);
    const result = await opened.contentBlob.text();

    if (result === testString) {
      return {
        success: true,
        message: "Your recovery phrase can open Capsule v1 files.",
      };
    }

    return {
      success: false,
      message: "The encrypted access check did not match.",
    };
  } catch (error) {
    console.error("Recovery access test failed:", error);
    return {
      success: false,
      message: "ZeroDrive could not verify this recovery phrase.",
    };
  }
}
