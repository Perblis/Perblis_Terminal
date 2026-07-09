import { forwardRef } from "react";
import { TextInput, View, type TextInputProps } from "react-native";

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
  return (
    <View className="gap-1.5">
      <BodyText className="text-body-sm font-sans-medium text-text-secondary">{label}</BodyText>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        className={`min-h-12 rounded-md border bg-surface-card px-4 py-3 font-sans text-body text-text-primary ${
          error ? "border-text-danger" : "border-border-strong"
        }`}
        placeholderTextColor="#8D93A0"
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
