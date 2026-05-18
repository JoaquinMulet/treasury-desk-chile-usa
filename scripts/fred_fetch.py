"""
Descarga series del Federal Reserve Economic Data (FRED).
Lee credenciales desde .env (FRED_API_KEY).
El .env NO se commitea (está en .gitignore).

Uso:
  uv run --with requests --with python-dotenv python scripts/fred_fetch.py
  uv run --with requests --with python-dotenv python scripts/fred_fetch.py --snapshot-only

El segundo modo regenera `_snapshot.json` desde los CSVs en disco sin
hacer fetch al API — útil para regenerar el JSON consumible por
`src/lib/data/market.ts` sin requerir API key.

Devuelve:
  - data/fred/<series_id>.csv para cada serie consultada
  - data/fred/_snapshot.json con yields/changes/history para market.ts
"""
import json
import os
import sys
import time
from datetime import date, datetime, timedelta
from pathlib import Path
import requests
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

SNAPSHOT_ONLY = "--snapshot-only" in sys.argv

API_KEY = os.environ.get("FRED_API_KEY")
if not API_KEY and not SNAPSHOT_ONLY:
    print("ERROR: FRED_API_KEY no definido en .env", file=sys.stderr)
    sys.exit(1)

OUT = ROOT / "data" / "fred"
OUT.mkdir(parents=True, exist_ok=True)

# Series a descargar — mismo catálogo que src/lib/data/fred-meta.ts
SERIES = [
    # Treasury nominal constant maturity
    ("DGS1MO", "Treasury 1M"),
    ("DGS3MO", "Treasury 3M"),
    ("DGS6MO", "Treasury 6M"),
    ("DGS1", "Treasury 1Y"),
    ("DGS2", "Treasury 2Y"),
    ("DGS5", "Treasury 5Y"),
    ("DGS7", "Treasury 7Y"),
    ("DGS10", "Treasury 10Y"),
    ("DGS20", "Treasury 20Y"),
    ("DGS30", "Treasury 30Y"),
    # TIPS real yields
    ("DFII5", "TIPS 5Y real"),
    ("DFII10", "TIPS 10Y real"),
    ("DFII20", "TIPS 20Y real"),
    ("DFII30", "TIPS 30Y real"),
    # Breakeven inflation (FRED-calculated)
    ("T5YIE", "Breakeven 5Y"),
    ("T10YIE", "Breakeven 10Y"),
    # Policy rates
    ("DFF", "Fed Funds effective"),
    ("SOFR", "SOFR overnight"),
    # Pre-computed spreads
    ("T10Y2Y", "Spread 10Y-2Y"),
    ("T10Y3M", "Spread 10Y-3M"),
]

BASE_URL = "https://api.stlouisfed.org/fred/series/observations"
# Fecha de inicio amplia — FRED ignora si la serie empieza después
START = "1900-01-01"


