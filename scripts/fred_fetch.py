"""
Descarga series del Federal Reserve Economic Data (FRED).
Lee credenciales desde .env (FRED_API_KEY).
El .env NO se commitea (está en .gitignore).

Uso:
  uv run --with requests --with python-dotenv python scripts/fred_fetch.py

Devuelve CSV en data/fred/<series_id>.csv para cada serie consultada.
"""
import os
import sys
import time
from pathlib import Path
import requests
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

API_KEY = os.environ.get("FRED_API_KEY")
if not API_KEY:
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


def main():
    total = 0
    failed = []
    for code, label in SERIES:
        try:
            print(f"[{code}] {label}...", end=" ", flush=True)
            obs = fetch_series(code)
            n = write_csv(code, obs)
            print(f"{n} obs  ({obs[0]['date']} → {obs[-1]['date']})" if n > 0 else "EMPTY")
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
    if failed:
        print("\nFallidas:")
        for code, msg in failed:
            print(f"  - {code}: {msg}")
        sys.exit(1)


if __name__ == "__main__":
    main()
