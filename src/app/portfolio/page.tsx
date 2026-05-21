"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Trash2, Plus } from "lucide-react";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { toast } from "sonner";
import { PageHeader, Panel } from "@/components/fin/section";
import { Commentary, Term, P } from "@/components/fin/commentary";
import { FinTable, FinThead, FinTbody, FinTr, FinTh, FinTd } from "@/components/fin/fin-table";
import { MetricTile } from "@/components/fin/metric-tile";
import { BarGauge } from "@/components/fin/bar-gauge";
import { Num, CLP, Yld } from "@/components/fin/num";
import { fmtCLP } from "@/lib/format";
import { getFx } from "@/lib/data/fx";

type Currency = "CLP" | "UF" | "USD";
type AssetClass = "DPF" | "BTU" | "BTP" | "FM_MM" | "FM_RF" | "ETF" | "BOND_USA" | "EQUITY" | "CASH";

type Holding = {
  id: string;
  name: string;
  assetClass: AssetClass;
  currency: Currency;
  quantity: number;
  unitPrice: number;
  duration: number;
  yieldPct: number;
  acquisitionDate: string;
};

// FX vivo desde BCCh (data/bcch/_catalog.json) · refrescado por cron diario.
// Antes era hardcoded `{ CLP: 1, UF: 40763, USD: 906.68 }` — auditoría mayo 2026 lo cubrió.
const FX = getFx() as Record<Currency, number>;

const PALETTE: Record<string, string> = {
  DPF: "#8b949e", BTU: "#39d0d8", BTP: "#4493f8", FM_MM: "#8b949e",
  FM_RF: "#4493f8", ETF: "#3fb950", BOND_USA: "#f85149", EQUITY: "#d29922", CASH: "#8b949e",
  CLP: "#4493f8", UF: "#39d0d8", USD: "#3fb950",
};

