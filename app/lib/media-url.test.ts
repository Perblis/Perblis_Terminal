// The API returns R2 S3-endpoint URLs in prod, which are NOT public-readable
// (the portal hit the same wall — its BFF media proxy is PR #42). The app must
// rewrite them onto the backend's public-media proxy, mirroring the portal.
import { publicMediaKeyFromUrl, resolveMediaUrl } from "./media";

describe("publicMediaKeyFromUrl", () => {
  it("extracts public keys from R2 S3-endpoint URLs", () => {
    expect(
      publicMediaKeyFromUrl(
        "https://abc123.r2.cloudflarestorage.com/listings/0197-xyz.jpg",
      ),
    ).toBe("listings/0197-xyz.jpg");
    expect(publicMediaKeyFromUrl("https://cdn.example.com/logos/l.webp")).toBe("logos/l.webp");
    expect(publicMediaKeyFromUrl("https://cdn.example.com/handovers/h.jpg")).toBe(
      "handovers/h.jpg",
    );
  });

  it("rejects non-public prefixes and non-URLs", () => {
    expect(publicMediaKeyFromUrl("https://x.r2.cloudflarestorage.com/verifications/v.pdf")).toBe(
      null,
    );
    expect(publicMediaKeyFromUrl("not-a-url")).toBe(null);
    expect(publicMediaKeyFromUrl("")).toBe(null);
  });
});

describe("resolveMediaUrl", () => {
  it("routes public R2 URLs through the backend media proxy", () => {
    const out = resolveMediaUrl("https://abc.r2.cloudflarestorage.com/listings/a b.jpg");
    expect(out).toMatch(/\/api\/v1\/media\/public\?key=listings%2Fa%20b\.jpg$/);
    expect(out).toMatch(/^https?:\/\//);
  });

  it("resolves relative dev paths against the API origin", () => {
    expect(resolveMediaUrl("/api/v1/media/public?key=listings/a.jpg")).toMatch(
      /^https?:\/\/.+\/api\/v1\/media\/public\?key=listings\/a\.jpg$/,
    );
  });

  it("passes through unrelated absolute URLs and empty values", () => {
    expect(resolveMediaUrl("https://example.com/other/thing.png")).toBe(
      "https://example.com/other/thing.png",
    );
    expect(resolveMediaUrl("")).toBe("");
  });
});
