export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-s5 px-s5">
      {/* Brand name in the brand color, straight from the token preset. */}
      <h1 className="text-3xl font-bold text-amber-500">Terminal</h1>
      <p className="text-base text-ink-700">
        Supplier Portal — map-first B2B marketplace for hiring heavy assets in Nigeria.
      </p>

      {/* Proves both token paths render: the Tailwind preset (primitive ramps)
          and the CSS-variable-backed semantic tokens (action/primary). */}
      <div className="flex items-center gap-s3">
        <span className="inline-block h-s5 w-s5 rounded-md bg-action-primary" />
        <code className="font-mono text-sm text-ink-600">action/primary → var(--action-primary)</code>
      </div>

      <p className="font-mono text-xs text-ink-500">Wave 0 · pipeline check</p>
    </main>
  );
}
