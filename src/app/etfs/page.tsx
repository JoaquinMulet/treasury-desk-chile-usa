import { PageHeader, Panel } from "@/components/fin/section";
import { Commentary, Term, P } from "@/components/fin/commentary";
import { LWCChart } from "@/components/charts/lwc-chart";
import { Heatmap } from "@/components/charts/heatmap";
import { FinTable, FinThead, FinTbody, FinTr, FinTh, FinTd } from "@/components/fin/fin-table";
import { Sparkline } from "@/components/fin/sparkline";
import { US_HISTORY, US_HISTORY_LABELS, US_SNAPSHOT } from "@/lib/data/market";
import { totalReturnEstimate } from "@/lib/calc/bond";

// Universo completo · todos los 9 tickers vivos vía Yahoo Finance (cron diario).
// `price` y `history` vienen de US_SNAPSHOT/US_HISTORY · cero hardcoded.
const ETFS = [
  { ticker: "TLT", name: "iShares 20+ Year Treasury", duration: 17, ter: 0.15, aum: 50000, price: US_SNAPSHOT.etfs.tlt, history: US_HISTORY.tlt },
  { ticker: "EDV", name: "Vanguard Extended Duration", duration: 24, ter: 0.06, aum: 3000, price: US_SNAPSHOT.etfs.edv, history: US_HISTORY.edv },
  { ticker: "ZROZ", name: "PIMCO 25+Y Zero Coupon", duration: 26, ter: 0.15, aum: 1500, price: US_SNAPSHOT.etfs.zroz, history: US_HISTORY.zroz },
  { ticker: "VGLT", name: "Vanguard Long-Term Treasury", duration: 16, ter: 0.04, aum: 11000, price: US_SNAPSHOT.etfs.vglt, history: US_HISTORY.vglt },
  { ticker: "TLH", name: "iShares 10-20Y Treasury", duration: 12.5, ter: 0.15, aum: 10000, price: US_SNAPSHOT.etfs.tlh, history: US_HISTORY.tlh },
  { ticker: "IEF", name: "iShares 7-10Y Treasury", duration: 7.5, ter: 0.15, aum: 30000, price: US_SNAPSHOT.etfs.ief, history: US_HISTORY.ief },
  { ticker: "IEI", name: "iShares 3-7Y Treasury", duration: 4.5, ter: 0.15, aum: 12000, price: US_SNAPSHOT.etfs.iei, history: US_HISTORY.iei },
  { ticker: "SHY", name: "iShares 1-3Y Treasury", duration: 1.9, ter: 0.15, aum: 30000, price: US_SNAPSHOT.etfs.shy, history: US_HISTORY.shy },
  { ticker: "SGOV", name: "iShares 0-3M T-Bills", duration: 0.1, ter: 0.09, aum: 30000, price: US_SNAPSHOT.etfs.sgov, history: US_HISTORY.sgov },
];

function useCase(d: number): string {
  if (d <= 0.2) return "Cash USD";
  if (d <= 3) return "Corta";
  if (d <= 7) return "Intermedia";
  if (d <= 15) return "Larga";
  if (d <= 20) return "20+";
  return "Extra-larga";
}

