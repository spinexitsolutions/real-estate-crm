"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ArrowDown, ArrowUp, CircleAlert, CircleCheck, Plus, Trash2, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { buildPlan, PLAN_PRESETS, type PlanPreset } from "@/lib/payment-plan";
import { formatCurrency } from "@/lib/format";
import { fromDateTimeLocal } from "@/lib/timezone";
import { cn } from "@/lib/utils";

type Row = { key: string; label: string; dueDate: string; mode: "amount" | "percent"; value: string };

let seq = 0;
const k = () => `r${++seq}`;

function rowAmount(r: Row, total: number) {
  const v = Number(r.value.replace(/,/g, ""));
  if (!Number.isFinite(v) || v <= 0) return 0;
  return r.mode === "percent" ? Math.round((total * v) / 100) : Math.round(v);
}

/** Interactive installment schedule. Emits a hidden input `installments` with JSON [{label, dueDate, amount}]. */
export function PlanBuilder({ total, startDate, name = "installments" }: { total: number; startDate: string; name?: string }) {
  const [preset, setPreset] = useState<PlanPreset>("CONSTRUCTION_LINKED");
  const [token, setToken] = useState("100000");
  const [months, setMonths] = useState("12");
  const [possession, setPossession] = useState("12");
  const [rows, setRows] = useState<Row[]>([]);
  const [touched, setTouched] = useState(false);

  const generate = (p: PlanPreset = preset) => {
    const start = startDate ? new Date(fromDateTimeLocal(`${startDate}T00:00`)) : new Date();
    const plan = buildPlan(p, total, start, { tokenAmount: Number(token) || 0, months: Number(months) || 12, possessionMonths: Number(possession) || 12 });
    setRows(plan.map((r) => ({ key: k(), label: r.label, dueDate: format(r.dueDate, "yyyy-MM-dd"), mode: "amount", value: String(r.amount) })));
  };

  // Regenerate automatically until the user edits rows by hand.
  useEffect(() => {
    if (!touched && total > 0) generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, startDate, preset, token, months, possession]);

  const computed = useMemo(() => rows.map((r) => ({ ...r, amount: rowAmount(r, total) })), [rows, total]);
  const sum = computed.reduce((s, r) => s + r.amount, 0);
  const remaining = Math.round(total) - sum;
  const json = JSON.stringify(computed.map((r) => ({ label: r.label, dueDate: r.dueDate, amount: r.amount })));

  const update = (key: string, patch: Partial<Row>) => {
    setTouched(true);
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };
  const move = (idx: number, dir: -1 | 1) => {
    setTouched(true);
    setRows((rs) => {
      const next = [...rs];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return rs;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <input type="hidden" name={name} value={json} />
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {PLAN_PRESETS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => {
              setPreset(p.value);
              setTouched(false);
            }}
            className={cn(
              "rounded-lg border px-3 py-2.5 text-left transition",
              preset === p.value ? "border-brand-500 bg-brand-50/60 ring-4 ring-brand-500/10" : "border-slate-200 hover:bg-slate-50",
            )}
          >
            <span className={cn("block text-sm font-medium", preset === p.value ? "text-brand-700" : "text-slate-800")}>{p.label}</span>
            <span className="mt-0.5 block text-xs text-slate-500">{p.description}</span>
          </button>
        ))}
      </div>

      {preset !== "CUSTOM" && (
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Token amount" className="w-40">
            <Input inputMode="numeric" value={token} onChange={(e) => (setToken(e.target.value.replace(/[^\d]/g, "")), setTouched(false))} />
          </Field>
          {preset === "EQUAL_MONTHLY" && (
            <Field label="Number of months" className="w-36">
              <Input inputMode="numeric" value={months} onChange={(e) => (setMonths(e.target.value.replace(/[^\d]/g, "")), setTouched(false))} />
            </Field>
          )}
          {preset === "DOWN_PAYMENT" && (
            <Field label="Possession after (months)" className="w-48">
              <Input inputMode="numeric" value={possession} onChange={(e) => (setPossession(e.target.value.replace(/[^\d]/g, "")), setTouched(false))} />
            </Field>
          )}
          {touched && (
            <Button
              variant="secondary"
              onClick={() => {
                setTouched(false);
                generate();
              }}
            >
              <WandSparkles /> Reset to preset
            </Button>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className="bg-slate-50/70">
            <tr>
              <th className="table-th w-8">#</th>
              <th className="table-th">Installment</th>
              <th className="table-th">Due date</th>
              <th className="table-th">Amount / %</th>
              <th className="table-th text-right">Amount</th>
              <th className="table-th w-28" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {computed.map((r, idx) => (
              <tr key={r.key}>
                <td className="px-4 py-2 text-xs text-slate-400">{idx + 1}</td>
                <td className="px-2 py-2">
                  <Input value={r.label} onChange={(e) => update(r.key, { label: e.target.value })} className="h-8 min-w-48" />
                </td>
                <td className="px-2 py-2">
                  <Input type="date" value={r.dueDate} onChange={(e) => update(r.key, { dueDate: e.target.value })} className="h-8 w-40" />
                </td>
                <td className="px-2 py-2">
                  <div className="flex items-center gap-1">
                    <Input inputMode="decimal" value={r.value} onChange={(e) => update(r.key, { value: e.target.value.replace(/[^\d.]/g, "") })} className="h-8 w-32" />
                    <div className="inline-flex rounded-md border border-slate-200 p-0.5">
                      {(["amount", "percent"] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() =>
                            update(r.key, {
                              mode: m,
                              value: m === r.mode ? r.value : m === "percent" ? String(total ? Math.round((r.amount / total) * 10000) / 100 : 0) : String(r.amount),
                            })
                          }
                          className={cn("rounded px-1.5 py-0.5 text-xs font-medium", r.mode === m ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-800")}
                        >
                          {m === "amount" ? "Rs" : "%"}
                        </button>
                      ))}
                    </div>
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-right font-medium text-slate-800">{formatCurrency(r.amount)}</td>
                <td className="px-2 py-2">
                  <div className="flex justify-end gap-0.5">
                    <button type="button" onClick={() => move(idx, -1)} disabled={idx === 0} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30" aria-label="Move up">
                      <ArrowUp className="size-3.5" />
                    </button>
                    <button type="button" onClick={() => move(idx, 1)} disabled={idx === computed.length - 1} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30" aria-label="Move down">
                      <ArrowDown className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTouched(true);
                        setRows((rs) => rs.filter((x) => x.key !== r.key));
                      }}
                      className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      aria-label="Remove"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {computed.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                  Enter the total value to generate a schedule, or add installments manually.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setTouched(true);
            const last = rows[rows.length - 1];
            setRows((rs) => [...rs, { key: k(), label: `Installment ${rs.length + 1}`, dueDate: last?.dueDate ?? startDate, mode: "amount", value: remaining > 0 ? String(remaining) : "" }]);
          }}
        >
          <Plus /> Add installment
        </Button>
        <div
          className={cn(
            "flex items-center gap-2 rounded-lg px-3 py-2 text-sm",
            remaining === 0 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800",
          )}
        >
          {remaining === 0 ? <CircleCheck className="size-4" /> : <CircleAlert className="size-4" />}
          <span>
            Scheduled <span className="font-semibold">{formatCurrency(sum)}</span> of {formatCurrency(total)}
            {remaining !== 0 && (
              <>
                {" "}
                - <span className="font-semibold">{formatCurrency(Math.abs(remaining))}</span> {remaining > 0 ? "remaining" : "over"}
              </>
            )}
          </span>
          {remaining !== 0 && computed.length > 0 && (
            <button
              type="button"
              className="ml-1 font-semibold underline underline-offset-2"
              onClick={() => {
                setTouched(true);
                const last = computed[computed.length - 1];
                update(last.key, { mode: "amount", value: String(Math.max(0, last.amount + remaining)) });
              }}
            >
              Adjust last
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
