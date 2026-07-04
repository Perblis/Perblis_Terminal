// Shared public-storefront render: used by the P10 preview-as-hirer and the
// public /s/[id] page. No hire CTAs, no fee fields (the API shape enforces it).
import { BadgeCheck, MapPin, ShieldCheck } from "lucide-react";

import { CLASS_GLYPHS } from "@/components/brand/class-glyphs";
import { CLASS_BY_VALUE } from "@/lib/asset-classes";
import type { AssetClass } from "@/lib/types";

export type StorefrontData = {
  supplier_id: string;
  business_name: string;
  logo_url: string;
  verification_badge: string | null;
  member_since: string;
  about: string;
  yards: { id: string; name: string; listing_count: number }[];
  live_listings: {
    id: string;
    title: string;
    asset_class: AssetClass;
    asset_type: string;
    daily_price_display: string;
    cover_photo_url: string | null;
    yard_id: string | null;
  }[];
};

export function StorefrontView({ data }: { data: StorefrontData }) {
  const name = data.business_name || "Supplier on Terminal";
  return (
    <div className="flex flex-col gap-s5">
      <header className="flex items-center gap-s4">
        {data.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- R2 URLs are runtime-dynamic
          <img src={data.logo_url} alt="" className="size-s8 rounded-md object-cover" />
        ) : (
          <span className="grid size-s8 place-items-center rounded-md bg-surface-inverse font-display text-h3 text-amber-500">
            {name.slice(0, 1).toUpperCase()}
          </span>
        )}
        <div>
          <h2 className="flex items-center gap-s2 font-display text-h2 text-text-primary">
            {name}
            {data.verification_badge === "business_verified" ? (
              <ShieldCheck size={20} className="text-blue-600" aria-label="Business verified" />
            ) : data.verification_badge === "verified" ? (
              <BadgeCheck size={20} className="text-blue-600" aria-label="Verified" />
            ) : null}
          </h2>
          <p className="text-caption text-ink-500">
            On Terminal since{" "}
            {new Date(data.member_since).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}
            {data.yards.length > 0 ? ` · ${data.yards.length} yard${data.yards.length > 1 ? "s" : ""}` : ""}
          </p>
        </div>
      </header>

      {data.about ? <p className="max-w-2xl text-body text-text-secondary">{data.about}</p> : null}

      {data.yards.length > 0 ? (
        <div className="flex flex-wrap gap-s2">
          {data.yards.map((y) => (
            <span key={y.id} className="flex items-center gap-s1 rounded-pill border border-border-strong px-s3 py-s1 text-body-sm text-text-secondary">
              <MapPin size={13} aria-hidden />
              {y.name} · <span className="font-mono">{y.listing_count}</span>
            </span>
          ))}
        </div>
      ) : null}

      <div className="grid gap-s4 sm:grid-cols-2 lg:grid-cols-3">
        {data.live_listings.map((l) => {
          const meta = CLASS_BY_VALUE[l.asset_class];
          const Glyph = CLASS_GLYPHS[l.asset_class];
          return (
            <div key={l.id} className="overflow-hidden rounded-md border border-border-default bg-surface-card">
              <div className="relative aspect-[4/3] bg-surface-sunken">
                {l.cover_photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- R2 URLs are runtime-dynamic
                  <img src={l.cover_photo_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className={`flex h-full items-center justify-center ${meta.bg} ${meta.text}`}>
                    <Glyph size={40} />
                  </div>
                )}
                <span className={`absolute left-s2 top-s2 flex items-center gap-s1 rounded-pill px-s2 py-px text-caption font-medium ${meta.bg} ${meta.text}`}>
                  <span className={`size-s2 rounded-pill ${meta.dot}`} aria-hidden />
                  {meta.label.split(" & ")[0]}
                </span>
              </div>
              <div className="p-s3">
                <p className="line-clamp-2 text-body font-medium text-text-primary">{l.title}</p>
                <p className="text-caption text-ink-500">{l.asset_type}</p>
                <p className="pt-s1 font-mono text-mono-lg font-medium">
                  {l.daily_price_display}
                  <span className="font-sans text-caption font-normal text-ink-500"> /day</span>
                </p>
              </div>
            </div>
          );
        })}
        {data.live_listings.length === 0 ? (
          <p className="col-span-full text-body-sm text-text-secondary">No live listings right now.</p>
        ) : null}
      </div>
    </div>
  );
}
