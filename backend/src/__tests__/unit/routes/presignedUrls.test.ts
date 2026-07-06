import crypto from "crypto";
import request from "supertest";
import express from "express";
import presignedUrlsRouter from "../../../routes/presignedUrls";
import { query } from "../../../config/database";

jest.mock("../../../config/s3", () => ({
  MINIO_BUCKET: "test-bucket",
  s3Client: {},
}));
jest.mock("../../../config/database");
jest.mock("../../../utils/logger", () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn() },
}));

const mockGetSignedUrl = jest.fn();
jest.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: (...args: any[]) => mockGetSignedUrl(...args),
}));

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  req.user = {
    email: "recipient@example.com",
    emailHash: "a".repeat(64),
  };
  next();
});
app.use("/api/presigned-url", presignedUrlsRouter);

const shareId = "550e8400-e29b-41d4-a716-446655440000";
const capability = "anonymous-upload-capability";
const capabilityHash = crypto
  .createHash("sha256")
  .update(capability)
  .digest("hex");

describe("authorized presigned URLs", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSignedUrl.mockResolvedValue("https://minio.example/signed");
  });

  it("signs the server-owned pending object with its expected size", async () => {
    (query as jest.Mock).mockResolvedValue({
      rows: [
        {
          file_id: "shared/opaque-id",
          expected_encrypted_size: 1052,
          management_capability_hash: capabilityHash,
        },
      ],
    });

    const response = await request(app)
      .post("/api/presigned-url/upload")
      .set("x-share-capability", capability)
      .send({ shareId })
      .expect(200);

    expect(response.body.data.fileKey).toBeUndefined();
    const command = mockGetSignedUrl.mock.calls[0][1];
    expect(command.input).toMatchObject({
      Key: "shared/opaque-id",
      ContentLength: 1052,
      ContentType: "application/octet-stream",
    });
  });

  it("does not sign an upload for a wrong capability", async () => {
    (query as jest.Mock).mockResolvedValue({
      rows: [
        {
          file_id: "shared/opaque-id",
          expected_encrypted_size: 1052,
          management_capability_hash: capabilityHash,
        },
      ],
    });

    await request(app)
      .post("/api/presigned-url/upload")
      .set("x-share-capability", "wrong")
      .send({ shareId })
      .expect(404);
    expect(mockGetSignedUrl).not.toHaveBeenCalled();
  });

  it("rejects arbitrary upload parameters", async () => {
    await request(app)
      .post("/api/presigned-url/upload")
      .set("x-share-capability", capability)
      .send({ shareId, fileName: "secret.txt", fileSize: 1 })
      .expect(400);
  });

  it("signs downloads only for the authenticated active recipient", async () => {
    (query as jest.Mock).mockResolvedValue({
      rows: [{ file_id: "shared/opaque-id" }],
    });
    const response = await request(app)
      .post("/api/presigned-url/download")
      .send({ shareId })
      .expect(200);
    expect(response.body.data.fileKey).toBeUndefined();
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("status = 'active'"),
      [shareId, ["a".repeat(64)]],
    );
  });

  it("hides unavailable or unauthorized downloads", async () => {
    (query as jest.Mock).mockResolvedValue({ rows: [] });
    await request(app)
      .post("/api/presigned-url/download")
      .send({ shareId })
      .expect(404);
    expect(mockGetSignedUrl).not.toHaveBeenCalled();
  });
});
