import {
  getRecipientKeyPin,
  pinRecipientKey,
} from "../../utils/recipientKeyPins";

describe("recipient key pins", () => {
  beforeEach(() => localStorage.clear());

  it("normalizes the recipient and stores only the fingerprint metadata", () => {
    pinRecipientKey(" Recipient@Example.com ", "a".repeat(64), 2);

    expect(getRecipientKeyPin("recipient@example.com")).toEqual(
      expect.objectContaining({
        fingerprint: "a".repeat(64),
        keyVersion: 2,
      }),
    );
  });

  it("rejects malformed fingerprints", () => {
    expect(() => pinRecipientKey("recipient@example.com", "bad", 1)).toThrow(
      "invalid recipient key",
    );
  });
});
