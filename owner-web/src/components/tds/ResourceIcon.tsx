import type { LucideIcon } from "lucide-react";
import { Construction, Truck, Warehouse, Container, Building2 } from "lucide-react";

import type { ResourceType } from "@/lib/constants";
import { cn } from "@/lib/cn";

/**
 * Resource type icon. Per TDS, categories are encoded by ICON, not color —
 * all five resource types share neutral surfaces and the same stroke color.
 */
const ICONS: Record<ResourceType, LucideIcon> = {
  equipment: Construction,
  vehicle: Truck,
  warehouse: Warehouse,
  terminal: Container,
  facility: Building2,
};

export function ResourceIcon({
  type,
  className,
  size = 20,
}: {
  type: ResourceType;
  className?: string;
  size?: number;
}) {
  const Icon = ICONS[type];
  return (
    <Icon
      aria-hidden
      width={size}
      height={size}
      strokeWidth={1.75}
      className={cn("text-text-primary", className)}
    />
  );
}
