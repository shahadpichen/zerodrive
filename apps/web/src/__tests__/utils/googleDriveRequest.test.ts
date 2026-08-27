import {
  GoogleDriveRequestError,
  googleDriveFetch,
} from "../../utils/googleDriveRequest";
import {
  clearGoogleTokens,
  getOrFetchGoogleToken,
} from "../../utils/authService";

jest.mock("../../utils/authService", () => ({
  GOOGLE_TOKEN_REFRESH_BUFFER_MS: 120000,
  clearGoogleTokens: jest.fn(),
  getOrFetchGoogleToken: jest.fn(),
}));

jest.mock("../../utils/logger", () => ({
  warn: jest.fn(),
}));

global.fetch = jest.fn();

const mockGetOrFetchGoogleToken = getOrFetchGoogleToken as jest.MockedFunction<
  typeof getOrFetchGoogleToken
>;

describe("googleDriveFetch", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("uses a token with a safety buffer before making the Drive request", async () => {
    mockGetOrFetchGoogleToken.mockResolvedValue("fresh-token");
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
    });

    await googleDriveFetch("https://www.googleapis.com/drive/v3/files", {
      method: "GET",
    });

    expect(mockGetOrFetchGoogleToken).toHaveBeenCalledWith({
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
    mockGetOrFetchGoogleToken
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
    expect(mockGetOrFetchGoogleToken).toHaveBeenNthCalledWith(2, {
      forceRefresh: true,
      minValidityMs: 120000,
    });
    expect(global.fetch).toHaveBeenCalledTimes(2);
    const retryHeaders = (global.fetch as jest.Mock).mock.calls[1][1]
      .headers as Headers;
    expect(retryHeaders.get("Authorization")).toBe("Bearer refreshed-token");
  });

  it("clears stored Google tokens when the retry cannot get a fresh token", async () => {
    mockGetOrFetchGoogleToken
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
    mockGetOrFetchGoogleToken.mockResolvedValue("fresh-token");
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
    });

    const response = await googleDriveFetch(
      "https://www.googleapis.com/drive/v3/files",
      { method: "GET" },
    );

    expect(response.status).toBe(500);
    expect(mockGetOrFetchGoogleToken).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("fails a stalled Drive request instead of leaving the vault refresh pending", async () => {
    mockGetOrFetchGoogleToken.mockResolvedValue("fresh-token");
    (global.fetch as jest.Mock).mockImplementation(
      (_input: RequestInfo | URL, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => {
            reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
          });
        }),
    );

    await expect(
      googleDriveFetch(
        "https://www.googleapis.com/drive/v3/files",
        { method: "GET" },
        { timeoutMs: 25 },
      ),
    ).rejects.toMatchObject({
      name: "GoogleDriveRequestError",
      status: 408,
      message: "Google Drive did not respond in time. Retry the operation.",
    });
  });
});
