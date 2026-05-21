"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { toast } from "sonner";
import { PageHeader, Panel } from "@/components/fin/section";
import { Commentary, Term, P } from "@/components/fin/commentary";
import { FinTable, FinThead, FinTbody, FinTr, FinTh, FinTd } from "@/components/fin/fin-table";
import { BarGauge } from "@/components/fin/bar-gauge";
import { CLP } from "@/components/fin/num";
import { fmtCLP } from "@/lib/format";

type Bucket = { id: string; label: string; minDays: number; maxDays: number; targetPct: number; currentCLP: number };
type Obligation = { id: string; label: string; date: string; amountCLP: number; category: "tax" | "payroll" | "capex" | "dividend" | "supplier" | "other" };

const DEFAULT_BUCKETS: Bucket[] = [
  { id: "b1", label: "Overnight (<1m)", minDays: 0, maxDays: 30, targetPct: 25, currentCLP: 0 },
  { id: "b2", label: "Corto (1-3m)", minDays: 30, maxDays: 90, targetPct: 20, currentCLP: 0 },
  { id: "b3", label: "Medio-corto (3-12m)", minDays: 90, maxDays: 365, targetPct: 25, currentCLP: 0 },
  { id: "b4", label: "Medio (1-3y)", minDays: 365, maxDays: 365 * 3, targetPct: 15, currentCLP: 0 },
  { id: "b5", label: "Largo (3-7y)", minDays: 365 * 3, maxDays: 365 * 7, targetPct: 10, currentCLP: 0 },
  { id: "b6", label: "Extra-largo (7y+)", minDays: 365 * 7, maxDays: 365 * 30, targetPct: 5, currentCLP: 0 },
];

