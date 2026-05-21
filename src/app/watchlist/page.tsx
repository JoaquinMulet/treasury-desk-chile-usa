"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Bell, Plus, Trash2 } from "lucide-react";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { toast } from "sonner";
import { lastValueClient as lastValue, BCChKey, BCCH_SERIES } from "@/lib/data/bcch-client";
import { US_SNAPSHOT } from "@/lib/data/market";
import { PageHeader, Panel } from "@/components/fin/section";
import { FinTable, FinThead, FinTbody, FinTr, FinTh, FinTd } from "@/components/fin/fin-table";
import { MetricTile } from "@/components/fin/metric-tile";
import { Num } from "@/components/fin/num";
import { Commentary, Term, P } from "@/components/fin/commentary";

type AlertOp = ">" | "<" | "=";
type AlertTarget = { kind: "bcch"; key: BCChKey } | { kind: "us"; metric: "us_10y" | "us_30y" | "tlt" | "edv" | "move" | "dxy" };

type Alert = { id: string; name: string; target: AlertTarget; operator: AlertOp; threshold: number; enabled: boolean };

function getValue(t: AlertTarget): number | null {
  if (t.kind === "bcch") return lastValue(t.key)?.value ?? null;
  if (t.metric === "us_10y") return US_SNAPSHOT.yields.us_10y;
  if (t.metric === "us_30y") return US_SNAPSHOT.yields.us_30y;
  if (t.metric === "tlt") return US_SNAPSHOT.etfs.tlt;
  if (t.metric === "edv") return US_SNAPSHOT.etfs.edv;
  if (t.metric === "move") return US_SNAPSHOT.vol.move;
  if (t.metric === "dxy") return US_SNAPSHOT.fx.dxy;
  return null;
}

function triggered(v: number | null, op: AlertOp, threshold: number): boolean {
  if (v == null) return false;
  if (op === ">") return v > threshold;
  if (op === "<") return v < threshold;
  return Math.abs(v - threshold) < 0.01;
}

export default function WatchlistPage() {
  const [alerts, setAlerts] = useLocalStorage<Alert[]>("watchlist.alerts", []);
  const [open, setOpen] = useState(false);

  function addAlert(a: Omit<Alert, "id">) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setAlerts([...alerts, { ...a, id }]);
    setOpen(false);
    toast.success(`Alerta agregada: ${a.name}`);
  }
  function toggleAlert(id: string) {
    setAlerts(alerts.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a)));
  }
  function removeAlert(id: string) {
    setAlerts(alerts.filter((a) => a.id !== id));
  }

  const triggeredCount = alerts.filter((a) => a.enabled && triggered(getValue(a.target), a.operator, a.threshold)).length;
  const activeCount = alerts.filter((a) => a.enabled).length;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Watchlist · Alertas"
        description="Niveles configurables · evaluación contra cierre actual"
        right={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button size="sm"><Plus className="mr-1 h-3 w-3" />Alerta</Button>} />
            <DialogContent>
              <DialogHeader><DialogTitle>Nueva alerta</DialogTitle></DialogHeader>
              <AlertForm onSubmit={addAlert} />
            </DialogContent>
          </Dialog>
        }
      />

      <Commentary title="Niveles técnicos y disparadores operacionales">
        <P>
          Las alertas operan sobre <Term>niveles técnicos pre-definidos</Term>: umbrales en yields, precios o
          spreads que, al ser cruzados, gatillan una revisión de tesis. Provienen de tres fuentes: (1) <Term>análisis
          histórico</Term> (mínimos/máximos previos del instrumento funcionan como soportes y resistencias);
          (2) <Term>niveles psicológicos redondos</Term> (UST 10Y cruzando 5% como umbral mental para market
          participants); (3) <Term>estructura de la curva</Term> (inversión 2s10s como predictor de recesión).
        </P>
        <P>
          La disciplina de configurar alertas antes de que se gatillen es una forma de <Term>pre-commitment</Term>
          que mitiga sesgos comportamentales: en el momento del shock, el operador tiene un plan pre-cocinado en
          lugar de tomar decisiones bajo stress. La práctica recomendada es alertar sobre niveles asimétricos: más
          alertas en los lados donde no se quiere estar (excess yields para una posición long duration) que en los
          favorables.
        </P>
      </Commentary>

      <div className="grid grid-cols-3 gap-2">
        <MetricTile label="Total alertas" value={alerts.length.toString()} />
        <MetricTile label="Activas" value={activeCount.toString()} pill={activeCount > 0 ? { label: "MONITOREO", tone: "info" } : undefined} />
        <MetricTile
          label="Disparadas"
          value={triggeredCount.toString()}
          pill={triggeredCount > 0 ? { label: "ATENCIÓN", tone: "neg" } : undefined}
        />
      </div>

      <Commentary title="Mecánica de evaluación · operadores y umbrales" variant="compact">
        <P>
          Cada alerta se compone de cuatro elementos: <Term>métrica</Term> (la variable a monitorear — yield 10Y,
          spread 2s10s, precio TLT, VIX/MOVE), <Term>operador</Term> (mayor que, menor que, igual a), <Term>umbral</Term>
          (el nivel a comparar) y <Term>estado</Term> (activa/pausada). La evaluación ocurre contra el último cierre
          disponible: el sistema reporta DISPARADA cuando se cumple la condición, MONITOREO cuando está activa pero
          no se cumple, y PAUSA cuando el usuario la desactivó.
        </P>
        <P>
          La práctica recomendada es asimetría direccional: para una posición long-duration (apuesta a baja de
          tasas), configurar más alertas en el lado adverso (yield subiendo, MOVE elevándose) que en el favorable.
          Esto contrarresta el sesgo de confirmación (<Term>behavioral finance</Term>) — buscamos evidencia que
          invalide la tesis activa, no que la confirme. Niveles típicos: alertar a 2σ por encima de la media
          histórica (equivalente a percentil 97.5 en distribución normal), o cuando la métrica cruza un
          <Term>percentile</Term> extremo (p95 o p5) en histórico de 5 años. El <Term>z-score</Term> normalizado
          es la métrica universal: <span className="num">(observado − media) / σ</span>. Para identificar
          <Term>tail events</Term> que justifiquen revisión de posición, el umbral típico es |z|≥2.5.
        </P>
      </Commentary>

      <Panel title="Alertas configuradas">
        {alerts.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            Sin alertas. Ejemplos típicos:&nbsp;
            <span className="font-mono">USA 10Y &gt; 5%</span>,&nbsp;
            <span className="font-mono">TLT &lt; 80</span>,&nbsp;
            <span className="font-mono">MOVE &gt; 100</span>.
          </div>
        ) : (
          <FinTable>
            <FinThead>
              <FinTr>
                <FinTh></FinTh>
                <FinTh>Nombre</FinTh>
                <FinTh>Métrica</FinTh>
                <FinTh>Condición</FinTh>
                <FinTh align="right">Valor actual</FinTh>
                <FinTh>Estado</FinTh>
                <FinTh></FinTh>
              </FinTr>
            </FinThead>
            <FinTbody>
              {alerts.map((a) => {
                const v = getValue(a.target);
                const trig = a.enabled && triggered(v, a.operator, a.threshold);
                return (
                  <FinTr key={a.id}>
                    <FinTd>
                      <input type="checkbox" checked={a.enabled} onChange={() => toggleAlert(a.id)} />
                    </FinTd>
                    <FinTd className="font-medium">{a.name}</FinTd>
                    <FinTd className="text-[10px]">
                      {a.target.kind === "bcch" ? `BCCh · ${BCCH_SERIES[a.target.key].name}` : `USA · ${a.target.metric}`}
                    </FinTd>
                    <FinTd numeric>{a.operator} {a.threshold}</FinTd>
                    <FinTd align="right"><Num value={v} decimals={3} /></FinTd>
                    <FinTd>
                      {trig ? (
                        <span className="pill border-[var(--color-neg)] text-[var(--color-neg)]">
                          <Bell className="mr-1 h-2.5 w-2.5" />DISPARADA
                        </span>
                      ) : a.enabled ? (
                        <span className="pill border-[var(--color-info)] text-[var(--color-info)]">MONITOREO</span>
                      ) : (
                        <span className="pill border-border text-muted-foreground">PAUSA</span>
                      )}
                    </FinTd>
                    <FinTd>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeAlert(a.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </FinTd>
                  </FinTr>
                );
              })}
            </FinTbody>
          </FinTable>
        )}
      </Panel>
    </div>
  );
}

