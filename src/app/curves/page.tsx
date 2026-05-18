import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LWCChart } from "@/components/charts/lwc-chart";
import { CurveSnapshot } from "@/components/charts/curve-snapshot";
import { loadSeries, lastValue, BCChKey } from "@/lib/data/bcch";
import { US_HISTORY, US_HISTORY_LABELS, US_SNAPSHOT } from "@/lib/data/market";
import { PageHeader, Panel } from "@/components/fin/section";
import { FinTable, FinThead, FinTbody, FinTr, FinTh, FinTd } from "@/components/fin/fin-table";
import { Yld, Bps } from "@/components/fin/num";
import { Commentary, Term, P } from "@/components/fin/commentary";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const PALETTE = ["#39d0d8", "#4493f8", "#3fb950", "#d29922", "#f85149", "#8b949e"];

function curveLines(keys: { key: BCChKey; label: string }[]) {
  return keys.map((k, i) => ({
    data: loadSeries(k.key).map((p) => ({ time: p.time, value: p.value })),
    color: PALETTE[i % PALETTE.length],
    title: k.label,
    lineWidth: 1.5 as const,
  }));
}

function curveSnap(keys: { key: BCChKey; label: string; tenorYears: number }[]) {
  return keys.map((k) => {
    const lv = lastValue(k.key);
    return { tenor: k.label, tenorYears: k.tenorYears, yield: lv?.value ?? 0 };
  });
}

function changes(series: { time: string; value: number }[]): { d1: number; w1: number; m1: number; y1: number } {
  if (series.length === 0) return { d1: 0, w1: 0, m1: 0, y1: 0 };
  const last = series[series.length - 1].value;
  const dAgo = (n: number) => series[Math.max(0, series.length - 1 - n)]?.value ?? last;
  return {
    d1: (last - dAgo(1)) * 100,
    w1: (last - dAgo(5)) * 100,
    m1: (last - dAgo(22)) * 100,
    y1: (last - dAgo(252)) * 100,
  };
}

