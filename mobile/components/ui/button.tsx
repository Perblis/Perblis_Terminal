import { ActivityIndicator, Pressable, View, type PressableProps } from "react-native";

import { BodyText } from "./text";

type Props = PressableProps & {
  label: string;
  /** Optional second line under the label — used to hang the price on the
   *  primary CTA ("Request to hire" / "₦165,000 per day") and to name what a
   *  secondary action actually does. Kept as its own Text node so callers and
   *  tests can still query the label alone. */
  sublabel?: string;
  busy?: boolean;
  variant?: "primary" | "secondary" | "ghost" | "inverse";
};

const FRAME: Record<NonNullable<Props["variant"]>, string> = {
  primary: "bg-surface-brand active:opacity-90",
  secondary: "border border-border-strong bg-surface-card active:bg-surface-sunken",
  ghost: "active:opacity-70",
  inverse: "border border-border-strong bg-surface-chrome active:opacity-90",
};

const LABEL: Record<NonNullable<Props["variant"]>, string> = {
  primary: "font-sans-semibold text-text-on-brand",
  secondary: "font-sans-semibold text-text-primary",
  ghost: "text-text-secondary",
  inverse: "font-sans-semibold text-text-on-chrome",
};

/** The sublabel sits on the same ground as the label, so it must use the same
 *  colour family at lower emphasis — opacity, not a different hue. */
const SUBLABEL: Record<NonNullable<Props["variant"]>, string> = {
  primary: "text-text-on-brand opacity-75",
  secondary: "text-text-tertiary",
  ghost: "text-text-tertiary",
  inverse: "text-text-on-chrome opacity-75",
};

/** ≥48dp touch target (experience bar). */
export function Button({
  label,
  sublabel,
  busy = false,
  variant = "primary",
  disabled,
  ...rest
}: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={sublabel ? `${label}, ${sublabel}` : label}
      accessibilityState={{ disabled: !!disabled || busy, busy }}
      disabled={!!disabled || busy}
      // px-4 with a sublabel: at px-6 a side-by-side pair leaves the narrower
      // button ~105dp of text room, which is less than its own caption needs.
      className={`min-h-12 flex-row items-center justify-center rounded-md ${sublabel ? "px-4 py-2.5" : "px-6 py-3.5"} ${FRAME[variant]} ${disabled ? "opacity-50" : ""}`}
      {...rest}
    >
      {busy ? (
        <ActivityIndicator size="small" />
      ) : sublabel ? (
        // numberOfLines is load-bearing, not cosmetic: a wrapping sublabel makes
        // one button taller than the other, and a side-by-side pair then sits
        // visibly misaligned. Capped at one line each, both buttons are always
        // exactly two lines tall, so they match by construction.
        <View className="items-center">
          <BodyText className={LABEL[variant]} numberOfLines={1}>
            {label}
          </BodyText>
          <BodyText className={`text-caption ${SUBLABEL[variant]}`} numberOfLines={1}>
            {sublabel}
          </BodyText>
        </View>
      ) : (
        <BodyText className={LABEL[variant]}>{label}</BodyText>
      )}
    </Pressable>
  );
}
