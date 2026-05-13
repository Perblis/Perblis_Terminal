import { Construction, Truck, Warehouse, Container, Fence, type LucideProps } from "lucide-react";

import type { ResourceType } from "@/lib/constants";

/**
 * Resource type icon. Per TDS, categories are encoded by icon — not color —
 * so callers should not tint these by resource type. All five share neutral
 * surfaces and the same stroke color.
 */
const map: Record<ResourceType, React.ComponentType<LucideProps>> = {
  equipment: Construction,
  vehicle: Truck,
  warehouse: Warehouse,
  terminal: Container,
  facility: Fence,
};

export function ResourceIcon({
  type,
  strokeWidth = 1.5,
  ...rest
}: { type: ResourceType } & LucideProps) {
  const C = map[type] ?? Construction;
  return <C strokeWidth={strokeWidth} aria-hidden {...rest} />;
}
