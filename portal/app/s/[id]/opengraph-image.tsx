import { ImageResponse } from "next/og";

import { apiBaseUrl } from "@/lib/server/config";

// The designed OG share card (wave-7-vision.md): WhatsApp links must look
// premium. Ink duotone, amber tick-bar, supplier name, badge, counts.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Supplier storefront on Terminal";

type Storefront = {
  business_name: string;
  verification_badge: string | null;
  yards: unknown[];
  live_listings: { asset_class: string }[];
};

export default async function OgImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let data: Storefront | null = null;
  try {
    const resp = await fetch(`${apiBaseUrl()}/storefronts/${id}`, { headers: { accept: "application/json" } });
    if (resp.ok) data = (await resp.json()) as Storefront;
  } catch {
    // render the brand card even if the API is unreachable
  }

  const name = data?.business_name || "Supplier on Terminal";
  const badge =
    data?.verification_badge === "business_verified"
      ? "BUSINESS VERIFIED"
      : data?.verification_badge === "verified"
        ? "VERIFIED"
        : null;
  const classes = [...new Set((data?.live_listings ?? []).map((l) => l.asset_class))];
  const classColors: Record<string, string> = {
    plant_machinery: "#D97706",
    trucks_haulage: "#2563EB",
    warehousing: "#059669",
    terminals_yards: "#7C3AED",
    land_staging: "#92400E",
  };

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#16181D",
          padding: 72,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 6, height: 40, background: "#F59E0B", display: "flex" }} />
          <div style={{ color: "#F7F7F5", fontSize: 36, fontWeight: 700, letterSpacing: 4, display: "flex" }}>
            TERMINAL
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ color: "#FFFFFF", fontSize: 72, fontWeight: 700, lineHeight: 1.1, display: "flex" }}>
            {name.length > 34 ? `${name.slice(0, 33)}…` : name}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            {badge ? (
              <div
                style={{
                  display: "flex",
                  border: "3px solid #3B82F6",
                  color: "#93C5FD",
                  padding: "8px 20px",
                  fontSize: 26,
                  letterSpacing: 3,
                }}
              >
                {badge}
              </div>
            ) : null}
            <div style={{ color: "#B3B8C2", fontSize: 30, display: "flex" }}>
              {(data?.live_listings ?? []).length} assets · {(data?.yards ?? []).length} yards
            </div>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            {classes.slice(0, 5).map((c) => (
              <div key={c} style={{ width: 28, height: 28, borderRadius: 999, background: classColors[c] ?? "#8D93A0", display: "flex" }} />
            ))}
          </div>
        </div>

        <div
          style={{
            height: 10,
            width: "100%",
            display: "flex",
            backgroundImage: "repeating-linear-gradient(45deg, #F59E0B 0 16px, #16181D 16px 32px)",
          }}
        />
      </div>
    ),
    size,
  );
}
