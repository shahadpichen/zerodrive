import {
  GoogleDriveRequestError,
  googleDriveFetch,
} from "../../utils/googleDriveRequest";
import { clearGoogleTokens } from "../../utils/authService";
import { getGoogleAccessToken } from "../../utils/gapiInit";

jest.mock("../../utils/gapiInit", () => ({
  getGoogleAccessToken: jest.fn(),
}));

jest.mock("../../utils/authService", () => ({
  GOOGLE_TOKEN_REFRESH_BUFFER_MS: 120000,
  clearGoogleTokens: jest.fn(),
}));

jest.mock("../../utils/logger", () => ({
  warn: jest.fn(),
}));

global.fetch = jest.fn();

const mockGetGoogleAccessToken = getGoogleAccessToken as jest.MockedFunction<
  typeof getGoogleAccessToken
>;

describe("googleDriveFetch", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("uses a token with a safety buffer before making the Drive request", async () => {
    mockGetGoogleAccessToken.mockResolvedValue("fresh-token");
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
    });

    await googleDriveFetch("https://www.googleapis.com/drive/v3/files", {
      method: "GET",
    });

    expect(mockGetGoogleAccessToken).toHaveBeenCalledWith({
      minValidityMs: 120000,
    });
    expect(global.fetch).toHaveBeenCalledWith(
      "https://www.googleapis.com/drive/v3/files",
      expect.objectContaining({
        method: "GET",
        headers: expect.any(Headers),
      }),
    );
    const headers = (global.fetch as jest.Mock).mock.calls[0][1]
      .headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer fresh-token");
  });

  it("refreshes the Google token and retries once after an auth failure", async () => {
    mockGetGoogleAccessToken
      .mockResolvedValueOnce("expired-token")
      .mockResolvedValueOnce("refreshed-token");
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

    const response = await googleDriveFetch(
      "https://www.googleapis.com/upload/drive/v3/files",
      {
        method: "POST",
        body: new Blob(["encrypted"]),
      },
    );

    expect(response.ok).toBe(true);
    expect(mockGetGoogleAccessToken).toHaveBeenNthCalledWith(2, {
      forceRefresh: true,
      minValidityMs: 120000,
    });
    expect(global.fetch).toHaveBeenCalledTimes(2);
    const retryHeaders = (global.fetch as jest.Mock).mock.calls[1][1]
      .headers as Headers;
    expect(retryHeaders.get("Authorization")).toBe("Bearer refreshed-token");
  });

  it("clears stored Google tokens when the retry cannot get a fresh token", async () => {
    mockGetGoogleAccessToken
      .mockResolvedValueOnce("expired-token")
      .mockResolvedValueOnce(null);
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 401,
    });

    await expect(
      googleDriveFetch("https://www.googleapis.com/drive/v3/files", {
        method: "GET",
      }),
    ).rejects.toThrow(GoogleDriveRequestError);

    expect(clearGoogleTokens).toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("does not retry non-auth Drive failures", async () => {
    mockGetGoogleAccessToken.mockResolvedValue("fresh-token");
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
    });

    const response = await googleDriveFetch(
      "https://www.googleapis.com/drive/v3/files",
      { method: "GET" },
    );

    expect(response.status).toBe(500);
    expect(mockGetGoogleAccessToken).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
