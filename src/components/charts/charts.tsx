"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCompact, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CHART_COLORS, type ChartDatum } from "./palette";

export { CHART_COLORS };
export type { ChartDatum };

type Fmt = { currency?: string | boolean };

function makeFormatter(currency?: string | boolean) {
  if (!currency) return (v: number) => formatNumber(Math.round(v));
  const code = typeof currency === "string" ? currency : "INR";
  return (v: number) => formatCompact(v, code);
}

function TooltipCard({
  active,
  payload,
  label,
  fmt,
  seriesName,
}: {
  active?: boolean;
  payload?: { value: number; name?: string; color?: string; payload?: { label?: string; fill?: string } }[];
  label?: string;
  fmt: (v: number) => string;
  seriesName?: string;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-pop">
      <p className="text-xs font-medium text-slate-500">{label ?? p.payload?.label}</p>
      <p className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold text-slate-900">
        <span className="size-2 rounded-full" style={{ background: p.color ?? p.payload?.fill ?? CHART_COLORS[0] }} />
        {seriesName ? <span className="font-normal text-slate-500">{seriesName}:</span> : null}
        {fmt(p.value)}
      </p>
    </div>
  );
}

const axisProps = {
  tickLine: false,
  axisLine: false,
  tick: { fill: "#94a3b8", fontSize: 12 },
} as const;

/** Smooth area trend. data: [{label, value}] */
export function AreaTrend({
  data,
  height = 260,
  color = CHART_COLORS[0],
  currency,
  seriesName,
}: { data: ChartDatum[]; height?: number; color?: string; seriesName?: string } & Fmt) {
  const fmt = makeFormatter(currency);
  const id = `area-${color.replace("#", "")}`;
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.22} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#eef0f4" />
          <XAxis dataKey="label" {...axisProps} minTickGap={16} />
          <YAxis {...axisProps} width={56} tickFormatter={fmt} allowDecimals={false} />
          <Tooltip cursor={{ stroke: "#cbd5e1", strokeDasharray: "4 4" }} content={<TooltipCard fmt={fmt} seriesName={seriesName} />} />
          <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2.25} fill={`url(#${id})`} activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Vertical (default) or horizontal bar chart. */
