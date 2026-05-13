import Link from "next/link";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

export function EmptyState({
  title,
  hint,
  cta,
  className,
}: {
  title: string;
  hint?: string;
  cta?: { label: string; href?: string; onClick?: () => void };
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-5 py-12 text-center",
        className,
      )}
    >
      <div className="font-body text-text-primary text-[15px]">{title}</div>
      {hint ? <div className="font-body text-text-secondary text-[13px]">{hint}</div> : null}
      {cta ? (
        cta.href ? (
          <Button asChild>
            <Link href={cta.href}>{cta.label}</Link>
          </Button>
        ) : (
          <Button onClick={cta.onClick}>{cta.label}</Button>
        )
      ) : null}
    </div>
  );
}
