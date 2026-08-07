// The five asset classes (Lexicon 02; hues fixed by 02 §3) and their type
// lists, mirrored from listings/spec_data.py — names must match exactly
// (spec templates key on class+type).
import type { AssetClass } from "./types";

export type AssetClassMeta = {
  value: AssetClass;
  label: string;
  /** class/* semantic color utilities (02 §3) */
  text: string;
  bg: string;
  dot: string;
  types: string[];
};

export const ASSET_CLASSES: AssetClassMeta[] = [
  {
    value: "plant_machinery",
    label: "Plant & Machinery",
    text: "text-earth-300",
    bg: "bg-earth-400/12",
    dot: "bg-class-plant",
    types: [
      "Excavator",
      "Bulldozer",
      "Wheel Loader / Backhoe",
      "Grader",
      "Roller / Compactor",
      "Mobile Crane",
      "Tower Crane",
      "Boom / Scissor Lift",
      "Forklift (industrial)",
      "Concrete Mixer (transit)",
      "Concrete Pump",
      "Generator",
      "Air Compressor",
      "Drilling Rig",
      "Welding Machine",
    ],
  },
  {
    value: "trucks_haulage",
    label: "Trucks & Haulage",
    text: "text-blue-300",
    bg: "bg-blue-400/12",
    dot: "bg-class-trucks",
    types: [
      "Tipper / Dump Truck",
      "Flatbed Truck",
      "Box / Covered Truck",
      "Lowbed / Lowboy Trailer",
      "Fuel / Chemical Tanker",
      "Water Bowser",
      "Crane Truck (Hiab)",
      "Reach Stacker / Container Handler",
      "Truck Head (tractor unit)",
    ],
  },
  {
    value: "warehousing",
    label: "Warehousing & Storage",
    text: "text-teal-300",
    bg: "bg-teal-400/12",
    dot: "bg-class-warehouse",
    types: ["Dry Warehouse", "Cold Storage", "Bonded Warehouse", "Distribution Centre", "Self-Storage Unit"],
  },
  {
    value: "terminals_yards",
    label: "Terminals & Container Yards",
    text: "text-violet-300",
    bg: "bg-violet-400/12",
    dot: "bg-class-terminals",
    types: ["Port Terminal", "ICD", "Container Yard / Bonded Depot"],
  },
  {
    value: "land_staging",
    label: "Land & Staging",
    text: "text-pink-300",
    bg: "bg-pink-400/12",
    dot: "bg-class-land",
    types: ["Fabrication Yard", "Laydown", "Marshalling", "Industrial Land"],
  },
];

export const CLASS_BY_VALUE = Object.fromEntries(ASSET_CLASSES.map((c) => [c.value, c])) as Record<
  AssetClass,
  AssetClassMeta
>;
