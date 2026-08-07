// S6 SpecTable: template-driven rows — join the versioned template's field
// definitions against the listing's specs dict. Values render verbatim.
import { View } from "react-native";

import type { SpecTemplate } from "../../lib/types";
import { BodyText, MonoText } from "../ui/text";

function formatValue(value: unknown, unit?: string): string {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.join(", ");
  if (value === null || value === undefined || value === "") return "—";
  return unit ? `${String(value)} ${unit}` : String(value);
}

export function SpecTable({
  specs,
  template,
}: {
  specs: Record<string, unknown>;
  template: SpecTemplate | undefined;
}) {
  const entries = template
    ? Object.entries(template.fields)
        .filter(([name]) => specs[name] !== undefined)
        .map(([name, field]) => ({
          key: name,
          label: field.display_name,
          value: formatValue(specs[name], field.unit),
        }))
    : Object.entries(specs).map(([name, value]) => ({
        key: name,
        label: name.replace(/_/g, " "),
        value: formatValue(value),
      }));

  if (entries.length === 0) return null;

  return (
    <View className="overflow-hidden rounded-lg border border-border">
      {entries.map((row, i) => (
        <View
          key={row.key}
          className={`flex-row items-center justify-between px-3.5 py-2.5 ${
            i % 2 === 0 ? "bg-surface-card" : "bg-surface-sunken"
          }`}
        >
          <BodyText className="flex-1 text-body-sm text-text-secondary">{row.label}</BodyText>
          <MonoText className="text-body-sm">{row.value}</MonoText>
        </View>
      ))}
    </View>
  );
}
