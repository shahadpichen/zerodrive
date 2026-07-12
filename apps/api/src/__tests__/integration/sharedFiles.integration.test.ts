/**
 * Integration Tests for Shared Files Routes
 * Tests all endpoints with authentication, validation, and error scenarios
 */

import request from "supertest";
import express, { Application } from "express";
import cookieParser from "cookie-parser";
import sharedFilesRouter from "../../routes/sharedFiles";
import { responseHelpers, errorHandler } from "../../middleware/errorHandler";
import { generateToken, verifyToken } from "../../services/jwtService";
import { requireAuth } from "../../middleware/auth";
import crypto from "crypto";

// Mock dependencies
jest.mock("../../config/database");
jest.mock("../../services/emailService");
jest.mock("../../services/analytics");
const mockS3Send = jest.fn();
jest.mock("../../config/s3", () => ({
  MINIO_BUCKET: "test-bucket",
  s3Client: { send: (...args: any[]) => mockS3Send(...args) },
}));

const mockQuery = jest.fn();
jest.mock("../../config/database", () => ({
  query: (...args: any[]) => mockQuery(...args),
}));

const mockSendFileShareNotification = jest.fn();
jest.mock("../../services/emailService", () => ({
  sendFileShareNotification: (...args: any[]) =>
    mockSendFileShareNotification(...args),
}));

const mockTrackEvent = jest.fn();
jest.mock("../../services/analytics", () => ({
  trackEvent: (...args: any[]) => mockTrackEvent(...args),
  AnalyticsEvent: {
    FILE_SHARED: "file_shared",
    SHARED_FILE_ACCESSED: "shared_file_accessed",
    SHARE_FINALIZED: "share_finalized",
    SHARE_REVOKED: "share_revoked",
  },
  AnalyticsCategory: {
    SHARING: "sharing",
  },
  getFileSizeBucket: jest.fn((size: number) => "1MB-10MB"),
  getFileTypeCategory: jest.fn((mimeType: string) => "document"),
}));

const validWrappedFileKey = JSON.stringify({
  v: 2,
  keyWrap: "RSA-OAEP-256",
  contentEncryption: "AES-256-GCM",
  recipientKeyVersion: 1,
  recipientKeyFingerprint: "f".repeat(64),
  ciphertext: Buffer.alloc(256, 7).toString("base64"),
});

