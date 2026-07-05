import {
  getRecipientKeyPin,
  pinRecipientKey,
} from "../../utils/recipientKeyPins";

describe("recipient key pins", () => {
  const owner = "f".repeat(64);
  beforeEach(() => localStorage.clear());

  it("normalizes the recipient and stores only the fingerprint metadata", () => {
    pinRecipientKey(owner, " Recipient@Example.com ", "a".repeat(64), 2);

    expect(getRecipientKeyPin(owner, "recipient@example.com")).toEqual(
      expect.objectContaining({
        fingerprint: "a".repeat(64),
        keyVersion: 2,
      }),
    );
  });

  it("rejects malformed fingerprints", () => {
    expect(() =>
      pinRecipientKey(owner, "recipient@example.com", "bad", 1),
    ).toThrow("invalid recipient key");
  });

  it("does not share trust decisions between local accounts", () => {
    pinRecipientKey(owner, "recipient@example.com", "a".repeat(64), 1);
    expect(
      getRecipientKeyPin("e".repeat(64), "recipient@example.com"),
    ).toBeNull();
  });
});
