import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// tailwind-merge only knows stock Tailwind class names. Two of our token
// families look identical to it:
//
//   text-body-sm        -> a named TYPE ROLE   (ch.03 §2, emitted as fontSize)
//   text-text-secondary -> a semantic TEXT COLOUR (02 §2, emitted as a colour)
//
// Left unconfigured it files both under one "text" group and drops whichever
// comes first, so `cn("text-body-sm", "text-text-secondary")` silently loses
// the size and `cn("bg-action-primary text-text-on-brand", "text-body")`
// silently loses the colour. That second case shipped a near-invisible label
// on every primary button. Teaching it the two vocabularies fixes ~270 call
// sites at once.
const TYPE_ROLES = [
  "display-xl",
  "display-lg",
  "h1",
  "h2",
  "h3",
  "body-lg",
  "body",
  "body-sm",
  "caption",
  "mono-lg",
  "mono",
  "mono-sm",
  "overline",
  "2xs",
  "xs",
  "sm",
  "base",
  "lg",
  "xl",
  "2xl",
  "3xl",
];

// Semantic colour tokens whose group prefix is itself "text" (text/primary,
// text/on-brand, …) — the only colour family that collides with font sizes.
const TEXT_COLOURS = [
  "primary",
  "secondary",
  "tertiary",
  "inverse",
  "on-chrome",
  "on-brand",
  "brand-on-inverse",
  "link",
  "danger",
  "money",
];

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: TYPE_ROLES }],
      "text-color": [{ text: [{ text: TEXT_COLOURS }] }],
    },
  },
});

/** Merge Tailwind class lists with correct override semantics. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
