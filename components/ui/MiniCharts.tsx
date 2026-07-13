"use client";

/**
 * Lightweight, dependency-free charts (SVG + CSS). Heights use explicit pixels
 * so bars always render (percentage-of-flex heights collapse to zero).
 */

export interface ChartPoint {
  label: string;
  value: number;
  color?: string;
}

const BRAND = "#7516EA";
const CHART_H = 168; // px drawing area

/** Vertical bar chart. Values are shown only when `showValues` is set. */
export function BarChart({
  data,
  max,
  showValues = false,
  unit = "",
  valueFormat,
}: {
  data: ChartPoint[];
  max?: number;
  showValues?: boolean;
  unit?: string;
  valueFormat?: (v: number) => string;
}) {
  const top = Math.max(1, max ?? 0, ...data.map((d) => d.value));
  const fmt = (v: number) => (valueFormat ? valueFormat(v) : `${v}${unit}`);
  return (
    <div className="relative">
      {/* gridlines */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 flex flex-col justify-between"
        style={{ height: CHART_H }}
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-px w-full bg-gray-100" />
        ))}
      </div>

      <div
        className="relative flex items-end gap-2 overflow-x-auto pb-1"
        style={{ minHeight: CHART_H }}
      >
        {data.map((d, i) => {
          const h = d.value > 0 ? Math.max(6, (d.value / top) * CHART_H) : 0;
          return (
            <div key={i} className="flex min-w-[34px] flex-1 flex-col items-center">
              <div className="flex w-full items-end" style={{ height: CHART_H }}>
                <div
                  className="w-full rounded-t-md transition-all duration-500"
                  style={{ height: h, backgroundColor: d.color ?? BRAND }}
                  title={showValues ? fmt(d.value) : undefined}
                />
              </div>
              {showValues && (
                <span className="mt-1 text-[11px] font-semibold text-gray-500">
                  {d.value > 0 ? fmt(d.value) : ""}
                </span>
              )}
              <span className="mt-0.5 max-w-[60px] truncate text-[10px] text-gray-400">
                {d.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Smooth line + area chart with colored dots. No numeric labels. */
export function LineChart({
  data,
  max = 100,
}: {
  data: ChartPoint[];
  max?: number;
}) {
  const n = data.length;
  const pts = data.map((d, i) => ({
    x: n === 1 ? 50 : (i / (n - 1)) * 100,
    y: (1 - Math.min(d.value, max) / max) * 100,
    color: d.color ?? BRAND,
    label: d.label,
  }));

  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const area =
    n === 1
      ? `M 0 ${pts[0].y} L 100 ${pts[0].y} L 100 100 L 0 100 Z`
      : `M ${pts[0].x} 100 ` +
        pts.map((p) => `L ${p.x} ${p.y}`).join(" ") +
        ` L ${pts[n - 1].x} 100 Z`;

  return (
    <div>
      <div className="relative w-full" style={{ height: CHART_H }}>
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="h-full w-full"
        >
          <defs>
            <linearGradient id="lc-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={BRAND} stopOpacity="0.25" />
              <stop offset="100%" stopColor={BRAND} stopOpacity="0" />
            </linearGradient>
          </defs>
          {[25, 50, 75].map((y) => (
            <line
              key={y}
              x1="0"
              y1={y}
              x2="100"
              y2={y}
              stroke="#eef0f4"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <path d={area} fill="url(#lc-area)" />
          {n > 1 && (
            <path
              d={line}
              fill="none"
              stroke={BRAND}
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
        {/* dots as crisp HTML overlay (SVG circles distort under non-uniform scale) */}
        {pts.map((p, i) => (
          <span
            key={i}
            className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-sm"
            style={{ left: `${p.x}%`, top: `${p.y}%`, backgroundColor: p.color }}
          />
        ))}
      </div>
      <div className="mt-1.5 flex justify-between px-0.5 text-[10px] text-gray-400">
        {data.map((d, i) => (
          <span key={i} className="max-w-[60px] truncate">
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}
