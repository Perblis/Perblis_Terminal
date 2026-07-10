// S16 Profile — identity + verification (F2), become-a-supplier hand-off to the
// portal (F8), settings, sign out. No fee anywhere (D-014). Verification is
// surfaced quietly here + at the cap gate (V17), never as an early nudge.
import * as Application from "expo-application";
import { router } from "expo-router";
import { useState } from "react";
import { Linking, Modal, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "../../components/ui/button";
import { BodyText, DisplayText } from "../../components/ui/text";
import { apiFetch, PORTAL_URL } from "../../lib/api";
import { logout } from "../../lib/auth-api";
import { useBecomeSupplier, useDeleteAccount, useVerification } from "../../lib/queries";
import { useSession } from "../../stores/session";

const SUPPORT_EMAIL = "support@perblis.com";
const SUPPORT_WHATSAPP = "https://wa.me/2348000000000";

function Row({ label, sub, onPress, danger }: { label: string; sub?: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="flex-row items-center justify-between border-b border-border-default px-4 py-3.5 active:bg-surface-sunken"
    >
      <View className="flex-1 pr-3">
        <BodyText className={danger ? "text-text-danger" : "text-text-primary"}>{label}</BodyText>
        {sub ? <BodyText className="text-caption text-text-tertiary">{sub}</BodyText> : null}
      </View>
      <BodyText className="text-text-tertiary">›</BodyText>
    </Pressable>
  );
}

export default function ProfileTab() {
  const insets = useSafeAreaInsets();
  const me = useSession((s) => s.me);
  const hydrated = useSession((s) => s.hydrated);
  const setMe = useSession((s) => s.setMe);
  const { data: verification } = useVerification();
  const deleteAccount = useDeleteAccount();
  const becomeSupplier = useBecomeSupplier();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [inviteSent, setInviteSent] = useState(false);

  const signOut = async () => {
    await logout();
    setMe(null);
    router.replace("/(tabs)");
  };

  if (!me) {
    // Until the boot reconciliation has run, don't flash the guest CTA at a
    // signed-in user whose session is still hydrating.
    if (!hydrated) return <View className="flex-1 bg-surface-page" />;
    return (
      <View className="flex-1 justify-center gap-4 bg-surface-page px-6">
        <DisplayText className="text-h2">Profile</DisplayText>
        <BodyText className="text-text-secondary">
          You’re browsing as a guest. Sign in to request hires and message suppliers.
        </BodyText>
        <Button label="Sign in" onPress={() => router.push("/auth/login")} />
      </View>
    );
  }

  const verified = me.is_verified || me.account_level !== "basic";
  const requests = verification?.requests ?? [];
  const pending = requests.some((r) => r.state === "pending");
  const rejected = requests.find((r) => r.state === "rejected");
  const attempts = requests.length;

  const changePassword = async () => {
    try {
      await apiFetch("/auth/password-reset", { method: "POST", body: { email: me.email } });
    } catch {
      // no-enumeration endpoint — always succeeds from the client's view
    }
    setResetSent(true);
  };

  const confirmDelete = () =>
    deleteAccount.mutate(undefined, {
      onSuccess: async () => {
        setDeleteOpen(false);
        await signOut();
      },
    });

  return (
    <View className="flex-1 bg-surface-page" style={{ paddingTop: insets.top }}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        {/* Identity */}
        <View className="items-center gap-2 px-6 py-6">
          <View className="h-16 w-16 items-center justify-center rounded-full bg-surface-inverse">
            <DisplayText className="text-h2 text-text-inverse">
              {me.full_name.slice(0, 1).toUpperCase()}
            </DisplayText>
          </View>
          <DisplayText className="text-h2">{me.full_name}</DisplayText>
          <BodyText className="text-text-secondary">{me.email}</BodyText>
          {verified ? (
            <View className="rounded-full bg-teal-50 px-3 py-0.5">
              <BodyText className="text-caption font-sans-semibold text-teal-900">✓ Verified</BodyText>
            </View>
          ) : null}
        </View>

        {/* Verification card (F2) */}
        {!verified ? (
          <View className="mx-4 mb-4 gap-2 rounded-lg border border-border-default bg-surface-card p-4">
            {pending ? (
              <>
                <BodyText className="font-sans-semibold text-text-primary">Verification under review</BodyText>
                <BodyText className="text-body-sm text-text-secondary">
                  We’re checking your documents — this usually takes a business day.
                </BodyText>
              </>
            ) : attempts >= 3 ? (
              <>
                <BodyText className="font-sans-semibold text-text-primary">Verification needs a hand</BodyText>
                <BodyText className="text-body-sm text-text-secondary">
                  You’ve reached the resubmission limit. Contact support and we’ll sort it out with you.
                </BodyText>
                <Button variant="secondary" label="Contact support" onPress={() => void Linking.openURL(SUPPORT_WHATSAPP)} />
              </>
            ) : rejected ? (
              <>
                <BodyText className="font-sans-semibold text-text-primary">Verification declined</BodyText>
                <BodyText className="text-body-sm text-text-secondary">{rejected.reason || "Please resubmit clearer documents."}</BodyText>
                <Button label="Resubmit" onPress={() => router.push("/verify")} />
              </>
            ) : (
              <>
                <BodyText className="font-sans-semibold text-text-primary">Verify your account</BodyText>
                <BodyText className="text-body-sm text-text-secondary">
                  Unlock hires above the Basic limit by verifying your identity or business.
                </BodyText>
                <Button label="Verify" onPress={() => router.push("/verify")} />
              </>
            )}
          </View>
        ) : null}

        {/* Become a supplier (F8) — activate + email the portal link */}
        <Row
          label="Become a supplier"
          sub={
            inviteSent
              ? "Portal link sent to your email — sign in there to set up"
              : "List your assets and take hires — we’ll email your portal link"
          }
          onPress={() =>
            becomeSupplier.mutate(undefined, { onSuccess: () => setInviteSent(true) })
          }
        />

        {/* Settings */}
        <View className="mt-4">
          <Row
            label="Change password"
            sub={resetSent ? "Reset link sent to your email" : undefined}
            onPress={() => void changePassword()}
          />
          <Row label="Contact support" onPress={() => void Linking.openURL(`mailto:${SUPPORT_EMAIL}`)} />
          <Row label="Legal & privacy" onPress={() => void Linking.openURL(`${PORTAL_URL}/legal`)} />
          <Row label="Delete account" danger onPress={() => setDeleteOpen(true)} />
        </View>

        <View className="items-center gap-3 px-6 py-6">
          <Button variant="secondary" label="Sign out" onPress={() => void signOut()} />
          <BodyText className="text-caption text-text-tertiary">
            Terminal v{Application.nativeApplicationVersion ?? "1.0.0"}
          </BodyText>
        </View>
      </ScrollView>

      <Modal visible={deleteOpen} transparent animationType="slide" onRequestClose={() => setDeleteOpen(false)}>
        <View className="flex-1 justify-end bg-black/50">
          <View className="gap-4 rounded-t-2xl bg-surface-page p-6" style={{ paddingBottom: insets.bottom + 24 }}>
            <DisplayText className="text-h2">Delete your account?</DisplayText>
            <BodyText className="text-text-secondary">
              Your account is deactivated immediately and permanently deleted after 30 days. Active
              hires must be resolved first. This can’t be undone.
            </BodyText>
            <Button label="Delete account" busy={deleteAccount.isPending} onPress={confirmDelete} />
            <Button variant="ghost" label="Keep my account" onPress={() => setDeleteOpen(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}
