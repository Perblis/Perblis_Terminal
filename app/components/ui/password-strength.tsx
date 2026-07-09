import { View } from "react-native";

import { BodyText } from "./text";

export type Strength = { score: 0 | 1 | 2 | 3; label: string };

/** Mirrors the backend policy floor (≥8 chars, uppercase, digit) + length bonus. */
export function passwordStrength(password: string): Strength {
  if (!password) return { score: 0, label: "" };
  const meetsPolicy = password.length >= 8 && /[A-Z]/.test(password) && /\d/.test(password);
  if (!meetsPolicy) return { score: 1, label: "Too weak — 8+ characters, an uppercase letter and a number." };
  if (password.length >= 12 && /[^A-Za-z0-9]/.test(password)) return { score: 3, label: "Strong password." };
  return { score: 2, label: "Good — longer with a symbol is stronger." };
}

const BAR: Record<Exclude<Strength["score"], 0>, string> = {
  1: "bg-text-danger",
  2: "bg-surface-brand",
  3: "bg-status-onHire",
};

export function PasswordStrengthMeter({ password }: { password: string }) {
  const { score, label } = passwordStrength(password);
  if (score === 0) return null;
  return (
    <View className="gap-1">
      <View className="flex-row gap-1">
        {([1, 2, 3] as const).map((step) => (
          <View
            key={step}
            className={`h-1 flex-1 rounded-full ${score >= step ? BAR[score as 1 | 2 | 3] : "bg-ink-200"}`}
          />
        ))}
      </View>
      <BodyText className="text-caption text-text-tertiary">{label}</BodyText>
    </View>
  );
}
