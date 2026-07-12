import { zodResolver } from "@hookform/resolvers/zod";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Pressable, ScrollView, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { VerifyOtp } from "../../components/auth/verify-otp";
import { Button } from "../../components/ui/button";
import { BodyText, DisplayText } from "../../components/ui/text";
import { TextField } from "../../components/ui/text-field";
import { ApiError } from "../../lib/api";
import { fetchMe, login, resendEmailOtp, resendPhoneOtp } from "../../lib/auth-api";
import { loginSchema, type LoginInput } from "../../lib/auth-schemas";
import { consumePendingIntent } from "../../lib/guest-intent";
import { useSession } from "../../stores/session";

// Abandoned-OTP resume (F1): login with an unverified account drops straight
// back into the OTP step, starting at whichever channel is still unverified.
type Resume = { phone: string; email: string; password: string; startChannel: "phone" | "email" };

export default function Login() {
  const insets = useSafeAreaInsets();
  const setMe = useSession((s) => s.setMe);
  const { reauth } = useLocalSearchParams<{ reauth?: string }>();
  const [formError, setFormError] = useState<string | null>(null);
  const [resume, setResume] = useState<Resume | null>(null);

  const { control, handleSubmit, formState } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const finishLogin = async (email: string, password: string) => {
    await login(email, password);
    setMe(await fetchMe());
    if (reauth === "1" && router.canGoBack()) {
      // F12 re-auth: pop the sheet — the interrupted screen is underneath.
      router.back();
      return;
    }
    const intent = consumePendingIntent();
    router.replace((intent ?? "/(tabs)") as never);
  };

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await finishLogin(values.email, values.password);
    } catch (e) {
      if (e instanceof ApiError && (e.code === "phone_not_verified" || e.code === "email_not_verified")) {
        // The login error carries the account phone when the server knows it;
        // fall back to asking the API to resend by email identity only.
        const phone = (e.fields?.phone?.[0] as string | undefined) ?? "";
        const startChannel = e.code === "phone_not_verified" ? "phone" : "email";
        if (startChannel === "phone" && phone) await resendPhoneOtp(phone).catch(() => undefined);
        if (startChannel === "email") await resendEmailOtp(values.email).catch(() => undefined);
        setResume({ phone, email: values.email, password: values.password, startChannel });
        return;
      }
      if (e instanceof ApiError && e.code === "account_suspended") {
        router.replace("/system/suspended");
        return;
      }
      setFormError(e instanceof ApiError ? e.message : "Something went wrong. Try again.");
    }
  });

  return (
    <KeyboardAvoidingView className="flex-1 bg-surface-page" behavior="padding">
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="gap-4 px-6">
          {resume ? (
            <VerifyOtp
              phone={resume.phone}
              email={resume.email}
              startChannel={resume.startChannel}
              onVerified={() => {
                void finishLogin(resume.email, resume.password).catch(() =>
                  setFormError("Verified — sign in again to continue."),
                );
                setResume(null);
              }}
            />
          ) : (
            <>
              <View>
                <DisplayText className="text-h1">Sign in</DisplayText>
                <BodyText className="mt-1 text-text-secondary">
                  Back to the map — your hires are where you left them.
                </BodyText>
              </View>

              <Controller
                control={control}
                name="email"
                render={({ field, fieldState }) => (
                  <TextField
                    label="Email"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    value={field.value}
                    onChangeText={field.onChange}
                    error={fieldState.error?.message}
                  />
                )}
              />
              <Controller
                control={control}
                name="password"
                render={({ field, fieldState }) => (
                  <TextField
                    label="Password"
                    secureTextEntry
                    autoComplete="current-password"
                    value={field.value}
                    onChangeText={field.onChange}
                    error={fieldState.error?.message}
                  />
                )}
              />

              {formError ? (
                <BodyText className="text-body-sm text-text-danger">{formError}</BodyText>
              ) : null}

              <Button label="Sign in" busy={formState.isSubmitting} onPress={() => void onSubmit()} />
              <Pressable
                accessibilityRole="link"
                className="items-center py-2"
                onPress={() => router.replace("/auth/register")}
              >
                <BodyText className="text-text-link">New to Terminal? Create an account</BodyText>
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
