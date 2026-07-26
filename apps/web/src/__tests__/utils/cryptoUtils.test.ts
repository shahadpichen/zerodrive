import { validateRecoveryPhrase } from "@zerodrivehq/capsule";
import {
  clearStoredKey,
  generateMnemonic,
  getStoredKey,
  storeKey,
} from "../../utils/cryptoUtils";

describe("cryptoUtils legacy key lifecycle", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("keeps an imported legacy AES key in this browser tab only", async () => {
    const key = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"],
    );
    await storeKey(key);

    const restored = await getStoredKey();
    expect(restored).not.toBeNull();
    const [original, recovered] = await Promise.all([
      crypto.subtle.exportKey("jwk", key),
      crypto.subtle.exportKey("jwk", restored!),
    ]);
    expect(recovered.k).toBe(original.k);

    clearStoredKey();
    await expect(getStoredKey()).resolves.toBeNull();
  });

  it("generates a valid 12-word Capsule recovery phrase", () => {
    const phrase = generateMnemonic();

    expect(phrase.split(" ")).toHaveLength(12);
    expect(validateRecoveryPhrase(phrase)).toBe(true);
  });

  it("returns null for malformed stored key material", async () => {
    sessionStorage.setItem("aes-key", "{not-json");
    await expect(getStoredKey()).resolves.toBeNull();
  });
});
