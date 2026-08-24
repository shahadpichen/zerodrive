declare module "heic-to/csp" {
  export function heicTo(options: {
    blob: Blob;
    type: `image/${string}`;
    quality?: number;
  }): Promise<Blob>;
}
