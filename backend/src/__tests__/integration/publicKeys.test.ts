import request from "supertest";
import express from "express";
import publicKeysRouter from "../../routes/publicKeys";
import { query, transaction } from "../../config/database";
import { deriveLookupCandidates } from "../../utils/identity";

jest.mock("../../config/database");

const ownerLookupId = "a".repeat(64);
const validPublicKey = JSON.stringify({
  kty: "RSA",
  n: Buffer.alloc(256, 7).toString("base64url"),
  e: "AQAB",
  alg: "RSA-OAEP-256",
  key_ops: ["encrypt"],
  ext: true,
});
const fingerprint = "f".repeat(64);
const clientQuery = jest.fn();

const app = express();
app.use(express.json());
app.use((req, res, next) => {
  req.user = { email: "owner@example.com", emailHash: ownerLookupId };
  res.apiSuccess = (data: unknown, message: string, statusCode = 200) =>
    res.status(statusCode).json({ success: true, data, message });
  next();
});
app.use("/api/public-keys", publicKeysRouter);
app.use(
  (
    error: any,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message,
    });
  },
);

describe("privacy-preserving public key directory", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (transaction as jest.Mock).mockImplementation(async (callback) =>
      callback({ query: clientQuery }),
    );
  });

  it("stores a key only under the authenticated lookup id", async () => {
    clientQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ next_version: 1 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            user_id: ownerLookupId,
            public_key: validPublicKey,
            key_version: 1,
            fingerprint,
            is_active: true,
          },
        ],
      });

    await request(app)
      .post("/api/public-keys")
      .send({ public_key: validPublicKey })
      .expect(201);

    expect(clientQuery).toHaveBeenLastCalledWith(
      expect.stringContaining("INSERT INTO public_keys"),
      [
        ownerLookupId,
        validPublicKey,
        1,
        expect.stringMatching(/^[0-9a-f]{64}$/),
      ],
    );
  });

  it("retains the previous key and creates a new active version on rotation", async () => {
    clientQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            user_id: ownerLookupId,
            public_key: JSON.stringify({ kty: "RSA", n: "old", e: "AQAB" }),
            key_version: 1,
            fingerprint: "0".repeat(64),
            is_active: true,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ next_version: 2 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            user_id: ownerLookupId,
            public_key: validPublicKey,
            key_version: 2,
            fingerprint,
            is_active: true,
          },
        ],
      });

    const response = await request(app)
      .post("/api/public-keys")
      .send({ public_key: validPublicKey })
      .expect(201);

    expect(clientQuery).toHaveBeenCalledWith(
      expect.stringContaining("SET is_active = FALSE"),
      [ownerLookupId],
    );
    expect(response.body.data.key_version).toBe(2);
  });

  it("rejects caller-supplied owner identifiers", async () => {
    await request(app)
      .post("/api/public-keys")
      .send({ user_id: "b".repeat(64), public_key: validPublicKey })
      .expect(422);

    expect(query).not.toHaveBeenCalled();
  });

  it("rejects private key material", async () => {
    await request(app)
      .post("/api/public-keys")
      .send({
        public_key: JSON.stringify({
          kty: "RSA",
          n: "modulus",
          e: "AQAB",
          d: "private",
        }),
      })
      .expect(422);
  });

  it("looks up a recipient without returning an internal identifier", async () => {
    (query as jest.Mock).mockResolvedValue({
      rows: [{ public_key: validPublicKey, key_version: 3, fingerprint }],
    });

    const response = await request(app)
      .post("/api/public-keys/lookup")
      .send({ email: "Recipient@Example.com" })
      .expect(200);

    const candidates = deriveLookupCandidates("recipient@example.com");
    expect(query).toHaveBeenCalledWith(expect.any(String), [
      candidates,
      candidates[0],
    ]);
    expect(response.body.data).toEqual({
      public_key: validPublicKey,
      key_version: 3,
      fingerprint,
    });
  });

  it("returns 404 for an unknown recipient", async () => {
    (query as jest.Mock).mockResolvedValue({ rows: [] });

    await request(app)
      .post("/api/public-keys/lookup")
      .send({ email: "missing@example.com" })
      .expect(404);
  });

  it("deletes only the authenticated user's key", async () => {
    (query as jest.Mock).mockResolvedValue({ rowCount: 1, rows: [] });

    await request(app).delete("/api/public-keys").expect(200);
    expect(query).toHaveBeenCalledWith(
      "DELETE FROM public_keys WHERE user_id = $1",
      [ownerLookupId],
    );
  });

  it("does not expose a public-key listing endpoint", async () => {
    await request(app).get("/api/public-keys").expect(404);
  });
});
