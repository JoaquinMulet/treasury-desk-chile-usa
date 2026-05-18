"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, Panel } from "@/components/fin/section";
import { FinTable, FinThead, FinTbody, FinTr, FinTh, FinTd } from "@/components/fin/fin-table";
import { Num, Signed, Pct } from "@/components/fin/num";
import { Commentary, Term, P } from "@/components/fin/commentary";
import {
  bondPrice,
  bondYTM,
  macaulayDuration,
  modifiedDuration,
  convexity,
  dv01,
  totalReturnEstimate,
} from "@/lib/calc/bond";

const PRESETS = {
  "BTU-2055": { face: 100, couponRate: 0.0190, couponsPerYear: 2, yearsToMaturity: 29.5 },
  "BTU-2050": { face: 100, couponRate: 0.0180, couponsPerYear: 2, yearsToMaturity: 24.5 },
  "BTU-2044": { face: 100, couponRate: 0.0210, couponsPerYear: 2, yearsToMaturity: 18.5 },
  "BTU-2039": { face: 100, couponRate: 0.0290, couponsPerYear: 2, yearsToMaturity: 13.5 },
  "BTU-2035": { face: 100, couponRate: 0.0220, couponsPerYear: 2, yearsToMaturity: 9.5 },
  "BTP-2034": { face: 100, couponRate: 0.0550, couponsPerYear: 2, yearsToMaturity: 8.5 },
  "BTP-2030": { face: 100, couponRate: 0.0470, couponsPerYear: 2, yearsToMaturity: 4.5 },
  "UST-30Y": { face: 100, couponRate: 0.045, couponsPerYear: 2, yearsToMaturity: 29.5 },
  "UST-10Y": { face: 100, couponRate: 0.0425, couponsPerYear: 2, yearsToMaturity: 9.5 },
  "UST-5Y": { face: 100, couponRate: 0.04, couponsPerYear: 2, yearsToMaturity: 4.5 },
};

