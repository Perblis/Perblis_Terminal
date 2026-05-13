import { cn } from "@/lib/cn";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-6 flex items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        {eyebrow ? (
          <div className="text-text-tertiary text-[11px] tracking-[0.06em] uppercase">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="font-display mt-1 text-[28px] leading-none tracking-tight uppercase lg:text-[36px]">
          {title}
        </h1>
        {description ? (
          <p className="text-text-secondary mt-2 max-w-[640px] text-[14px]">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
