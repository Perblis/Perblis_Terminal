// S10 Hire Detail — status banner (all 9 states, 09 §3 copy) → LockedTerms
// (hirer vault) → EventTimeline → HandoverRecord cards → conversation row →
// contextual actions gated by legalHirerActions (never an illegal action).
// D-014: the only money the hirer sees is hire_value + §7.6 refund figures.
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EventTimeline } from "../../components/hires/event-timeline";
import { HandoverConfirmMoment } from "../../components/hires/handover-confirm-moment";
import { HandoverRecordCard } from "../../components/hires/handover-record-card";
import { LockedTerms } from "../../components/hires/locked-terms";
import { RefundManifest } from "../../components/hires/refund-manifest";
import { StatusBadge } from "../../components/hires/status-badge";
import { Button } from "../../components/ui/button";
import { TextField } from "../../components/ui/text-field";
import { BodyText, DisplayText, MonoText } from "../../components/ui/text";
import { hirerStatusCopy, legalHirerActions } from "../../lib/hire-domain";
import { useCountdown } from "../../lib/use-countdown";
import {
  useCancelHire,
  useConfirmHandover,
  useConversations,
  useHandovers,
  useHire,
  useRaiseDispute,
  useRefundPreview,
} from "../../lib/queries";

export default function HireDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const hireId = id ?? null;
  const { data: hire } = useHire(hireId, undefined);
  const { data: handovers } = useHandovers(hireId);
  const { data: conversations } = useConversations();
  const confirmHandover = useConfirmHandover(id ?? "");

  const [cancelOpen, setCancelOpen] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [momentVisible, setMomentVisible] = useState(false);

  const refund = useRefundPreview(hireId, cancelOpen && hire?.status === "confirmed");
  const cancelHire = useCancelHire(id ?? "");
  const raiseDispute = useRaiseDispute(id ?? "");
  // useCountdown keeps time-reading in a hook (pure render) and ticks the banner.
  const payCountdown = useCountdown(hire?.payment_deadline ?? null);

  if (!hire) {
    return (
      <View className="flex-1 items-center justify-center bg-surface-page">
        <ActivityIndicator />
      </View>
    );
  }

  const actions = legalHirerActions(hire.status);
  const hoursToPay = payCountdown && !payCountdown.expired ? payCountdown.hours : undefined;
  // On-hire handover during Confirmed; off-hire during On Hire (FSD §7.4).
  const handoverKind = hire.status === "on_hire" ? "off_hire" : "on_hire";

  const onConfirmHandover = (handoverId: string) =>
    confirmHandover.mutate(handoverId, { onSuccess: () => setMomentVisible(true) });

  return (
    <View className="flex-1 bg-surface-page" style={{ paddingTop: insets.top }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 24, gap: 20 }}>
        <View className="flex-row items-center justify-between">
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()}>
            <DisplayText className="text-h3">←</DisplayText>
          </Pressable>
          <MonoText className="text-caption text-text-tertiary">#{hire.id.slice(0, 8)}</MonoText>
        </View>

        <View className="gap-2">
          <DisplayText className="text-h2" numberOfLines={2}>
            {hire.listing_title}
          </DisplayText>
          <StatusBadge status={hire.status} />
        </View>

        {/* Status banner — 09 §3 copy for every state. */}
        <View className="rounded-lg border border-border-default bg-surface-sunken p-4">
          <BodyText className="text-text-primary">{hirerStatusCopy(hire.status, hoursToPay)}</BodyText>
          {hire.status === "in_dispute" ? (
            <BodyText className="mt-1 text-caption text-text-secondary">
              Funds are on hold while our team reviews. We’ll be in touch.
            </BodyText>
          ) : null}
          {hire.status === "declined" && hire.decline_reason ? (
            <BodyText className="mt-1 text-caption text-text-secondary">{hire.decline_reason}</BodyText>
          ) : null}
        </View>

        <LockedTerms hire={hire} />

        {handovers && handovers.length > 0 ? (
          <View className="gap-3">
            <BodyText className="font-sans-semibold text-text-primary">Handover</BodyText>
            {handovers.map((record) => (
              <HandoverRecordCard
                key={record.id}
                record={record}
                confirming={confirmHandover.isPending}
                onConfirm={() => onConfirmHandover(record.id)}
              />
            ))}
          </View>
        ) : null}

        {/* Conversation — the hire thread exists from acceptance; open it
            directly rather than dropping the hirer on the Messages tab. */}
        {["accepted", "confirmed", "on_hire", "completed", "in_dispute"].includes(hire.status) ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              const conv = conversations?.results.find((c) => c.hire_id === hire.id);
              router.push((conv ? `/messages/${conv.id}` : "/(tabs)/messages") as never);
            }}
            className="flex-row items-center justify-between rounded-lg border border-border-default bg-surface-card p-4 active:bg-surface-sunken"
          >
            <BodyText className="font-sans-semibold text-text-primary">Message the supplier</BodyText>
            <DisplayText className="text-h3 text-text-link">→</DisplayText>
          </Pressable>
        ) : null}

        <EventTimeline events={hire.events} />

        {/* Contextual actions — only the legal ones (state-machine fidelity). */}
        <View className="gap-3">
          {actions.includes("pay") ? (
            <Button label="Pay now" onPress={() => router.push(`/pay/${hire.id}` as never)} />
          ) : null}
          {actions.includes("submit_handover") ? (
            <Button
              variant={actions.includes("pay") ? "secondary" : "primary"}
              label={handoverKind === "off_hire" ? "Submit off-hire handover" : "Submit on-hire handover"}
              onPress={() => router.push(`/handover/${hire.id}?kind=${handoverKind}` as never)}
            />
          ) : null}
          {actions.includes("cancel") ? (
            <Button variant="secondary" label="Cancel hire" onPress={() => setCancelOpen(true)} />
          ) : null}
          {actions.includes("raise_issue") ? (
            <Button variant="ghost" label="Raise an issue" onPress={() => setDisputeOpen(true)} />
          ) : null}
        </View>
      </ScrollView>

      {/* Cancel — refund preview (Confirmed) + reason (F5). */}
      <Modal visible={cancelOpen} transparent animationType="slide" onRequestClose={() => setCancelOpen(false)}>
        <View className="flex-1 justify-end bg-black/50">
          <View className="gap-4 rounded-t-2xl bg-surface-page p-6" style={{ paddingBottom: insets.bottom + 24 }}>
            <DisplayText className="text-h2">Cancel this hire?</DisplayText>
            {hire.status === "confirmed" ? (
              refund.data ? (
                <RefundManifest preview={refund.data} />
              ) : (
                <ActivityIndicator />
              )
            ) : (
              <BodyText className="text-text-secondary">
                No payment has been taken yet, so there’s nothing to refund. This can’t be undone.
              </BodyText>
            )}
            <TextField
              label="Reason"
              placeholder="Tell us why you're cancelling"
              value={reason}
              onChangeText={setReason}
              multiline
            />
            <Button
              label="Confirm cancellation"
              busy={cancelHire.isPending}
              disabled={reason.trim().length === 0}
              onPress={() =>
                cancelHire.mutate(reason.trim(), {
                  onSuccess: () => {
                    setCancelOpen(false);
                    setReason("");
                  },
                })
              }
            />
            <Button variant="ghost" label="Keep the hire" onPress={() => setCancelOpen(false)} />
          </View>
        </View>
      </Modal>

      {/* Raise issue → In Dispute (server enforces the ≤72h window). */}
      <Modal visible={disputeOpen} transparent animationType="slide" onRequestClose={() => setDisputeOpen(false)}>
        <View className="flex-1 justify-end bg-black/50">
          <View className="gap-4 rounded-t-2xl bg-surface-page p-6" style={{ paddingBottom: insets.bottom + 24 }}>
            <DisplayText className="text-h2">Raise an issue</DisplayText>
            <BodyText className="text-text-secondary">
              This opens a dispute and puts the hire on hold while our team reviews. Use it only
              for a genuine problem with the hire.
            </BodyText>
            <TextField
              label="What went wrong?"
              placeholder="Describe the issue"
              value={reason}
              onChangeText={setReason}
              multiline
            />
            <Button
              label="Raise the issue"
              busy={raiseDispute.isPending}
              disabled={reason.trim().length === 0}
              onPress={() =>
                raiseDispute.mutate(reason.trim(), {
                  onSuccess: () => {
                    setDisputeOpen(false);
                    setReason("");
                  },
                })
              }
            />
            <Button variant="ghost" label="Never mind" onPress={() => setDisputeOpen(false)} />
          </View>
        </View>
      </Modal>

      <HandoverConfirmMoment visible={momentVisible} onDone={() => setMomentVisible(false)} />
    </View>
  );
}
