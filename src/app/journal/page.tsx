"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Search } from "lucide-react";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { toast } from "sonner";
import { PageHeader, Panel } from "@/components/fin/section";
import { Commentary, Term, P } from "@/components/fin/commentary";

type Entry = {
  id: string;
  date: string;
  title: string;
  type: "buy" | "sell" | "rebalance" | "thesis" | "post-mortem";
  thesis: string;
  alternatives: string;
  result?: string;
  lessons?: string;
  tags: string[];
};

const TYPE_COLORS: Record<Entry["type"], string> = {
  buy: "border-[var(--color-pos)] text-[var(--color-pos)]",
  sell: "border-[var(--color-neg)] text-[var(--color-neg)]",
  rebalance: "border-[var(--color-info)] text-[var(--color-info)]",
  thesis: "border-[var(--color-warn)] text-[var(--color-warn)]",
  "post-mortem": "border-border text-muted-foreground",
};

export default function JournalPage() {
  const [entries, setEntries] = useLocalStorage<Entry[]>("journal.entries", []);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = entries
    .filter((e) =>
      search === "" ||
      e.title.toLowerCase().includes(search.toLowerCase()) ||
      e.thesis.toLowerCase().includes(search.toLowerCase()) ||
      e.tags.some((t) => t.toLowerCase().includes(search.toLowerCase())),
    )
    .sort((a, b) => b.date.localeCompare(a.date));

  function addEntry(e: Omit<Entry, "id">) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setEntries([...entries, { ...e, id }]);
    setOpen(false);
    toast.success("Entrada agregada");
  }
  function removeEntry(id: string) {
    setEntries(entries.filter((e) => e.id !== id));
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Diario de decisiones"
        description="Trade journal · tesis · alternativas · resultado · lecciones"
        right={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button size="sm"><Plus className="mr-1 h-3 w-3" />Entrada</Button>} />
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>Nueva entrada de diario</DialogTitle></DialogHeader>
              <EntryForm onSubmit={addEntry} />
            </DialogContent>
          </Dialog>
        }
      />

      <Commentary title="Trade journal · disciplina y aprendizaje">
        <P>
          El <Term>trade journal</Term> documenta cada decisión con tesis, alternativas consideradas, resultado y
          lecciones. Su función no es contable sino de <Term>mejora del proceso</Term>. La literatura de behavioral
          finance (Kahneman, Tversky, Thaler) documenta que sin registro escrito los operadores re-escriben su
          historia, sobre-pesando éxitos y olvidando errores. El journal escrito es la forma estándar de mitigar
          ese sesgo: las palabras al momento de la decisión son inmutables.
        </P>
        <P>
          Para hacer el journal efectivo, cada entrada debe responder cuatro preguntas: ¿cuál es la tesis y qué evidencia
          la sustenta?, ¿qué alternativas se consideraron y por qué se descartaron?, ¿cuáles son los <Term>kill
          criteria</Term> que invalidarían la tesis?, ¿cómo se medirá el éxito? Revisar entradas a 3 meses, 1 año y 3
          años revela patrones de sesgo recurrentes: overconfidence en tesis macro, anclaje sobre niveles redondos, sesgo de
          actualidad tras rallies.
        </P>
      </Commentary>

      <Panel>
        <div className="flex items-center gap-2">
          <Search className="h-3 w-3 text-muted-foreground" />
          <Input
            placeholder="Buscar en título, tesis o tags..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-7 max-w-md text-xs"
          />
          <span className="pill border-border text-muted-foreground ml-auto">{filtered.length} entradas</span>
        </div>
      </Panel>

      <Commentary title="Taxonomía de entradas · de la tesis al post-mortem" variant="compact">
        <P>
          Cada entrada se clasifica por tipo: <Term>tesis</Term> (formulación inicial de hipótesis con evidencia y
          kill criteria), <Term>compra/venta</Term> (registro de transacción con tamaño y razón), <Term>rebalanceo</Term>
          (ajuste de allocation), o <Term>post-mortem</Term> (análisis retrospectivo de cómo evolucionó la tesis).
          Los <Term>tags</Term> permiten cross-cutting analysis: agrupar todas las decisiones &quot;tactical&quot;
          o &quot;duration&quot; para identificar patrones recurrentes en éxito y fracaso.
        </P>
        <P>
          La estructura clásica del post-mortem (Annie Duke en &quot;Thinking in Bets&quot;) separa dos preguntas
          frecuentemente confundidas: <Term>¿fue una buena decisión?</Term> (proceso correcto dado información
          disponible) versus <Term>¿fue un buen resultado?</Term> (outcome favorable). Trades pueden ser buenas
          decisiones con malos resultados (high variance) o malas decisiones con buenos resultados (luck). Sin
          separar estas dimensiones, el aprendizaje converge a optimización por outcome — un sesgo documentado
          que premia la suerte y penaliza el proceso.
        </P>
      </Commentary>

      <Commentary title="Sesgos conductuales que el journal mitiga · evidencia cuantitativa">
        <P>
          El argumento empírico para mantener un trade journal está en la <Term>brecha conductual</Term> (behavior
          gap): la diferencia sistemática entre el retorno del activo y el retorno que efectivamente captura el
          inversor por mal timing de entrada y salida. DALBAR (2008) midió que entre 1987 y 2007 el S&amp;P 500
          retornó 10%+ anual mientras el inversor promedio en fondos mutuos de equity capturó 4.48% — diferencia
          que aproxima la tasa de inflación del período. Dichev (2007) reportó la versión NASDAQ: el índice retornó 9.6% anual entre
          1973 y 2002, pero el dólar promedio invertido (ponderado por flujos) capturó solo 4.3% por
          concentrarse en 1998–2000. En el pico de la burbuja dot-com los flujos a fondos de acciones llegaron
          al 99% y 123% del flujo neto a fondos (1999 y 2000), señal canónica de capitulación del lado
          comprador.
        </P>
        <P>
          Los sesgos específicos documentados por la literatura conductual (Kahneman-Tversky 1979,
          prospect theory) que la disciplina del journal está diseñada para mitigar: <Term>overconfidence</Term>
          (82% de los conductores creen estar en el top 30% — Tilson 2005), <Term>aversión a pérdidas</Term>
          (el dolor de una pérdida pesa el doble que el placer de una ganancia equivalente — Tversky 1979),
          <Term> herding</Term> (los flujos retail se concentran en tops de ciclo y se evacúan en valles),
          <Term> anchoring</Term> (Warren Buffett confesó en la junta anual 2004 de Berkshire haber dejado
          USD 10 mil millones sobre la mesa por no haber comprado Wal-Mart cuando el precio se movió 1/8 sobre
          su anclaje inicial), <Term>information overload</Term> (Andreassen documentó que los inversores que
          siguen noticias intensivamente transan más y retornan menos que los que las ignoran). El journal
          escrito ataca dos vías: registra la tesis original antes del outcome (impide reescribir la historia)
          y obliga a documentar los <Term>kill criteria</Term> al inicio, lo que reduce el efecto de
          confirmación post-hoc.
        </P>
      </Commentary>

      {filtered.length === 0 ? (
        <Panel>
          <div className="py-8 text-center text-xs text-muted-foreground">
            {entries.length === 0
              ? "Sin entradas. Documenta cada decisión: tesis, alternativas, resultado, lecciones."
              : "Sin resultados para el filtro actual."}
          </div>
        </Panel>
      ) : (
        <div className="space-y-2">
          {filtered.map((e) => (
            <Panel key={e.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={"pill " + TYPE_COLORS[e.type]}>{e.type}</span>
                    <h3 className="text-sm font-semibold">{e.title}</h3>
                    {e.tags.map((t) => (
                      <span key={t} className="pill border-border text-muted-foreground">{t}</span>
                    ))}
                  </div>
                  <p className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">{e.date}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeEntry(e.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              <div className="mt-3 space-y-2 text-xs">
                <Section title="Tesis">{e.thesis}</Section>
                {e.alternatives && <Section title="Alternativas consideradas" muted>{e.alternatives}</Section>}
                {e.result && <Section title="Resultado">{e.result}</Section>}
                {e.lessons && <Section title="Lecciones" highlight>{e.lessons}</Section>}
              </div>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}

function Section({ title, children, muted, highlight }: { title: string; children: React.ReactNode; muted?: boolean; highlight?: boolean }) {
  return (
    <div className={highlight ? "border-l-2 border-[var(--color-warn)] bg-[var(--color-warn-bg)] px-3 py-2" : ""}>
      <h4 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{title}</h4>
      <p className={"mt-1 whitespace-pre-line " + (muted ? "text-muted-foreground" : "text-foreground")}>{children}</p>
    </div>
  );
}

function EntryForm({ onSubmit }: { onSubmit: (e: Omit<Entry, "id">) => void }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [title, setTitle] = useState("");
  const [type, setType] = useState<Entry["type"]>("thesis");
  const [thesis, setThesis] = useState("");
  const [alternatives, setAlternatives] = useState("");
  const [result, setResult] = useState("");
  const [lessons, setLessons] = useState("");
  const [tagsRaw, setTagsRaw] = useState("");

  return (
    <form className="grid grid-cols-2 gap-3" onSubmit={(e) => {
      e.preventDefault();
      onSubmit({ date, title, type, thesis, alternatives, result, lessons, tags: tagsRaw.split(",").map((t) => t.trim()).filter(Boolean) });
    }}>
      <div><Label className="text-[10px] uppercase tracking-wider">Fecha</Label><Input className="mt-1" type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></div>
      <div>
        <Label className="text-[10px] uppercase tracking-wider">Tipo</Label>
        <Select value={type} onValueChange={(v) => v && setType(v as Entry["type"])}>
          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="thesis">Tesis</SelectItem><SelectItem value="buy">Compra</SelectItem>
            <SelectItem value="sell">Venta</SelectItem><SelectItem value="rebalance">Rebalanceo</SelectItem>
            <SelectItem value="post-mortem">Post-mortem</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="col-span-2"><Label className="text-[10px] uppercase tracking-wider">Título</Label><Input className="mt-1" value={title} onChange={(e) => setTitle(e.target.value)} required /></div>
      <div className="col-span-2">
        <Label className="text-[10px] uppercase tracking-wider">Tesis</Label>
        <textarea className="mt-1 flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" value={thesis} onChange={(e) => setThesis(e.target.value)} required />
      </div>
      <div className="col-span-2">
        <Label className="text-[10px] uppercase tracking-wider">Alternativas</Label>
        <textarea className="mt-1 flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" value={alternatives} onChange={(e) => setAlternatives(e.target.value)} />
      </div>
      <div className="col-span-2">
        <Label className="text-[10px] uppercase tracking-wider">Resultado</Label>
        <textarea className="mt-1 flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" value={result} onChange={(e) => setResult(e.target.value)} />
      </div>
      <div className="col-span-2">
        <Label className="text-[10px] uppercase tracking-wider">Lecciones</Label>
        <textarea className="mt-1 flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" value={lessons} onChange={(e) => setLessons(e.target.value)} />
      </div>
      <div className="col-span-2"><Label className="text-[10px] uppercase tracking-wider">Tags (coma)</Label><Input className="mt-1" value={tagsRaw} onChange={(e) => setTagsRaw(e.target.value)} placeholder="tactical, duration, USA" /></div>
      <div className="col-span-2 flex justify-end"><Button type="submit">Guardar</Button></div>
    </form>
  );
}