describe("Shared Files Routes Integration", () => {
  let app: Application;
  const testUserEmail = "sender@example.com";
  const testRecipientEmail = "recipient@example.com";
  const authenticatedUserHash = verifyToken(
    generateToken(testUserEmail),
  ).emailHash;
  const testRecipientEmailHash = authenticatedUserHash;
  const csrfToken = "test-csrf-token";

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use(responseHelpers);
    app.use(requireAuth);
    app.use("/api/shared-files", sharedFilesRouter);
    app.use(errorHandler);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockTrackEvent.mockResolvedValue(undefined);
    mockSendFileShareNotification.mockResolvedValue(undefined);
    mockS3Send.mockResolvedValue({});
  });

  describe("POST /api/shared-files", () => {
    const validShareRequest = {
      management_capability_hash: "a".repeat(64),
      recipient_email: testRecipientEmail,
      encrypted_file_key: validWrappedFileKey,
      encrypted_metadata: Buffer.from("encrypted-metadata").toString("base64"),
      file_size: 1024000,
      encrypted_size: 1024028,
      access_type: "view",
    };

    it("should create shared file with valid data", async () => {
      const token = generateToken(testUserEmail);

      // Mock check for existing share (none found)
      mockQuery.mockResolvedValueOnce({ rows: [] });

      // Mock insert
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: "share-uuid-123",
            ...validShareRequest,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      });

      const response = await request(app)
        .post("/api/shared-files")
        .set("Cookie", [
          `zerodrive_token=${token}`,
          `zerodrive_csrf=${csrfToken}`,
        ])
        .set("x-csrf-token", csrfToken)
        .send(validShareRequest);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.file_id).toBeUndefined();
      expect(response.body.message).toBe("Pending share created");

      // Verify existing share check
      expect(mockQuery).toHaveBeenCalledWith(
        "SELECT id FROM shared_files WHERE management_capability_hash = $1",
        [validShareRequest.management_capability_hash],
      );
    });

    it("sends only a generic notification without plaintext metadata", async () => {
      const token = generateToken(testUserEmail);

      mockQuery.mockResolvedValueOnce({ rows: [] }); // No existing share
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: "share-uuid-123", ...validShareRequest }],
      });

      const response = await request(app)
        .post("/api/shared-files")
        .set("Cookie", [
          `zerodrive_token=${token}`,
          `zerodrive_csrf=${csrfToken}`,
        ])
        .set("x-csrf-token", csrfToken)
        .send(validShareRequest);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);

      // Verify email was sent
      expect(mockSendFileShareNotification).toHaveBeenCalledWith(
        testRecipientEmail,
      );
    });

    it("should create shared file with expiration date", async () => {
      const token = generateToken(testUserEmail);
      const expiresAt = new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000,
      ).toISOString(); // 7 days
      const requestWithExpiry = {
        ...validShareRequest,
        expires_at: expiresAt,
      };

      mockQuery.mockResolvedValueOnce({ rows: [] });
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: "share-uuid-123", ...requestWithExpiry }],
      });

      const response = await request(app)
        .post("/api/shared-files")
        .set("Cookie", [
          `zerodrive_token=${token}`,
          `zerodrive_csrf=${csrfToken}`,
        ])
        .set("x-csrf-token", csrfToken)
        .send(requestWithExpiry);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(mockTrackEvent).toHaveBeenCalled();
    });

    it("should return 401 when no auth cookie provided", async () => {
      const response = await request(app)
        .post("/api/shared-files")
        .send(validShareRequest);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it("should return 401 when invalid token provided", async () => {
      const response = await request(app)
        .post("/api/shared-files")
        .set("Cookie", [
          "zerodrive_token=invalid.token.here",
          `zerodrive_csrf=${csrfToken}`,
        ])
        .set("x-csrf-token", csrfToken)
        .send(validShareRequest);

      expect(response.status).toBe(401);
    });

    it("should return 403 when CSRF token missing", async () => {
      const token = generateToken(testUserEmail);

      const response = await request(app)
        .post("/api/shared-files")
        .set("Cookie", [`zerodrive_token=${token}`])
        .send(validShareRequest);

      expect(response.status).toBe(403);
      expect(response.body.error.message).toContain("CSRF");
    });

    it("should return 403 when CSRF tokens do not match", async () => {
      const token = generateToken(testUserEmail);

      const response = await request(app)
        .post("/api/shared-files")
        .set("Cookie", [
          `zerodrive_token=${token}`,
          `zerodrive_csrf=${csrfToken}`,
        ])
        .set("x-csrf-token", "wrong-csrf-token")
        .send(validShareRequest);

      expect(response.status).toBe(403);
      expect(response.body.error.message).toContain("CSRF");
    });

    it("rejects caller-supplied object keys", async () => {
      const token = generateToken(testUserEmail);
      const invalidRequest = { ...validShareRequest, file_id: "chosen-key" };

      const response = await request(app)
        .post("/api/shared-files")
        .set("Cookie", [
          `zerodrive_token=${token}`,
          `zerodrive_csrf=${csrfToken}`,
        ])
        .set("x-csrf-token", csrfToken)
        .send(invalidRequest);

      expect(response.status).toBe(422);
      expect(response.body.error.message).toContain("file_id");
    });

    it("should return 422 when required field recipient_email is missing", async () => {
      const token = generateToken(testUserEmail);
      const invalidRequest = { ...validShareRequest };
      delete (invalidRequest as any).recipient_email;

      const response = await request(app)
        .post("/api/shared-files")
        .set("Cookie", [
          `zerodrive_token=${token}`,
          `zerodrive_csrf=${csrfToken}`,
        ])
        .set("x-csrf-token", csrfToken)
        .send(invalidRequest);

      expect(response.status).toBe(422);
      expect(response.body.error.message).toContain("recipient_email");
    });

    it("should return 422 when required field encrypted_file_key is missing", async () => {
      const token = generateToken(testUserEmail);
      const invalidRequest = { ...validShareRequest };
      delete (invalidRequest as any).encrypted_file_key;

      const response = await request(app)
        .post("/api/shared-files")
        .set("Cookie", [
          `zerodrive_token=${token}`,
          `zerodrive_csrf=${csrfToken}`,
        ])
        .set("x-csrf-token", csrfToken)
        .send(invalidRequest);

      expect(response.status).toBe(422);
      expect(response.body.error.message).toContain("encrypted_file_key");
    });

    it("should reject an unversioned wrapped file key", async () => {
      const token = generateToken(testUserEmail);
      const response = await request(app)
        .post("/api/shared-files")
        .set("Cookie", [
          `zerodrive_token=${token}`,
          `zerodrive_csrf=${csrfToken}`,
        ])
        .set("x-csrf-token", csrfToken)
        .send({
          ...validShareRequest,
          encrypted_file_key: "opaque-unversioned-value",
        });

      expect(response.status).toBe(422);
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it("should return 422 when encrypted metadata is missing", async () => {
      const token = generateToken(testUserEmail);
      const invalidRequest = { ...validShareRequest };
      delete (invalidRequest as any).encrypted_metadata;

      const response = await request(app)
        .post("/api/shared-files")
        .set("Cookie", [
          `zerodrive_token=${token}`,
          `zerodrive_csrf=${csrfToken}`,
        ])
        .set("x-csrf-token", csrfToken)
        .send(invalidRequest);

      expect(response.status).toBe(422);
      expect(response.body.error.message).toContain("encrypted_metadata");
    });

    it("should return 422 when required field file_size is missing", async () => {
      const token = generateToken(testUserEmail);
      const invalidRequest = { ...validShareRequest };
      delete (invalidRequest as any).file_size;

      const response = await request(app)
        .post("/api/shared-files")
        .set("Cookie", [
          `zerodrive_token=${token}`,
          `zerodrive_csrf=${csrfToken}`,
        ])
        .set("x-csrf-token", csrfToken)
        .send(invalidRequest);

      expect(response.status).toBe(422);
      expect(response.body.error.message).toContain("file_size");
    });

    it("rejects plaintext filename and MIME metadata", async () => {
      const token = generateToken(testUserEmail);
      const invalidRequest = {
        ...validShareRequest,
        file_name: "secret.pdf",
        mime_type: "application/pdf",
      };

      const response = await request(app)
        .post("/api/shared-files")
        .set("Cookie", [
          `zerodrive_token=${token}`,
          `zerodrive_csrf=${csrfToken}`,
        ])
        .set("x-csrf-token", csrfToken)
        .send(invalidRequest);

      expect(response.status).toBe(422);
      expect(response.body.error.message).toContain("not allowed");
    });

    it("should return 422 when file_size is negative", async () => {
      const token = generateToken(testUserEmail);
      const invalidRequest = {
        ...validShareRequest,
        file_size: -100,
      };

      const response = await request(app)
        .post("/api/shared-files")
        .set("Cookie", [
          `zerodrive_token=${token}`,
          `zerodrive_csrf=${csrfToken}`,
        ])
        .set("x-csrf-token", csrfToken)
        .send(invalidRequest);

      expect(response.status).toBe(422);
    });

    it("should return 422 when file_size is not an integer", async () => {
      const token = generateToken(testUserEmail);
      const invalidRequest = {
        ...validShareRequest,
        file_size: 1024.5,
      };

      const response = await request(app)
        .post("/api/shared-files")
        .set("Cookie", [
          `zerodrive_token=${token}`,
          `zerodrive_csrf=${csrfToken}`,
        ])
        .set("x-csrf-token", csrfToken)
        .send(invalidRequest);

      expect(response.status).toBe(422);
    });

    it("should return 422 when access_type is invalid", async () => {
      const token = generateToken(testUserEmail);
      const invalidRequest = {
        ...validShareRequest,
        access_type: "invalid-type",
      };

      const response = await request(app)
        .post("/api/shared-files")
        .set("Cookie", [
          `zerodrive_token=${token}`,
          `zerodrive_csrf=${csrfToken}`,
        ])
        .set("x-csrf-token", csrfToken)
        .send(invalidRequest);

      expect(response.status).toBe(422);
    });

    it("should return 422 when recipient_email format is invalid", async () => {
      const token = generateToken(testUserEmail);
      const invalidRequest = {
        ...validShareRequest,
        recipient_email: "not-an-email",
      };

      const response = await request(app)
        .post("/api/shared-files")
        .set("Cookie", [
          `zerodrive_token=${token}`,
          `zerodrive_csrf=${csrfToken}`,
        ])
        .set("x-csrf-token", csrfToken)
        .send(invalidRequest);

      expect(response.status).toBe(422);
    });

    it("should return 422 when custom_message exceeds max length", async () => {
      const token = generateToken(testUserEmail);
      const invalidRequest = {
        ...validShareRequest,
        custom_message: "a".repeat(501), // Max is 500
      };

      const response = await request(app)
        .post("/api/shared-files")
        .set("Cookie", [
          `zerodrive_token=${token}`,
          `zerodrive_csrf=${csrfToken}`,
        ])
        .set("x-csrf-token", csrfToken)
        .send(invalidRequest);

      expect(response.status).toBe(422);
    });

    it("should return 422 when expires_at is not valid ISO date", async () => {
      const token = generateToken(testUserEmail);
      const invalidRequest = {
        ...validShareRequest,
        expires_at: "not-a-date",
      };

      const response = await request(app)
        .post("/api/shared-files")
        .set("Cookie", [
          `zerodrive_token=${token}`,
          `zerodrive_csrf=${csrfToken}`,
        ])
        .set("x-csrf-token", csrfToken)
        .send(invalidRequest);

      expect(response.status).toBe(422);
    });

    it("shares a file with no credit checks at all (credits removed)", async () => {
      const token = generateToken(testUserEmail);

      // Mock check for existing share (none found)
      mockQuery.mockResolvedValueOnce({ rows: [] });

      // Mock insert
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: "share-uuid-nocredit",
            ...validShareRequest,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      });

      const response = await request(app)
        .post("/api/shared-files")
        .set("Cookie", [
          `zerodrive_token=${token}`,
          `zerodrive_csrf=${csrfToken}`,
        ])
        .set("x-csrf-token", csrfToken)
        .send(validShareRequest);

      expect(response.status).toBe(201);
      expect(response.body.data).toBeDefined();
    });

    it("should return 409 when file is already shared with recipient", async () => {
      const token = generateToken(testUserEmail);

      // Mock existing share found
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: "existing-share-id" }],
      });

      const response = await request(app)
        .post("/api/shared-files")
        .set("Cookie", [
          `zerodrive_token=${token}`,
          `zerodrive_csrf=${csrfToken}`,
        ])
        .set("x-csrf-token", csrfToken)
        .send(validShareRequest);

      expect(response.status).toBe(409);
      expect(response.body.error.message).toContain("capability collision");
    });

    it("should return 500 on database error during share check", async () => {
      const token = generateToken(testUserEmail);
      mockQuery.mockRejectedValueOnce(new Error("Database connection failed"));

      const response = await request(app)
        .post("/api/shared-files")
        .set("Cookie", [
          `zerodrive_token=${token}`,
          `zerodrive_csrf=${csrfToken}`,
        ])
        .set("x-csrf-token", csrfToken)
        .send(validShareRequest);

      expect(response.status).toBe(500);
      expect(response.body.error.message).toContain("Failed to share file");
    });

    it("should return 500 on database error during insert", async () => {
      const token = generateToken(testUserEmail);
      mockQuery.mockResolvedValueOnce({ rows: [] }); // No existing share
      mockQuery.mockRejectedValueOnce(new Error("Insert failed"));

      const response = await request(app)
        .post("/api/shared-files")
        .set("Cookie", [
          `zerodrive_token=${token}`,
          `zerodrive_csrf=${csrfToken}`,
        ])
        .set("x-csrf-token", csrfToken)
        .send(validShareRequest);

      expect(response.status).toBe(500);
    });

    it("should handle email sending failure gracefully", async () => {
      const token = generateToken(testUserEmail);

      mockQuery.mockResolvedValueOnce({ rows: [] });
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: "share-uuid-123", ...validShareRequest }],
      });
      mockSendFileShareNotification.mockRejectedValueOnce(
        new Error("Email service down"),
      );

      const response = await request(app)
        .post("/api/shared-files")
        .set("Cookie", [
          `zerodrive_token=${token}`,
          `zerodrive_csrf=${csrfToken}`,
        ])
        .set("x-csrf-token", csrfToken)
        .send(validShareRequest);

      // Should still succeed even if email fails
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it("should default access_type to view when not specified", async () => {
      const token = generateToken(testUserEmail);
      const requestWithoutAccessType = { ...validShareRequest };
      delete (requestWithoutAccessType as any).access_type;

      mockQuery.mockResolvedValueOnce({ rows: [] });
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: "share-uuid-123",
            ...requestWithoutAccessType,
            access_type: "view",
          },
        ],
      });

      const response = await request(app)
        .post("/api/shared-files")
        .set("Cookie", [
          `zerodrive_token=${token}`,
          `zerodrive_csrf=${csrfToken}`,
        ])
        .set("x-csrf-token", csrfToken)
        .send(requestWithoutAccessType);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it("should handle analytics tracking failure gracefully", async () => {
      const token = generateToken(testUserEmail);
      mockQuery.mockResolvedValueOnce({ rows: [] });
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: "share-uuid-123", ...validShareRequest }],
      });
      mockTrackEvent.mockRejectedValueOnce(new Error("Analytics service down"));

      const response = await request(app)
        .post("/api/shared-files")
        .set("Cookie", [
          `zerodrive_token=${token}`,
          `zerodrive_csrf=${csrfToken}`,
        ])
        .set("x-csrf-token", csrfToken)
        .send(validShareRequest);

      // Should still succeed even if analytics fails
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });
  });

  describe("POST /api/shared-files/:id/finalize", () => {
    const id = "550e8400-e29b-41d4-a716-446655440000";
    const capability = "finalize-capability";
    const capabilityHash = crypto
      .createHash("sha256")
      .update(capability)
      .digest("hex");

    it("activates a pending share only after storage size verification", async () => {
      const token = generateToken(testUserEmail);
      const pending = {
        id,
        file_id: "shared/opaque-id",
        status: "pending",
        expected_encrypted_size: 1052,
        management_capability_hash: capabilityHash,
      };
      mockQuery
        .mockResolvedValueOnce({ rows: [pending] })
        .mockResolvedValueOnce({ rows: [{ ...pending, status: "active" }] });
      mockS3Send.mockResolvedValueOnce({ ContentLength: 1052 });

      const response = await request(app)
        .post(`/api/shared-files/${id}/finalize`)
        .set("Cookie", [
          `zerodrive_token=${token}`,
          `zerodrive_csrf=${csrfToken}`,
        ])
        .set("x-csrf-token", csrfToken)
        .set("x-share-capability", capability)
        .expect(200);

      expect(response.body.data.status).toBe("active");
      expect(mockQuery).toHaveBeenLastCalledWith(
        expect.stringContaining("SET status = 'active'"),
        [id],
      );
      expect(mockTrackEvent).toHaveBeenCalledWith("share_finalized", "sharing");
    });

    it("keeps a size-mismatched upload pending", async () => {
      const token = generateToken(testUserEmail);
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id,
            file_id: "shared/opaque-id",
            status: "pending",
            expected_encrypted_size: 1052,
            management_capability_hash: capabilityHash,
          },
        ],
      });
      mockS3Send.mockResolvedValueOnce({ ContentLength: 999 });

      await request(app)
        .post(`/api/shared-files/${id}/finalize`)
        .set("Cookie", [
          `zerodrive_token=${token}`,
          `zerodrive_csrf=${csrfToken}`,
        ])
        .set("x-csrf-token", csrfToken)
        .set("x-share-capability", capability)
        .expect(409);

      expect(mockQuery).toHaveBeenCalledTimes(1);
    });
  });

  describe("GET /api/shared-files", () => {
    it("should retrieve shared files for recipient with pagination", async () => {
      const token = generateToken(testUserEmail);
      const mockSharedFiles = [
        {
          id: "share-1",
          file_id: "file-1",
          recipient_user_id: testRecipientEmailHash,
          encrypted_file_key: "key-1",
          file_name: "doc1.pdf",
          file_size: 1024,
          mime_type: "application/pdf",
          access_type: "view",
          created_at: new Date(),
        },
        {
          id: "share-2",
          file_id: "file-2",
          recipient_user_id: testRecipientEmailHash,
          encrypted_file_key: "key-2",
          file_name: "doc2.pdf",
          file_size: 2048,
          mime_type: "application/pdf",
          access_type: "download",
          created_at: new Date(),
        },
      ];

      // Mock count query - total of 100 files
      mockQuery.mockResolvedValueOnce({
        rows: [{ count: "100" }],
      });

      // Mock files query - returns 2 files (first page with default limit 50)
      mockQuery.mockResolvedValueOnce({
        rows: mockSharedFiles,
      });

      const response = await request(app)
        .get("/api/shared-files")
        .query({
          limit: 2,
          offset: 0,
        })
        .set("Cookie", [`zerodrive_token=${token}`]);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.files).toHaveLength(2);
      expect(response.body.data.total).toBe(100);
      expect(response.body.data.hasMore).toBe(true); // 0 + 2 < 100, so hasMore = true
      expect(response.body.message).toBe("Shared files retrieved successfully");
    });

    it("should use default pagination values when not specified", async () => {
      const token = generateToken(testUserEmail);
      mockQuery.mockResolvedValueOnce({ rows: [{ count: "0" }] });
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get("/api/shared-files")
        .set("Cookie", [`zerodrive_token=${token}`]);

      expect(response.status).toBe(200);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        [[authenticatedUserHash, expect.any(String)], 50, 0], // Current HMAC plus legacy identifier
      );
    });

    it("should respect custom limit and offset", async () => {
      const token = generateToken(testUserEmail);
      mockQuery.mockResolvedValueOnce({ rows: [{ count: "100" }] });
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get("/api/shared-files")
        .query({
          limit: 20,
          offset: 40,
        })
        .set("Cookie", [`zerodrive_token=${token}`]);

      expect(response.status).toBe(200);
      expect(mockQuery).toHaveBeenCalledWith(expect.any(String), [
        [authenticatedUserHash, expect.any(String)],
        20,
        40,
      ]);
    });

    it("should filter out expired files", async () => {
      const token = generateToken(testUserEmail);
      mockQuery.mockResolvedValueOnce({ rows: [{ count: "1" }] });
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await request(app)
        .get("/api/shared-files")
        .set("Cookie", [`zerodrive_token=${token}`]);

      // Verify query includes expiration filter
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining(
          "expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP",
        ),
        expect.any(Array),
      );
    });

    it("should return 401 when no auth cookie provided", async () => {
      const response = await request(app).get("/api/shared-files");

      expect(response.status).toBe(401);
    });

    it("should derive recipient identity without a query parameter", async () => {
      const token = generateToken(testUserEmail);
      mockQuery.mockResolvedValueOnce({ rows: [{ count: "0" }] });
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get("/api/shared-files")
        .set("Cookie", [`zerodrive_token=${token}`]);

      expect(response.status).toBe(200);
      expect(mockQuery).toHaveBeenCalledWith(expect.any(String), [
        [authenticatedUserHash, expect.any(String)],
      ]);
    });

    it("should return 422 when limit exceeds maximum", async () => {
      const token = generateToken(testUserEmail);

      const response = await request(app)
        .get("/api/shared-files")
        .query({ limit: 101 })
        .set("Cookie", [`zerodrive_token=${token}`]);

      expect(response.status).toBe(422);
    });

    it("should return 422 when limit is less than 1", async () => {
      const token = generateToken(testUserEmail);

      const response = await request(app)
        .get("/api/shared-files")
        .query({ limit: 0 })
        .set("Cookie", [`zerodrive_token=${token}`]);

      expect(response.status).toBe(422);
    });

    it("should return 422 when offset is negative", async () => {
      const token = generateToken(testUserEmail);

      const response = await request(app)
        .get("/api/shared-files")
        .query({ offset: -1 })
        .set("Cookie", [`zerodrive_token=${token}`]);

      expect(response.status).toBe(422);
    });

    it("should return empty array when no files found", async () => {
      const token = generateToken(testUserEmail);
      mockQuery.mockResolvedValueOnce({ rows: [{ count: "0" }] });
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get("/api/shared-files")
        .set("Cookie", [`zerodrive_token=${token}`]);

      expect(response.status).toBe(200);
      expect(response.body.data.files).toEqual([]);
      expect(response.body.data.total).toBe(0);
      expect(response.body.data.hasMore).toBe(false);
    });

    it("should return 500 on database error", async () => {
      const token = generateToken(testUserEmail);
      mockQuery.mockRejectedValueOnce(new Error("Database connection failed"));

      const response = await request(app)
        .get("/api/shared-files")
        .set("Cookie", [`zerodrive_token=${token}`]);

      expect(response.status).toBe(500);
      expect(response.body.error.message).toContain(
        "Failed to retrieve shared files",
      );
    });

    it("should calculate hasMore correctly when on last page", async () => {
      const token = generateToken(testUserEmail);
      mockQuery.mockResolvedValueOnce({ rows: [{ count: "50" }] });
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get("/api/shared-files")
        .query({
          limit: 50,
          offset: 0,
        })
        .set("Cookie", [`zerodrive_token=${token}`]);

      expect(response.status).toBe(200);
      expect(response.body.data.hasMore).toBe(false);
    });
  });

  describe("GET /api/shared-files/:id", () => {
    const validUuid = "550e8400-e29b-41d4-a716-446655440000";

    it("should retrieve specific shared file when exists and not expired", async () => {
      const token = generateToken(testUserEmail);
      const mockSharedFile = {
        id: validUuid,
        file_id: "file-123",
        recipient_user_id: testRecipientEmailHash,
        encrypted_file_key: "key-data",
        file_name: "document.pdf",
        file_size: 1024,
        mime_type: "application/pdf",
        access_type: "view",
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockQuery.mockResolvedValueOnce({
        rows: [mockSharedFile],
      });

      const response = await request(app)
        .get(`/api/shared-files/${validUuid}`)
        .set("Cookie", [`zerodrive_token=${token}`]);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(validUuid);
      expect(response.body.message).toBe("Shared file retrieved successfully");
      expect(mockQuery).toHaveBeenCalledWith(expect.any(String), [
        validUuid,
        expect.arrayContaining([authenticatedUserHash]),
      ]);
    });

    it("should return 401 when no auth cookie provided", async () => {
      const response = await request(app).get(`/api/shared-files/${validUuid}`);

      expect(response.status).toBe(401);
    });

    it("should return 422 when id is not valid UUID", async () => {
      const token = generateToken(testUserEmail);

      const response = await request(app)
        .get("/api/shared-files/not-a-uuid")
        .set("Cookie", [`zerodrive_token=${token}`]);

      expect(response.status).toBe(422);
      expect(response.body.error.message).toContain("must be a valid GUID");
    });

    it("should return 404 when shared file not found", async () => {
      const token = generateToken(testUserEmail);
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get(`/api/shared-files/${validUuid}`)
        .set("Cookie", [`zerodrive_token=${token}`]);

      expect(response.status).toBe(404);
      expect(response.body.error.message).toContain("not found or has expired");
    });

    it("should return 404 when shared file is expired", async () => {
      const token = generateToken(testUserEmail);
      // Query returns empty because it filters expired files
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get(`/api/shared-files/${validUuid}`)
        .set("Cookie", [`zerodrive_token=${token}`]);

      expect(response.status).toBe(404);
    });

    it("should return 500 on database error", async () => {
      const token = generateToken(testUserEmail);
      mockQuery.mockRejectedValueOnce(new Error("Database connection failed"));

      const response = await request(app)
        .get(`/api/shared-files/${validUuid}`)
        .set("Cookie", [`zerodrive_token=${token}`]);

      expect(response.status).toBe(500);
      expect(response.body.error.message).toContain(
        "Failed to retrieve shared file",
      );
    });

    it("should handle malformed UUID gracefully", async () => {
      const token = generateToken(testUserEmail);

      const response = await request(app)
        .get("/api/shared-files/550e8400-invalid")
        .set("Cookie", [`zerodrive_token=${token}`]);

      expect(response.status).toBe(422);
    });
  });

  describe("PUT /api/shared-files/:id", () => {
    const validUuid = "550e8400-e29b-41d4-a716-446655440000";

    it("should update access_type successfully", async () => {
      const token = generateToken(testUserEmail);
      const updateRequest = {
        access_type: "download",
      };

      // Mock existing file check
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: validUuid,
            file_id: "file-123",
            access_type: "view",
          },
        ],
      });

      // Mock update
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: validUuid,
            file_id: "file-123",
            access_type: "download",
            updated_at: new Date(),
          },
        ],
      });

      const response = await request(app)
        .put(`/api/shared-files/${validUuid}`)
        .set("Cookie", [
          `zerodrive_token=${token}`,
          `zerodrive_csrf=${csrfToken}`,
        ])
        .set("x-csrf-token", csrfToken)
        .send(updateRequest);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.access_type).toBe("download");
      expect(response.body.message).toBe("Shared file updated successfully");
    });

    it("should update expires_at successfully", async () => {
      const token = generateToken(testUserEmail);
      const newExpiryDate = new Date(
        Date.now() + 14 * 24 * 60 * 60 * 1000,
      ).toISOString();
      const updateRequest = {
        expires_at: newExpiryDate,
      };

      mockQuery.mockResolvedValueOnce({
        rows: [{ id: validUuid, expires_at: null }],
      });
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: validUuid, expires_at: newExpiryDate }],
      });

      const response = await request(app)
        .put(`/api/shared-files/${validUuid}`)
        .set("Cookie", [
          `zerodrive_token=${token}`,
          `zerodrive_csrf=${csrfToken}`,
        ])
        .set("x-csrf-token", csrfToken)
        .send(updateRequest);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it("should update both access_type and expires_at", async () => {
      const token = generateToken(testUserEmail);
      const newExpiryDate = new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000,
      ).toISOString();
      const updateRequest = {
        access_type: "download",
        expires_at: newExpiryDate,
      };

      mockQuery.mockResolvedValueOnce({
        rows: [{ id: validUuid }],
      });
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: validUuid,
            access_type: "download",
            expires_at: newExpiryDate,
          },
        ],
      });

      const response = await request(app)
        .put(`/api/shared-files/${validUuid}`)
        .set("Cookie", [
          `zerodrive_token=${token}`,
          `zerodrive_csrf=${csrfToken}`,
        ])
        .set("x-csrf-token", csrfToken)
        .send(updateRequest);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it("should allow setting expires_at to null", async () => {
      const token = generateToken(testUserEmail);
      const updateRequest = {
        expires_at: null,
      };

      mockQuery.mockResolvedValueOnce({
        rows: [{ id: validUuid }],
      });
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: validUuid, expires_at: null }],
      });

      const response = await request(app)
        .put(`/api/shared-files/${validUuid}`)
        .set("Cookie", [
          `zerodrive_token=${token}`,
          `zerodrive_csrf=${csrfToken}`,
        ])
        .set("x-csrf-token", csrfToken)
        .send(updateRequest);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it("should return 401 when no auth cookie provided", async () => {
      const response = await request(app)
        .put(`/api/shared-files/${validUuid}`)
        .send({ access_type: "download" });

      expect(response.status).toBe(401);
    });

    it("should return 403 when CSRF token missing", async () => {
      const token = generateToken(testUserEmail);

      const response = await request(app)
        .put(`/api/shared-files/${validUuid}`)
        .set("Cookie", [`zerodrive_token=${token}`])
        .send({ access_type: "download" });

      expect(response.status).toBe(403);
    });

    it("should return 422 when id is not valid UUID", async () => {
      const token = generateToken(testUserEmail);

      const response = await request(app)
        .put("/api/shared-files/not-a-uuid")
        .set("Cookie", [
          `zerodrive_token=${token}`,
          `zerodrive_csrf=${csrfToken}`,
        ])
        .set("x-csrf-token", csrfToken)
        .send({ access_type: "download" });

      expect(response.status).toBe(422);
    });

    it("should return 422 when access_type is invalid", async () => {
      const token = generateToken(testUserEmail);

      const response = await request(app)
        .put(`/api/shared-files/${validUuid}`)
        .set("Cookie", [
          `zerodrive_token=${token}`,
          `zerodrive_csrf=${csrfToken}`,
        ])
        .set("x-csrf-token", csrfToken)
        .send({ access_type: "invalid-type" });

      expect(response.status).toBe(422);
    });

    it("should return 400 when no valid fields to update", async () => {
      const token = generateToken(testUserEmail);
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: validUuid }],
      });

      const response = await request(app)
        .put(`/api/shared-files/${validUuid}`)
        .set("Cookie", [
          `zerodrive_token=${token}`,
          `zerodrive_csrf=${csrfToken}`,
        ])
        .set("x-csrf-token", csrfToken)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain(
        "No valid fields to update",
      );
    });

    it("should return 404 when shared file not found", async () => {
      const token = generateToken(testUserEmail);
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .put(`/api/shared-files/${validUuid}`)
        .set("Cookie", [
          `zerodrive_token=${token}`,
          `zerodrive_csrf=${csrfToken}`,
        ])
        .set("x-csrf-token", csrfToken)
        .send({ access_type: "download" });

      expect(response.status).toBe(404);
      expect(response.body.error.message).toContain("not found");
    });

    it("should return 500 on database error", async () => {
      const token = generateToken(testUserEmail);
      mockQuery.mockRejectedValueOnce(new Error("Database connection failed"));

      const response = await request(app)
        .put(`/api/shared-files/${validUuid}`)
        .set("Cookie", [
          `zerodrive_token=${token}`,
          `zerodrive_csrf=${csrfToken}`,
        ])
        .set("x-csrf-token", csrfToken)
        .send({ access_type: "download" });

      expect(response.status).toBe(500);
      expect(response.body.error.message).toContain(
        "Failed to update shared file",
      );
    });
  });

  describe("DELETE /api/shared-files/:id", () => {
    const validUuid = "550e8400-e29b-41d4-a716-446655440000";

    it("should delete shared file successfully", async () => {
      const token = generateToken(testUserEmail);
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ id: validUuid, file_id: "shared/legacy-object" }],
        })
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rowCount: 1 });

      const response = await request(app)
        .delete(`/api/shared-files/${validUuid}`)
        .set("Cookie", [
          `zerodrive_token=${token}`,
          `zerodrive_csrf=${csrfToken}`,
        ])
        .set("x-csrf-token", csrfToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.deleted).toBe(true);
      expect(response.body.message).toBe("File sharing revoked successfully");
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("management_capability_hash IS NULL"),
        [validUuid, [authenticatedUserHash, expect.any(String)]],
      );
      expect(mockTrackEvent).toHaveBeenCalledWith("share_revoked", "sharing");
    });

    it("revokes a new share using only its anonymous capability", async () => {
      const token = generateToken(testUserEmail);
      const capability = "anonymous-management-secret";
      const capabilityHash = crypto
        .createHash("sha256")
        .update(capability)
        .digest("hex");
      mockQuery
        .mockResolvedValueOnce({
          rows: [
            {
              id: validUuid,
              file_id: "shared/opaque-object",
              management_capability_hash: capabilityHash,
            },
          ],
        })
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rowCount: 1 });

      await request(app)
        .delete(`/api/shared-files/${validUuid}`)
        .set("Cookie", [
          `zerodrive_token=${token}`,
          `zerodrive_csrf=${csrfToken}`,
        ])
        .set("x-csrf-token", csrfToken)
        .set("x-share-capability", capability)
        .expect(200);

      expect(mockQuery).toHaveBeenLastCalledWith(
        "DELETE FROM shared_files WHERE id = $1",
        [validUuid],
      );
    });

    it("rejects an incorrect anonymous capability", async () => {
      const token = generateToken(testUserEmail);
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: validUuid,
            management_capability_hash: "a".repeat(64),
          },
        ],
      });

      await request(app)
        .delete(`/api/shared-files/${validUuid}`)
        .set("Cookie", [
          `zerodrive_token=${token}`,
          `zerodrive_csrf=${csrfToken}`,
        ])
        .set("x-csrf-token", csrfToken)
        .set("x-share-capability", "wrong-capability")
        .expect(403);

      expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    it("keeps a deleting row for retry when object removal fails", async () => {
      const token = generateToken(testUserEmail);
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ id: validUuid, file_id: "shared/retry-object" }],
        })
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rowCount: 1 });
      mockS3Send.mockRejectedValueOnce(new Error("MinIO unavailable"));

      await request(app)
        .delete(`/api/shared-files/${validUuid}`)
        .set("Cookie", [
          `zerodrive_token=${token}`,
          `zerodrive_csrf=${csrfToken}`,
        ])
        .set("x-csrf-token", csrfToken)
        .expect(503);

      expect(mockQuery).toHaveBeenLastCalledWith(
        expect.stringContaining("deletion_attempts = deletion_attempts + 1"),
        [validUuid, "OBJECT_DELETE_FAILED"],
      );
      expect(mockQuery).not.toHaveBeenCalledWith(
        "DELETE FROM shared_files WHERE id = $1",
        [validUuid],
      );
    });

    it("should return 401 when no auth cookie provided", async () => {
      const response = await request(app).delete(
        `/api/shared-files/${validUuid}`,
      );

      expect(response.status).toBe(401);
    });

    it("should return 403 when CSRF token missing", async () => {
      const token = generateToken(testUserEmail);

      const response = await request(app)
        .delete(`/api/shared-files/${validUuid}`)
        .set("Cookie", [`zerodrive_token=${token}`]);

      expect(response.status).toBe(403);
    });

    it("should return 403 when CSRF tokens do not match", async () => {
      const token = generateToken(testUserEmail);

      const response = await request(app)
        .delete(`/api/shared-files/${validUuid}`)
        .set("Cookie", [
          `zerodrive_token=${token}`,
          `zerodrive_csrf=${csrfToken}`,
        ])
        .set("x-csrf-token", "wrong-csrf-token");

      expect(response.status).toBe(403);
    });

    it("should return 422 when id is not valid UUID", async () => {
      const token = generateToken(testUserEmail);

      const response = await request(app)
        .delete("/api/shared-files/not-a-uuid")
        .set("Cookie", [
          `zerodrive_token=${token}`,
          `zerodrive_csrf=${csrfToken}`,
        ])
        .set("x-csrf-token", csrfToken);

      expect(response.status).toBe(422);
    });

    it("should return 404 when shared file not found", async () => {
      const token = generateToken(testUserEmail);
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .delete(`/api/shared-files/${validUuid}`)
        .set("Cookie", [
          `zerodrive_token=${token}`,
          `zerodrive_csrf=${csrfToken}`,
        ])
        .set("x-csrf-token", csrfToken);

      expect(response.status).toBe(404);
      expect(response.body.error.message).toContain("not found");
    });

    it("should handle double deletion gracefully", async () => {
      const token = generateToken(testUserEmail);

      // First deletion succeeds
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ id: validUuid, file_id: "shared/legacy-object" }],
        })
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rowCount: 1 });
      const response1 = await request(app)
        .delete(`/api/shared-files/${validUuid}`)
        .set("Cookie", [
          `zerodrive_token=${token}`,
          `zerodrive_csrf=${csrfToken}`,
        ])
        .set("x-csrf-token", csrfToken);
      expect(response1.status).toBe(200);

      // Second deletion fails (already deleted)
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const response2 = await request(app)
        .delete(`/api/shared-files/${validUuid}`)
        .set("Cookie", [
          `zerodrive_token=${token}`,
          `zerodrive_csrf=${csrfToken}`,
        ])
        .set("x-csrf-token", csrfToken);
      expect(response2.status).toBe(404);
    });

    it("should return 500 on database error", async () => {
      const token = generateToken(testUserEmail);
      mockQuery.mockRejectedValueOnce(new Error("Database connection failed"));

      const response = await request(app)
        .delete(`/api/shared-files/${validUuid}`)
        .set("Cookie", [
          `zerodrive_token=${token}`,
          `zerodrive_csrf=${csrfToken}`,
        ])
        .set("x-csrf-token", csrfToken);

      expect(response.status).toBe(500);
      expect(response.body.error.message).toContain(
        "Failed to revoke file sharing",
      );
    });
  });

  describe("credit endpoints removed", () => {
    it("GET /api/credits/balance/:userId returns 404 (route unmounted)", async () => {
      const token = generateToken(testUserEmail);
      const res = await request(app)
        .get("/api/credits/balance/some-user")
        .set("Cookie", [`zerodrive_token=${token}`]);
      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/shared-files/:id/access", () => {
    const validUuid = "550e8400-e29b-41d4-a716-446655440000";

    it("should record file access successfully", async () => {
      const token = generateToken(testUserEmail);
      const mockSharedFile = {
        id: validUuid,
        file_id: "file-123",
        file_name: "document.pdf",
      };

      // Mock file exists check
      mockQuery.mockResolvedValueOnce({
        rows: [mockSharedFile],
      });

      // Mock update last_accessed_at
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });

      const response = await request(app)
        .post(`/api/shared-files/${validUuid}/access`)
        .set("Cookie", [
          `zerodrive_token=${token}`,
          `zerodrive_csrf=${csrfToken}`,
        ])
        .set("x-csrf-token", csrfToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.recorded).toBe(true);
      expect(response.body.message).toBe("File access recorded successfully");

      // Verify update was called
      expect(mockQuery).toHaveBeenCalledWith(
        "UPDATE shared_files SET last_accessed_at = CURRENT_TIMESTAMP WHERE id = $1",
        [validUuid],
      );
    });

    it("should return 401 when no auth cookie provided", async () => {
      const response = await request(app).post(
        `/api/shared-files/${validUuid}/access`,
      );

      expect(response.status).toBe(401);
    });

    it("should return 403 when CSRF token missing", async () => {
      const token = generateToken(testUserEmail);

      const response = await request(app)
        .post(`/api/shared-files/${validUuid}/access`)
        .set("Cookie", [`zerodrive_token=${token}`]);

      expect(response.status).toBe(403);
    });

    it("should return 422 when id is not valid UUID", async () => {
      const token = generateToken(testUserEmail);

      const response = await request(app)
        .post("/api/shared-files/not-a-uuid/access")
        .set("Cookie", [
          `zerodrive_token=${token}`,
          `zerodrive_csrf=${csrfToken}`,
        ])
        .set("x-csrf-token", csrfToken);

      expect(response.status).toBe(422);
    });

    it("should return 404 when shared file not found", async () => {
      const token = generateToken(testUserEmail);
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post(`/api/shared-files/${validUuid}/access`)
        .set("Cookie", [
          `zerodrive_token=${token}`,
          `zerodrive_csrf=${csrfToken}`,
        ])
        .set("x-csrf-token", csrfToken);

      expect(response.status).toBe(404);
      expect(response.body.error.message).toContain("not found or has expired");
    });

    it("should return 404 when shared file is expired", async () => {
      const token = generateToken(testUserEmail);
      // Query returns empty because file is expired
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post(`/api/shared-files/${validUuid}/access`)
        .set("Cookie", [
          `zerodrive_token=${token}`,
          `zerodrive_csrf=${csrfToken}`,
        ])
        .set("x-csrf-token", csrfToken);

      expect(response.status).toBe(404);
    });

    it("should filter expired files in query", async () => {
      const token = generateToken(testUserEmail);
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await request(app)
        .post(`/api/shared-files/${validUuid}/access`)
        .set("Cookie", [
          `zerodrive_token=${token}`,
          `zerodrive_csrf=${csrfToken}`,
        ])
        .set("x-csrf-token", csrfToken);

      // Verify query includes expiration filter
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining(
          "expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP",
        ),
        expect.any(Array),
      );
    });

    it("should return 500 on database error during file check", async () => {
      const token = generateToken(testUserEmail);
      mockQuery.mockRejectedValueOnce(new Error("Database connection failed"));

      const response = await request(app)
        .post(`/api/shared-files/${validUuid}/access`)
        .set("Cookie", [
          `zerodrive_token=${token}`,
          `zerodrive_csrf=${csrfToken}`,
        ])
        .set("x-csrf-token", csrfToken);

      expect(response.status).toBe(500);
      expect(response.body.error.message).toContain(
        "Failed to record file access",
      );
    });

    it("should return 500 on database error during update", async () => {
      const token = generateToken(testUserEmail);
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: validUuid }],
      });
      mockQuery.mockRejectedValueOnce(new Error("Update failed"));

      const response = await request(app)
        .post(`/api/shared-files/${validUuid}/access`)
        .set("Cookie", [
          `zerodrive_token=${token}`,
          `zerodrive_csrf=${csrfToken}`,
        ])
        .set("x-csrf-token", csrfToken);

      expect(response.status).toBe(500);
    });

    it("should handle multiple access recordings", async () => {
      const token = generateToken(testUserEmail);

      // First access
      mockQuery.mockResolvedValueOnce({ rows: [{ id: validUuid }] });
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });

      const response1 = await request(app)
        .post(`/api/shared-files/${validUuid}/access`)
        .set("Cookie", [
          `zerodrive_token=${token}`,
          `zerodrive_csrf=${csrfToken}`,
        ])
        .set("x-csrf-token", csrfToken);
      expect(response1.status).toBe(200);

      // Second access
      mockQuery.mockResolvedValueOnce({ rows: [{ id: validUuid }] });
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });

      const response2 = await request(app)
        .post(`/api/shared-files/${validUuid}/access`)
        .set("Cookie", [
          `zerodrive_token=${token}`,
          `zerodrive_csrf=${csrfToken}`,
        ])
        .set("x-csrf-token", csrfToken);
      expect(response2.status).toBe(200);

      // Both should succeed
      expect(mockQuery).toHaveBeenCalledTimes(4); // 2 checks + 2 updates
    });
  });
});
