/**
 * API route que consume el CMF API público para fondos mutuos chilenos.
 * Documentación: OpenAPI 3.1 (cmf-api).
 */
import { NextRequest, NextResponse } from "next/server";

const BASE = process.env.BUSCAFONDOS_API_URL || "https://api.buscafondos.com";

type CacheEntry = { ts: number; data: unknown };
const cache = new Map<string, CacheEntry>();
const TTL = 15 * 60_000; // 15 min

async function fetchCached(path: string): Promise<unknown> {
  const now = Date.now();
  const c = cache.get(path);
  if (c && now - c.ts < TTL) return c.data;
  const r = await fetch(`${BASE}${path}`, { headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error(`Upstream ${r.status} for ${path}`);
  const data = await r.json();
  cache.set(path, { ts: now, data });
  return data;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action") || "all-funds";

  try {
    // GET /api/asset_providers — listar administradoras (AGF)
    if (action === "providers") {
      const data = await fetchCached("/api/asset_providers");
      return NextResponse.json({ success: true, data });
    }

    // GET /api/asset_providers/{provider_id}/conceptual_assets — fondos por AGF
    if (action === "funds") {
      const providerId = searchParams.get("provider_id");
      if (!providerId) return NextResponse.json({ success: false, error: "Missing provider_id" }, { status: 400 });
      const data = await fetchCached(`/api/asset_providers/${providerId}/conceptual_assets`);
      return NextResponse.json({ success: true, data });
    }

    // GET /api/conceptual_assets/{concept_id}/real_assets — series de un fondo
    if (action === "series") {
      const conceptId = searchParams.get("concept_id");
      if (!conceptId) return NextResponse.json({ success: false, error: "Missing concept_id" }, { status: 400 });
      const data = await fetchCached(`/api/conceptual_assets/${conceptId}/real_assets`);
      return NextResponse.json({ success: true, data });
    }

    // GET /api/all-funds — universo completo con variaciones
    if (action === "all-funds") {
      const date = searchParams.get("date");
      const category = searchParams.get("category");
      const qs = new URLSearchParams();
      if (date) qs.set("date", date);
      if (category) qs.set("category", category);
      const path = qs.toString() ? `/api/all-funds?${qs.toString()}` : "/api/all-funds";
      const data = await fetchCached(path);
      return NextResponse.json({ success: true, data });
    }

    // GET /api/real_assets/{asset_id}/days — valores cuota diarios
    if (action === "days") {
      const assetId = searchParams.get("asset_id");
      const fromDate = searchParams.get("from_date");
      if (!assetId) return NextResponse.json({ success: false, error: "Missing asset_id" }, { status: 400 });
      const qs = fromDate ? `?from_date=${fromDate}` : "";
      const data = await fetchCached(`/api/real_assets/${assetId}/days${qs}`);
      return NextResponse.json({ success: true, data });
    }

    // GET /api/real_assets/{asset_id}/expense_ratio — TAC actual
    if (action === "expense_ratio") {
      const assetId = searchParams.get("asset_id");
      if (!assetId) return NextResponse.json({ success: false, error: "Missing asset_id" }, { status: 400 });
      const data = await fetchCached(`/api/real_assets/${assetId}/expense_ratio`);
      return NextResponse.json({ success: true, data });
    }

    // GET /api/real_assets/{asset_id}/risk_metrics — métricas de riesgo
    if (action === "risk") {
      const assetId = searchParams.get("asset_id");
      if (!assetId) return NextResponse.json({ success: false, error: "Missing asset_id" }, { status: 400 });
      const data = await fetchCached(`/api/real_assets/${assetId}/risk_metrics`);
      return NextResponse.json({ success: true, data });
    }

    // GET /api/agf_stats/ranking — ranking AGFs
    if (action === "ranking") {
      const metric = searchParams.get("metric") || "patrimony";
      const date = searchParams.get("date");
      const qs = new URLSearchParams({ metric });
      if (date) qs.set("date", date);
      const data = await fetchCached(`/api/agf_stats/ranking?${qs.toString()}`);
      return NextResponse.json({ success: true, data });
    }

    // GET /api/funds/{run}/cartera/resumen
    if (action === "cartera_resumen") {
      const run = searchParams.get("run");
      const month = searchParams.get("month");
      if (!run) return NextResponse.json({ success: false, error: "Missing run" }, { status: 400 });
      const qs = month ? `?month=${month}` : "";
      const data = await fetchCached(`/api/funds/${run}/cartera/resumen${qs}`);
      return NextResponse.json({ success: true, data });
    }

    // GET /api/funds/{run}/cartera/holdings
    if (action === "cartera_holdings") {
      const run = searchParams.get("run");
      const month = searchParams.get("month");
      const market = searchParams.get("market") || "all";
      if (!run) return NextResponse.json({ success: false, error: "Missing run" }, { status: 400 });
      const qs = new URLSearchParams({ market });
      if (month) qs.set("month", month);
      const data = await fetchCached(`/api/funds/${run}/cartera/holdings?${qs.toString()}`);
      return NextResponse.json({ success: true, data });
    }

    return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ success: false, error: msg }, { status: 502 });
  }
}
