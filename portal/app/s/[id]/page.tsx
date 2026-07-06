import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { WordmarkInline } from "@/components/brand/wordmark";
import { StorefrontView, type StorefrontData } from "@/components/storefront/storefront-view";
import { apiBaseUrl } from "@/lib/server/config";

// Public storefront share page — the URL "Share storefront" copies. Fetches
// the public API server-side (no auth; suspended suppliers 404 upstream).
// The designed OG share card renders from this route's metadata in 7E.

async function fetchStorefront(id: string): Promise<StorefrontData | null> {
  const resp = await fetch(`${apiBaseUrl()}/storefronts/${id}`, {
    headers: { accept: "application/json" },
    next: { revalidate: 60 },
  });
  if (!resp.ok) return null;
  return (await resp.json()) as StorefrontData;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const data = await fetchStorefront(id);
  const name = data?.business_name || "Supplier on Terminal";
  return {
    title: name,
    description: `${name} — ${data?.live_listings.length ?? 0} assets for hire on Terminal.`,
  };
}

export default async function PublicStorefrontPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await fetchStorefront(id);
  if (!data) notFound();

  return (
    <main className="mx-auto max-w-4xl px-s5 py-s6">
      <div className="mb-s5 flex items-center justify-between">
        <WordmarkInline />
        <a href="/register" className="rounded-sm bg-action-primary px-s4 py-s2 text-body-sm font-medium text-text-on-brand hover:bg-amber-400">
          Hire on Terminal
        </a>
      </div>
      <div className="hazard-stripe mb-s5" />
      <StorefrontView data={data} />
      <p className="mt-s7 text-caption text-ink-500">Terminal Ltd · Lagos · terminal.africa/privacy</p>
    </main>
  );
}
