/**
 * Sparkline mínimo SVG. Dibuja una línea + area sutil. No interactivo.
 */
export function Sparkline({
  values,
  color = "#4493f8",
  height = 28,
  width,
  showDot = true,
}: {
  values: number[];
  color?: string;
  height?: number;
  width?: number;
  showDot?: boolean;
}) {
  if (values.length < 2) return null;
  const w = width ?? 100;
  const h = height;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = w / (values.length - 1);
  const points = values.map((v, i) => {
    const x = i * stepX;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return [x, y];
  });
  const path = points.map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`)).join(" ");
  const areaPath = `${path} L${w},${h} L0,${h} Z`;
  const lastX = points[points.length - 1][0];
  const lastY = points[points.length - 1][1];

  return (
    <svg
      width="100%"
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="sparkline"
    >
      <path d={areaPath} fill={color} opacity={0.12} />
      <path d={path} fill="none" stroke={color} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
      {showDot && <circle cx={lastX} cy={lastY} r={2} fill={color} />}
    </svg>
  );
}
