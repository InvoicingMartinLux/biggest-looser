"use client";

import type { WeightUnit } from "@/lib/types";
import { kgToUnit } from "@/lib/weight";

export default function WeightChart({
  points,
  unit,
  targetKg,
}: {
  points: { date: string; kg: number }[];
  unit: WeightUnit;
  targetKg?: number | null;
}) {
  if (points.length === 0) {
    return <p className="text-zinc-500 text-sm py-8 text-center">No weigh-ins yet — log your first weight to see your progress.</p>;
  }

  const W = 640;
  const H = 220;
  const PAD = { l: 46, r: 12, t: 14, b: 26 };

  const values = points.map((p) => kgToUnit(p.kg, unit));
  const target = targetKg != null ? kgToUnit(targetKg, unit) : null;
  let min = Math.min(...values, ...(target != null ? [target] : []));
  let max = Math.max(...values, ...(target != null ? [target] : []));
  if (max - min < 2) {
    min -= 1;
    max += 1;
  }
  const span = max - min;
  min -= span * 0.08;
  max += span * 0.08;

  const x = (i: number) =>
    points.length === 1 ? (PAD.l + W - PAD.r) / 2 : PAD.l + (i / (points.length - 1)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - (v - min) / (max - min)) * (H - PAD.t - PAD.b);

  const path = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");

  const gridLines = 4;
  const fmtShort = (d: string) => {
    const dt = new Date(d + "T00:00:00Z");
    return dt.toLocaleDateString(undefined, { day: "numeric", month: "short", timeZone: "UTC" });
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      {Array.from({ length: gridLines + 1 }, (_, i) => {
        const v = min + ((max - min) * i) / gridLines;
        return (
          <g key={i}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="#27272a" strokeWidth="1" />
            <text x={PAD.l - 6} y={y(v) + 4} textAnchor="end" fontSize="10" fill="#71717a">
              {v.toFixed(1)}
            </text>
          </g>
        );
      })}
      {target != null && (
        <g>
          <line
            x1={PAD.l}
            x2={W - PAD.r}
            y1={y(target)}
            y2={y(target)}
            stroke="#f59e0b"
            strokeWidth="1.5"
            strokeDasharray="6 4"
          />
          <text x={W - PAD.r} y={y(target) - 5} textAnchor="end" fontSize="10" fill="#f59e0b">
            target {target.toFixed(1)} {unit}
          </text>
        </g>
      )}
      <path d={path} fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {values.map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} r="3.5" fill="#10b981" stroke="#052e22" strokeWidth="1.5">
          <title>{`${fmtShort(points[i].date)}: ${v.toFixed(1)} ${unit}`}</title>
        </circle>
      ))}
      <text x={PAD.l} y={H - 8} fontSize="10" fill="#71717a">
        {fmtShort(points[0].date)}
      </text>
      <text x={W - PAD.r} y={H - 8} textAnchor="end" fontSize="10" fill="#71717a">
        {fmtShort(points[points.length - 1].date)}
      </text>
    </svg>
  );
}
