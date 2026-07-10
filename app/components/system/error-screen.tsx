import { useMemo } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { captureException } from "../../lib/sentry";
import { HazardStripe } from "../brand/hazard-stripe";
import { TCrane } from "../brand/t-crane";
import { Button } from "../ui/button";
import { BodyText, DisplayText, MonoText } from "../ui/text";

/**
 * S17 · Error 500 — the last-resort screen behind the root ErrorBoundary.
 * Renders ABOVE the app's providers (expo-router mounts the boundary over
 * the layout), so it must stay self-contained: no router, no query client —
 * the ErrorBoundary export supplies its own SafeArea + theme wrappers.
 * The Sentry ref line renders only when a DSN produced an event id
 * (keyless-degraded: no DSN, no line, nothing broken).
 */
export function ErrorScreen({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const insets = useSafeAreaInsets();
  const eventId = useMemo(() => captureException(error), [error]);
  return (
    <View className="flex-1 bg-ink-900" style={{ paddingTop: insets.top }}>
      <View className="flex-1 items-center justify-center gap-3 px-8">
        <TCrane size={56} />
        <DisplayText className="text-h1 text-center text-paper-0">
          Something broke on our side
        </DisplayText>
        <BodyText className="text-center text-ink-300">
          This screen hit an error we didn{"’"}t plan for. Try again — if it keeps happening,
          contact support@terminal.ng or our WhatsApp line and we{"’"}ll dig in.
        </BodyText>
        {eventId ? (
          <MonoText className="text-caption text-ink-300">Ref: {eventId}</MonoText>
        ) : null}
        <View className="mt-3 w-full">
          <Button label="Try again" onPress={onRetry} />
        </View>
      </View>
      <HazardStripe height={8} />
      <View style={{ height: insets.bottom }} className="bg-ink-900" />
    </View>
  );
}
