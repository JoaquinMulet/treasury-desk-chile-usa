"""
Descarga ETFs USA, MOVE y DXY desde Yahoo Finance (via yfinance).
Cubre el gap que FRED no tiene: instrumentos privados (ETFs) y
proprietary indices (ICE MOVE) que no están en FRED.

Uso:
  uv run --with yfinance --with python-dotenv python scripts/yf_fetch.py
  uv run --with yfinance --with python-dotenv python scripts/yf_fetch.py --snapshot-only

Devuelve:
  - data/yf/<TICKER>.csv para cada ticker (date,value formato bcch-compatible)
  - data/yf/_snapshot.json alineado a las labels del snapshot FRED, para
    consumo desde src/lib/data/market.ts

IMPORTANTE: yfinance es un wrapper no-oficial de Yahoo Finance. Yahoo
ocasionalmente cambia su backend; si el script falla, suele bastar con
actualizar yfinance. Para producción institucional usar Refinitiv/Bloomberg.
"""
import json
import sys
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SNAPSHOT_ONLY = "--snapshot-only" in sys.argv

OUT = ROOT / "data" / "yf"
OUT.mkdir(parents=True, exist_ok=True)

FRED_SNAPSHOT = ROOT / "data" / "fred" / "_snapshot.json"

# Tickers · key del consumer en market.ts → ticker Yahoo
TICKERS = {
    # Long-duration Treasury ETFs
    "tlt": "TLT",       # iShares 20+ Year Treasury Bond (dur ~17)
    "edv": "EDV",       # Vanguard Extended Duration Treasury (dur ~24)
    "vglt": "VGLT",     # Vanguard Long-Term Treasury (dur ~16)
    "zroz": "ZROZ",     # PIMCO 25+ Year Zero Coupon Treasury (dur ~26)
    # Intermediate/short Treasury ETFs (universe completion para /etfs)
    "tlh": "TLH",       # iShares 10-20Y Treasury (dur ~12.5)
    "ief": "IEF",       # iShares 7-10Y Treasury (dur ~7.5)
    "iei": "IEI",       # iShares 3-7Y Treasury (dur ~4.5)
    "shy": "SHY",       # iShares 1-3Y Treasury (dur ~1.9)
    "sgov": "SGOV",     # iShares 0-3M T-Bills (dur ~0.1)
    # Volatility & FX indices
    "move": "^MOVE",    # ICE BofA MOVE Index (Treasury volatility)
    "dxy": "DX-Y.NYB",  # ICE U.S. Dollar Index
}

# Ventana histórica · descargamos 2 años para tener margen suficiente
# tanto para changes mensuales como para el history weekly de 28 semanas
START = (datetime.now() - timedelta(days=730)).strftime("%Y-%m-%d")


def fetch_series(ticker: str):
    """Descarga histórico daily desde Yahoo. Devuelve lista [(date_str, close), ...] ordenada."""
    import yfinance as yf
    df = yf.download(ticker, start=START, progress=False, auto_adjust=False)
    if df is None or df.empty:
        return []
    # yfinance devuelve un MultiIndex para single-ticker en versiones recientes;
    # extraemos "Close" como Series
    if hasattr(df.columns, "levels"):
        close = df["Close"][ticker] if (ticker in df["Close"].columns) else df["Close"].iloc[:, 0]
    else:
        close = df["Close"]
    out: list[tuple[str, float]] = []
    for ts, val in close.items():
        if val is None:
            continue
        try:
            fv = float(val)
        except (TypeError, ValueError):
            continue
        if fv != fv:  # NaN check
            continue
        out.append((ts.strftime("%Y-%m-%d"), fv))
    out.sort(key=lambda x: x[0])
    return out


def write_csv(ticker: str, series: list[tuple[str, float]]) -> int:
    """Escribe CSV con formato date,value (compatible con parseCsv de bcch.ts)."""
    path = OUT / f"{ticker}.csv"
    with open(path, "w", encoding="utf-8") as f:
        f.write("date,value\n")
        for d, v in series:
            f.write(f"{d},{v:.4f}\n")
    return len(series)


def read_csv_series(ticker: str) -> list[tuple[str, float]]:
    """Lee un CSV ya escrito. Análogo a fred_fetch.py."""
    path = OUT / f"{ticker}.csv"
    if not path.exists():
        return []
    out: list[tuple[str, float]] = []
    with open(path, "r", encoding="utf-8") as f:
        next(f, None)
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


