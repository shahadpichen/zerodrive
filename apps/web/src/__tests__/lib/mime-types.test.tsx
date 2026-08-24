import {
  getFileIconPath,
  getMimeTypeCategory,
  isHeicFile,
} from "../../lib/mime-types";

describe("file type classification", () => {
  it.each([
    "image/heic",
    "image/heif",
    "image/heic-sequence",
    "application/heic",
    "application/heif",
  ])(
    "classifies %s as an image",
    (mimeType) => {
      expect(getMimeTypeCategory(mimeType, "photo.HEIC")).toBe("Images");
      expect(getFileIconPath(mimeType, "photo.HEIC")).toBe("/009-img.png");
      expect(isHeicFile(mimeType, "photo.HEIC")).toBe(true);
    },
  );

  it.each(["photo.HEIC", "photo.heif"])(
    "uses the image extension when the browser reports a generic MIME type",
    (fileName) => {
      expect(getMimeTypeCategory("application/octet-stream", fileName)).toBe(
        "Images",
      );
      expect(getFileIconPath("application/octet-stream", fileName)).toBe(
        "/009-img.png",
      );
      expect(isHeicFile("application/octet-stream", fileName)).toBe(true);
    },
  );

  it("does not override a specific non-HEIC MIME type from the filename", () => {
    expect(getMimeTypeCategory("application/pdf", "renamed.heic")).toBe("PDFs");
    expect(isHeicFile("application/pdf", "renamed.heic")).toBe(false);
  });

  it("keeps an unknown generic file in the fallback category", () => {
    expect(
      getMimeTypeCategory("application/octet-stream", "archive.unknown"),
    ).toBe("Others");
  });
});