function AlertForm({ onSubmit }: { onSubmit: (a: Omit<Alert, "id">) => void }) {
  const [name, setName] = useState("");
  const [source, setSource] = useState<"bcch" | "us">("us");
  const [bcchKey, setBcchKey] = useState<BCChKey>("uf_10y");
  const [usMetric, setUsMetric] = useState<"us_10y" | "us_30y" | "tlt" | "edv" | "move" | "dxy">("us_10y");
  const [operator, setOperator] = useState<AlertOp>(">");
  const [threshold, setThreshold] = useState(5);

  return (
    <form className="grid grid-cols-2 gap-3" onSubmit={(e) => {
      e.preventDefault();
      const target: AlertTarget = source === "bcch" ? { kind: "bcch", key: bcchKey } : { kind: "us", metric: usMetric };
      onSubmit({ name, target, operator, threshold, enabled: true });
    }}>
      <div className="col-span-2">
        <Label className="text-[10px] uppercase tracking-wider">Nombre</Label>
        <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="USA 10Y rompe 5%" required />
      </div>
      <div>
        <Label className="text-[10px] uppercase tracking-wider">Fuente</Label>
        <Select value={source} onValueChange={(v) => v && setSource(v as "bcch" | "us")}>
          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="us">USA · Yahoo</SelectItem>
            <SelectItem value="bcch">Chile · BCCh</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-[10px] uppercase tracking-wider">Métrica</Label>
        {source === "bcch" ? (
          <Select value={bcchKey} onValueChange={(v) => v && setBcchKey(v as BCChKey)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(BCCH_SERIES) as BCChKey[]).map((k) => (
                <SelectItem key={k} value={k}>{BCCH_SERIES[k].name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Select value={usMetric} onValueChange={(v) => v && setUsMetric(v as typeof usMetric)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="us_10y">USA 10Y</SelectItem>
              <SelectItem value="us_30y">USA 30Y</SelectItem>
              <SelectItem value="tlt">TLT</SelectItem>
              <SelectItem value="edv">EDV</SelectItem>
              <SelectItem value="move">MOVE</SelectItem>
              <SelectItem value="dxy">DXY</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>
      <div>
        <Label className="text-[10px] uppercase tracking-wider">Operador</Label>
        <Select value={operator} onValueChange={(v) => v && setOperator(v as AlertOp)}>
          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value=">">Mayor que</SelectItem>
            <SelectItem value="<">Menor que</SelectItem>
            <SelectItem value="=">Igual a</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-[10px] uppercase tracking-wider">Umbral</Label>
        <Input className="mt-1 font-mono" type="number" step="any" value={threshold} onChange={(e) => setThreshold(parseFloat(e.target.value) || 0)} required />
      </div>
      <div className="col-span-2 flex justify-end">
        <Button type="submit">Crear</Button>
      </div>
    </form>
  );
}
