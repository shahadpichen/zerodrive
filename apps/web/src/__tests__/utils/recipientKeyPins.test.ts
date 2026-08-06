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
    expect(() =>
      pinRecipientKey("recipient@example.com", "bad", 1),
    ).toThrow("invalid recipient key");
  });

  it("does not let an API-controlled owner namespace reset an existing pin", () => {
    localStorage.setItem(
      `zerodrive-recipient-key-pins-v1:${"f".repeat(64)}`,
      JSON.stringify({
        "recipient@example.com": {
          fingerprint: "a".repeat(64),
          keyVersion: 1,
          pinnedAt: 10,
        },
      }),
    );

    expect(getRecipientKeyPin("recipient@example.com")).toEqual(
      expect.objectContaining({
        fingerprint: "a".repeat(64),
        keyVersion: 1,
      }),
    );
    expect(
      localStorage.getItem("zerodrive-recipient-key-pins-v2"),
    ).not.toBeNull();
  });
});
