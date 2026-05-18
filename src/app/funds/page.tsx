"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, Panel } from "@/components/fin/section";
import { Commentary, Term, P } from "@/components/fin/commentary";
import { FinTable, FinThead, FinTbody, FinTr, FinTh, FinTd } from "@/components/fin/fin-table";
import { Pct, Compact } from "@/components/fin/num";

type Fund = {
  id?: string;
  attributes?: {
    run?: string;
    name?: string;
    category?: string;
    serie?: string;
    currency?: string;
    tac?: number;
    monthly_change?: number;
    daily_change?: number;
    patrimony?: number;
    investor_class?: string;
    administrator?: { name?: string };
  };
  run?: string;
  fundName?: string;
  agf?: string;
  category?: string;
  serie?: string;
  currency?: string;
  tac?: number;
  dailyChange?: number;
  monthlyChange?: number;
  patrimony?: number;
  investorClass?: string;
};

function normalize(f: Fund) {
  return {
    run: f.run ?? f.attributes?.run ?? "",
    name: f.fundName ?? f.attributes?.name ?? "",
    agf: f.agf ?? f.attributes?.administrator?.name ?? "",
    category: f.category ?? f.attributes?.category ?? "",
    serie: f.serie ?? f.attributes?.serie ?? "",
    currency: f.currency ?? f.attributes?.currency ?? "",
    tac: f.tac ?? f.attributes?.tac ?? 0,
    dailyChange: f.dailyChange ?? f.attributes?.daily_change ?? 0,
    monthlyChange: f.monthlyChange ?? f.attributes?.monthly_change ?? 0,
    patrimony: f.patrimony ?? f.attributes?.patrimony ?? 0,
    investorClass: f.investorClass ?? f.attributes?.investor_class ?? "",
  };
}

