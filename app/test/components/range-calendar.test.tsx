// S7 ① calendar availability: held days strike + disable, ranges can't span
// a held day, and no availability data keeps the permissive grid.
import { fireEvent, render } from "@testing-library/react-native";
import { useState } from "react";

import {
  RangeCalendar,
  type AvailabilityByDay,
  type DateRange,
} from "../../components/hires/range-calendar";

const TODAY = "2026-08-01";

function Harness({
  availability,
  onMonthChange,
  onRange,
}: {
  availability?: AvailabilityByDay;
  onMonthChange?: (first: string, last: string) => void;
  onRange?: (r: DateRange) => void;
}) {
  const [range, setRange] = useState<DateRange>({ start: null, end: null });
  return (
    <RangeCalendar
      range={range}
      onChange={(next) => {
        setRange(next);
        onRange?.(next);
      }}
      todayIso={TODAY}
      availability={availability}
      onMonthChange={onMonthChange}
    />
  );
}

test("fully-held day is disabled and labelled booked", async () => {
  const availability = { "2026-08-10": { free: 0, total: 1 } };
  const screen = await render(<Harness availability={availability} />);
  const held = screen.getByLabelText("2026-08-10 — booked");
  expect(held.props.accessibilityState.disabled).toBe(true);
});

test("a range can't span a held day — the pick restarts instead", async () => {
  const availability = { "2026-08-10": { free: 0, total: 1 } };
  const ranges: DateRange[] = [];
  const screen = await render(
    <Harness availability={availability} onRange={(r) => ranges.push(r)} />,
  );
  await fireEvent.press(screen.getByLabelText("2026-08-08"));
  await fireEvent.press(screen.getByLabelText("2026-08-12")); // spans the held 10th
  expect(ranges.at(-1)).toEqual({ start: "2026-08-12", end: null }); // restarted
  await fireEvent.press(screen.getByLabelText("2026-08-14"));
  expect(ranges.at(-1)).toEqual({ start: "2026-08-12", end: "2026-08-14" });
});

test("multi-unit scarcity shows a free-units hint", async () => {
  const availability = { "2026-08-05": { free: 1, total: 3 } };
  const screen = await render(<Harness availability={availability} />);
  expect(screen.getByText("1 left")).toBeTruthy();
});

test("no availability data → permissive grid (only past days disabled)", async () => {
  const ranges: DateRange[] = [];
  const screen = await render(<Harness onRange={(r) => ranges.push(r)} />);
  await fireEvent.press(screen.getByLabelText("2026-08-08"));
  await fireEvent.press(screen.getByLabelText("2026-08-20"));
  expect(ranges.at(-1)).toEqual({ start: "2026-08-08", end: "2026-08-20" });
});

test("onMonthChange fires with the visible month bounds (mount + flip)", async () => {
  const months: [string, string][] = [];
  const screen = await render(<Harness onMonthChange={(f, l) => months.push([f, l])} />);
  expect(months.at(-1)).toEqual(["2026-08-01", "2026-08-31"]);
  await fireEvent.press(screen.getByLabelText("Next month"));
  expect(months.at(-1)).toEqual(["2026-09-01", "2026-09-30"]);
});