def change_pct(series: list[tuple[str, float]], lag_days: int) -> float | None:
    """Cambio porcentual entre el último valor y el de hace `lag_days`.
    lag_days se cuenta sobre la serie ordenada (trading days, no calendar)."""
    if len(series) < lag_days + 1:
        return None
    last = series[-1][1]
    prev = series[-1 - lag_days][1]
    if prev == 0:
        return None
    return round((last - prev) / prev * 100, 2)


def value_at_or_before(series: list[tuple[str, float]], target_date: str) -> float | None:
    """Devuelve el último valor con fecha ≤ target_date. None si no hay."""
    last_val = None
    for d, v in series:
        if d <= target_date:
            last_val = v
        else:
            break
    return last_val


def write_snapshot() -> None:
    """Genera data/yf/_snapshot.json alineado a las labels del snapshot FRED.
    Estructura:
      { as_of, prices {...}, changes_pct {1d/1w/1m por ticker},
        history { labels: [...], <ticker>: [...] alineados a labels } }
    """
    # Cargamos labels del snapshot FRED si existe; sino fallback a labels propias
    fred_labels: list[str] = []
    if FRED_SNAPSHOT.exists():
        try:
            with open(FRED_SNAPSHOT, "r", encoding="utf-8") as f:
                fred = json.load(f)
            fred_labels = fred.get("history", {}).get("labels", [])
        except Exception as e:
            print(f"WARN: no se pudo leer fred snapshot: {e}", file=sys.stderr)

    all_series = {key: read_csv_series(key) for key in TICKERS}

    # Si no hay labels FRED disponibles, usamos labels propias (weekly del TLT)
    if not fred_labels and all_series.get("tlt"):
        tlt = all_series["tlt"]
        cutoff_dt = datetime.strptime(tlt[-1][0], "%Y-%m-%d") - timedelta(days=200)
        recent = [(d, v) for d, v in tlt if datetime.strptime(d, "%Y-%m-%d") >= cutoff_dt]
        by_week: dict[tuple[int, int], tuple[str, float]] = {}
        for d_str, v in recent:
            d = datetime.strptime(d_str, "%Y-%m-%d").date()
            iso = d.isocalendar()
            by_week[(iso.year, iso.week)] = (d_str, v)
        fred_labels = [item[0] for item in sorted(by_week.values(), key=lambda x: x[0])][-28:]

    # Construcción de history alineada
    history: dict[str, list[float | None]] = {"labels": fred_labels}  # type: ignore[dict-item]
    for key, series in all_series.items():
        history[key] = [value_at_or_before(series, d) for d in fred_labels]

    # As-of: máximo entre las series · si fred trae labels usamos su as-of, sino máximo de YF
    as_of = max((s[-1][0] for s in all_series.values() if s), default="")

    snapshot = {
        "as_of": as_of,
        "source": "Yahoo Finance · via yfinance",
        "prices": {
            key: (series[-1][1] if series else None) for key, series in all_series.items()
        },
        "changes_pct": {
            key: {
                "day": change_pct(series, 1),
                "week": change_pct(series, 5),
                "month": change_pct(series, 21),
            } if series else None
            for key, series in all_series.items()
        },
        "history": history,
    }
    snap_path = OUT / "_snapshot.json"
    with open(snap_path, "w", encoding="utf-8") as f:
        json.dump(snapshot, f, indent=2)
    print(f"\n[snapshot] {snap_path.name} · as_of {as_of} · labels {len(fred_labels)}w")


def main():
    if SNAPSHOT_ONLY:
        print("Modo --snapshot-only · saltando fetch a Yahoo\n")
        write_snapshot()
        return

    total = 0
    failed: list[tuple[str, str]] = []
    for key, ticker in TICKERS.items():
        try:
            print(f"[{ticker}] ({key})...", end=" ", flush=True)
            series = fetch_series(ticker)
            if not series:
                print("EMPTY")
                failed.append((ticker, "empty response"))
                continue
            n = write_csv(key, series)
            print(f"{n} obs  ({series[0][0]} -> {series[-1][0]})")
            total += n
        except Exception as e:
            print(f"ERR: {e}")
            failed.append((ticker, str(e)))

    print(f"\n{'=' * 60}")
    print(f"Total: {total} observaciones, {len(TICKERS) - len(failed)}/{len(TICKERS)} OK")

    write_snapshot()

    if failed:
        print("\nFallidas:")
        for ticker, msg in failed:
            print(f"  - {ticker}: {msg}")
        # Salimos con código 0 igual: el snapshot se genera con lo que haya, y el
        # workflow no debería fallar si un solo ticker no responde temporalmente
        # (Yahoo cae a veces). Cambiar a sys.exit(1) si se prefiere bloquear.


if __name__ == "__main__":
    main()
