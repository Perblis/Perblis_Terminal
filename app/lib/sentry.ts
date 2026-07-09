import * as Sentry from "@sentry/react-native";

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

/**
 * Keyless-degraded (design.md: simulate integrations, never simulate
 * trust): without a DSN the app runs with Sentry inert — no throw, no
 * warning noise on device.
 */
export function initSentry(): void {
  if (!dsn) return;
  Sentry.init({
    dsn,
    // Errors only for now — tracing/profiling are a Wave 9 call.
    tracesSampleRate: 0,
  });
}

export function captureException(err: unknown): string | undefined {
  if (!dsn) return undefined;
  return Sentry.captureException(err);
}
