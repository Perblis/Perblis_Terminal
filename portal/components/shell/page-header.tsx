import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";

/** Portal page anatomy header (04 §6): breadcrumb → h1 + primary action. */
export function PageHeader({
  title,
  crumbs = [],
  action,
}: {
  title: string;
  crumbs?: { label: string; href?: string }[];
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-s2 pb-s5">
      {crumbs.length > 0 ? (
        <nav aria-label="Breadcrumb" className="flex items-center gap-s1 text-caption text-ink-500">
          {crumbs.map((crumb, i) => (
            <Fragment key={`${crumb.label}-${i}`}>
              {i > 0 ? <ChevronRight size={12} aria-hidden /> : null}
              {crumb.href ? (
                <Link href={crumb.href} className="hover:text-text-primary">
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-text-primary">{crumb.label}</span>
              )}
            </Fragment>
          ))}
        </nav>
      ) : null}
      <div className="flex items-center justify-between gap-s4">
        <h1 className="font-display text-h1 text-text-primary">{title}</h1>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </header>
  );
}
