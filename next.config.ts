import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * File tracing para deployment en Vercel.
   *
   * Las páginas dinámicas (/, /analog, /curves, /inflation, /spreads, /ml)
   * leen CSVs de `data/bcch/` y `data/fred/` vía node:fs en runtime
   * (loadSeries / loadFredSeries). Sin trazado explícito, el bundle
   * serverless de Vercel puede no incluir esos CSV y las funciones
   * devolverían series vacías en producción.
   *
   * Los snapshots JSON (data/fred/_snapshot.json, data/yf/_snapshot.json,
   * data/bcch/_catalog.json) NO necesitan trazado: se importan
   * estáticamente y el bundler los embebe automáticamente.
   */
  outputFileTracingIncludes: {
    "/": ["./data/**/*"],
    "/analog": ["./data/**/*"],
    "/curves": ["./data/**/*"],
    "/inflation": ["./data/**/*"],
    "/spreads": ["./data/**/*"],
    "/ml": ["./data/**/*"],
  },
};

export default nextConfig;
