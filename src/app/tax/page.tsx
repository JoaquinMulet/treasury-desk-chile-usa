"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader, Panel } from "@/components/fin/section";
import { Commentary, Term, P } from "@/components/fin/commentary";
import { FinTable, FinThead, FinTbody, FinTr, FinTh, FinTd } from "@/components/fin/fin-table";
import { CLP, Pct } from "@/components/fin/num";
import { afterTaxReturn, corporateTax, TaxRegime, TAX_NOTES, InstrumentTax } from "@/lib/calc/tax";

const TYPES: { value: InstrumentTax["type"]; label: string }[] = [
  { value: "DPF_CLP", label: "DPF Banco CLP" },
  { value: "DPF_USD", label: "DPF Banco USD" },
  { value: "BTU", label: "BTU (Tesorería UF)" },
  { value: "BTP", label: "BTP (Tesorería CLP)" },
  { value: "FM_MM", label: "FM Money Market" },
  { value: "FM_RF", label: "FM Renta Fija" },
  { value: "ETF_USA", label: "ETF USA (TLT, EDV, etc.)" },
  { value: "BOND_USA", label: "Bono Tesorería USA" },
];

export default function TaxPage() {
  const [regime, setRegime] = useState<TaxRegime>("14A");
  const [notional, setNotional] = useState(100_000_000);
  const [horizonYears, setHorizonYears] = useState(1);
  const [fxGain, setFxGain] = useState(0);

  const [yields, setYields] = useState({
    DPF_CLP: 4.5, DPF_USD: 5.0, BTU: 5.5, BTP: 5.5, FM_MM: 4.2, FM_RF: 5.0, ETF_USA: 4.5, BOND_USA: 4.5,
  });

  const rows = useMemo(() => {
    return TYPES.map((t) => {
      const expReturn = yields[t.value] / 100;
      const fx = (t.value.endsWith("USD") || t.value === "ETF_USA" || t.value === "BOND_USA") ? (notional * fxGain / 100) * horizonYears : 0;
      const inst: InstrumentTax = { type: t.value, notional, expectedReturn: expReturn, horizonYears, realizedFx: fx };
      const r = afterTaxReturn(inst, regime);
      return { ...t, expReturn, ...r, fx };
    });
  }, [yields, notional, horizonYears, regime, fxGain]);

  const sorted = [...rows].sort((a, b) => b.netYield - a.netYield);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Tributario corporativo · Chile"
        description="Retorno neto post 1ra Categoría · régimen 14 A o 14 D"
      />

      <Commentary title="Tributación corporativa · qué importa para decidir">
        <P>
          La decisión óptima de tesorería se basa en <Term>retorno neto después de impuesto</Term>, no bruto. En
          Chile, las personas jurídicas tributan en 1ra Categoría a tasa 27% bajo régimen general (14 A,
          semi-integrado) o 25% bajo régimen Pro Pyme (14 D, atribuido). Esto se aplica sobre rentas devengadas
          anuales: cupones, intereses, reajustes UF e incluso ganancias cambiarias realizadas (Art. 41 LIR).
        </P>
        <P>
          Los <Term>regímenes preferenciales</Term> que aplican a personas naturales (Art. 107 LIR — 10% sobre
          presencia bursátil; Art. 57 LIR — exención &lt;30 UTM) generalmente NO aplican a empresas con activos
          ordinarios. La excepción son ciertas inversiones de empresas familiares (sociedades de inversión bajo
          el régimen 14 D) y los ETFs con presencia bursátil chilena. La <Term>tax-equivalent yield</Term> se
          calcula como <span className="num">yield_bruto × (1 − tasa)</span> y permite comparar instrumentos
          gravados con exentos en términos homogéneos.
        </P>
      </Commentary>

      <Panel title="Configuración">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Régimen</Label>
            <Select value={regime} onValueChange={(v) => v && setRegime(v as TaxRegime)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="14A">14 A (semi-int., 27%)</SelectItem>
                <SelectItem value="14D">14 D (Pro Pyme, 25%)</SelectItem>
              </SelectContent>
            </Select>
            <p className="mt-1 text-[10px] text-muted-foreground">Tasa: {(corporateTax(regime) * 100).toFixed(0)}%</p>
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Monto (CLP)</Label>
            <Input className="mt-1 font-mono" type="number" value={notional} onChange={(e) => setNotional(parseFloat(e.target.value) || 0)} />
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Horizonte (años)</Label>
            <Input className="mt-1 font-mono" type="number" step="0.5" value={horizonYears} onChange={(e) => setHorizonYears(parseFloat(e.target.value) || 1)} />
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Δ FX anual % (solo USD)</Label>
            <Input className="mt-1 font-mono" type="number" step="0.1" value={fxGain} onChange={(e) => setFxGain(parseFloat(e.target.value) || 0)} />
          </div>
        </div>
      </Panel>

      <Tabs defaultValue="ranking">
        <TabsList className="bg-card">
          <TabsTrigger value="ranking">Ranking neto</TabsTrigger>
          <TabsTrigger value="custom">Yields esperados</TabsTrigger>
          <TabsTrigger value="notes">Notas tributarias</TabsTrigger>
        </TabsList>

        <TabsContent value="ranking">
          <Commentary title="Ranking de yield neto · interpretación práctica" variant="compact">
            <P>
              Para una tesorería corporativa, los instrumentos relevantes deben compararse por <Term>yield neto
              efectivo</Term> al horizonte de inversión. El ranking refleja el orden óptimo si se ignoran riesgos
              de crédito, duración y FX — usar como punto de partida y luego ajustar por estos. Diferencias de 100
              bps en yield neto suelen justificar diversificación entre dos instrumentos en lugar de concentrar en
              uno solo, especialmente si las fuentes de riesgo son distintas (e.g., DPF bancario vs ETF USA).
            </P>
          </Commentary>
          <Panel title="Retorno neto después de impuesto · ranking">
            <FinTable>
              <FinThead>
                <FinTr>
                  <FinTh>Instrumento</FinTh>
                  <FinTh align="right">Yield bruto</FinTh>
                  <FinTh align="right">Δ FX</FinTh>
                  <FinTh align="right">Retorno bruto</FinTh>
                  <FinTh align="right">Impuesto</FinTh>
                  <FinTh align="right">Retorno neto</FinTh>
                  <FinTh align="right">Yield neto efectivo</FinTh>
                </FinTr>
              </FinThead>
              <FinTbody>
                {sorted.map((r, i) => (
                  <FinTr key={r.value} className={i === 0 ? "bg-[var(--color-pos-bg)]" : ""}>
                    <FinTd>
                      {i === 0 && <span className="pill mr-2 border-[var(--color-pos)] text-[var(--color-pos)]">#1</span>}
                      <span className="font-medium">{r.label}</span>
                    </FinTd>
                    <FinTd align="right"><Pct value={r.expReturn * 100} /></FinTd>
                    <FinTd align="right"><CLP value={r.fx} colored /></FinTd>
                    <FinTd align="right"><CLP value={r.grossReturn} /></FinTd>
                    <FinTd align="right" className="text-[var(--color-neg)]"><CLP value={-r.taxOwed} /></FinTd>
                    <FinTd align="right"><CLP value={r.netReturn} /></FinTd>
                    <FinTd align="right"><Pct value={r.netYield * 100} /></FinTd>
                  </FinTr>
                ))}
              </FinTbody>
            </FinTable>
          </Panel>
        </TabsContent>

        <TabsContent value="custom">
          <Panel title="Yields esperados anuales · editables">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {TYPES.map((t) => (
                <div key={t.value}>
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.label}</Label>
                  <Input className="mt-1 font-mono" type="number" step="0.1" value={yields[t.value]} onChange={(e) => setYields({ ...yields, [t.value]: parseFloat(e.target.value) || 0 })} />
                </div>
              ))}
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="notes">
          <Panel title="Notas tributarias">
            <div className="space-y-3 text-xs">
              {TYPES.map((t) => (
                <div key={t.value} className="border-l-2 border-border bg-background/40 px-3 py-2">
                  <div className="font-medium text-foreground">{t.label}</div>
                  <p className="mt-1 text-muted-foreground">{TAX_NOTES[t.value]}</p>
                </div>
              ))}
              <div className="border-l-2 border-[var(--color-warn)] bg-[var(--color-warn-bg)] px-3 py-2">
                <strong className="text-[var(--color-warn)]">Disclaimer · </strong>
                <span className="text-muted-foreground">simulación con fines de planificación. Tributación efectiva depende de variables específicas. Consultar contador para casos concretos.</span>
              </div>
            </div>
          </Panel>
        </TabsContent>
      </Tabs>
    </div>
  );
}