export default function CashLadderPage() {
  const [buckets, setBuckets] = useLocalStorage<Bucket[]>("cashladder.buckets", DEFAULT_BUCKETS);
  const [obligations, setObligations] = useLocalStorage<Obligation[]>("cashladder.obligations", []);
  const [openOb, setOpenOb] = useState(false);

  const total = buckets.reduce((s, b) => s + b.currentCLP, 0);
  const upcoming = useMemo(() => {
    const now = new Date();
    return [...obligations]
      .map((o) => ({
        ...o,
        days: Math.floor((new Date(o.date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
      }))
      .filter((o) => o.days >= -7)
      .sort((a, b) => a.days - b.days);
  }, [obligations]);

  const obligationsByBucket = useMemo(() => {
    return buckets.map((b) => {
      const items = upcoming.filter((o) => o.days >= b.minDays && o.days < b.maxDays);
      const amount = items.reduce((s, o) => s + o.amountCLP, 0);
      const currentPct = total > 0 ? (b.currentCLP / total) * 100 : 0;
      const gap = currentPct - b.targetPct;
      const coverage = amount > 0 ? b.currentCLP / amount : Infinity;
      return { ...b, obligationCount: items.length, obligationAmount: amount, coverage, currentPct, gap };
    });
  }, [buckets, upcoming, total]);

  function updateBucket(id: string, field: keyof Bucket, value: number) {
    setBuckets(buckets.map((b) => (b.id === id ? { ...b, [field]: value } : b)));
  }

  function addObligation(o: Omit<Obligation, "id">) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setObligations([...obligations, { ...o, id }]);
    setOpenOb(false);
    toast.success(`Obligación agregada: ${o.label}`);
  }

  function removeObligation(id: string) {
    setObligations(obligations.filter((o) => o.id !== id));
  }

  const gaps = obligationsByBucket.filter((b) => b.obligationAmount > 0 && b.coverage < 1);
  const imbalances = obligationsByBucket.filter((b) => Math.abs(b.gap) > 7);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Cash Ladder"
        description="Segmentación de caja por horizonte · match con calendario de obligaciones"
      />

      <Commentary title="Cash ladder · liability-driven investment para tesorería">
        <P>
          El <Term>cash ladder</Term> aplica <Term>liability-driven investment (LDI)</Term> a tesorería corporativa:
          la caja se segmenta por horizonte de liquidez y cada bucket se invierte en instrumentos con duración
          compatible. El enfoque viene de la gestión de fondos de pensiones (Leibowitz 1986) y se generaliza a
          cualquier entidad con pasivos predecibles. El principio rector es <Term>asset-liability matching</Term>:
          minimizar la diferencia entre la duración de activos y pasivos para reducir el riesgo de reinversión y
          de tasas.
        </P>
        <P>
          La política target por bucket refleja tres restricciones: cobertura de obligaciones conocidas, reserva de
          seguridad para imprevistos, y captura del term premium en plazos largos. Una asignación conservadora
          típica para tesorería empresarial es 50% en buckets bajo 1 año, 35% entre 1 y 3 años, y 15% en 3 años o
          más. Más exposición a duración larga aumenta el carry pero también el riesgo de mark-to-market.
        </P>
      </Commentary>

      <Panel title="Política de asignación · horizontes y coverage">
        <FinTable>
          <FinThead>
            <FinTr>
              <FinTh>Bucket</FinTh>
              <FinTh align="right">Días</FinTh>
              <FinTh align="right">Target %</FinTh>
              <FinTh align="right">Actual CLP</FinTh>
              <FinTh align="right">Actual %</FinTh>
              <FinTh align="right">Gap</FinTh>
              <FinTh align="right">Obligaciones</FinTh>
              <FinTh align="right">Coverage</FinTh>
              <FinTh>Distribución</FinTh>
            </FinTr>
          </FinThead>
          <FinTbody>
            {obligationsByBucket.map((b) => {
              const gapColor = Math.abs(b.gap) < 3 ? "text-[var(--color-pos)]" : Math.abs(b.gap) < 7 ? "text-[var(--color-warn)]" : "text-[var(--color-neg)]";
              return (
                <FinTr key={b.id}>
                  <FinTd className="font-medium">{b.label}</FinTd>
                  <FinTd align="right" className="text-[10px] text-muted-foreground">{b.minDays}–{b.maxDays}</FinTd>
                  <FinTd align="right">
                    <Input
                      className="h-6 w-16 ml-auto text-right font-mono text-xs"
                      type="number"
                      value={b.targetPct}
                      onChange={(e) => updateBucket(b.id, "targetPct", parseFloat(e.target.value) || 0)}
                    />
                  </FinTd>
                  <FinTd align="right">
                    <Input
                      className="h-6 w-32 ml-auto text-right font-mono text-xs"
                      type="number"
                      value={b.currentCLP}
                      onChange={(e) => updateBucket(b.id, "currentCLP", parseFloat(e.target.value) || 0)}
                    />
                  </FinTd>
                  <FinTd align="right" numeric>{b.currentPct.toFixed(1)}%</FinTd>
                  <FinTd align="right">
                    <span className={`num ${gapColor}`}>
                      {b.gap > 0 ? "+" : ""}{b.gap.toFixed(1)}pp
                    </span>
                  </FinTd>
                  <FinTd align="right" numeric>{b.obligationCount}</FinTd>
                  <FinTd align="right">
                    {b.obligationAmount > 0 ? (
                      <span className={`pill ${b.coverage >= 1 ? "border-[var(--color-pos)] text-[var(--color-pos)]" : "border-[var(--color-neg)] text-[var(--color-neg)]"}`}>
                        {b.coverage >= 100 ? "∞" : `${(b.coverage * 100).toFixed(0)}%`}
                      </span>
                    ) : <span className="text-[10px] text-muted-foreground">—</span>}
                  </FinTd>
                  <FinTd>
                    <div className="w-24">
                      <BarGauge value={b.currentPct} max={Math.max(b.targetPct * 2, 30)} color="#4493f8" height={4} />
                    </div>
                  </FinTd>
                </FinTr>
              );
            })}
            <FinTr className="border-t-2 border-border font-semibold">
              <FinTd>Total</FinTd>
              <FinTd></FinTd>
              <FinTd align="right" numeric>{buckets.reduce((s, b) => s + b.targetPct, 0)}%</FinTd>
              <FinTd align="right"><CLP value={total} /></FinTd>
              <FinTd align="right" numeric>100%</FinTd>
              <FinTd></FinTd>
              <FinTd align="right" numeric>{upcoming.length}</FinTd>
              <FinTd></FinTd>
              <FinTd></FinTd>
            </FinTr>
          </FinTbody>
        </FinTable>
      </Panel>

      <Commentary title="Riesgo de liquidez · concepto y métricas">
        <P>
          El <Term>riesgo de liquidez</Term> es distinto al riesgo de tasas: mide la capacidad de convertir
          activos en cash sin pérdida material en el horizonte requerido. Para tesorería, dos conceptos clave:
          <Term>funding liquidity</Term> (capacidad de financiar obligaciones cuando se vencen) y <Term>market
          liquidity</Term> (capacidad de transar instrumentos sin mover el precio). Un activo puede tener alta
          duration pero baja market liquidity (bonos corporativos pequeños), o baja duration pero baja funding
          liquidity (DPF con multas por rescate anticipado).
        </P>
        <P>
          Métricas operativas: <Term>tracking error</Term> entre obligaciones proyectadas y disponibilidad real
          por bucket (volatilidad del gap), <Term>z-score</Term> del coverage ratio versus histórico de la
          empresa, y stress testing con <Term>tail events</Term> de liquidez (e.g., aceleración de pagos a
          proveedores, dividendos extraordinarios, oportunidades de M&amp;A). El framework completo combina
          <Term>liability-driven investing</Term> con buffers de seguridad calibrados al percentil 95 de
          variabilidad histórica.
        </P>
      </Commentary>

      <Commentary title="Coverage ratio y diagnóstico de liquidez" variant="compact">
        <P>
          El <Term>coverage ratio</Term> por bucket es <span className="num">caja_disponible / obligaciones_del_plazo</span>.
          Un valor &lt;100% indica gap de liquidez: faltan recursos en ese horizonte para cumplir obligaciones
          conocidas. La práctica recomendada es coverage ratio ≥ 120% para buckets con obligaciones rígidas
          (impuestos, payroll) y ≥ 150% para los más cortos (overnight) donde la flexibilidad operativa es crítica.
          Valores muy altos (&gt;500%) en buckets cortos sugieren sub-óptima asignación: hay caja inactiva que podría
          generar carry en buckets más largos sin comprometer cumplimiento.
        </P>
      </Commentary>

      <Commentary title="Collateral yield · el componente subestimado del retorno de tesorería">
        <P>
          Mulvey, Simsek y Kaul (2003) descomponen el retorno total de una estrategia trend-following de futuros
          en tres componentes: <Term>collateral yield</Term> (rendimiento del cash colateral mientras la
          estrategia no está desplegada), <Term>trend gains</Term> (resultado direccional de las posiciones
          activas) y <Term>rebalancing gains</Term> (efecto compounding de reequilibrios sistemáticos). El
          hallazgo del paper es que el collateral yield es históricamente <Term>el componente más grande</Term>
          de los tres. Aplicado a tesorería: el rendimiento del cash inactivo en los buckets cortos aporta más
          al retorno agregado que cualquier ganancia táctica en los buckets largos.
        </P>
        <P>
          Faber (2013, Extension 2) examina la decisión simétrica para asset allocation: invertir el bucket de
          caja en T-bills versus en Treasury 10Y. Sobre 1973–2012 el cambio agrega 137 bps anuales con
          aumento de volatilidad de 7.09% a 8.14% y drawdown de −10.74% a −11.90%. El test crítico es la
          ventana 1973–1981 de alzas sostenidas de tasas, donde a priori extender duración debería penalizar:
          aun ahí el portafolio con cash en 10Y superó al de T-bills (13.69% vs 12.09%). La explicación: el
          carry del 10Y supera el drag de mark-to-market en horizontes anuales si el filtro táctico está
          activo. La aplicación a tesorería empresarial es directa — un bucket overnight en money market y
          uno corto en duración 2–4 capturan collateral yield superior al de un 100% overnight.
        </P>
      </Commentary>

      <Panel
        title="Calendario de obligaciones"
        right={
          <Dialog open={openOb} onOpenChange={setOpenOb}>
            <DialogTrigger render={<Button size="sm"><Plus className="mr-1 h-3 w-3" />Obligación</Button>} />
            <DialogContent>
              <DialogHeader><DialogTitle>Nueva obligación</DialogTitle></DialogHeader>
              <ObligationForm onSubmit={addObligation} />
            </DialogContent>
          </Dialog>
        }
      >
        {upcoming.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted-foreground">
            Sin obligaciones registradas. Agrega impuestos, payroll, dividendos, capex, etc.
          </div>
        ) : (
          <FinTable>
            <FinThead>
              <FinTr>
                <FinTh>Concepto</FinTh>
                <FinTh>Categoría</FinTh>
                <FinTh>Fecha</FinTh>
                <FinTh align="right">Días</FinTh>
                <FinTh align="right">Monto CLP</FinTh>
                <FinTh></FinTh>
              </FinTr>
            </FinThead>
            <FinTbody>
              {upcoming.map((o) => (
                <FinTr key={o.id}>
                  <FinTd className="font-medium">{o.label}</FinTd>
                  <FinTd><span className="pill border-border text-muted-foreground">{o.category}</span></FinTd>
                  <FinTd className="text-[10px]">{o.date}</FinTd>
                  <FinTd align="right">
                    <span className={`num ${o.days < 0 ? "text-[var(--color-neg)]" : o.days < 30 ? "text-[var(--color-warn)]" : ""}`}>
                      {o.days}
                    </span>
                  </FinTd>
                  <FinTd align="right"><CLP value={o.amountCLP} /></FinTd>
                  <FinTd>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeObligation(o.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </FinTd>
                </FinTr>
              ))}
            </FinTbody>
          </FinTable>
        )}
      </Panel>

      {(gaps.length > 0 || imbalances.length > 0 || total > 0) && (
        <Panel title="Diagnóstico">
          <div className="space-y-2 text-xs">
            {gaps.map((b) => (
              <div key={b.id} className="border-l-2 border-[var(--color-neg)] bg-[var(--color-neg-bg)] px-3 py-2">
                <span className="font-medium text-[var(--color-neg)]">Gap liquidez · </span>
                <span className="text-muted-foreground">
                  {b.label} tiene obligaciones por <span className="num text-foreground">{fmtCLP(b.obligationAmount)}</span> · disponible <span className="num text-foreground">{fmtCLP(b.currentCLP)}</span> · coverage <span className="num">{(b.coverage * 100).toFixed(0)}%</span>
                </span>
              </div>
            ))}
            {imbalances.map((b) => (
              <div key={b.id} className="border-l-2 border-[var(--color-warn)] bg-[var(--color-warn-bg)] px-3 py-2">
                <span className="font-medium text-[var(--color-warn)]">Desbalance · </span>
                <span className="text-muted-foreground">
                  {b.label} actual <span className="num text-foreground">{b.currentPct.toFixed(1)}%</span> vs target <span className="num">{b.targetPct}%</span> (gap <span className="num">{b.gap > 0 ? "+" : ""}{b.gap.toFixed(1)}pp</span>)
                </span>
              </div>
            ))}
            {gaps.length === 0 && imbalances.length === 0 && total > 0 && (
              <div className="border-l-2 border-[var(--color-pos)] bg-[var(--color-pos-bg)] px-3 py-2 text-[var(--color-pos)]">
                Política de tesorería en cumplimiento · sin gaps detectados
              </div>
            )}
          </div>
        </Panel>
      )}
    </div>
  );
}

function ObligationForm({ onSubmit }: { onSubmit: (o: Omit<Obligation, "id">) => void }) {
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState<Obligation["category"]>("tax");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [amountCLP, setAmountCLP] = useState(0);
  return (
    <form className="grid grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); onSubmit({ label, category, date, amountCLP }); }}>
      <div className="col-span-2"><Label className="text-[10px] uppercase tracking-wider">Concepto</Label><Input className="mt-1" value={label} onChange={(e) => setLabel(e.target.value)} required /></div>
      <div>
        <Label className="text-[10px] uppercase tracking-wider">Categoría</Label>
        <Select value={category} onValueChange={(v) => v && setCategory(v as Obligation["category"])}>
          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="tax">Impuestos</SelectItem><SelectItem value="payroll">Sueldos</SelectItem>
            <SelectItem value="capex">Capex</SelectItem><SelectItem value="dividend">Dividendos</SelectItem>
            <SelectItem value="supplier">Proveedores</SelectItem><SelectItem value="other">Otro</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div><Label className="text-[10px] uppercase tracking-wider">Fecha</Label><Input className="mt-1" type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></div>
      <div className="col-span-2"><Label className="text-[10px] uppercase tracking-wider">Monto CLP</Label><Input className="mt-1 font-mono" type="number" value={amountCLP} onChange={(e) => setAmountCLP(parseFloat(e.target.value) || 0)} required /></div>
      <div className="col-span-2 flex justify-end"><Button type="submit">Agregar</Button></div>
    </form>
  );
}
