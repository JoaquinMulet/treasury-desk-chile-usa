"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, Panel } from "@/components/fin/section";
import { Commentary, Term, P } from "@/components/fin/commentary";
import { FinTable, FinThead, FinTbody, FinTr, FinTh, FinTd } from "@/components/fin/fin-table";
import { MetricTile } from "@/components/fin/metric-tile";

type Issuer = {
  ticker: string;
  name: string;
  sector: "Soberano CL" | "Soberano USA" | "Bancario CL" | "Corporativo CL" | "Bancario USA" | "Corporativo USA";
  rating: string;
  ratingScore: number;
  outstandingBn: number;
  jurisdiction: "CL" | "USA";
  liquidity: "Alta" | "Media" | "Baja";
};

const ISSUERS: Issuer[] = [
  { ticker: "BTU", name: "Tesorería General Chile (UF)", sector: "Soberano CL", rating: "A", ratingScore: 6, outstandingBn: 35, jurisdiction: "CL", liquidity: "Alta" },
  { ticker: "BTP", name: "Tesorería General Chile (CLP)", sector: "Soberano CL", rating: "A", ratingScore: 6, outstandingBn: 28, jurisdiction: "CL", liquidity: "Alta" },
  { ticker: "BCU", name: "Banco Central Chile (UF)", sector: "Soberano CL", rating: "A", ratingScore: 6, outstandingBn: 18, jurisdiction: "CL", liquidity: "Alta" },
  { ticker: "BCP", name: "Banco Central Chile (CLP)", sector: "Soberano CL", rating: "A", ratingScore: 6, outstandingBn: 12, jurisdiction: "CL", liquidity: "Alta" },
  { ticker: "UST", name: "US Treasury", sector: "Soberano USA", rating: "AAA", ratingScore: 1, outstandingBn: 36000, jurisdiction: "USA", liquidity: "Alta" },
  { ticker: "BCI", name: "Banco BCI", sector: "Bancario CL", rating: "AA+", ratingScore: 2, outstandingBn: 4.5, jurisdiction: "CL", liquidity: "Alta" },
  { ticker: "BCH", name: "Banco de Chile", sector: "Bancario CL", rating: "AA+", ratingScore: 2, outstandingBn: 6.2, jurisdiction: "CL", liquidity: "Alta" },
  { ticker: "STD", name: "Banco Santander Chile", sector: "Bancario CL", rating: "AA+", ratingScore: 2, outstandingBn: 5.8, jurisdiction: "CL", liquidity: "Alta" },
  { ticker: "BICE", name: "Banco BICE", sector: "Bancario CL", rating: "AA", ratingScore: 3, outstandingBn: 1.2, jurisdiction: "CL", liquidity: "Media" },
  { ticker: "ITC", name: "Itaú Chile", sector: "Bancario CL", rating: "AA", ratingScore: 3, outstandingBn: 2.4, jurisdiction: "CL", liquidity: "Alta" },
  { ticker: "BES", name: "BancoEstado", sector: "Bancario CL", rating: "AA+", ratingScore: 2, outstandingBn: 8.5, jurisdiction: "CL", liquidity: "Alta" },
  { ticker: "CMPC", name: "CMPC", sector: "Corporativo CL", rating: "A", ratingScore: 6, outstandingBn: 3.1, jurisdiction: "CL", liquidity: "Media" },
  { ticker: "COPEC", name: "Copec", sector: "Corporativo CL", rating: "A", ratingScore: 6, outstandingBn: 2.8, jurisdiction: "CL", liquidity: "Media" },
  { ticker: "ENEL", name: "Enel Chile", sector: "Corporativo CL", rating: "AA-", ratingScore: 4, outstandingBn: 4.2, jurisdiction: "CL", liquidity: "Media" },
  { ticker: "ETESA", name: "Transelec", sector: "Corporativo CL", rating: "AA-", ratingScore: 4, outstandingBn: 2.0, jurisdiction: "CL", liquidity: "Baja" },
  { ticker: "FALA", name: "Falabella", sector: "Corporativo CL", rating: "A", ratingScore: 6, outstandingBn: 1.8, jurisdiction: "CL", liquidity: "Media" },
  { ticker: "AGUAS", name: "Aguas Andinas", sector: "Corporativo CL", rating: "AA", ratingScore: 3, outstandingBn: 1.5, jurisdiction: "CL", liquidity: "Media" },
  { ticker: "CODELCO", name: "CODELCO", sector: "Corporativo CL", rating: "A", ratingScore: 6, outstandingBn: 4.8, jurisdiction: "CL", liquidity: "Alta" },
  { ticker: "LATAM", name: "LATAM Airlines", sector: "Corporativo CL", rating: "BB+", ratingScore: 11, outstandingBn: 0.9, jurisdiction: "CL", liquidity: "Baja" },
];

