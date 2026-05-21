"""
Descarga series del Banco Central de Chile (BDE - SIETE REST).
Lee credenciales desde .env (BCCH_USER, BCCH_PASS).
El .env NO se commitea (está en .gitignore).

Uso:
  uv run --with requests --with python-dotenv --with pandas python scripts/bcch_fetch.py

Devuelve CSV en data/bcch/<series_id>.csv para cada serie consultada.
"""
import os
import sys
import time
import json
from pathlib import Path
import requests
import pandas as pd
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

USER = os.environ.get("BCCH_USER")
PASS = os.environ.get("BCCH_PASS")
if not USER or not PASS:
    print("ERROR: BCCH_USER o BCCH_PASS no definidos en .env", file=sys.stderr)
    sys.exit(1)

OUT = ROOT / "data" / "bcch"
OUT.mkdir(parents=True, exist_ok=True)

BASE = "https://si3.bcentral.cl/SieteRestWS/SieteRestWS.ashx"

# Series clave para la tesis: curva UF + curva CLP + USD/CLP + breakeven + TPM + UF
SERIES = {
    # Curva real UF (BCU + BTU agregada, mercado secundario diario)
    "F022.BUF.TIS.AN01.UF.Z.D": "Yield UF 1Y",
    "F022.BUF.TIS.AN02.UF.Z.D": "Yield UF 2Y",
    "F022.BUF.TIS.AN05.UF.Z.D": "Yield UF 5Y",
    "F022.BUF.TIS.AN10.UF.Z.D": "Yield UF 10Y",
    "F022.BUF.TIS.AN20.UF.Z.D": "Yield UF 20Y",
    "F022.BUF.TIS.AN30.UF.Z.D": "Yield UF 30Y",
    # Curva nominal CLP (BCP + BTP, mercado secundario diario)
    "F022.BCLP.TIS.AN01.NO.Z.D": "Yield CLP 1Y",
    "F022.BCLP.TIS.AN02.NO.Z.D": "Yield CLP 2Y",
    "F022.BCLP.TIS.AN05.NO.Z.D": "Yield CLP 5Y",
    "F022.BCLP.TIS.AN10.NO.Z.D": "Yield CLP 10Y",
    # Breakeven inflation (compensación inflacionaria swaps spot, diaria)
    "F022.SWSP.TAS.AN01.Z.Z.D": "BEI swap 1Y",
    "F022.SWSP.TAS.AN02.Z.Z.D": "BEI swap 2Y",
    "F022.SWSP.TAS.AN05.Z.Z.D": "BEI swap 5Y",
    "F022.SWSP.TAS.AN10.Z.Z.D": "BEI swap 10Y",
    # Breakeven inflation (bonos BCCh spot, diaria)
    "F022.BOSP.TAS.AN01.Z.Z.D": "BEI bonos 1Y",
    "F022.BOSP.TAS.AN05.Z.Z.D": "BEI bonos 5Y",
    "F022.BOSP.TAS.AN10.Z.Z.D": "BEI bonos 10Y",
    # TPM
    "F022.TPM.TIN.D001.NO.Z.D": "TPM",
    # USD/CLP nominal observado
    "F073.TCO.PRE.Z.D": "USD/CLP",
    # UF diaria
    "F073.UFF.PRE.Z.D": "UF",
}

def fetch(series_id, first="2002-01-01", last=None):
    params = {
        "user": USER,
        "pass": PASS,
        "function": "GetSeries",
        "timeseries": series_id,
        "firstdate": first,
    }
    if last:
        params["lastdate"] = last
    r = requests.get(BASE, params=params, timeout=30)
    r.raise_for_status()
    data = r.json()
    if data.get("Codigo") != 0:
        return None, data.get("Descripcion", "unknown error")
    obs = (data.get("Series") or {}).get("Obs") or []
    rows = []
    for o in obs:
        v = o.get("value", "")
        if v in ("", "NaN", None) or o.get("statusCode") not in ("OK", None):
            continue
        try:
            val = float(v)
        except ValueError:
            continue
        d = o.get("indexDateString", "")
        # formato DD-MM-YYYY → YYYY-MM-DD
        if d and len(d) == 10:
            dd, mm, yy = d.split("-")
            iso = f"{yy}-{mm}-{dd}"
        else:
            continue
        rows.append({"date": iso, "value": val})
    if not rows:
        return None, "empty"
    df = pd.DataFrame(rows).sort_values("date").reset_index(drop=True)
    return df, None


def main():
    catalog = []
    for sid, name in SERIES.items():
        print(f"Fetching {sid} ({name})...", end=" ", flush=True)
        df, err = fetch(sid)
        if err:
            print(f"FAIL: {err}")
            continue
        out_path = OUT / f"{sid}.csv"
        df.to_csv(out_path, index=False)
        print(f"OK  rows={len(df):4d}  first={df['date'].iloc[0]}  last={df['date'].iloc[-1]}  last_val={df['value'].iloc[-1]:.4f}")
        catalog.append({
            "id": sid,
            "name": name,
            "rows": len(df),
            "first": df["date"].iloc[0],
            "last": df["date"].iloc[-1],
            "last_value": float(df["value"].iloc[-1]),
            "file": str(out_path.relative_to(ROOT)).replace("\\", "/"),
        })
        time.sleep(0.4)  # rate limit cortés
    with open(OUT / "_catalog.json", "w", encoding="utf-8") as f:
        json.dump(catalog, f, indent=2, ensure_ascii=False)
    print(f"\nCatálogo escrito: {OUT / '_catalog.json'}")


if __name__ == "__main__":
    main()