export default function CurvesPage() {
  const ufKeys = [
    { key: "uf_2y" as BCChKey, label: "2Y", tenorYears: 2 },
    { key: "uf_5y" as BCChKey, label: "5Y", tenorYears: 5 },
    { key: "uf_10y" as BCChKey, label: "10Y", tenorYears: 10 },
    { key: "uf_20y" as BCChKey, label: "20Y", tenorYears: 20 },
    { key: "uf_30y" as BCChKey, label: "30Y", tenorYears: 30 },
  ];
  const clpKeys = [
    { key: "clp_1y" as BCChKey, label: "1Y", tenorYears: 1 },
    { key: "clp_2y" as BCChKey, label: "2Y", tenorYears: 2 },
    { key: "clp_5y" as BCChKey, label: "5Y", tenorYears: 5 },
    { key: "clp_10y" as BCChKey, label: "10Y", tenorYears: 10 },
  ];
  const beiKeys = [
    { key: "bei_1y" as BCChKey, label: "1Y", tenorYears: 1 },
    { key: "bei_2y" as BCChKey, label: "2Y", tenorYears: 2 },
    { key: "bei_5y" as BCChKey, label: "5Y", tenorYears: 5 },
    { key: "bei_10y" as BCChKey, label: "10Y", tenorYears: 10 },
  ];

  const ufStats = ufKeys.map((k) => ({ ...k, lv: lastValue(k.key), chg: changes(loadSeries(k.key)) }));
  const clpStats = clpKeys.map((k) => ({ ...k, lv: lastValue(k.key), chg: changes(loadSeries(k.key)) }));
  const beiStats = beiKeys.map((k) => ({ ...k, lv: lastValue(k.key), chg: changes(loadSeries(k.key)) }));

  const usLines = (["us_5y", "us_10y", "us_30y"] as const).map((k, i) => ({
    data: US_HISTORY[k].map((value, idx) => ({ time: US_HISTORY_LABELS[idx], value })),
    color: PALETTE[i],
    title: k.replace("us_", "").toUpperCase(),
    lineWidth: 1.5 as const,
  }));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Curvas de yields"
        description="Mercado secundario diario · Chile (BCCh, 2002→) + USA (yfinance)"
      />

      <Commentary title="Estructura temporal de tasas de interés">
        <P>
          Una <Term>curva de yield</Term> grafica el yield to maturity contra el plazo a vencimiento. Codifica tres
          tipos de información: expectativas de tasas cortas futuras, <Term>term premium</Term> (compensación
          exigida por inmovilizar capital), y primas por riesgo de crédito, inflación o liquidez. La hipótesis de
          expectativas pura postula que el yield a plazo n es el promedio geométrico esperado de las tasas cortas
          en n años. En la práctica el term premium es no-cero y varía con el ciclo (Adrian-Crump-Moench 2013 lo
          descompone para Treasuries).
        </P>
        <P>
          Tres formas canónicas: <Term>normal</Term> (pendiente positiva, escenario de crecimiento), <Term>plana</Term>
          (final de ciclo de alzas), e <Term>invertida</Term> (pendiente negativa, indicador clásico de recesión).
          Estrella-Mishkin 1996 documentan que la inversión 10Y−3M ha precedido todas las recesiones USA desde 1955
          con lag de 12 a 18 meses.
        </P>
      </Commentary>

      <Tabs defaultValue="uf" className="space-y-3">
        <TabsList className="bg-card">
          <TabsTrigger value="uf">Chile UF</TabsTrigger>
          <TabsTrigger value="clp">Chile CLP</TabsTrigger>
          <TabsTrigger value="bei">BEI</TabsTrigger>
          <TabsTrigger value="us">USA</TabsTrigger>
        </TabsList>

        <TabsContent value="uf" className="space-y-3">
          <Commentary title="Curva UF · yields reales (BCU + BTU)">
            <P>
              La curva UF chilena cotiza <Term>yields reales</Term>: el retorno por sobre la inflación medida en
              Unidad de Fomento. Es funcionalmente equivalente a los TIPS estadounidenses (Treasury Inflation-Protected
              Securities). Esta curva permite estimar directamente el costo real del capital soberano local y es la
              base para cualquier análisis de inmunización de pasivos indexados (pensiones, contratos UF).
            </P>
            <P>
              El BCCh agrega en una sola serie diaria los precios de mercado secundario de BCU (Banco Central Chile en UF)
              y BTU (Tesorería General de la República en UF) por plazo, eliminando la diferencia de crédito (mínima) y
              produciendo la curva soberana real más confiable. Cambios paralelos reflejan shocks a expectativas de
              tasa real global; cambios en pendiente capturan cambios en expectativas de la TPM real futura del BCCh.
            </P>
          </Commentary>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr,360px]">
            <Panel title="Histórico — yields UF por plazo (diaria)" right={<span className="text-[10px] uppercase tracking-wider text-muted-foreground">{loadSeries("uf_10y").length.toLocaleString("es-CL")} obs</span>}>
              <LWCChart height={420} lines={curveLines(ufKeys)} priceFormat={{ minMove: 0.01, precision: 2 }} />
            </Panel>
            <Panel title="Snapshot curva UF">
              <CurveSnapshot points={curveSnap(ufKeys)} colorMain="#39d0d8" labelMain="UF actual" />
              <div className="mt-3">
                <FinTable>
                  <FinThead>
                    <FinTr>
                      <FinTh>Tenor</FinTh>
                      <FinTh align="right">Yield</FinTh>
                      <FinTh align="right">1d</FinTh>
                      <FinTh align="right">1m</FinTh>
                      <FinTh align="right">1y</FinTh>
                    </FinTr>
                  </FinThead>
                  <FinTbody>
                    {ufStats.map((s) => (
                      <FinTr key={s.label}>
                        <FinTd>{s.label}</FinTd>
                        <FinTd align="right" numeric><Yld value={s.lv?.value} /></FinTd>
                        <FinTd align="right" numeric><Bps value={s.chg.d1} colored /></FinTd>
                        <FinTd align="right" numeric><Bps value={s.chg.m1} colored /></FinTd>
                        <FinTd align="right" numeric><Bps value={s.chg.y1} colored /></FinTd>
                      </FinTr>
                    ))}
                  </FinTbody>
                </FinTable>
                <p className="mt-2 text-[10px] text-muted-foreground">Último cierre: {fmtDate(ufStats[2].lv?.date)}</p>
              </div>
            </Panel>
          </div>
        </TabsContent>

        <TabsContent value="clp" className="space-y-3">
          <Commentary title="Curva CLP nominal · BCP + BTP">
            <P>
              La curva CLP cotiza yields nominales en pesos: incluye yield real más compensación por inflación
              esperada (BEI) más prima por riesgo inflacionario. Por la <Term>ecuación de Fisher</Term>,
              <span className="num"> (1+i_nominal) = (1+r_real)(1+π_e)</span> donde π_e es inflación esperada. En
              equilibrio sin arbitraje: <span className="num">CLP_n − UF_n = BEI_n</span> en cada plazo n.
            </P>
            <P>
              La curva CLP es más corta (hasta 10Y) que la UF (hasta 30Y) reflejando la preferencia institucional
              chilena por indexación: AFPs, compañías de seguros y fondos de pensiones tienen pasivos en UF y
              prefieren matching de activos. La liquidez en plazos &gt;10Y en pesos nominal es baja; quien necesita
              duración larga típicamente la consigue vía UF.
            </P>
          </Commentary>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr,360px]">
            <Panel title="Histórico — yields CLP nominal por plazo (diaria)">
              <LWCChart height={420} lines={curveLines(clpKeys)} priceFormat={{ minMove: 0.01, precision: 2 }} />
            </Panel>
            <Panel title="Snapshot curva CLP">
              <CurveSnapshot points={curveSnap(clpKeys)} colorMain="#4493f8" labelMain="CLP actual" />
              <div className="mt-3">
                <FinTable>
                  <FinThead>
                    <FinTr>
                      <FinTh>Tenor</FinTh>
                      <FinTh align="right">Yield</FinTh>
                      <FinTh align="right">1d</FinTh>
                      <FinTh align="right">1m</FinTh>
                      <FinTh align="right">1y</FinTh>
                    </FinTr>
                  </FinThead>
                  <FinTbody>
                    {clpStats.map((s) => (
                      <FinTr key={s.label}>
                        <FinTd>{s.label}</FinTd>
                        <FinTd align="right" numeric><Yld value={s.lv?.value} /></FinTd>
                        <FinTd align="right" numeric><Bps value={s.chg.d1} colored /></FinTd>
                        <FinTd align="right" numeric><Bps value={s.chg.m1} colored /></FinTd>
                        <FinTd align="right" numeric><Bps value={s.chg.y1} colored /></FinTd>
                      </FinTr>
                    ))}
                  </FinTbody>
                </FinTable>
              </div>
            </Panel>
          </div>
        </TabsContent>

        <TabsContent value="bei" className="space-y-3">
          <Commentary title="Breakeven inflation · swaps cámara">
            <P>
              El <Term>breakeven inflation (BEI)</Term> es la inflación promedio anual durante el plazo n que iguala
              el retorno de un bono nominal con uno indexado. En Chile se calcula como spread <span className="num">
              CLP_n − UF_n</span> o directamente desde swaps cámara, que cotizan limpiamente expectativas sin
              necesidad de descomponer curvas.
            </P>
            <P>
              El BEI no es exactamente la expectativa de inflación: incluye una <Term>prima por riesgo inflacionario</Term>
              (compensación por incertidumbre) más una prima de liquidez (típicamente UF cotiza con descuento de
              liquidez vs CLP nominal). Studies como D&apos;Amico-Kim-Wei 2018 estiman que para Treasuries la prima de
              riesgo inflación es ~30 bps; para Chile probablemente similar. La curva BEI invertida (BEI_2Y &gt; BEI_10Y)
              señala que el mercado descuenta inflación alta de corto que cede en el largo — típico de ciclos de
              normalización monetaria del BCCh.
            </P>
          </Commentary>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr,360px]">
            <Panel title="Histórico — Breakeven inflation por plazo (swaps cámara)">
              <LWCChart height={420} lines={curveLines(beiKeys)} priceFormat={{ minMove: 0.01, precision: 2 }} />
            </Panel>
            <Panel title="BEI snapshot">
              <CurveSnapshot points={curveSnap(beiKeys)} colorMain="#d29922" labelMain="BEI actual" />
              <div className="mt-3">
                <FinTable>
                  <FinThead>
                    <FinTr>
                      <FinTh>Tenor</FinTh>
                      <FinTh align="right">BEI</FinTh>
                      <FinTh align="right">vs target 3%</FinTh>
                      <FinTh align="right">1m</FinTh>
                    </FinTr>
                  </FinThead>
                  <FinTbody>
                    {beiStats.map((s) => (
                      <FinTr key={s.label}>
                        <FinTd>{s.label}</FinTd>
                        <FinTd align="right" numeric><Yld value={s.lv?.value} /></FinTd>
                        <FinTd align="right" numeric><Bps value={((s.lv?.value ?? 0) - 3) * 100} colored inverseColor /></FinTd>
                        <FinTd align="right" numeric><Bps value={s.chg.m1} colored /></FinTd>
                      </FinTr>
                    ))}
                  </FinTbody>
                </FinTable>
              </div>
            </Panel>
          </div>
        </TabsContent>

        <TabsContent value="us" className="space-y-3">
          <Commentary title="Curva del Tesoro USA · referencia global">
            <P>
              La curva UST define la <Term>tasa libre de riesgo nominal</Term> en dólares — el activo seguro y líquido
              de referencia para casi toda la valoración financiera global. Su forma incorpora cuatro factores
              estimables por modelos afines (Cochrane-Piazzesi, Adrian-Crump-Moench): expectativas de Fed Funds
              futuras, prima por plazo, prima por riesgo inflación, y prima por liquidez/escasez de colateral.
            </P>
            <P>
              Los puntos canónicos son 2Y (cercano a expectativa Fed Funds promedio 2 años), 10Y (benchmark de
              valoración global, sensible a expectativas estructurales de crecimiento e inflación), y 30Y (long
              bond, dominado por term premium y demanda de duración por pensiones y seguros). El spread 10Y−2Y
              es el indicador clásico de recesión: cuando se invierte, históricamente precede contracciones con
              lag 12-18m (8 de 8 episodios desde 1968 según NY Fed).
            </P>
          </Commentary>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr,360px]">
            <Panel title="UST 5Y · 10Y · 30Y — últimos 6 meses">
              <LWCChart height={420} lines={usLines} priceFormat={{ minMove: 0.001, precision: 3 }} />
            </Panel>
            <Panel title="UST snapshot">
              <CurveSnapshot
                points={[
                  { tenor: "5Y", tenorYears: 5, yield: US_SNAPSHOT.yields.us_5y },
                  { tenor: "10Y", tenorYears: 10, yield: US_SNAPSHOT.yields.us_10y },
                  { tenor: "30Y", tenorYears: 30, yield: US_SNAPSHOT.yields.us_30y },
                ]}
                colorMain="#f85149"
                labelMain="USA actual"
              />
              <div className="mt-3">
                <FinTable>
                  <FinThead>
                    <FinTr>
                      <FinTh>Tenor</FinTh>
                      <FinTh align="right">Yield</FinTh>
                    </FinTr>
                  </FinThead>
                  <FinTbody>
                    <FinTr><FinTd>5Y</FinTd><FinTd align="right" numeric><Yld value={US_SNAPSHOT.yields.us_5y} decimals={3} /></FinTd></FinTr>
                    <FinTr><FinTd>10Y</FinTd><FinTd align="right" numeric><Yld value={US_SNAPSHOT.yields.us_10y} decimals={3} /></FinTd></FinTr>
                    <FinTr><FinTd>30Y</FinTd><FinTd align="right" numeric><Yld value={US_SNAPSHOT.yields.us_30y} decimals={3} /></FinTd></FinTr>
                  </FinTbody>
                </FinTable>
              </div>
            </Panel>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
