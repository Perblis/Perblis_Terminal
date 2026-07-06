import { describe, expect, it } from "vitest";

import { isAllowedR2PresignedUrl } from "./media-put";

describe("isAllowedR2PresignedUrl", () => {
  it("allows Cloudflare R2 presigned hosts", () => {
    expect(
      isAllowedR2PresignedUrl(
        "https://abc123.r2.cloudflarestorage.com/terminal-public/listings/01.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256",
      ),
    ).toBe(true);
  });

  it("rejects non-https URLs", () => {
    expect(isAllowedR2PresignedUrl("http://evil.example/upload")).toBe(false);
  });

  it("rejects arbitrary hosts", () => {
    expect(isAllowedR2PresignedUrl("https://evil.example/upload")).toBe(false);
  });
});
