import { ActivityIndicator, Pressable, type PressableProps } from "react-native";

import { BodyText } from "./text";

type Props = PressableProps & {
  label: string;
  busy?: boolean;
  variant?: "primary" | "secondary" | "ghost" | "inverse";
};

const FRAME: Record<NonNullable<Props["variant"]>, string> = {
  primary: "bg-surface-brand active:opacity-90",
  secondary: "border border-border-strong bg-surface-card active:bg-surface-sunken",
  ghost: "active:opacity-70",
  inverse: "bg-surface-inverse active:opacity-90",
};

const LABEL: Record<NonNullable<Props["variant"]>, string> = {
  primary: "font-sans-semibold text-text-on-brand",
  secondary: "font-sans-semibold text-text-primary",
  ghost: "text-text-secondary",
  inverse: "font-sans-semibold text-text-inverse",
};

/** ≥48dp touch target (experience bar). */
export function Button({ label, busy = false, variant = "primary", disabled, ...rest }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled || busy, busy }}
      disabled={!!disabled || busy}
      className={`min-h-12 flex-row items-center justify-center rounded-md px-6 py-3.5 ${FRAME[variant]} ${disabled ? "opacity-50" : ""}`}
      {...rest}
    >
      {busy ? <ActivityIndicator size="small" /> : <BodyText className={LABEL[variant]}>{label}</BodyText>}
    </Pressable>
  );
}
