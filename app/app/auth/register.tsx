import { zodResolver } from "@hookform/resolvers/zod";
import { router } from "expo-router";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Pressable, ScrollView, Switch, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { VerifyOtp } from "../../components/auth/verify-otp";
import { Button } from "../../components/ui/button";
import { PasswordStrengthMeter } from "../../components/ui/password-strength";
import { BodyText, DisplayText } from "../../components/ui/text";
import { TextField } from "../../components/ui/text-field";
import { ApiError } from "../../lib/api";
import { fetchMe, login, register } from "../../lib/auth-api";
import { registerSchema } from "../../lib/auth-schemas";
import { consumePendingIntent } from "../../lib/guest-intent";
import { useSession } from "../../stores/session";

// The two consent flags ride one control (same doc set) — validated manually.
const fieldsSchema = registerSchema.omit({ accept_tos: true, accept_privacy: true });
type FieldsInput = { full_name: string; email: string; phone: string; password: string };

export default function Register() {
  const insets = useSafeAreaInsets();
  const setMe = useSession((s) => s.setMe);
  const [accepted, setAccepted] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [duplicatePhone, setDuplicatePhone] = useState(false);
  const [verifying, setVerifying] = useState<{ phone: string; email: string; password: string } | null>(
    null,
  );

  const { control, handleSubmit, setError, watch, formState } = useForm<FieldsInput>({
    resolver: zodResolver(fieldsSchema),
    defaultValues: { full_name: "", email: "", phone: "", password: "" },
  });

  const password = watch("password");

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    setDuplicatePhone(false);
    if (!accepted) {
      setConsentError("You must accept the Terms of Service and Privacy Policy.");
      return;
    }
    setConsentError(null);
    try {
      await register({ ...values, accept_tos: true, accept_privacy: true });
      setVerifying({ phone: values.phone, email: values.email, password: values.password });
    } catch (e) {
      if (e instanceof ApiError && e.fields) {
        for (const [field, messages] of Object.entries(e.fields)) {
          if (field === "phone" && /exists|registered|taken|already/i.test(messages.join(" "))) {
            setDuplicatePhone(true);
          }
          if (["full_name", "email", "phone", "password"].includes(field)) {
            setError(field as keyof FieldsInput, { message: messages.join(" ") });
          }
        }
        return;
      }
      setFormError(e instanceof ApiError ? e.message : "Something went wrong. Try again.");
    }
  });

  const onVerified = async () => {
    if (!verifying) return;
    try {
      await login(verifying.email, verifying.password);
      setMe(await fetchMe());
      const intent = consumePendingIntent();
      router.replace((intent ?? "/(tabs)") as never);
    } catch {
      // Verified but auto-login failed (e.g. network) — land on sign-in.
      router.replace("/auth/login");
    }
  };

  return (
    <KeyboardAvoidingView className="flex-1 bg-surface-page" behavior="padding">
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="gap-4 px-6">
          {verifying ? (
            <VerifyOtp
              phone={verifying.phone}
              email={verifying.email}
              onVerified={() => void onVerified()}
            />
          ) : (
            <>
              <View>
                <DisplayText className="text-h1">Create your account</DisplayText>
                <BodyText className="mt-1 text-text-secondary">
                  Hire heavy assets with one total, paid safely through Terminal.
                </BodyText>
              </View>

              <Controller
                control={control}
                name="full_name"
                render={({ field, fieldState }) => (
                  <TextField
                    label="Full name"
                    autoComplete="name"
                    value={field.value}
                    onChangeText={field.onChange}
                    error={fieldState.error?.message}
                  />
                )}
              />
              <Controller
                control={control}
                name="phone"
                render={({ field, fieldState }) => (
                  <TextField
                    label="Phone"
                    keyboardType="phone-pad"
                    autoComplete="tel"
                    placeholder="0803 123 4567"
                    value={field.value}
                    onChangeText={field.onChange}
                    error={fieldState.error?.message}
                    hint="We'll text a code to this number. +234 numbers only."
                  />
                )}
              />
              {duplicatePhone ? (
                <Pressable accessibilityRole="link" onPress={() => router.replace("/auth/login")}>
                  <BodyText className="text-text-link">
                    That number already has an account — sign in instead →
                  </BodyText>
                </Pressable>
              ) : null}
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
                  <View className="gap-2">
                    <TextField
                      label="Password"
                      secureTextEntry
                      autoComplete="new-password"
                      value={field.value}
                      onChangeText={field.onChange}
                      error={fieldState.error?.message}
                    />
                    <PasswordStrengthMeter password={password} />
                  </View>
                )}
              />

              <View className="gap-1">
                <View className="flex-row items-center gap-3">
                  <Switch
                    accessibilityLabel="Accept the Terms of Service and Privacy Policy"
                    value={accepted}
                    onValueChange={setAccepted}
                  />
                  <BodyText className="flex-1 text-body-sm text-text-secondary">
                    I accept the Terms of Service and Privacy Policy.
                  </BodyText>
                </View>
                {consentError ? (
                  <BodyText className="text-body-sm text-text-danger">{consentError}</BodyText>
                ) : null}
              </View>

              {formError ? (
                <BodyText className="text-body-sm text-text-danger">{formError}</BodyText>
              ) : null}

              <Button label="Create account" busy={formState.isSubmitting} onPress={() => void onSubmit()} />
              <Pressable
                accessibilityRole="link"
                className="items-center py-2"
                onPress={() => router.replace("/auth/login")}
              >
                <BodyText className="text-text-link">Already have an account? Sign in</BodyText>
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
