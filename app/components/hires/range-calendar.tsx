// S7 ① bespoke range calendar (no dependency): tap start, tap end; taps
// before the start restart the range. Min = today. NOTE: held/booked dates
// are NOT struck — no availability-ranges endpoint exists (recorded gap);
// the 409 availability_conflict sheet is the race safety-net.
import { useState } from "react";
import { Pressable, View } from "react-native";

import { BodyText, DisplayText, MonoText } from "../ui/text";

export type DateRange = { start: string | null; end: string | null };

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function monthMatrix(year: number, month: number): (string | null)[] {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7; // Monday-first
  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(iso(new Date(year, month, d)));
  return cells;
}

export function RangeCalendar({
  range,
  onChange,
  todayIso,
}: {
  range: DateRange;
  onChange: (next: DateRange) => void;
  /** Injected for freeze-time tests; defaults to the device clock. */
  todayIso?: string;
}) {
  const today = todayIso ?? iso(new Date());
  const [cursor, setCursor] = useState(() => {
    const [y, m] = today.split("-").map(Number);
    return { year: y, month: m - 1 };
  });

  const cells = monthMatrix(cursor.year, cursor.month);
  const monthLabel = new Date(cursor.year, cursor.month, 1).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });

  const pick = (day: string) => {
    if (day < today) return;
    if (!range.start || range.end || day < range.start) {
      onChange({ start: day, end: null });
    } else {
      onChange({ start: range.start, end: day });
    }
  };

  const inRange = (day: string) =>
    range.start !== null && range.end !== null && day >= range.start && day <= range.end;

  return (
    <View className="rounded-lg border border-border bg-surface-card p-3">
      <View className="flex-row items-center justify-between pb-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          hitSlop={10}
          onPress={() =>
            setCursor((c) => (c.month === 0 ? { year: c.year - 1, month: 11 } : { ...c, month: c.month - 1 }))
          }
        >
          <DisplayText className="px-2 text-h3">‹</DisplayText>
        </Pressable>
        <BodyText className="font-sans-semibold">{monthLabel}</BodyText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next month"
          hitSlop={10}
          onPress={() =>
            setCursor((c) => (c.month === 11 ? { year: c.year + 1, month: 0 } : { ...c, month: c.month + 1 }))
          }
        >
          <DisplayText className="px-2 text-h3">›</DisplayText>
        </Pressable>
      </View>

      <View className="flex-row">
        {DAY_LABELS.map((l, i) => (
          <BodyText key={`${l}${i}`} className="flex-1 text-center text-caption text-text-tertiary">
            {l}
          </BodyText>
        ))}
      </View>

      <View className="flex-row flex-wrap">
        {cells.map((day, i) => {
          if (!day) return <View key={`x${i}`} style={{ width: "14.28%", height: 42 }} />;
          const disabled = day < today;
          const isEdge = day === range.start || day === range.end;
          const isBetween = inRange(day) && !isEdge;
          return (
            <Pressable
              key={day}
              accessibilityRole="button"
              accessibilityLabel={day}
              accessibilityState={{ disabled, selected: isEdge || isBetween }}
              disabled={disabled}
              onPress={() => pick(day)}
              style={{ width: "14.28%", height: 42 }}
              className="items-center justify-center"
            >
              <View
                className={`h-9 w-9 items-center justify-center rounded-full ${
                  isEdge ? "bg-surface-brand" : isBetween ? "bg-amber-100" : ""
                }`}
              >
                <MonoText
                  className={`text-body-sm ${
                    disabled
                      ? "text-ink-300"
                      : isEdge
                        ? "text-text-on-brand"
                        : isBetween
                          ? "text-amber-900"
                          : "text-text-primary"
                  }`}
                >
                  {Number(day.slice(-2))}
                </MonoText>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
