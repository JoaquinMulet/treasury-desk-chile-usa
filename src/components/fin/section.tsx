import { cn } from "@/lib/utils";

/**
 * Section header Bloomberg-style: línea separadora con título uppercase.
 */
export function Section({
  title,
  subtitle,
  right,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex items-end justify-between border-b border-border pb-2">
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/90">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {right && <div className="flex items-center gap-2 text-xs text-muted-foreground">{right}</div>}
      </div>
      {children}
    </section>
  );
}

export function PageHeader({
  title,
  description,
  right,
}: {
  title: string;
  description?: string;
  right?: React.ReactNode;
}) {
  return (
    <header className="flex items-baseline justify-between border-b border-border pb-3">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-foreground">{title}</h1>
        {description && (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {right}
    </header>
  );
}

export function Panel({
  title,
  right,
  children,
  className,
  noPadding,
}: {
  title?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}) {
  return (
    <div className={cn("border border-border bg-card", className)}>
      {title && (
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/90">
            {title}
          </h3>
          {right && <div className="text-xs text-muted-foreground">{right}</div>}
        </div>
      )}
      <div className={cn(noPadding ? "" : "p-3")}>{children}</div>
    </div>
  );
}

export function KV({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between border-b border-border/50 py-1.5 text-xs last:border-b-0", className)}>
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground">{children}</span>
    </div>
  );
}
