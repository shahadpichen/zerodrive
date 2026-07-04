import request from "supertest";
import express from "express";
import publicKeysRouter from "../../routes/publicKeys";
import { query } from "../../config/database";
import { deriveLookupCandidates } from "../../utils/identity";

jest.mock("../../config/database");

const ownerLookupId = "a".repeat(64);
const validPublicKey = JSON.stringify({
  kty: "RSA",
  n: "test-modulus",
  e: "AQAB",
  alg: "RSA-OAEP-256",
  key_ops: ["encrypt"],
  ext: true,
});

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
  beforeEach(() => jest.clearAllMocks());

  it("stores a key only under the authenticated lookup id", async () => {
    (query as jest.Mock)
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ user_id: ownerLookupId, public_key: validPublicKey }],
      });

    await request(app)
      .post("/api/public-keys")
      .send({ public_key: validPublicKey })
      .expect(201);

    expect(query).toHaveBeenLastCalledWith(expect.stringContaining("INSERT"), [
      ownerLookupId,
      validPublicKey,
    ]);
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
      rows: [{ public_key: validPublicKey }],
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
    expect(response.body.data).toEqual({ public_key: validPublicKey });
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
