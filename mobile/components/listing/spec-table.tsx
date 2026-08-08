// S6 SpecTable: template-driven rows — join the versioned template's field
// definitions against the listing's specs dict. Values render verbatim.
//
// 2026-08-08 (founder, §8): the zebra-striped bordered table was a box inside
// a box inside a scroll view, and every row spent half its width on a label
// column. It's now a two-column grid — label as an overline above its value —
// which halves the vertical run, kills the outer border, and lets the values
// (the part anyone reads) sit at full weight. Every spec still renders; the
// template join and formatValue are untouched.
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
    <View className="flex-row flex-wrap">
      {entries.map((row, i) => {
        // Hairline between grid ROWS only — a full box around each cell would
        // put us straight back to nested containers.
        const onSecondRowOrLater = i >= 2;
        return (
          <View
            key={row.key}
            accessibilityLabel={`${row.label}: ${row.value}`}
            className={`w-1/2 gap-0.5 py-3 ${onSecondRowOrLater ? "border-t border-border-default" : ""} ${
              i % 2 === 1 ? "pl-4" : "pr-4"
            }`}
          >
            <BodyText className="text-overline uppercase text-text-tertiary" numberOfLines={1}>
              {row.label}
            </BodyText>
            <MonoText className="text-body">{row.value}</MonoText>
          </View>
        );
      })}
    </View>
  );
}