export default function FundsPage() {
  const [search, setSearch] = useState("");
  const [agfFilter, setAgfFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [maxTac, setMaxTac] = useState<number | "">(2);
  const [sortBy, setSortBy] = useState<"tac" | "monthly" | "patrimony">("tac");

  const { data, isLoading, error } = useQuery<{ success: boolean; data: { data?: Fund[] } | Fund[] }>({
    queryKey: ["funds", "all"],
    queryFn: async () => {
      const r = await fetch("/api/funds?action=all-funds");
      if (!r.ok) throw new Error("API error");
      return r.json();
    },
    staleTime: 15 * 60_000,
  });

  const fundsArray: Fund[] = data && data.success
    ? Array.isArray(data.data)
      ? data.data
      : Array.isArray(data.data?.data)
      ? data.data.data
      : []
    : [];
  const funds = fundsArray.map(normalize);

  const agfs = Array.from(new Set(funds.map((f) => f.agf).filter(Boolean))).sort();
  const categories = Array.from(new Set(funds.map((f) => f.category).filter(Boolean))).sort();

  let filtered = funds;
  if (search) filtered = filtered.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()) || f.run.includes(search));
  if (agfFilter !== "all") filtered = filtered.filter((f) => f.agf === agfFilter);
  if (categoryFilter !== "all") filtered = filtered.filter((f) => f.category === categoryFilter);
  if (typeof maxTac === "number") filtered = filtered.filter((f) => f.tac <= maxTac / 100);
  filtered = [...filtered].sort((a, b) => {
    if (sortBy === "tac") return a.tac - b.tac;
    if (sortBy === "monthly") return b.monthlyChange - a.monthlyChange;
    return b.patrimony - a.patrimony;
  }).slice(0, 200);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Fondos mutuos · Chile"
        description="Universo CMF vía buscafondos.com · screening TAC, AGF, categoría"
      />

      <Commentary title="Fondos mutuos chilenos · arquitectura del producto">
        <P>
          Un <Term>fondo mutuo</Term> es un vehículo de inversión colectiva administrado por una AGF (Administradora
          General de Fondos) bajo la Ley 20.712. Permite acceso a portafolios diversificados con bajos mínimos de
          entrada, valoración diaria del valor cuota (NAV), y liquidación T+1 a T+3 según el reglamento. La CMF
          regula los reglamentos internos, la valoración mark-to-market y la transparencia de carteras (publicación
          mensual).
        </P>
        <P>
          El factor que más determina el retorno neto de largo plazo es la <Term>TAC (Tasa Anual de Costos)</Term>,
          que incluye remuneración de la AGF, custodia, gastos operacionales. Diferencias de 50–100 bps en TAC se
          acumulan a múltiplos del nominal en décadas (Bogle 1999). Por eso el screening empieza filtrando por TAC
          máximo aceptable según el peer group: money market ≤ 0.5%, renta fija corta ≤ 1.0%, renta fija larga ≤
          1.5%, mixtos ≤ 1.8%, equity ≤ 2.0%.
        </P>
      </Commentary>

      <Panel title="Filtros">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-[1.4fr_1.4fr_1.4fr_0.8fr_0.8fr]">
          <Input className="h-8 text-xs" placeholder="Buscar fondo o RUN..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select value={agfFilter} onValueChange={(v) => v && setAgfFilter(v)}>
            <SelectTrigger className="h-8 w-full text-xs"><SelectValue placeholder="AGF" /></SelectTrigger>
            <SelectContent className="min-w-[320px]">
              <SelectItem value="all">Todas las AGF</SelectItem>
              {agfs.map((a) => (<SelectItem key={a} value={a}>{a}</SelectItem>))}
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={(v) => v && setCategoryFilter(v)}>
            <SelectTrigger className="h-8 w-full text-xs"><SelectValue placeholder="Categoría" /></SelectTrigger>
            <SelectContent className="min-w-[280px]">
              <SelectItem value="all">Todas las categorías</SelectItem>
              {categories.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
            </SelectContent>
          </Select>
          <Input
            className="h-8 text-xs font-mono"
            type="number"
            step="0.1"
            placeholder="Max TAC %"
            value={maxTac}
            onChange={(e) => setMaxTac(e.target.value === "" ? "" : parseFloat(e.target.value))}
          />
          <Select value={sortBy} onValueChange={(v) => v && setSortBy(v as "tac" | "monthly" | "patrimony")}>
            <SelectTrigger className="h-8 w-full text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="tac">TAC ↑</SelectItem>
              <SelectItem value="monthly">Mensual ↓</SelectItem>
              <SelectItem value="patrimony">Patrimonio ↓</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Panel>

      <Commentary title="Métricas profesionales en evaluación de fondos">
        <P>
          Las métricas estándar van más allá del retorno bruto: <Term>tracking error</Term> mide la dispersión
          del retorno del fondo respecto a su benchmark; <Term>information ratio</Term> (alpha sobre tracking
          error) cuantifica el skill del manager activo; <Term>Sortino</Term> y <Term>Calmar</Term> ratios
          ajustan retorno por downside risk en lugar de volatilidad total. Para fondos de renta fija, el
          <Term>DV01</Term> y la <Term>duración modificada</Term> determinan la sensibilidad de la cartera a
          tasas. La <Term>atribución</Term> de retorno descompone performance entre allocation effect (peso
          de clases) y selection effect (elección dentro de clase).
        </P>
      </Commentary>

      <Commentary title="Cómo screnear el universo CMF" variant="compact">
        <P>
          La tabla devuelve hasta 200 fondos ordenados por el criterio elegido. Para una <Term>tesorería corporativa</Term>
          buscando capital preservation, ordenar por TAC ascendente filtrando categoría money market o renta fija
          corta entrega los candidatos óptimos. Para apuestas tácticas a duración, filtrar por categorías mid/long
          term debt y ordenar por monthlyChange descendente identifica los fondos que ya se están moviendo en línea
          con la tesis — useful como confirmación. Patrimonio alto (USD &gt;100M equiv) reduce el riesgo de liquidez
          en rescates grandes.
        </P>
      </Commentary>

      <Panel
        title="Resultados"
        right={
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {isLoading ? "Cargando..." : error ? "Error API" : `${filtered.length} / ${funds.length}`}
          </span>
        }
      >
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-8" />)}
          </div>
        ) : error ? (
          <div className="border border-[var(--color-neg)]/30 bg-[var(--color-neg-bg)] p-3 text-xs">
            Error de conexión al API buscafondos.com.
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">Sin resultados con filtros actuales</div>
        ) : (
          <FinTable>
            <FinThead>
              <FinTr>
                <FinTh>RUN</FinTh>
                <FinTh>Fondo</FinTh>
                <FinTh>AGF</FinTh>
                <FinTh>Categoría</FinTh>
                <FinTh>Serie</FinTh>
                <FinTh>Curr</FinTh>
                <FinTh align="right">TAC</FinTh>
                <FinTh align="right">Mensual</FinTh>
                <FinTh align="right">Patrimonio</FinTh>
              </FinTr>
            </FinThead>
            <FinTbody>
              {filtered.map((f, i) => (
                <FinTr key={`${f.run}-${f.serie}-${i}`}>
                  <FinTd numeric className="text-[10px]">{f.run}</FinTd>
                  <FinTd className="max-w-xs truncate font-medium">{f.name}</FinTd>
                  <FinTd className="text-[10px] text-muted-foreground">{f.agf.substring(0, 25)}</FinTd>
                  <FinTd><span className="pill border-border text-muted-foreground">{f.category}</span></FinTd>
                  <FinTd>{f.serie}</FinTd>
                  <FinTd className="text-[10px]">{f.currency}</FinTd>
                  <FinTd align="right" numeric>{(f.tac * 100).toFixed(2)}%</FinTd>
                  <FinTd align="right"><Pct value={f.monthlyChange} colored signed /></FinTd>
                  <FinTd align="right"><Compact value={f.patrimony} /></FinTd>
                </FinTr>
              ))}
            </FinTbody>
          </FinTable>
        )}
      </Panel>
    </div>
  );
}