export default function IssuersPage() {
  const [search, setSearch] = useState("");
  const [sectorFilter, setSectorFilter] = useState<string>("all");
  const [sort, setSort] = useState<"rating" | "outstanding" | "name">("rating");

  const filtered = useMemo(() => {
    let r = ISSUERS;
    if (search) r = r.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()) || i.ticker.toLowerCase().includes(search.toLowerCase()));
    if (sectorFilter !== "all") r = r.filter((i) => i.sector === sectorFilter);
    return [...r].sort((a, b) => {
      if (sort === "rating") return a.ratingScore - b.ratingScore;
      if (sort === "outstanding") return b.outstandingBn - a.outstandingBn;
      return a.name.localeCompare(b.name);
    });
  }, [search, sectorFilter, sort]);

  const sectorBreakdown = useMemo(() => {
    const map: Record<string, { count: number; outstanding: number }> = {};
    for (const i of ISSUERS) {
      const s = map[i.sector] || { count: 0, outstanding: 0 };
      map[i.sector] = { count: s.count + 1, outstanding: s.outstanding + i.outstandingBn };
    }
    return Object.entries(map).map(([k, v]) => ({ sector: k, ...v }));
  }, []);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Emisores"
        description="Universo soberano + bancario + corporativo accesible desde Chile"
      />

      <Commentary title="Jerarquía de emisores y prima de crédito">
        <P>
          El universo de emisores se organiza en una <Term>jerarquía de riesgo de crédito</Term>: soberano (Tesorería
          de la República y Banco Central) en la base, bancario senior por encima, y corporativo según rating
          individual. Cada nivel exige una <Term>prima por riesgo de default</Term> medible como spread del yield
          sobre el soberano comparable: un bono corporativo BBB típicamente paga 100–250 bps sobre el soberano A,
          un bancario AA+ paga 30–80 bps. Estos spreads varían cíclicamente: comprimidos en regímenes risk-on,
          ampliados en stress.
        </P>
        <P>
          El rating crediticio (Moody&apos;s, S&amp;P, Fitch) es una métrica relativa: AAA es el techo (US Treasury,
          algunas multilaterales); A es investment grade sólido (Chile soberano); BBB es el último grado IG; BB y
          abajo es high yield (mayor probabilidad de default histórica). La <Term>liquidez</Term> es ortogonal al
          rating: un bono AAA puede ser ilíquido si la emisión es pequeña, lo que se traduce en mayor bid-ask spread.
        </P>
      </Commentary>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
        {sectorBreakdown.map((s) => (
          <MetricTile
            key={s.sector}
            label={s.sector}
            value={s.count.toString()}
            subtitle={`USD ${s.outstanding.toFixed(1)}B outstanding`}
          />
        ))}
      </div>

      <Commentary title="Composición sectorial del universo" variant="compact">
        <P>
          Los seis tiles superiores muestran la distribución del universo por sector. Para gestión de tesorería en
          Chile, los soberanos CL (BTU/BTP/BCU/BCP) y los bancarios CL AA+ (Banco de Chile, BCI, Santander,
          BancoEstado) concentran ~70% de la liquidez del mercado local. El segmento corporativo CL ofrece spread
          sobre soberano pero con menor liquidez intradía; típicamente apropiado para holdings buy-and-hold dentro
          del cash ladder de plazos medios.
        </P>
        <P>
          Métricas relevantes para analizar emisores: <Term>DV01</Term> por emisión, <Term>tracking error</Term>
          versus el soberano comparable (mide volatilidad del spread crediticio), y <Term>attribution</Term> del
          spread total entre componente de default (probabilidad de no-pago × loss given default) y componente
          de liquidez (premio por iliquidez sobre soberano IG). El <Term>z-score</Term> del spread vs media
          histórica del emisor identifica niveles atractivos para entry; valores |z|&gt;2 indican repricing
          excesivo o oportunidad. Para análisis de <Term>tail events</Term> (downgrades, default), las series
          históricas de spreads previos a eventos similares en el sector son la referencia más útil.
        </P>
      </Commentary>

      <Panel
        title="Catálogo · filtros"
        right={
          <div className="flex items-center gap-2">
            <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-7 w-44 text-xs" />
            <Select value={sectorFilter} onValueChange={(v) => v && setSectorFilter(v)}>
              <SelectTrigger className="h-7 w-44 text-xs"><SelectValue placeholder="Sector" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los sectores</SelectItem>
                <SelectItem value="Soberano CL">Soberano CL</SelectItem>
                <SelectItem value="Soberano USA">Soberano USA</SelectItem>
                <SelectItem value="Bancario CL">Bancario CL</SelectItem>
                <SelectItem value="Corporativo CL">Corporativo CL</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(v) => v && setSort(v as "rating" | "outstanding" | "name")}>
              <SelectTrigger className="h-7 w-40 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="rating">Rating ↑</SelectItem>
                <SelectItem value="outstanding">Outstanding ↓</SelectItem>
                <SelectItem value="name">Alfabético</SelectItem>
              </SelectContent>
            </Select>
            <span className="pill border-foreground text-foreground">{filtered.length}</span>
          </div>
        }
      >
        <FinTable>
          <FinThead>
            <FinTr>
              <FinTh>Ticker</FinTh>
              <FinTh>Emisor</FinTh>
              <FinTh>Sector</FinTh>
              <FinTh>Rating</FinTh>
              <FinTh align="right">Outstanding</FinTh>
              <FinTh>Liquidez</FinTh>
              <FinTh>Jurisdicción</FinTh>
            </FinTr>
          </FinThead>
          <FinTbody>
            {filtered.map((i) => (
              <FinTr key={i.ticker}>
                <FinTd><span className="pill border-foreground text-foreground">{i.ticker}</span></FinTd>
                <FinTd className="font-medium">{i.name}</FinTd>
                <FinTd className="text-xs text-muted-foreground">{i.sector}</FinTd>
                <FinTd>
                  <span className={
                    "pill " +
                    (i.ratingScore <= 5 ? "border-[var(--color-pos)] text-[var(--color-pos)]" :
                      i.ratingScore <= 10 ? "border-[var(--color-warn)] text-[var(--color-warn)]" :
                      "border-[var(--color-neg)] text-[var(--color-neg)]")
                  }>{i.rating}</span>
                </FinTd>
                <FinTd align="right" numeric>{i.outstandingBn.toFixed(1)}B</FinTd>
                <FinTd>
                  <span className={
                    "pill " +
                    (i.liquidity === "Alta" ? "border-[var(--color-pos)] text-[var(--color-pos)]" :
                      i.liquidity === "Media" ? "border-[var(--color-warn)] text-[var(--color-warn)]" :
                      "border-border text-muted-foreground")
                  }>{i.liquidity}</span>
                </FinTd>
                <FinTd className="text-xs">{i.jurisdiction}</FinTd>
              </FinTr>
            ))}
          </FinTbody>
        </FinTable>
      </Panel>
    </div>
  );
}
