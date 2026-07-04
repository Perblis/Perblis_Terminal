"use client";

// Sentry, keyless-degraded (TSD §9): no DSN → no-op. Client-side only — the
// Worker side relies on Cloudflare observability (wrangler.toml) + error
// digests until a Workers-native Sentry transport is warranted.
import * as Sentry from "@sentry/browser";

let initialized = false;

export function initSentry() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn || initialized) return;
  initialized = true;
  Sentry.init({
    dsn,
    release: process.env.NEXT_PUBLIC_RELEASE,
    tracesSampleRate: 0, // errors only — budget guardrail
  });
}

export function captureError(error: unknown, context?: Record<string, unknown>) {
  if (!initialized) return;
  Sentry.captureException(error, { extra: context });
}
