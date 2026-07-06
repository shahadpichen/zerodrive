const mockQuery = jest.fn();

jest.mock("../../../config/database", () => ({
  query: (...args: unknown[]) => mockQuery(...args),
}));

import {
  consumeOAuthExchange,
  createOAuthExchange,
  OAuthExchangePayload,
} from "../../../services/oauthExchange";

describe("OAuth exchange capabilities", () => {
  const payload: OAuthExchangePayload = {
    ownerHash: "a".repeat(64),
    expiresAt: Date.now() + 60_000,
    tokens: {
      accessToken: "google-access-token",
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      scope: "drive.file",
    },
    isNewUser: false,
    hasLimitedScope: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = "test-jwt-secret-that-is-long-enough-for-tests";
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  it("stores only a hash and expiry, then decrypts after atomic consumption", async () => {
    const code = await createOAuthExchange(payload);
    const insert = mockQuery.mock.calls.find(([sql]) =>
      String(sql).includes("INSERT INTO oauth_exchanges"),
    );

    expect(insert?.[1][0]).toMatch(/^[0-9a-f]{64}$/);
    expect(insert?.[1][0]).not.toContain("google-access-token");
    expect(code).not.toContain("google-access-token");

    mockQuery.mockResolvedValueOnce({
      rows: [{ code_hash: insert?.[1][0] }],
      rowCount: 1,
    });
    await expect(consumeOAuthExchange(code)).resolves.toEqual(payload);
  });

  it("rejects unknown or already-consumed capabilities", async () => {
    await expect(consumeOAuthExchange("unknown")).resolves.toBeNull();
  });

  it("rejects a tampered capability after consuming its hash", async () => {
    const code = await createOAuthExchange(payload);
    const position = Math.floor(code.length / 2);
    const replacement = code[position] === "A" ? "B" : "A";
    mockQuery.mockResolvedValueOnce({
      rows: [{ code_hash: "b".repeat(64) }],
      rowCount: 1,
    });

    await expect(
      consumeOAuthExchange(
        `${code.slice(0, position)}${replacement}${code.slice(position + 1)}`,
      ),
    ).resolves.toBeNull();
  });
});
