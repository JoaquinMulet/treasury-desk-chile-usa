import { Card, CardContent } from "@/components/ui/card";
import { Construction } from "lucide-react";

export function PageStub({
  title,
  description,
  roadmap,
}: {
  title: string;
  description: string;
  roadmap?: string[];
}) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-start gap-4 py-10">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Construction className="h-5 w-5" />
            <span className="text-sm font-medium">Módulo en construcción</span>
          </div>
          {roadmap && roadmap.length > 0 && (
            <div className="text-sm">
              <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
                Contenido planeado
              </div>
              <ul className="space-y-1.5 text-foreground">
                {roadmap.map((r, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-muted-foreground">·</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