export default function PortfolioPage() {
  const [holdings, setHoldings] = useLocalStorage<Holding[]>("portfolio.holdings", []);
  const [open, setOpen] = useState(false);

  const stats = useMemo(() => {
    let totalCLP = 0;
    const byClass: Record<string, number> = {};
    const byCurrency: Record<string, number> = {};
    let weightedDurNum = 0;
    let weightedYieldNum = 0;
    for (const h of holdings) {
      const valueCLP = h.quantity * h.unitPrice * FX[h.currency];
      totalCLP += valueCLP;
      byClass[h.assetClass] = (byClass[h.assetClass] || 0) + valueCLP;
      byCurrency[h.currency] = (byCurrency[h.currency] || 0) + valueCLP;
      weightedDurNum += valueCLP * h.duration;
      weightedYieldNum += valueCLP * h.yieldPct;
    }
    return {
      totalCLP,
      byClass,
      byCurrency,
      weightedDur: totalCLP > 0 ? weightedDurNum / totalCLP : 0,
      weightedYield: totalCLP > 0 ? weightedYieldNum / totalCLP : 0,
    };
  }, [holdings]);

  function addHolding(h: Omit<Holding, "id">) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setHoldings([...holdings, { ...h, id }]);
    setOpen(false);
    toast.success(`${h.name} agregado`);
  }

  function removeHolding(id: string) {
    setHoldings(holdings.filter((h) => h.id !== id));
    toast.info("Posición eliminada");
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Cartera"
        description="Holdings con valorización mark-to-market · persistencia localStorage"
        right={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button size="sm"><Plus className="mr-1 h-3 w-3" />Posición</Button>} />
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Nueva posición</DialogTitle>
              </DialogHeader>
              <HoldingForm onSubmit={addHolding} />
            </DialogContent>
          </Dialog>
        }
      />

      <Commentary title="Métricas agregadas de cartera de renta fija">
        <P>
          La <Term>duración ponderada</Term> es el promedio de las duraciones individuales ponderado por valor de
          mercado. Es la métrica fundamental de riesgo de tasas: la cartera completa responderá aproximadamente
          como un bono sintético con esa duración. <Term>Yield ponderado</Term> es similar pero para el rendimiento
          actual; representa el carry esperado anual a yields constantes. Ambas son aditivas linealmente en valor de
          mercado, propiedad útil para sizing y hedging.
        </P>
        <P>
          La descomposición por <Term>clase de activo</Term> y por <Term>moneda</Term> es la base del análisis de
          atribución de riesgo. Una cartera con 60% en duración USD (TLT, EDV) y 40% en duración UF (BTU) tiene
          dos fuentes principales de varianza: la tasa USA larga (correlación 0.7 entre TLT y BTU según análisis
          histórico) y el tipo de cambio CLP/USD. La regla práctica: si una clase concentra &gt;30% del riesgo total,
          es candidata a hedging o reducción.
        </P>
      </Commentary>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <MetricTile label="Valorización" value={<CLP value={stats.totalCLP} />} unit="CLP" />
        <MetricTile label="Duración pond." value={<Num value={stats.weightedDur} />} unit="años" />
        <MetricTile label="Yield pond." value={<Yld value={stats.weightedYield} />} />
        <MetricTile label="Posiciones" value={holdings.length.toString()} />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Panel title="Por clase de activo">
          <div className="space-y-2">
            {Object.entries(stats.byClass).length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">Sin datos</div>
            ) : (
              Object.entries(stats.byClass)
                .sort((a, b) => b[1] - a[1])
                .map(([k, v]) => {
                  const pct = stats.totalCLP > 0 ? (v / stats.totalCLP) * 100 : 0;
                  return (
                    <div key={k}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium">{k}</span>
                        <span className="num text-muted-foreground">{pct.toFixed(1)}% · {fmtCLP(v)}</span>
                      </div>
                      <BarGauge value={pct} max={100} color={PALETTE[k] || "#4493f8"} height={4} className="mt-1" />
                    </div>
                  );
                })
            )}
          </div>
        </Panel>

        <Panel title="Por moneda">
          <div className="space-y-2">
            {Object.entries(stats.byCurrency).length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">Sin datos</div>
            ) : (
              Object.entries(stats.byCurrency)
                .sort((a, b) => b[1] - a[1])
                .map(([k, v]) => {
                  const pct = stats.totalCLP > 0 ? (v / stats.totalCLP) * 100 : 0;
                  return (
                    <div key={k}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium">{k}</span>
                        <span className="num text-muted-foreground">{pct.toFixed(1)}% · {fmtCLP(v)}</span>
                      </div>
                      <BarGauge value={pct} max={100} color={PALETTE[k] || "#4493f8"} height={4} className="mt-1" />
                    </div>
                  );
                })
            )}
          </div>
        </Panel>
      </div>

      <Commentary title="Diversificación · más allá de la asignación nominal" variant="compact">
        <P>
          La diversificación efectiva no se mide por número de posiciones sino por <Term>independencia de fuentes
          de retorno</Term>. Una cartera con 5 ETFs Treasury de distinta duración no está diversificada — todos
          dependen de la misma curva. Una cartera con TLT, equity USA, BTU CL, oro y commodities tiene 5 fuentes
          independientes. El <Term>ratio de Sharpe a nivel cartera</Term> mejora super-linealmente con la cantidad
          de fuentes independientes (regla de Asness sobre risk parity), lo que justifica diversificación por
          factor más que por instrumento.
        </P>
      </Commentary>

      <Commentary title="GTAA · marco de referencia para asset allocation">
        <P>
          El marco <Term>Global Tactical Asset Allocation</Term> de Faber (2013) propone un benchmark mínimo
          para cualquier cartera diversificada: cinco clases equiponderadas a 20% — equity USA, equity ex-USA
          desarrollado, Treasury 10Y, commodities, REITs. La versión pasiva (buy-and-hold equiponderado) retornó
          9.92% anual con Sharpe 0.44 sobre 1973–2012; aplicar la regla del SMA de 10 meses sobre cada componente
          eleva esos resultados a 10.48% con Sharpe 0.73 y reduce el drawdown máximo de −46% a −9.54%. La mejora
          de Sharpe versus las clases individuales (~0.20 según rule of thumb del paper) viene de correlaciones
          imperfectas: las cinco fuentes responden a shocks distintos (ciclo de crecimiento, inflación, tasa real,
          ciclo de commodities, prima inmobiliaria). Faber observa que existen sólo cuatro clases <Term>reales</Term>
          — acciones, bonos, commodities, divisas; los REITs son combinación de las primeras tres.
        </P>
        <P>
          Expandir el universo a 13 sub-clases (incorporando <Term>value</Term>, <Term>momentum</Term>, small-cap,
          emerging, oro, corporate, foreign sovereign) eleva la Sharpe a 0.57 sin timing y a 0.94 con timing.
          La regla práctica que emerge: asignaciones bajo 5% del total no mueven la aguja de riesgo/retorno
          agregado; sobre 30% en una sola clase concentran riesgo en exceso. Mohamed El-Erian (PIMCO 2009)
          condensó el límite del enfoque pasivo en una observación que hoy es consenso: <Term>la
          diversificación por sí sola ya no es suficiente para moderar el riesgo</Term> — necesita
          complementarse con una regla de exposición condicionada al régimen.
        </P>
      </Commentary>

      <Commentary title="Métricas de riesgo · DV01, tracking error, drawdown, atribución">
        <P>
          Más allá de duración y yield, una cartera de renta fija profesional se monitorea por: <Term>DV01</Term>
          (dollar value of 1 bp, pérdida en CLP por un movimiento paralelo de +1 bp en la curva — métrica práctica
          para hedging exacto); <Term>tracking error</Term> (volatilidad anualizada del retorno excedente versus
          benchmark — relevante si hay un benchmark definido como ICE BofA Long Treasury); <Term>information ratio</Term>
          (retorno excedente sobre tracking error — medida de skill activo); <Term>max drawdown</Term> (peor pérdida
          peak-to-trough — define la tolerancia psicológica y operacional al riesgo).
        </P>
        <P>
          La <Term>atribución de retorno</Term> descompone el resultado en sus drivers: efecto duración (paralelo
          de la curva), efecto pendiente (cambio en slope), efecto spread (cambio en prima de crédito vs soberano),
          y efecto FX (revaluación de exposiciones USD a CLP). La <Term>correlación</Term> entre clases es la base
          de la diversificación — TLT y BTU CL correlacionan ~0.7, lo que significa que combinarlas reduce volatilidad
          pero no en proporción 1:1.
        </P>
      </Commentary>

      <Panel title="Detalle posiciones">
        {holdings.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            Sin posiciones. Agrega tu primera con el botón superior.
          </div>
        ) : (
          <FinTable>
            <FinThead>
              <FinTr>
                <FinTh>Nombre</FinTh>
                <FinTh>Clase</FinTh>
                <FinTh>Curr</FinTh>
                <FinTh align="right">Cantidad</FinTh>
                <FinTh align="right">Precio</FinTh>
                <FinTh align="right">Valor CLP</FinTh>
                <FinTh align="right">Dur</FinTh>
                <FinTh align="right">YTM</FinTh>
                <FinTh></FinTh>
              </FinTr>
            </FinThead>
            <FinTbody>
              {holdings.map((h) => {
                const valueCLP = h.quantity * h.unitPrice * FX[h.currency];
                return (
                  <FinTr key={h.id}>
                    <FinTd className="font-medium">{h.name}</FinTd>
                    <FinTd><span className="pill border-border text-muted-foreground">{h.assetClass}</span></FinTd>
                    <FinTd>{h.currency}</FinTd>
                    <FinTd align="right" numeric>{h.quantity}</FinTd>
                    <FinTd align="right" numeric>{h.unitPrice.toFixed(2)}</FinTd>
                    <FinTd align="right"><CLP value={valueCLP} /></FinTd>
                    <FinTd align="right" numeric>{h.duration.toFixed(1)}</FinTd>
                    <FinTd align="right"><Yld value={h.yieldPct} /></FinTd>
                    <FinTd>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeHolding(h.id)}>
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

function HoldingForm({ onSubmit }: { onSubmit: (h: Omit<Holding, "id">) => void }) {
  const [name, setName] = useState("");
  const [assetClass, setAssetClass] = useState<AssetClass>("ETF");
  const [currency, setCurrency] = useState<Currency>("USD");
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);
  const [duration, setDuration] = useState(17);
  const [yieldPct, setYieldPct] = useState(4.5);

  return (
    <form
      className="grid grid-cols-2 gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ name, assetClass, currency, quantity, unitPrice, duration, yieldPct, acquisitionDate: new Date().toISOString().slice(0, 10) });
      }}
    >
      <div className="col-span-2">
        <Label className="text-[10px] uppercase tracking-wider">Nombre / Ticker</Label>
        <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="TLT, BTU-2039..." required />
      </div>
      <div>
        <Label className="text-[10px] uppercase tracking-wider">Clase</Label>
        <Select value={assetClass} onValueChange={(v) => v && setAssetClass(v as AssetClass)}>
          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="CASH">Cash</SelectItem><SelectItem value="DPF">DPF</SelectItem>
            <SelectItem value="BTU">BTU</SelectItem><SelectItem value="BTP">BTP</SelectItem>
            <SelectItem value="FM_MM">FM MM</SelectItem><SelectItem value="FM_RF">FM RF</SelectItem>
            <SelectItem value="ETF">ETF</SelectItem><SelectItem value="BOND_USA">UST</SelectItem>
            <SelectItem value="EQUITY">Equity</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-[10px] uppercase tracking-wider">Moneda</Label>
        <Select value={currency} onValueChange={(v) => v && setCurrency(v as Currency)}>
          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="CLP">CLP</SelectItem><SelectItem value="UF">UF</SelectItem><SelectItem value="USD">USD</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-[10px] uppercase tracking-wider">Cantidad</Label>
        <Input className="mt-1 font-mono" type="number" step="any" value={quantity} onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)} required />
      </div>
      <div>
        <Label className="text-[10px] uppercase tracking-wider">Precio</Label>
        <Input className="mt-1 font-mono" type="number" step="any" value={unitPrice} onChange={(e) => setUnitPrice(parseFloat(e.target.value) || 0)} required />
      </div>
      <div>
        <Label className="text-[10px] uppercase tracking-wider">Duración (años)</Label>
        <Input className="mt-1 font-mono" type="number" step="0.1" value={duration} onChange={(e) => setDuration(parseFloat(e.target.value) || 0)} />
      </div>
      <div>
        <Label className="text-[10px] uppercase tracking-wider">YTM (%)</Label>
        <Input className="mt-1 font-mono" type="number" step="0.01" value={yieldPct} onChange={(e) => setYieldPct(parseFloat(e.target.value) || 0)} />
      </div>
      <div className="col-span-2 flex justify-end">
        <Button type="submit">Agregar</Button>
      </div>
    </form>
  );
}
