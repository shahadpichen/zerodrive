import { decryptFile } from "../../utils/decryptFile";
import { decryptFileForPreview, getPreviewType } from "../../utils/filePreview";
import { getStoredKey } from "../../utils/cryptoUtils";
import { googleDriveFetch } from "../../utils/googleDriveRequest";

const mockHeicTo = jest.fn<Promise<Blob>, [Record<string, unknown>]>();

jest.mock(
  "heic-to/csp",
  () => ({
    heicTo: mockHeicTo,
  }),
  { virtual: true },
);
jest.mock("../../utils/decryptFile", () => ({ decryptFile: jest.fn() }));
jest.mock("../../utils/cryptoUtils", () => ({ getStoredKey: jest.fn() }));
jest.mock("../../utils/mnemonicManager", () => ({ hasMnemonic: jest.fn() }));
jest.mock("../../utils/googleDriveRequest", () => ({
  googleDriveFetch: jest.fn(),
}));

const mockDecryptFile = decryptFile as jest.MockedFunction<typeof decryptFile>;
const mockGetStoredKey = getStoredKey as jest.MockedFunction<
  typeof getStoredKey
>;
const mockGoogleDriveFetch = googleDriveFetch as jest.MockedFunction<
  typeof googleDriveFetch
>;

describe("HEIC file previews", () => {
  const originalCreateObjectUrl = URL.createObjectURL;

  beforeEach(() => {
    jest.clearAllMocks();
    URL.createObjectURL = jest.fn(() => "blob:heic-preview");
    mockGetStoredKey.mockResolvedValue({} as CryptoKey);
    mockGoogleDriveFetch.mockResolvedValue({
      ok: true,
      blob: async () => new Blob(["encrypted"]),
    } as Response);
  });

  afterAll(() => {
    URL.createObjectURL = originalCreateObjectUrl;
  });

  it("recognizes a generic .HEIC file as previewable", () => {
    expect(getPreviewType("application/octet-stream", "holiday.HEIC")).toBe(
      "image",
    );
  });

  it("recognizes the application/heic MIME variant as previewable", () => {
    expect(getPreviewType("application/heic", "holiday.HEIC")).toBe("image");
  });

  it("converts the decrypted HEIC only for its browser preview", async () => {
    const originalHeic = new Blob(["original-heic"], { type: "image/heic" });
    const displayJpeg = new Blob(["display-jpeg"], { type: "image/jpeg" });
    mockDecryptFile.mockResolvedValue({
      contentBlob: originalHeic,
      fileName: "holiday.HEIC",
      mimeType: "image/heic",
      contentFormat: "capsule_v1",
    });
    mockHeicTo.mockResolvedValue(displayJpeg);

    const result = await decryptFileForPreview(
      "drive-file-id",
      "holiday.HEIC",
      "image/heic",
    );

    expect(mockHeicTo).toHaveBeenCalledWith({
      blob: originalHeic,
      type: "image/jpeg",
      quality: 0.92,
    });
    expect(URL.createObjectURL).toHaveBeenCalledWith(displayJpeg);
    expect(result).toEqual({
      blobUrl: "blob:heic-preview",
      blob: displayJpeg,
      mimeType: "image/jpeg",
    });
  });
});