export default function ETFsPage() {
  const baseYTM = US_SNAPSHOT.yields.us_30y / 100;
  const shocks = [-200, -100, -50, 0, 50, 100, 200];

  // Construir matriz convexidad
  const convexityRows = ETFS.slice(0, 5).map((e) => e.ticker);
  const convexityCells = ETFS.slice(0, 5).map((e) => {
    const terms = { face: 100, couponRate: baseYTM, couponsPerYear: 2, yearsToMaturity: e.duration * 1.4 };
    return shocks.map((s) => totalReturnEstimate(terms, baseYTM, s, 1).total * 100);
  });

  const tltSeries = US_HISTORY.tlt.map((value, i) => ({ time: US_HISTORY_LABELS[i], value }));
  const edvSeries = US_HISTORY.edv.map((value, i) => ({ time: US_HISTORY_LABELS[i], value }));

  return (
    <div className="space-y-4">
      <PageHeader
        title="ETFs USA · Duration plays"
        description="Universo Treasury accesibles vía broker · convexidad · escenarios"
      />

      <Commentary title="ETFs Treasury · vehículos de exposición a duración">
        <P>
          Los ETFs de Treasury USA son la forma más eficiente (líquida, transparente, bajo costo) de implementar
          una vista táctica sobre la curva de tasas. Cada ETF se diferencia principalmente por su <Term>duración
          modificada objetivo</Term>, que define la sensibilidad esperada del precio a movimientos paralelos del
          yield: <span className="num">ΔPrice/Price ≈ −Duration × Δyield</span>. Un ETF de duración 17 (TLT) y uno
          de duración 24 (EDV) responderán al mismo shock de yield con magnitudes proporcionales a sus duraciones.
        </P>
        <P>
          La elección óptima depende de la convicción y el horizonte. Para apuestas direccionales fuertes a baja de
          tasas, <Term>EDV o ZROZ</Term> (duración 24-26) ofrecen mayor convexidad — capturan más upside por
          unidad de shock, aunque también más downside si se equivocan. Para portafolios de tesorería con tilt a
          duración pero sin convicción extrema, <Term>TLT o VGLT</Term> (duración 16-17) son el estándar. Para
          gestión de caja corta sin duración, <Term>SGOV o SHY</Term> (duración &lt;2) replican money market.
        </P>
      </Commentary>

      <Panel title="Universo · ficha técnica">
        <FinTable>
          <FinThead>
            <FinTr>
              <FinTh>Ticker</FinTh>
              <FinTh>Nombre</FinTh>
              <FinTh align="right">Dur</FinTh>
              <FinTh align="right">TER</FinTh>
              <FinTh align="right">AUM (USDm)</FinTh>
              <FinTh align="right">Precio</FinTh>
              <FinTh>Caso de uso</FinTh>
              <FinTh align="right">Tendencia</FinTh>
            </FinTr>
          </FinThead>
          <FinTbody>
            {ETFS.map((e) => (
              <FinTr key={e.ticker}>
                <FinTd><span className="pill border-foreground text-foreground">{e.ticker}</span></FinTd>
                <FinTd className="text-xs">{e.name}</FinTd>
                <FinTd align="right" numeric>{e.duration}</FinTd>
                <FinTd align="right" numeric>{e.ter}%</FinTd>
                <FinTd align="right" numeric>{(e.aum / 1000).toFixed(1)}B</FinTd>
                <FinTd align="right" numeric>{e.price.toFixed(2)}</FinTd>
                <FinTd className="text-xs text-muted-foreground">{useCase(e.duration)}</FinTd>
                <FinTd align="right">
                  {e.history ? (
                    <div className="w-24 ml-auto">
                      <Sparkline values={e.history} color="#3fb950" height={16} />
                    </div>
                  ) : "—"}
                </FinTd>
              </FinTr>
            ))}
          </FinTbody>
        </FinTable>
      </Panel>

      <Commentary title="Cómo interpretar la matriz de convexidad">
        <P>
          El heatmap inferior simula el retorno total a 1 año para cada ETF bajo siete shocks paralelos del yield
          (−200 a +200 bps). Visualmente revela tres propiedades clave de la duración: <Term>simetría parcial</Term>
          (los retornos son aproximadamente simétricos en magnitudes pequeñas pero asimétricos en magnitudes grandes
          gracias a la convexidad), <Term>escala con duración</Term> (más oscuro = mayor magnitud, ETFs largos
          dominan tanto el verde como el rojo), y el <Term>punto de breakeven</Term> donde el cupón compensa la
          pérdida por duración (visible como zona neutral entre 0 y +50 bps según el cupón actual del ETF).
        </P>
      </Commentary>

      <Panel title="Convexidad simulada · retorno total por shock de yield (1 año)" right={<span className="text-[10px] uppercase tracking-wider text-muted-foreground">Yield base {(baseYTM * 100).toFixed(2)}%</span>}>
        <Heatmap
          rows={convexityRows}
          cols={shocks.map((s) => `${s > 0 ? "+" : ""}${s} bps`)}
          cells={convexityCells}
          format="signedPct"
          decimals={1}
        />
      </Panel>

      <Commentary title="Trayectoria histórica TLT y EDV">
        <P>
          Las series temporales de TLT y EDV permiten visualizar la convexidad en acción: cuando los yields suben
          de manera sostenida, EDV cae aproximadamente 1.41× lo que cae TLT (ratio de duraciones 24/17), y en los
          rebotes recupera con el mismo factor. El ratio histórico de volatilidad EDV/TLT confirma empíricamente
          ese 1.41. Esto significa que invertir 1 USD en EDV es aproximadamente equivalente a invertir 1.41 USD
          en TLT en términos de exposición a riesgo de tasas — útil para calibrar tamaño de posición.
        </P>
      </Commentary>

      <Commentary title="El yield actual como anclaje del retorno esperado">
        <P>
          Sobre horizontes equivalentes a la duración del bono, el <Term>retorno futuro esperado de un
          Treasury ≈ yield al momento de la compra</Term>. La intuición es directa: el portafolio se compone
          de cupones recibidos y del repago del nominal; las desviaciones provienen del mark-to-market en el
          camino, pero convergen al yield inicial al vencimiento. Faber (2013, pp. 13–14) cita este resultado
          como anclaje conservador para forecast de bonos en horizontes de planificación, y observa que el
          mismo principio no aplica a equity — los dividendos representan una fracción menor del retorno
          total y la valuación de salida domina. Para asignar a TLT con yield-to-maturity 4.7%, la expectativa
          base de retorno anual sobre los próximos 17 años es 4.7%, no el promedio histórico de retornos
          recientes.
        </P>
        <P>
          La consecuencia operativa: el universo Treasury actual ofrece yields en niveles que no se veían
          desde el período 2006–2007. Para tesorerías con horizonte largo y obligaciones predecibles, este
          anclaje de carry se sitúa 200–300 bps por encima del de la década 2010–2021 (yields 1.5–2.5%).
          Mohamed El-Erian (PIMCO 2009) advirtió que <Term>la diversificación por sí sola ya no es suficiente
          para moderar el riesgo</Term> en un entorno de correlaciones inestables; Faber complementa
          señalando que <Term>el timing de bonos de baja volatilidad agrega poco valor</Term> — Treasury
          largos se aprovechan mejor con posición direccional sostenida que con rotación táctica, en
          contraste con crédito alto rendimiento, emergente o corporate, donde el filtro de tendencia sí
          mejora retornos ajustados por riesgo.
        </P>
      </Commentary>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Panel title="TLT · iShares 20+ Year Treasury">
          <LWCChart height={240} lines={[{ data: tltSeries, color: "#4493f8", title: "TLT", lineWidth: 2 }]} priceFormat={{ minMove: 0.01, precision: 2 }} />
        </Panel>
        <Panel title="EDV · Vanguard Extended Duration">
          <LWCChart height={240} lines={[{ data: edvSeries, color: "#3fb950", title: "EDV", lineWidth: 2 }]} priceFormat={{ minMove: 0.01, precision: 2 }} />
        </Panel>
      </div>
    </div>
  );
}
