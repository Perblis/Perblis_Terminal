// Text primitives: the default colour must yield to a caller-supplied one.
// NativeWind resolves conflicting colour utilities by stylesheet order, not
// className order, so emitting both is non-deterministic — in dark mode the
// near-white default was beating `text-text-inverse`/`text-amber-900` and
// rendering light-on-light (the map "N assets" pill bug).
import { render } from "@testing-library/react-native";

import { BodyText, DisplayText, Money, MonoText } from "../../components/ui/text";

function className(tree: Awaited<ReturnType<typeof render>>): string {
  const node = tree.toJSON() as { props: { className?: string } };
  return node.props.className ?? "";
}

test("BodyText defaults to primary ink when the caller sets no colour", async () => {
  const tree = await render(<BodyText>hi</BodyText>);
  expect(className(tree)).toContain("text-text-primary");
});

test.each([
  ["semantic colour", "text-text-inverse"],
  ["on-brand colour", "text-text-on-brand"],
  ["primitive ramp colour", "text-amber-900"],
])("BodyText drops the default when the caller passes a %s", async (_label, colorClass) => {
  const tree = await render(<BodyText className={`text-caption ${colorClass}`}>hi</BodyText>);
  expect(className(tree)).toContain(colorClass);
  expect(className(tree)).not.toContain("text-text-primary");
});

test("a caller font-size class alone keeps the default colour", async () => {
  const tree = await render(<MonoText className="text-body-sm">42</MonoText>);
  expect(className(tree)).toContain("text-body-sm");
  expect(className(tree)).toContain("text-text-primary");
});

test("MonoText and DisplayText yield to caller colours too", async () => {
  const mono = await render(<MonoText className="text-text-inverse">7</MonoText>);
  expect(className(mono)).not.toContain("text-text-primary");
  const display = await render(<DisplayText className="text-text-inverse">T</DisplayText>);
  expect(className(display)).not.toContain("text-text-primary");
});

test("Money keeps its money colour by default but yields when overridden", async () => {
  const plain = await render(<Money display="₦250,000" />);
  expect(className(plain)).toContain("text-text-money");
  const inverse = await render(<Money display="₦250,000" className="text-text-inverse" />);
  expect(className(inverse)).toContain("text-text-inverse");
  expect(className(inverse)).not.toContain("text-text-money");
});

test("Money yields its hard-coded size when the caller passes one (S6's day rate)", async () => {
  // Two fontSize utilities on one Text resolve by stylesheet order, not
  // className order — the same hazard the colour guard exists for. Without
  // the size guard, `text-money-md` silently loses to Money's own
  // `text-money` and the listing's hero price renders at 18px.
  const plain = await render(<Money display="₦165,000" />);
  expect(className(plain)).toContain("text-money");

  const md = await render(<Money display="₦165,000" className="text-money-md" />);
  expect(className(md)).toContain("text-money-md");
  expect(className(md).split(/\s+/)).not.toContain("text-money");

  // A colour-only override must NOT strip the default size.
  const coloured = await render(<Money display="₦165,000" className="text-text-inverse" />);
  expect(coloured && className(coloured).split(/\s+/)).toContain("text-money");
});

test("Money hero still wins over any caller size", async () => {
  const hero = await render(<Money display="₦900,000" hero />);
  expect(className(hero)).toContain("text-money-hero");
  expect(className(hero).split(/\s+/)).not.toContain("text-money");
});
