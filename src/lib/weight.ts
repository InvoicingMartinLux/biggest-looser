import type { WeightUnit } from "./types";

export const KG_PER_LB = 0.45359237;

export function kgToUnit(kg: number, unit: WeightUnit): number {
  return unit === "kg" ? kg : kg / KG_PER_LB;
}

export function unitToKg(value: number, unit: WeightUnit): number {
  return unit === "kg" ? value : value * KG_PER_LB;
}

export function formatWeight(kg: number | null | undefined, unit: WeightUnit): string {
  if (kg == null) return "—";
  return `${kgToUnit(kg, unit).toFixed(1)} ${unit}`;
}

export function formatPct(pct: number | null | undefined): string {
  if (pct == null) return "—";
  const sign = pct > 0 ? "-" : pct < 0 ? "+" : "";
  return `${sign}${Math.abs(pct).toFixed(2)} %`;
}
