import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PriceHero } from "../../components/hires/price-hero";
import { RangeCalendar, type DateRange } from "../../components/hires/range-calendar";
import { Button } from "../../components/ui/button";
import { BodyText, DisplayText, MonoText } from "../../components/ui/text";
import { TextField } from "../../components/ui/text-field";
import { ApiError } from "../../lib/api";
import { formatDateRange } from "../../lib/hire-domain";
import { quoteEstimate } from "../../lib/pricing";
import { useCreateHire, useListing } from "../../lib/queries";
import type { HireDetail } from "../../lib/types";

type Step = 1 | 2 | 3;

// Client-side acknowledgment gate (accept-time server concept — FSD §7.2):
// plant/trucks listings whose specs indicate an operator/driver is included.
function needsAcknowledgment(assetClass: string, specs: Record<string, unknown>): boolean {
  if (assetClass !== "plant_machinery" && assetClass !== "trucks_haulage") return false;
  return Object.entries(specs).some(
    ([key, value]) => /operator|driver/i.test(key) && (value === true || value === "included"),
  );
}

/** S7 Request flow — 3-step modal stack; back preserves entries (F3). */
export default function HireRequest() {
  const insets = useSafeAreaInsets();
  const { listingId } = useLocalSearchParams<{ listingId: string }>();
  const { data: listing } = useListing(listingId ?? null);
  const createHire = useCreateHire();

  const [step, setStep] = useState<Step>(1);
  const [range, setRange] = useState<DateRange>({ start: null, end: null });
  const [note, setNote] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [capGate, setCapGate] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<HireDetail | null>(null);

  const estimate = useMemo(() => {
    if (!listing || !range.start || !range.end) return null;
    try {
      return quoteEstimate(listing, range.start, range.end);
    } catch {
      return null;
    }
  }, [listing, range]);

  const requiresAck = listing ? needsAcknowledgment(listing.asset_class, listing.specs) : false;

  const submit = async () => {
    if (!listing || !range.start || !range.end) return;
    setFormError(null);
    try {
      const hire = await createHire.mutateAsync({
        listing_id: listing.id,
        start_date: range.start,
        end_date: range.end,
        hirer_note: note,
        terms_accepted: true,
      });
      setSubmitted(hire);
    } catch (e) {
      if (e instanceof ApiError && e.code === "availability_conflict") {
        // F3 409 race: refreshed pick — dates cleared, back to ①.
        setConflict(true);
        return;
      }
      if (e instanceof ApiError && e.code === "basic_cap_exceeded") {
        setCapGate(e.message);
        return;
      }
      setFormError(e instanceof ApiError ? e.message : "Something went wrong. Try again.");
    }
  };

  if (!listing) {
    return (
      <View className="flex-1 items-center justify-center bg-surface-page">
        <BodyText className="text-text-secondary">Loading…</BodyText>
      </View>
    );
  }

  // Submitted state (③ complete): server figures only — the hero renders
  // hire_value_display from the 201 body (D-014 mandate).
  if (submitted) {
    return (
      <View
        className="flex-1 items-center justify-center gap-5 bg-surface-page px-6"
        style={{ paddingBottom: insets.bottom }}
      >
        <DisplayText className="text-h1 text-center">Request sent</DisplayText>
        <PriceHero serverDisplay={submitted.hire_value_display} />
        <View className="items-center gap-1">
          <BodyText className="text-center text-text-secondary">
            Awaiting supplier — they have 24 hours to respond.
          </BodyText>
          <MonoText className="text-body-sm text-text-secondary">
            {formatDateRange(submitted.start_date, submitted.end_date, submitted.duration_days)}
          </MonoText>
        </View>
        <View className="w-full gap-3">
          <Button label="Track it in My Hires" onPress={() => router.replace("/(tabs)/hires" as never)} />
          <Button variant="ghost" label="Back to the map" onPress={() => router.replace("/(tabs)" as never)} />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-surface-page"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Step header */}
      <View
        className="flex-row items-center gap-3 border-b border-border bg-surface-card px-4 pb-3"
        style={{ paddingTop: insets.top + 8 }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={10}
          onPress={() => (step === 1 ? router.back() : setStep((s) => (s - 1) as Step))}
        >
          <DisplayText className="text-h3">←</DisplayText>
        </Pressable>
        <View className="flex-1">
          <DisplayText className="text-h3">{listing.title}</DisplayText>
          <BodyText className="text-caption text-text-tertiary">Step {step} of 3</BodyText>
        </View>
        <MonoText className="text-body-sm text-text-tertiary">{step}/3</MonoText>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
        keyboardShouldPersistTaps="handled"
      >
        {step === 1 ? (
          <View className="gap-3">
            <DisplayText className="text-h2">When do you need it?</DisplayText>
            <RangeCalendar range={range} onChange={setRange} />
            {estimate ? (
              <View className="rounded-md bg-surface-sunken px-3.5 py-2.5">
                <MonoText className="text-body-sm">{estimate.durationLine}</MonoText>
              </View>
            ) : (
              <BodyText className="text-body-sm text-text-tertiary">
                Pick a start and end date — the best rate applies automatically.
              </BodyText>
            )}
            <Button
              label="Next — review"
              disabled={!range.start || !range.end}
              onPress={() => setStep(2)}
            />
          </View>
        ) : null}

        {step === 2 ? (
          <View className="gap-4">
            <DisplayText className="text-h2">Review your request</DisplayText>

            {/* Manifest — the total here is a CLIENT ESTIMATE; the server
                figure renders after submit (no quote endpoint exists). */}
            <View className="gap-2.5 rounded-lg border border-border bg-surface-card p-4">
              <View className="flex-row justify-between">
                <BodyText className="text-text-secondary">Dates</BodyText>
                <MonoText className="text-body-sm">
                  {range.start && range.end && estimate
                    ? formatDateRange(range.start, range.end, estimate.days)
                    : "—"}
                </MonoText>
              </View>
              <View className="flex-row justify-between">
                <BodyText className="text-text-secondary">Rate</BodyText>
                <MonoText className="text-body-sm">{estimate?.durationLine ?? "—"}</MonoText>
              </View>
              <View className="mt-1 flex-row items-baseline justify-between border-t border-border pt-2.5">
                <BodyText className="font-sans-semibold">Estimated total</BodyText>
                <MonoText className="text-mono-lg">{estimate?.totalDisplayEstimate ?? "—"}</MonoText>
              </View>
              <BodyText className="text-caption text-text-tertiary">
                The exact total locks when the supplier accepts — no fees added on top.
              </BodyText>
            </View>

            <TextField
              label="Note to the supplier (optional)"
              placeholder="Site location, delivery needs, working hours…"
              multiline
              numberOfLines={3}
              value={note}
              onChangeText={setNote}
            />

            {requiresAck ? (
              <View className="flex-row items-center gap-3 rounded-lg border border-border bg-surface-sunken p-3">
                <Switch
                  accessibilityLabel="Acknowledge operator responsibility"
                  value={acknowledged}
                  onValueChange={setAcknowledged}
                />
                <BodyText className="flex-1 text-body-sm text-text-secondary">
                  This machine comes with an operator/driver. I understand site responsibility
                  stays with me while it works under my direction.
                </BodyText>
              </View>
            ) : null}

            <Button
              label="Next — confirm"
              disabled={requiresAck && !acknowledged}
              onPress={() => setStep(3)}
            />
          </View>
        ) : null}

        {step === 3 ? (
          <View className="gap-4">
            <DisplayText className="text-h2">Send the request?</DisplayText>
            <BodyText className="text-text-secondary">
              The supplier has 24 hours to respond. You pay nothing until they accept — then a
              4-hour payment window opens with one locked total.
            </BodyText>
            <BodyText className="text-body-sm text-text-tertiary">
              By sending, you accept the Terms of Service.
            </BodyText>
            {formError ? <BodyText className="text-body-sm text-text-danger">{formError}</BodyText> : null}
            <Button label="Send request" busy={createHire.isPending} onPress={() => void submit()} />
          </View>
        ) : null}
      </ScrollView>

      {/* F3 409 race sheet */}
      {conflict ? (
        <View className="absolute inset-0 items-center justify-center bg-black/40 px-6">
          <View className="w-full gap-3 rounded-lg bg-surface-card p-5">
            <DisplayText className="text-h3">Those dates were just taken</DisplayText>
            <BodyText className="text-text-secondary">
              Another hirer confirmed part of that window a moment ago. Pick fresh dates — the
              calendar is up to date.
            </BodyText>
            <Button
              label="Pick new dates"
              onPress={() => {
                setConflict(false);
                setRange({ start: null, end: null });
                setStep(1);
              }}
            />
          </View>
        </View>
      ) : null}

      {/* F3 Basic-cap gate sheet */}
      {capGate ? (
        <View className="absolute inset-0 items-center justify-center bg-black/40 px-6">
          <View className="w-full gap-3 rounded-lg bg-surface-card p-5">
            <DisplayText className="text-h3">This hire needs a verified account</DisplayText>
            <BodyText className="text-text-secondary">{capGate}</BodyText>
            <Button
              label="Verify my account"
              onPress={() => {
                setCapGate(null);
                router.push("/(tabs)/profile" as never);
              }}
            />
            <Button
              variant="ghost"
              label="Shorten the hire instead"
              onPress={() => {
                setCapGate(null);
                setStep(1);
              }}
            />
          </View>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}
