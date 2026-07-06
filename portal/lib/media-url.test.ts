import { describe, expect, it } from "vitest";

import { publicMediaKeyFromUrl, resolveMediaUrl } from "./media-url";

describe("publicMediaKeyFromUrl", () => {
  it("extracts key from R2 S3 endpoint URLs", () => {
    expect(
      publicMediaKeyFromUrl(
        "https://abc.r2.cloudflarestorage.com/listings/019f3748-af29-7103-8e32-182c2fb94c6d.jpg",
      ),
    ).toBe("listings/019f3748-af29-7103-8e32-182c2fb94c6d.jpg");
  });

  it("extracts key from custom public domains", () => {
    expect(publicMediaKeyFromUrl("https://cdn.example.com/logos/acme.png")).toBe("logos/acme.png");
  });

  it("ignores presigned PUT paths that include the bucket name", () => {
    expect(
      publicMediaKeyFromUrl(
        "https://abc.r2.cloudflarestorage.com/terminal-public/listings/photo.jpg?X-Amz-Signature=x",
      ),
    ).toBeNull();
  });
});

describe("resolveMediaUrl", () => {
  it("proxies R2 URLs through the BFF", () => {
    expect(
      resolveMediaUrl(
        "https://abc.r2.cloudflarestorage.com/listings/photo.jpg",
        null,
      ),
    ).toBe("/bff/media/public?key=listings%2Fphoto.jpg");
  });

  it("prefers r2_key when provided", () => {
    expect(resolveMediaUrl("https://ignored.example/x", "listings/from-key.jpg")).toBe(
      "/bff/media/public?key=listings%2Ffrom-key.jpg",
    );
  });

  it("rewrites API-relative dev URLs", () => {
    expect(resolveMediaUrl("/api/v1/media/public?key=listings/a.jpg")).toBe(
      "/bff/media/public?key=listings/a.jpg",
    );
  });
});
