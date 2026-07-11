import * as Haptics from "expo-haptics";
import * as Sharing from "expo-sharing";
import * as WebBrowser from "expo-web-browser";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { captureRef } from "react-native-view-shot";

import { CountdownPill } from "../../components/hires/countdown-pill";
import { LockedTerms } from "../../components/hires/locked-terms";
import { ReceiptCard } from "../../components/hires/receipt-card";
import { Button } from "../../components/ui/button";
import { BodyText, DisplayText } from "../../components/ui/text";
import { useCountdown } from "../../lib/use-countdown";
import { useHire, usePaymentStatus } from "../../lib/queries";
import { playPaymentSuccess } from "../../lib/sounds";

/**
 * S8 Pay. The webhook is the only truth: after the Paystack browser sheet
 * dismisses we POLL the hire until accepted → confirmed — never the
 * redirect (TSD §6). Never a dead end.
 */
export default function Pay() {
  const insets = useSafeAreaInsets();
  const { hireId } = useLocalSearchParams<{ hireId: string }>();
  const [confirming, setConfirming] = useState(false);

  // Poll fast while confirming; gently otherwise (deadline sweep visibility).
  const { data: hire } = useHire(hireId ?? null, confirming ? 3000 : 30000);
  const payment = usePaymentStatus(
    hire?.status === "accepted" ? (hireId ?? null) : null,
    confirming ? 5000 : undefined,
  );
  const countdown = useCountdown(hire?.payment_deadline);
  const receiptRef = useRef<View>(null);

  // The signature-moment signals (V7① haptic + V10 sound) fire once when the
  // webhook flips the hire to paid — previously the Stamp's mount effect.
  const success = hire?.status === "confirmed" || hire?.status === "on_hire";
  const successSignalled = useRef(false);
  useEffect(() => {
    if (!success || successSignalled.current) return;
    successSignalled.current = true;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    playPaymentSuccess();
  }, [success]);

  const openCheckout = async () => {
    const url = payment.data?.authorization_url;
    if (!url) return;
    await WebBrowser.openBrowserAsync(url).catch(() => {});
    // Browser dismissed — start polling; the webhook decides.
    setConfirming(true);
  };

  const shareReceipt = async () => {
    try {
      const uri = await captureRef(receiptRef, { format: "png", quality: 1 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri.startsWith("file://") ? uri : `file://${uri}`);
      }
    } catch {
      // Sharing is optional garnish — never a dead end.
    }
  };

  if (!hire) {
    return (
      <View className="flex-1 items-center justify-center bg-surface-page">
        <ActivityIndicator />
      </View>
    );
  }

  // Success — a composed confirmation around the receipt document (the
  // rotated-stamp theatrics retired with D-023's motion restraint).
  if (hire.status === "confirmed" || hire.status === "on_hire") {
    return (
      <ScrollView
        className="flex-1 bg-surface-page"
        contentContainerStyle={{ padding: 24, paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }}
      >
        <View className="gap-6">
          <View className="gap-2">
            <BodyText className="text-overline tracking-widest text-text-tertiary">
              PAYMENT COMPLETE
            </BodyText>
            <DisplayText className="text-h1">You’re confirmed</DisplayText>
            <BodyText className="text-text-secondary">
              The supplier has been notified. Contact details unlock in Messages, and handover
              happens on your start date.
            </BodyText>
          </View>
          <ReceiptCard ref={receiptRef} hire={hire} />
          <View className="gap-3">
            <Button label="Share receipt" onPress={() => void shareReceipt()} />
            <Button
              variant="secondary"
              label="View the hire"
              onPress={() => router.replace("/(tabs)/hires" as never)}
            />
          </View>
        </View>
      </ScrollView>
    );
  }

  // Expiry / system cancellation — dates released, re-request path.
  const expired =
    hire.status === "cancelled" || hire.status === "expired" || (countdown?.expired ?? false);
  if (hire.status !== "accepted" || expired) {
    return (
      <View
        className="flex-1 items-center justify-center gap-4 bg-surface-page px-6"
        style={{ paddingBottom: insets.bottom }}
      >
        <DisplayText className="text-h2 text-center">The payment window closed</DisplayText>
        <BodyText className="text-center text-text-secondary">
          Those dates have been released back to the market. The machine may still be free —
          request it again and the supplier can re-accept in minutes.
        </BodyText>
        <View className="w-full gap-3">
          <Button
            label="Request again"
            onPress={() => router.replace(`/hire-request/${hire.listing_id}` as never)}
          />
          <Button variant="ghost" label="Back to My Hires" onPress={() => router.replace("/(tabs)/hires" as never)} />
        </View>
      </View>
    );
  }

  // Confirming (post-browser) — the webhook decides.
  if (confirming && payment.data?.state !== "failed" && payment.data?.state !== "abandoned") {
    return (
      <View className="flex-1 items-center justify-center gap-4 bg-surface-page px-6">
        <ActivityIndicator size="large" />
        <DisplayText className="text-h2">Confirming with bank…</DisplayText>
        <BodyText className="text-center text-text-secondary">
          This usually takes a few seconds. We confirm directly with Paystack — no need to do
          anything else.
        </BodyText>
      </View>
    );
  }

  const failed = payment.data?.state === "failed" || payment.data?.state === "abandoned";
  const attemptsLeft = payment.data ? Math.max(0, 3 - payment.data.attempt) : 3;

  // Pay (accepted, window open) — deadline in all three mandatory places.
  return (
    <ScrollView
      className="flex-1 bg-surface-page"
      contentContainerStyle={{ padding: 24, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }}
    >
      <View className="gap-6">
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()}>
          <DisplayText className="text-h3">←</DisplayText>
        </Pressable>

        <CountdownPill deadlineIso={hire.payment_deadline ?? new Date().toISOString()} />

        <LockedTerms hire={hire} />

        {failed ? (
          <View className="gap-1 rounded-lg border border-text-danger bg-surface-card p-4">
            <BodyText className="font-sans-semibold text-text-danger">
              That payment didn’t go through.
            </BodyText>
            <BodyText className="text-body-sm text-text-secondary">
              Your bank declined or the checkout was closed. You have {attemptsLeft} attempt
              {attemptsLeft === 1 ? "" : "s"} left before the window closes — the countdown keeps
              running.
            </BodyText>
          </View>
        ) : null}

        <View className="gap-2">
          <Button
            label={failed ? "Try again" : "Pay now"}
            busy={payment.isLoading}
            disabled={!payment.data?.authorization_url}
            onPress={() => {
              setConfirming(false);
              void openCheckout();
            }}
          />
          <BodyText className="text-center text-caption text-text-tertiary">
            Pay {countdown && !countdown.expired ? `within ${countdown.label}` : "now"} — secure
            checkout by Paystack. If the window closes, the dates release automatically.
          </BodyText>
        </View>
      </View>
    </ScrollView>
  );
}
