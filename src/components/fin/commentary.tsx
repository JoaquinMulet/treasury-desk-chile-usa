import { cn } from "@/lib/utils";
import { BookOpen, GraduationCap } from "lucide-react";

/**
 * Caja de comentario académico — prosa explicativa para acompañar gráficos y datos.
 * Estética: texto justificado, letra 14px, leading generoso, max-width legible.
 */
export function Commentary({
  title = "Lectura académica",
  children,
  variant = "default",
  className,
}: {
  title?: string;
  children: React.ReactNode;
  variant?: "default" | "side" | "compact" | "highlight";
  className?: string;
}) {
  const Icon = variant === "compact" ? BookOpen : GraduationCap;

  return (
    <div
      className={cn(
        "border-l-2 border-border bg-card/40 px-5 py-4",
        variant === "side" && "h-full",
        variant === "highlight" && "border-[var(--color-info)] bg-[var(--color-info-bg)]",
        className,
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        <Icon
          className={cn(
            "h-3.5 w-3.5",
            variant === "highlight" ? "text-[var(--color-info)]" : "text-muted-foreground",
          )}
          strokeWidth={2}
        />
        <h4 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {title}
        </h4>
      </div>
      <div className="commentary-prose max-w-[78ch] space-y-3">
        {children}
      </div>
    </div>
  );
}

/**
 * Párrafo dentro de Commentary con tipografía consistente, justificado, 14px.
 */
export function P({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "text-[13.5px] leading-[1.7] text-foreground/90 [text-align:justify] [text-justify:inter-word] [hyphens:auto]",
        className,
      )}
    >
      {children}
    </p>
  );
}

/**
 * Término técnico destacado.
 */
export function Term({ children }: { children: React.ReactNode }) {
  return <span className="font-semibold text-foreground">{children}</span>;
}

/**
 * Cita académica al pie.
 */
export function Citation({ children }: { children: React.ReactNode }) {
  return (
    <p className="border-t border-border/60 pt-2.5 text-[12px] italic leading-[1.6] text-muted-foreground [text-align:justify]">
      {children}
    </p>
  );
}
