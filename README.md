# Bonds Treasury Desk

Plataforma personal de gestión táctica de tesorería corporativa.
Stack: Next.js 16 (app router) + TypeScript + Tailwind 4 + shadcn/ui + TradingView Lightweight Charts.

Datos: Banco Central de Chile (curva UF+CLP+BEI diaria desde 2002, 19 series),
Yahoo Finance (Treasury yields, TLT, EDV, MOVE, DXY), CMF Chile (fondos mutuos via BuscaFondos CLI).

## Setup

```bash
pnpm install
pnpm dev
# Abrir http://localhost:3000
```

## Actualizar data BCCh

Las credenciales del BCCh están en `.env` (no commiteable). Para refrescar las series:

```bash
uv run --with requests --with python-dotenv --with pandas python scripts/bcch_fetch.py
```

Esto re-descarga los 19 CSVs en `data/bcch/`.

## Estructura

```
src/
  app/                      Rutas (App Router)
    page.tsx                Snapshot táctico
    curves/                 Curvas UF + CLP + BEI + USA
    bonds/                  Calculadora bonos (stub)
    funds/                  Fondos mutuos CL (stub)
    portfolio/              Cartera y analytics (stub)
    cash-ladder/            Segmentación caja (stub)
    stress/                 Stress testing (stub)
    tax/                    Tributario corporativo (stub)
    analog/                 Análogo histórico (stub)
    backtest/               Backtesting (stub)
    ...
  components/
    layout/                 Sidebar, page stubs
    snapshot/               Stat cards, opportunity score
    charts/                 Lightweight Charts wrappers
    ui/                     shadcn (button, card, table, ...)
  lib/
    data/
      bcch.ts               Loader CSVs BCCh + utilities (z-score, percentile)
      market.ts             Snapshot USA cacheado
      types.ts              Tipos compartidos
data/
  bcch/                     19 CSVs históricos del BCCh
scripts/
  bcch_fetch.py             ETL Python (lee .env, descarga API BCCh)
```

## Módulos

Implementados (funcionales con data real):
- Snapshot táctico con score de oportunidad
- Curvas Chile UF / CLP / BEI / USA

Stubs (UI + roadmap, sin lógica):
- Calculadora bonos, Fondos, ETFs, Portfolio, Cash ladder,
- Stress testing, Tributario, Análogo histórico,
- Backtesting, Emisores, Watchlist, Diario, Reportes

Ver `plataforma_blueprint.md` en el repo BuscaFondos para spec completa.
