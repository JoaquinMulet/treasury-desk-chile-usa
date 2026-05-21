import { cn } from "@/lib/utils";

/**
 * Tabla densa Bloomberg-style. Header uppercase muy chico, filas con hover sutil,
 * separadores horizontales finos, sin separadores verticales.
 */

export function FinTable({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("w-full overflow-x-auto", className)}>
      <table className="w-full text-xs">{children}</table>
    </div>
  );
}

export function FinThead({ children }: { children: React.ReactNode }) {
  return <thead className="border-b border-border">{children}</thead>;
}

export function FinTbody({ children }: { children: React.ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function FinTr({ children, className, onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) {
  return (
    <tr
      className={cn(
        "border-b border-border/60 transition-colors hover:bg-muted/30",
        onClick && "cursor-pointer",
        className,
      )}
      onClick={onClick}
    >
      {children}
    </tr>
  );
}

export function FinTh({ children, className, align = "left" }: { children?: React.ReactNode; className?: string; align?: "left" | "right" | "center" }) {
  return (
    <th
      className={cn(
        "px-2 py-1.5 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function FinTd({ children, className, align = "left", numeric }: { children?: React.ReactNode; className?: string; align?: "left" | "right" | "center"; numeric?: boolean }) {
  return (
    <td
      className={cn(
        "px-2 py-1.5",
        align === "right" && "text-right",
        align === "center" && "text-center",
        numeric && "num",
        className,
      )}
    >
      {children}
    </td>
  );
}