export function BarSimple({
  data,
  height = 260,
  color = CHART_COLORS[0],
  currency,
  horizontal,
  multiColor,
  seriesName,
}: { data: ChartDatum[]; height?: number; color?: string; horizontal?: boolean; multiColor?: boolean; seriesName?: string } & Fmt) {
  const fmt = makeFormatter(currency);
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={!!horizontal} horizontal={!horizontal} stroke="#eef0f4" />
          {horizontal ? (
            <>
              <XAxis type="number" {...axisProps} tickFormatter={fmt} allowDecimals={false} />
              <YAxis type="category" dataKey="label" {...axisProps} width={110} />
            </>
          ) : (
            <>
              <XAxis dataKey="label" {...axisProps} minTickGap={8} />
              <YAxis {...axisProps} width={56} tickFormatter={fmt} allowDecimals={false} />
            </>
          )}
          <Tooltip cursor={{ fill: "#f1f5f9" }} content={<TooltipCard fmt={fmt} seriesName={seriesName} />} />
          <Bar dataKey="value" fill={color} radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]} maxBarSize={horizontal ? 22 : 36}>
            {multiColor && data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Donut with center total and a legend list. */
export function DonutChart({
  data,
  height = 200,
  currency,
  centerLabel = "Total",
  colors = CHART_COLORS,
  legend = true,
}: { data: ChartDatum[]; height?: number; centerLabel?: string; colors?: string[]; legend?: boolean } & Fmt) {
  const fmt = makeFormatter(currency);
  const total = data.reduce((s, d) => s + d.value, 0);
  const filtered = data.filter((d) => d.value > 0);
  return (
    <div className="@container flex w-full flex-col items-center gap-5">
      <div style={{ height, width: height }} className="relative shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip content={<TooltipCard fmt={fmt} />} />
            <Pie
              data={filtered.length ? filtered : [{ label: "No data", value: 1 }]}
              dataKey="value"
              nameKey="label"
              innerRadius="68%"
              outerRadius="100%"
              paddingAngle={filtered.length > 1 ? 2 : 0}
              stroke="none"
              isAnimationActive={false}
            >
              {(filtered.length ? filtered : [{ label: "No data", value: 1 }]).map((d, i) => (
                <Cell key={d.label} fill={filtered.length ? colors[data.indexOf(d) % colors.length] : "#e2e8f0"} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-semibold text-slate-900">{fmt(total)}</span>
          <span className="text-[11px] text-slate-500">{centerLabel}</span>
        </div>
      </div>
      {legend && (
        <ul className="grid w-full min-w-0 grid-cols-1 gap-x-6 gap-y-2 @sm:grid-cols-2">
          {data.map((d, i) => (
            <li key={d.label} className="flex items-center gap-2 text-[13px]">
              <span className="size-2.5 shrink-0 rounded-sm" style={{ background: colors[i % colors.length] }} />
              <span className="min-w-0 flex-1 truncate text-slate-600">{d.label}</span>
              <span className="font-medium text-slate-900">{fmt(d.value)}</span>
              <span className="w-11 text-right text-xs text-slate-400">{total ? Math.round((d.value / total) * 100) : 0}%</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Horizontal funnel bars with stage-to-stage conversion %. Pure CSS, no recharts. */
export function FunnelBars({ data, colors = CHART_COLORS, currency }: { data: (ChartDatum & { color?: string })[]; colors?: string[] } & Fmt) {
  const fmt = makeFormatter(currency);
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="space-y-2.5">
      {data.map((d, i) => {
        const prev = i > 0 ? data[i - 1].value : null;
        const conv = prev ? Math.round((d.value / prev) * 1000) / 10 : null;
        return (
          <div key={d.label}>
            <div className="mb-1 flex items-center justify-between text-[13px]">
              <span className="font-medium text-slate-700">{d.label}</span>
              <span className="flex items-center gap-2">
                {conv !== null && <span className="text-xs text-slate-400">{conv}% from previous</span>}
                <span className="font-semibold text-slate-900">{fmt(d.value)}</span>
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${Math.max(2, (d.value / max) * 100)}%`, background: d.color ?? colors[i % colors.length] }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Two-series grouped bar chart (e.g. created vs won). */
export function BarCompare({
  data,
  height = 260,
  series,
  currency,
}: {
  data: { label: string; a: number; b: number }[];
  series: [string, string];
  height?: number;
} & Fmt) {
  const fmt = makeFormatter(currency);
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#eef0f4" />
          <XAxis dataKey="label" {...axisProps} />
          <YAxis {...axisProps} width={56} tickFormatter={fmt} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: "#f1f5f9" }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-pop">
                  <p className="text-xs font-medium text-slate-500">{label}</p>
                  {payload.map((p) => (
                    <p key={String(p.dataKey)} className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-900">
                      <span className="size-2 rounded-full" style={{ background: p.color }} />
                      <span className="text-slate-500">{p.dataKey === "a" ? series[0] : series[1]}:</span>
                      <span className="font-semibold">{fmt(Number(p.value))}</span>
                    </p>
                  ))}
                </div>
              ) : null
            }
          />
          <Bar dataKey="a" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} maxBarSize={22} />
          <Bar dataKey="b" fill={CHART_COLORS[2]} radius={[4, 4, 0, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Simple legend row for BarCompare / custom charts. */
export function ChartLegend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

/** Thin progress bar, tone auto by percent unless color given. */
export function ProgressBar({ value, className, color }: { value: number; className?: string; color?: string }) {
  const v = Math.max(0, Math.min(100, value));
  const tone = color ?? (value >= 100 ? "#10b981" : value >= 60 ? "#4f46e5" : value >= 30 ? "#f59e0b" : "#f43f5e");
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-slate-100", className)}>
      <div className="h-full rounded-full" style={{ width: `${v}%`, background: tone }} />
    </div>
  );
}
