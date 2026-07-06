import crypto from "crypto";

export function shareCapabilityMatches(
  plaintextCapability: string | undefined,
  expectedHash: string,
): boolean {
  if (!plaintextCapability || !/^[0-9a-f]{64}$/.test(expectedHash)) {
    return false;
  }
  const actual = crypto
    .createHash("sha256")
    .update(plaintextCapability, "utf8")
    .digest();
  const expected = Buffer.from(expectedHash, "hex");
  return (
    actual.length === expected.length &&
    crypto.timingSafeEqual(actual, expected)
  );
}
