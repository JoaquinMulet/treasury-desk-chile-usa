import { cn } from "@/lib/utils";
import { fmtNum, fmtPct, fmtBps, fmtYield, fmtPrice, fmtCLP, fmtCompact, fmtSigned, signClass, inverseSignClass } from "@/lib/format";
import { ArrowDown, ArrowUp } from "lucide-react";

type Common = {
  className?: string;
  colored?: boolean;
  inverseColor?: boolean;
  size?: "xs" | "sm" | "base" | "lg" | "xl" | "2xl";
};

function sizeClass(s?: Common["size"]) {
  switch (s) {
    case "xs": return "text-xs";
    case "sm": return "text-sm";
    case "base": return "text-base";
    case "lg": return "text-lg";
    case "xl": return "text-xl";
    case "2xl": return "text-2xl";
    default: return "";
  }
}

function colorClass(v: number | null | undefined, colored?: boolean, inverse?: boolean): string {
  if (!colored) return "";
  return inverse ? inverseSignClass(v) : signClass(v);
}

export function Num({
  value, decimals = 2, ...rest
}: Common & { value: number | null | undefined; decimals?: number }) {
  return (
    <span className={cn("num", sizeClass(rest.size), colorClass(value, rest.colored, rest.inverseColor), rest.className)}>
      {fmtNum(value, decimals)}
    </span>
  );
}

export function Pct({
  value, decimals = 2, signed, ...rest
}: Common & { value: number | null | undefined; decimals?: number; signed?: boolean }) {
  return (
    <span className={cn("num", sizeClass(rest.size), colorClass(value, rest.colored, rest.inverseColor), rest.className)}>
      {fmtPct(value, decimals, signed)}
    </span>
  );
}

export function Bps({
  value, ...rest
}: Common & { value: number | null | undefined }) {
  return (
    <span className={cn("num", sizeClass(rest.size), colorClass(value, rest.colored, rest.inverseColor), rest.className)}>
      {fmtBps(value)}
    </span>
  );
}

export function Yld({
  value, decimals = 2, ...rest
}: Common & { value: number | null | undefined; decimals?: number }) {
  return (
    <span className={cn("num", sizeClass(rest.size), rest.className)}>
      {fmtYield(value, decimals)}
    </span>
  );
}

export function Price({
  value, decimals = 2, ...rest
}: Common & { value: number | null | undefined; decimals?: number }) {
  return (
    <span className={cn("num", sizeClass(rest.size), rest.className)}>
      {fmtPrice(value, decimals)}
    </span>
  );
}

export function CLP({
  value, decimals = 0, ...rest
}: Common & { value: number | null | undefined; decimals?: number }) {
  return (
    <span className={cn("num", sizeClass(rest.size), colorClass(value, rest.colored, rest.inverseColor), rest.className)}>
      {fmtCLP(value, decimals)}
    </span>
  );
}

export function Compact({
  value, decimals = 1, ...rest
}: Common & { value: number | null | undefined; decimals?: number }) {
  return (
    <span className={cn("num", sizeClass(rest.size), colorClass(value, rest.colored, rest.inverseColor), rest.className)}>
      {fmtCompact(value, decimals)}
    </span>
  );
}

export function Signed({
  value, decimals = 2, ...rest
}: Common & { value: number | null | undefined; decimals?: number }) {
  return (
    <span className={cn("num", sizeClass(rest.size), colorClass(value, rest.colored, rest.inverseColor), rest.className)}>
      {fmtSigned(value, decimals)}
    </span>
  );
}

export function DeltaArrow({ value, className }: { value: number | null | undefined; className?: string }) {
  if (value == null || value === 0) return null;
  const Icon = value > 0 ? ArrowUp : ArrowDown;
  return (
    <Icon
      className={cn(
        "inline h-3 w-3 shrink-0",
        value > 0 ? "text-[var(--color-pos)]" : "text-[var(--color-neg)]",
        className,
      )}
      strokeWidth={2.5}
    />
  );
}
