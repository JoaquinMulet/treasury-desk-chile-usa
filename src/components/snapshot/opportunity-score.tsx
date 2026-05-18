import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export type OpportunitySignal = {
  label: string;
  value: number; // -3..+3 z-score-like
  reason: string;
};

export function OpportunityScore({ signals }: { signals: OpportunitySignal[] }) {
  const composite =
    signals.length === 0 ? 0 : signals.reduce((s, x) => s + x.value, 0) / signals.length;
  const verdict = compositeVerdict(composite);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          <span>Score táctico — duración USA larga</span>
          <Badge variant={verdict.variant} className="text-xs">
            {verdict.label}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-baseline gap-3">
          <div className="text-3xl font-semibold tabular-nums">
            {composite > 0 ? "+" : ""}
            {composite.toFixed(2)}
          </div>
          <div className="text-xs text-muted-foreground">{verdict.hint}</div>
        </div>
        <div className="space-y-1.5">
          {signals.map((s) => (
            <div key={s.label} className="flex items-center justify-between text-xs">
              <div className="flex-1">
                <div className="font-medium">{s.label}</div>
                <div className="text-[11px] text-muted-foreground">{s.reason}</div>
              </div>
              <div
                className={
                  s.value > 0.5
                    ? "text-emerald-500 tabular-nums"
                    : s.value < -0.5
                    ? "text-red-500 tabular-nums"
                    : "text-muted-foreground tabular-nums"
                }
              >
                {s.value > 0 ? "+" : ""}
                {s.value.toFixed(2)}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function compositeVerdict(composite: number): {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
  hint: string;
} {
  if (composite >= 1.5)
    return {
      label: "Convicción alta",
      variant: "default",
      hint: "Múltiples señales alineadas con la tesis. Considerar entrada / aumento.",
    };
  if (composite >= 0.5)
    return {
      label: "Favorable",
      variant: "secondary",
      hint: "Sesgo positivo, pero validar timing antes de tamaño completo.",
    };
  if (composite >= -0.5)
    return {
      label: "Neutral",
      variant: "outline",
      hint: "Señales mixtas, sin convicción direccional clara.",
    };
  if (composite >= -1.5)
    return {
      label: "Adverso",
      variant: "secondary",
      hint: "Sesgo en contra, esperar mejor punto de entrada.",
    };
  return {
    label: "Contraindicado",
    variant: "destructive",
    hint: "Múltiples señales contra. No agregar posición.",
  };
}
