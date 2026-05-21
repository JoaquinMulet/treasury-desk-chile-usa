import { loadSeries, lastValue, BCChKey } from "@/lib/data/bcch";
import { findAnalogs, buildMonthlyFromDaily } from "@/lib/calc/analog";
import { PageHeader, Panel } from "@/components/fin/section";
import { FinTable, FinThead, FinTbody, FinTr, FinTh, FinTd } from "@/components/fin/fin-table";
import { MetricTile } from "@/components/fin/metric-tile";
import { Yld, Num } from "@/components/fin/num";
import { Commentary, Term, P } from "@/components/fin/commentary";

export const dynamic = "force-dynamic";

export default function AnalogPage() {
  const featureKeys: { key: BCChKey; label: string }[] = [
    { key: "uf_10y", label: "UF 10Y" },
    { key: "uf_5y", label: "UF 5Y" },
    { key: "clp_10y", label: "CLP 10Y" },
    { key: "bei_5y", label: "BEI 5Y" },
    { key: "bei_10y", label: "BEI 10Y" },
    { key: "tpm", label: "TPM" },
  ];

  const features = featureKeys.map((f) => {
    const monthly = buildMonthlyFromDaily(loadSeries(f.key));
    return { key: f.label, series: monthly, currentValue: lastValue(f.key)?.value ?? 0 };
  });

  const matches = findAnalogs(features, 15, 36);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Análogo histórico"
        description="Top 15 períodos macroeconómicamente similares · distancia euclídea normalizada"
      />

      <Commentary title="Análogo histórico · nearest-neighbor para regímenes macro">
        <P>
          El <Term>análogo histórico</Term> es una técnica no-paramétrica que identifica períodos del pasado donde el
          vector completo de variables macroeconómicas era similar al actual, asumiendo que el comportamiento futuro
          del mercado en esos análogos provee una distribución condicional para el presente. Es equivalente a un
          <Term>k-nearest neighbors</Term> aplicado a series temporales macroeconómicas (Hodrick-Prescott, Hamilton).
        </P>
        <P>
          Conceptualmente: cuando el mercado está en niveles únicos de yields, inflación y política monetaria, el
          forward return promedio histórico es poco informativo (mezcla regímenes muy distintos). Filtrando a los
          15 meses históricamente más similares — donde las seis features están en niveles cercanos al actual — se
          obtiene un benchmark mucho más relevante. La distancia euclídea sobre features normalizadas (z-score por
          la varianza histórica de cada serie) es la métrica estándar.
        </P>
      </Commentary>

      <Commentary title="Por qué importa el régimen · dispersión histórica de retornos por década">
        <P>
          La motivación empírica para condicionar por régimen es la enorme dispersión de retornos del S&amp;P 500
          por década, documentada por Faber (2013, Appendix B) en una ventana de 110 años. Los resultados
          decennales: 1900s 9.93% / 1910s 4.35% / 1920s 14.78% / 1930s −0.47% / 1940s 8.99% / 1950s 19.26% /
          1960s 7.76% / 1970s 5.88% / 1980s 17.55% / 1990s 18.21% / 2000s −0.94%. Promediar estas observaciones
          en un único "retorno histórico" descarta información sustantiva: el régimen importa más que el
          promedio incondicional.
        </P>
        <P>
          La dispersión también aparece en drawdowns: la peor pérdida pico-a-valle por década va de −15% (1950s)
          a −80% (1930s) y −51% (2000s). Identificar el régimen análogo al actual, en lugar de promediar los doce
          regímenes, es la diferencia entre un forecast de retorno esperado +9% incondicional con desviación
          estándar ±8 puntos y un forecast condicional con bandas mucho más estrechas. La técnica no predice el
          retorno futuro — provee la distribución relevante sobre la que tomar la decisión.
        </P>
      </Commentary>

      <div>
        <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Vector actual</h2>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
          {features.map((f) => (
            <MetricTile
              key={f.key}
              label={f.key}
              value={<Yld value={f.currentValue} />}
            />
          ))}
        </div>
      </div>

      <Panel
        title={`Top ${matches.length} períodos análogos`}
        right={
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {features[0]?.series.length ?? 0} meses analizados · ventana exclusión 36m
          </span>
        }
      >
        {matches.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted-foreground">Sin histórico suficiente</div>
        ) : (
          <FinTable>
            <FinThead>
              <FinTr>
                <FinTh>Rank</FinTh>
                <FinTh>Fecha</FinTh>
                <FinTh align="right">Distancia</FinTh>
                {features.map((f) => (
                  <FinTh key={f.key} align="right">{f.key}</FinTh>
                ))}
              </FinTr>
            </FinThead>
            <FinTbody>
              {matches.map((m, i) => (
                <FinTr key={m.date}>
                  <FinTd>
                    <span className={
                      "pill " +
                      (i < 3 ? "border-[var(--color-pos)] text-[var(--color-pos)]" :
                       i < 8 ? "border-[var(--color-info)] text-[var(--color-info)]" :
                       "border-border text-muted-foreground")
                    }>#{i + 1}</span>
                  </FinTd>
                  <FinTd className="font-medium">{m.date.slice(0, 7)}</FinTd>
                  <FinTd align="right"><Num value={m.distance} /></FinTd>
                  {features.map((f) => (
                    <FinTd key={f.key} align="right" numeric>
                      {m.features[f.key]?.toFixed(2) ?? "—"}
                    </FinTd>
                  ))}
                </FinTr>
              ))}
            </FinTbody>
          </FinTable>
        )}
      </Panel>

      <Commentary title="Limitaciones del método" variant="compact">
        <P>
          El análogo histórico asume <Term>estacionariedad de los regímenes</Term>: que los mecanismos económicos
          subyacentes en períodos similares responden a shocks de manera similar. Esta hipótesis falla cuando ha
          habido cambios estructurales mayores (creación del euro 1999, QE post-2008, cambios de mandato de la
          Fed). En esos casos, el análogo puede dar falsa señal. Mitigación: combinar con un análisis cualitativo
          de qué shock estructural está operando hoy que no estaba en los análogos.
        </P>
      </Commentary>

      <Panel title="Interpretación">
        <p className="text-xs text-muted-foreground">
          La distancia se calcula sobre features normalizadas (z-score por toda la serie histórica). Los matches más cercanos representan
          meses donde el conjunto completo de yields, breakeven e inflación estuvo en niveles similares al actual.
        </p>
      </Panel>
    </div>
  );
}
