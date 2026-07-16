import express from "express";
import request from "supertest";
import corsHandler from "../../../middleware/cors";

describe("CORS middleware", () => {
  const originalAllowedOrigins = process.env.ALLOWED_ORIGINS;

  beforeEach(() => {
    process.env.ALLOWED_ORIGINS = "http://localhost:3000";
  });

  afterEach(() => {
    if (originalAllowedOrigins === undefined) {
      delete process.env.ALLOWED_ORIGINS;
    } else {
      process.env.ALLOWED_ORIGINS = originalAllowedOrigins;
    }
  });

  it("allows share capability headers used by encrypted upload finalization", async () => {
    const app = express();
    app.use(corsHandler);
    app.post("/api/presigned-url/upload", (_req, res) => res.status(204).end());

    const response = await request(app)
      .options("/api/presigned-url/upload")
      .set("Origin", "http://localhost:3000")
      .set("Access-Control-Request-Method", "POST")
      .set(
        "Access-Control-Request-Headers",
        "content-type,x-csrf-token,x-share-capability",
      );

    expect(response.status).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe(
      "http://localhost:3000",
    );
    expect(
      response.headers["access-control-allow-headers"].toLowerCase(),
    ).toContain("x-share-capability");
  });
});
