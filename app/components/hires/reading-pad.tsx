// Class-recipe reading (FSD §7.4 / 03 §7): hour meter for Plant, odometer for
// Trucks, none for spaces (which rely on the condition note instead). Digits
// only; the value folds into the handover record's `reading` JSON.
import type { AssetClass } from "../../lib/types";
import { TextField } from "../ui/text-field";

export type ReadingKind = "hour_meter" | "odometer" | null;

export function readingKindFor(assetClass: AssetClass): ReadingKind {
  if (assetClass === "plant_machinery") return "hour_meter";
  if (assetClass === "trucks_haulage") return "odometer";
  return null;
}

const LABEL: Record<"hour_meter" | "odometer", string> = {
  hour_meter: "Hour meter reading",
  odometer: "Odometer reading (km)",
};

export function ReadingPad({
  kind,
  value,
  onChange,
}: {
  kind: ReadingKind;
  value: string;
  onChange: (v: string) => void;
}) {
  if (!kind) return null;
  return (
    <TextField
      label={LABEL[kind]}
      keyboardType="number-pad"
      value={value}
      onChangeText={(t) => onChange(t.replace(/[^0-9]/g, ""))}
      placeholder="e.g. 1200"
    />
  );
}
