import { forwardRef } from "react";
import { TextInput, View, type TextInputProps } from "react-native";

import { useThemeTokens } from "../../lib/theme";
import { BodyText } from "./text";

type Props = TextInputProps & {
  label: string;
  error?: string;
  hint?: string;
};

/** Labeled field (05 §2): label above, error below in the 09 §1 voice. */
export const TextField = forwardRef<TextInput, Props>(function TextField(
  { label, error, hint, ...rest },
  ref,
) {
  const tk = useThemeTokens();
  return (
    <View className="gap-1.5">
      <BodyText className="text-body-sm font-sans-medium text-text-secondary">{label}</BodyText>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        className={`min-h-12 rounded-md border bg-surface-card px-4 py-3 font-sans text-body text-text-primary ${
          error ? "border-text-danger" : "border-border-strong"
        }`}
        placeholderTextColor={tk["--text-tertiary"]}
        {...rest}
      />
      {error ? (
        <BodyText className="text-body-sm text-text-danger">{error}</BodyText>
      ) : hint ? (
        <BodyText className="text-body-sm text-text-tertiary">{hint}</BodyText>
      ) : null}
    </View>
  );
});