def fetch_series(code: str) -> list[dict]:
    """Descarga JSON de observaciones para una serie FRED."""
    params = {
        "series_id": code,
        "api_key": API_KEY,
        "file_type": "json",
        "observation_start": START,
    }
    resp = requests.get(BASE_URL, params=params, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    return data.get("observations", [])


def write_csv(code: str, observations: list[dict]) -> int:
    """Escribe CSV en formato date,value (compatible con bcch.ts parseCsv).
    Filtra observaciones con value='.' (missing en FRED).
    Devuelve cantidad de filas escritas."""
    path = OUT / f"{code}.csv"
    rows = 0
    with open(path, "w", encoding="utf-8") as f:
        f.write("date,value\n")
        for obs in observations:
            value = obs.get("value", ".")
            if value == "." or value is None:
                continue
            try:
                float(value)
            except (TypeError, ValueError):
                continue
            f.write(f"{obs['date']},{value}\n")
            rows += 1
    return rows


def read_csv_series(code: str) -> list[tuple[str, float]]:
    """Lee un CSV ya escrito (date,value) y devuelve [(date, value), ...] ordenado."""
    path = OUT / f"{code}.csv"
    if not path.exists():
        return []
    out: list[tuple[str, float]] = []
    with open(path, "r", encoding="utf-8") as f:
        next(f, None)  # skip header
        for line in f:
            line = line.strip()
            if not line:
                continue
            parts = line.split(",")
            if len(parts) != 2:
                continue
            try:
                out.append((parts[0], float(parts[1])))
            except ValueError:
                continue
    out.sort(key=lambda x: x[0])
    return out


def change_bps(series: list[tuple[str, float]], lag_days: int) -> float | None:
    """Diferencia en bps entre el último valor y el de hace `lag_days`.
    Usa lookup por índice (asume series diaria sin gaps grandes; aproxima).
    Devuelve None si no hay historia suficiente."""
    if len(series) < lag_days + 1:
        return None
    last = series[-1][1]
    prev = series[-1 - lag_days][1]
    return round((last - prev) * 100, 2)  # pp → bps


def weekly_history(series: list[tuple[str, float]], n_weeks: int) -> list[tuple[str, float]]:
    """Toma el último valor de cada semana ISO en los últimos `n_weeks * 7` días.
    Devuelve lista cronológica de hasta n_weeks puntos (date, value)."""
    if not series:
        return []
    cutoff = datetime.strptime(series[-1][0], "%Y-%m-%d").date() - timedelta(days=n_weeks * 7 + 7)
    recent = [(d, v) for d, v in series if datetime.strptime(d, "%Y-%m-%d").date() >= cutoff]
    by_week: dict[tuple[int, int], tuple[str, float]] = {}
    for d_str, v in recent:
        d = datetime.strptime(d_str, "%Y-%m-%d").date()
        iso = d.isocalendar()
        key = (iso.year, iso.week)
        # Última observación de la semana gana (recent[] ya está ordenada ascendente)
        by_week[key] = (d_str, v)
    sorted_weeks = sorted(by_week.values(), key=lambda x: x[0])
    return sorted_weeks[-n_weeks:]


def write_snapshot() -> None:
    """Genera data/fred/_snapshot.json para consumo desde market.ts (client-safe).
    Estructura:
      { as_of, yields {us_5y, us_10y, us_30y}, changes_bps {1d/1w/1m por yield},
        history { labels: [...], us_5y: [...], us_10y: [...], us_30y: [...] } }
    """
    s5 = read_csv_series("DGS5")
    s10 = read_csv_series("DGS10")
    s30 = read_csv_series("DGS30")
    if not s10:
        print("WARN: DGS10 vacío, no se genera snapshot", file=sys.stderr)
        return

    # Construir history weekly · alineamos por dates del 10Y (proxy del calendario)
    hist10 = weekly_history(s10, n_weeks=28)
    labels = [d for d, _ in hist10]

    def align(series: list[tuple[str, float]]) -> list[float | None]:
        by_date = dict(series)
        return [by_date.get(d) for d in labels]

    snapshot = {
        "as_of": s10[-1][0],
        "source": "FRED · https://fred.stlouisfed.org/",
        "yields": {
            "us_5y": s5[-1][1] if s5 else None,
            "us_10y": s10[-1][1],
            "us_30y": s30[-1][1] if s30 else None,
        },
        "changes_bps": {
            "us_5y": {
                "day": change_bps(s5, 1),
                "week": change_bps(s5, 5),
                "month": change_bps(s5, 21),
            } if s5 else None,
            "us_10y": {
                "day": change_bps(s10, 1),
                "week": change_bps(s10, 5),
                "month": change_bps(s10, 21),
            },
            "us_30y": {
                "day": change_bps(s30, 1),
                "week": change_bps(s30, 5),
                "month": change_bps(s30, 21),
            } if s30 else None,
        },
        "history": {
            "labels": labels,
            "us_5y": align(s5),
            "us_10y": [v for _, v in hist10],
            "us_30y": align(s30),
        },
    }
    snap_path = OUT / "_snapshot.json"
    with open(snap_path, "w", encoding="utf-8") as f:
        json.dump(snapshot, f, indent=2)
    print(f"\n[snapshot] {snap_path.name} · as_of {snapshot['as_of']} · history {len(labels)}w")


def main():
    if SNAPSHOT_ONLY:
        print("Modo --snapshot-only · saltando fetch al API\n")
        write_snapshot()
        return

    total = 0
    failed = []
    for code, label in SERIES:
        try:
            print(f"[{code}] {label}...", end=" ", flush=True)
            obs = fetch_series(code)
            n = write_csv(code, obs)
            print(f"{n} obs  ({obs[0]['date']} -> {obs[-1]['date']})" if n > 0 else "EMPTY")
            total += n
            # Rate-limit cortesía — FRED no impone límite estricto pero conviene espaciar
            time.sleep(0.15)
        except requests.HTTPError as e:
            print(f"HTTP {e.response.status_code}")
            failed.append((code, str(e)))
        except Exception as e:
            print(f"ERR: {e}")
            failed.append((code, str(e)))

    print(f"\n{'=' * 60}")
    print(f"Total: {total} observaciones, {len(SERIES) - len(failed)}/{len(SERIES)} series OK")

    # Snapshot consumible por market.ts — se regenera siempre que el fetch corra
    write_snapshot()

    if failed:
        print("\nFallidas:")
        for code, msg in failed:
            print(f"  - {code}: {msg}")
        sys.exit(1)


if __name__ == "__main__":
    main()