export default function BondsPage() {
  const [preset, setPreset] = useState<keyof typeof PRESETS>("BTU-2055");
  const [face, setFace] = useState(100);
  const [coupon, setCoupon] = useState(0.019);
  const [periods, setPeriods] = useState(2);
  const [years, setYears] = useState(29.5);
  const [price, setPrice] = useState<number | "">(100);

  function applyPreset(key: keyof typeof PRESETS) {
    setPreset(key);
    const p = PRESETS[key];
    setFace(p.face);
    setCoupon(p.couponRate);
    setPeriods(p.couponsPerYear);
    setYears(p.yearsToMaturity);
    setPrice(p.face);
  }

  const terms = { face, couponRate: coupon, couponsPerYear: periods, yearsToMaturity: years };
  const result = useMemo(() => {
    const px = typeof price === "number" ? price : 100;
    const ytm = bondYTM(terms, px, 0.05);
    const macD = macaulayDuration(terms, ytm);
    const modD = modifiedDuration(terms, ytm);
    const conv = convexity(terms, ytm);
    const dv = dv01(terms, ytm);
    const shocks = [-200, -150, -100, -50, 0, 50, 100, 150, 200];
    const scenarios = shocks.map((bps) => ({
      bps,
      ...totalReturnEstimate(terms, ytm, bps, 1),
    }));
    return { ytm, macD, modD, conv, dv, scenarios };
  }, [terms, price]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Calculadora de bonos"
        description="Pricing · YTM · Duración · Convexidad · Sensibilidad por shock de yield"
      />

      <Commentary title="Pricing de bonos · primer principios">
        <P>
          El precio teórico de un bono es el <Term>valor presente de sus flujos futuros</Term> descontados al yield
          de mercado: <span className="num">P = Σ C/(1+y/m)^t + F/(1+y/m)^n</span>, donde C es el cupón periódico,
          y es el yield to maturity, m la frecuencia de pagos, F el nominal y n el número total de períodos. Cuando
          el precio observado iguala el nominal, el YTM iguala la tasa cupón.
        </P>
        <P>
          Las cuatro métricas de sensibilidad son el lenguaje universal del análisis de renta fija: <Term>Macaulay
          duration</Term> es el promedio ponderado de los tiempos de los flujos (ponderados por su valor presente);
          <Term> modified duration</Term> es el coeficiente de sensibilidad lineal del precio al yield <span className="num">
          ΔP/P ≈ −D_mod × Δy</span>; <Term>convexidad</Term> es el término cuadrático que captura la curvatura del
          tradeoff precio-yield; <Term>DV01</Term> (dollar value of a basis point) es la pérdida en CLP por un
          aumento de 1 bp en el yield, métrica práctica para hedging.
        </P>
      </Commentary>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[300px,1fr]">
        <Panel title="Términos del bono">
          <div className="space-y-3">
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Preset</Label>
              <Select value={preset} onValueChange={(v) => v && applyPreset(v as keyof typeof PRESETS)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.keys(PRESETS).map((k) => (<SelectItem key={k} value={k}>{k}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Nominal</Label>
              <Input className="mt-1 font-mono" type="number" value={face} onChange={(e) => setFace(parseFloat(e.target.value) || 0)} />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Cupón (decimal)</Label>
              <Input className="mt-1 font-mono" type="number" step="0.001" value={coupon} onChange={(e) => setCoupon(parseFloat(e.target.value) || 0)} />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Pagos/año</Label>
              <Select value={String(periods)} onValueChange={(v) => v && setPeriods(parseInt(v))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Anual</SelectItem>
                  <SelectItem value="2">Semestral</SelectItem>
                  <SelectItem value="4">Trimestral</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Años a vencimiento</Label>
              <Input className="mt-1 font-mono" type="number" step="0.5" value={years} onChange={(e) => setYears(parseFloat(e.target.value) || 0)} />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Precio observado</Label>
              <Input className="mt-1 font-mono" type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value === "" ? "" : parseFloat(e.target.value))} />
            </div>
          </div>
        </Panel>

        <div className="space-y-3">
          <Panel title="Métricas calculadas">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <Metric label="YTM" value={<Pct value={result.ytm * 100} decimals={3} />} />
              <Metric label="Macaulay D" value={<Num value={result.macD} />} unit="años" />
              <Metric label="Mod. D" value={<Num value={result.modD} />} unit="años" />
              <Metric label="Convexidad" value={<Num value={result.conv} />} />
              <Metric label="DV01" value={<Num value={result.dv} decimals={4} />} />
            </div>
          </Panel>

          <Commentary title="Cómo leer los escenarios de shock" variant="compact">
            <P>
              La tabla descompone el retorno total estimado a 1 año bajo distintos shocks paralelos del yield. La
              aproximación analítica es <span className="num">ΔP/P ≈ −D_mod × Δy + ½ × C × (Δy)² + y × T</span>,
              donde el primer término es el efecto lineal de duración, el segundo es la corrección por convexidad
              (siempre positiva, beneficia al inversor), y el tercero es el cupón devengado durante el horizonte.
              La asimetría observada — un −100 bps genera más upside que el downside de un +100 bps — proviene
              precisamente de la convexidad positiva, característica de bonos sin opciones.
            </P>
          </Commentary>

          <Commentary title="YTM como retorno esperado · interpretación de largo plazo" variant="compact">
            <P>
              Sobre horizontes equivalentes a la duración del bono, el <Term>YTM al momento de la compra</Term>
              es la mejor estimación del retorno anualizado esperado — bajo supuesto de reinversión de cupones a
              la misma tasa y tenencia hasta el vencimiento. Faber (2013) cita este resultado como anclaje
              conservador de forecast para asset allocation: a diferencia del equity — cuyo retorno depende
              tanto de earnings yield como de cambios de múltiplo — los bonos sin opciones tienen
              retorno conocido si se mantienen al vencimiento, con desviaciones acotadas por convexidad.
              Un BTU-2055 comprado a YTM 1.90% rendirá ~1.90% real anual sobre los 30 años de tenencia,
              independientemente de la volatilidad intermedia.
            </P>
          </Commentary>
          <Panel title="Escenarios · retorno total 1 año">
            <FinTable>
              <FinThead>
                <FinTr>
                  <FinTh>Shock</FinTh>
                  <FinTh align="right">Retorno precio</FinTh>
                  <FinTh align="right">Cupón</FinTh>
                  <FinTh align="right">Total</FinTh>
                </FinTr>
              </FinThead>
              <FinTbody>
                {result.scenarios.map((s) => (
                  <FinTr key={s.bps}>
                    <FinTd>
                      <span className={s.bps > 0 ? "num text-[var(--color-neg)]" : s.bps < 0 ? "num text-[var(--color-pos)]" : "num text-muted-foreground"}>
                        {s.bps > 0 ? "+" : ""}{s.bps} bps
                      </span>
                    </FinTd>
                    <FinTd align="right" numeric><Signed value={s.priceReturn * 100} colored /></FinTd>
                    <FinTd align="right" numeric>{(s.couponIncome * 100).toFixed(2)}</FinTd>
                    <FinTd align="right" numeric>
                      <Signed value={s.total * 100} colored />
                    </FinTd>
                  </FinTr>
                ))}
              </FinTbody>
            </FinTable>
          </Panel>

          <Panel title="Validación">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <div className="text-muted-foreground">Precio @ YTM</div>
                <div className="num mt-1 font-semibold">{bondPrice(terms, result.ytm).toFixed(4)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Diff vs observado</div>
                <div className="num mt-1 font-semibold">{(bondPrice(terms, result.ytm) - (typeof price === "number" ? price : 100)).toFixed(6)}</div>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, unit }: { label: string; value: React.ReactNode; unit?: string }) {
  return (
    <div className="border border-border bg-background/40 p-2">
      <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">
        {value}
        {unit && <span className="ml-1 text-[10px] font-normal text-muted-foreground">{unit}</span>}
      </div>
    </div>
  );
}
