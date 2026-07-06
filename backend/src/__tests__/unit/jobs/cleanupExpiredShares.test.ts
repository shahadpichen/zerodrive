import { cleanupExpiredShares } from "../../../jobs/cleanupExpiredShares";
import { query } from "../../../config/database";
import { s3Client } from "../../../config/s3";

jest.mock("../../../config/database");
jest.mock("../../../config/s3", () => ({
  MINIO_BUCKET: "test-bucket",
  s3Client: { send: jest.fn() },
}));
jest.mock("../../../utils/logger", () => ({
  __esModule: true,
  default: { warn: jest.fn() },
}));

describe("share lifecycle cleanup", () => {
  beforeEach(() => jest.clearAllMocks());

  it("removes the row only after object deletion succeeds", async () => {
    (query as jest.Mock)
      .mockResolvedValueOnce({
        rows: [
          {
            id: "share-1",
            file_id: "shared/object-1",
            file_size: 100,
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });
    (s3Client.send as jest.Mock).mockResolvedValue({});

    const result = await cleanupExpiredShares();

    expect(result).toMatchObject({
      success: true,
      deletedCount: 1,
      minioDeletedCount: 1,
      storageFreedBytes: 100,
    });
    expect(query).toHaveBeenLastCalledWith(
      "DELETE FROM shared_files WHERE id = $1 AND status = 'deleting'",
      ["share-1"],
    );
  });

  it("retains failed deletions with retry state", async () => {
    (query as jest.Mock)
      .mockResolvedValueOnce({
        rows: [
          {
            id: "share-1",
            file_id: "shared/object-1",
            file_size: 100,
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });
    (s3Client.send as jest.Mock).mockRejectedValue(
      new Error("storage unavailable"),
    );

    const result = await cleanupExpiredShares();

    expect(result.success).toBe(true);
    expect(result.deletedCount).toBe(0);
    expect(query).toHaveBeenLastCalledWith(
      expect.stringContaining("deletion_attempts = deletion_attempts + 1"),
      ["share-1", "OBJECT_DELETE_FAILED"],
    );
  });
});
