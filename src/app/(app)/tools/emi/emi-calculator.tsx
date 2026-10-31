"use client";

import { useMemo, useState } from "react";
import { Share2, Wallet } from "lucide-react";
import { DonutChart } from "@/components/charts";
import { Card, CardHeader } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button-styles";
import { formatCompact, formatCurrency } from "@/lib/format";

function emiFor(principal: number, annualRate: number, months: number) {
  if (principal <= 0 || months <= 0) return 0;
  const r = annualRate / 12 / 100;
  if (r === 0) return principal / months;
  const f = Math.pow(1 + r, months);
  return (principal * r * f) / (f - 1);
}

function SliderField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  display,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  display: string;
  suffix?: string;
}) {
  const pct = ((Math.min(Math.max(value, min), max) - min) / (max - min)) * 100;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <label className="text-[13px] font-medium text-slate-700">{label}</label>
        <div className="relative">
          <input
            type="number"
            value={Number.isFinite(value) ? value : ""}
            min={min}
            max={max}
            step={step}
            onChange={(e) => onChange(Number(e.target.value))}
            className="input h-8 w-36 pr-12 text-right font-medium"
          />
          {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">{suffix}</span>}
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={Math.min(Math.max(value, min), max)}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full accent-brand-600"
        style={{ background: `linear-gradient(to right, #4f46e5 ${pct}%, #e2e8f0 ${pct}%)` }}
      />
      <div className="mt-1 flex justify-between text-[11px] text-slate-400">
        <span>{display}</span>
      </div>
    </div>
  );
}

export function EmiCalculator({ currency, company }: { currency: string; company: string }) {
  const isInr = currency === "INR";
  const [amount, setAmount] = useState(isInr ? 5000000 : 300000);
  const [rate, setRate] = useState(8.5);
  const [years, setYears] = useState(20);
  const [income, setIncome] = useState(isInr ? 150000 : 8000);
  const [existingEmi, setExistingEmi] = useState(0);

  const maxAmount = isInr ? 100000000 : 5000000;
  const months = Math.round(years * 12);
  const emi = emiFor(amount, rate, months);
  const total = emi * months;
  const interest = Math.max(0, total - amount);

  const schedule = useMemo(() => {
    const rows: { year: number; principal: number; interest: number; balance: number }[] = [];
    const r = rate / 12 / 100;
    let bal = amount;
    for (let y = 1; y <= Math.ceil(months / 12) && bal > 0.5; y++) {
      let p = 0;
      let i = 0;
      for (let m = 0; m < 12 && (y - 1) * 12 + m < months; m++) {
        const int = bal * r;
        const pr = Math.min(bal, emi - int);
        i += int;
        p += pr;
        bal -= pr;
      }
      rows.push({ year: y, principal: p, interest: i, balance: Math.max(0, bal) });
    }
    return rows;
  }, [amount, rate, months, emi]);

  const maxEmi = Math.max(0, income * 0.5 - existingEmi);
  const unitEmi = emiFor(1, rate, months);
  const eligible = unitEmi > 0 ? maxEmi / unitEmi : 0;

  const fmt = (v: number) => formatCurrency(v, currency);
  const shareText = `Home loan EMI estimate\n\nLoan amount: ${fmt(amount)}\nInterest rate: ${rate}% p.a.\nTenure: ${years} years\n\nMonthly EMI: ${fmt(emi)}\nTotal interest: ${fmt(interest)}\nTotal payable: ${fmt(total)}\n\n- ${company}`;

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
      <div className="space-y-6">
        <Card>
          <CardHeader title="Loan details" />
          <div className="space-y-6 p-5">
            <SliderField label="Loan amount" value={amount} onChange={setAmount} min={isInr ? 100000 : 10000} max={maxAmount} step={isInr ? 100000 : 5000} display={formatCompact(amount, currency)} />
            <SliderField label="Interest rate" value={rate} onChange={setRate} min={1} max={20} step={0.05} display={`${rate}% per annum`} suffix="%" />
            <SliderField label="Tenure" value={years} onChange={setYears} min={1} max={30} step={1} display={`${months} monthly instalments`} suffix="yrs" />
          </div>
        </Card>

        <Card>
          <CardHeader title="Affordability check" description="Banks typically allow total EMIs up to 50% of net monthly income (FOIR)" />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <div>
              <label className="label">Net monthly income</label>
              <input type="number" min={0} value={income} onChange={(e) => setIncome(Number(e.target.value))} className="input" />
            </div>
            <div>
              <label className="label">Existing EMIs per month</label>
              <input type="number" min={0} value={existingEmi} onChange={(e) => setExistingEmi(Number(e.target.value))} className="input" />
            </div>
            <div className="flex items-center gap-4 rounded-lg bg-brand-50 p-4 sm:col-span-2">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white text-brand-600 shadow-xs">
                <Wallet className="size-5" />
              </span>
              <div className="flex-1">
                <p className="text-xs text-brand-700">Maximum eligible loan at {rate}% for {years} years</p>
                <p className="text-xl font-semibold text-brand-900">{fmt(eligible)}</p>
                <p className="text-xs text-brand-700/80">Affordable EMI up to {fmt(maxEmi)} per month</p>
              </div>
              <button type="button" onClick={() => setAmount(Math.round(eligible / 10000) * 10000)} className={buttonClass("outline", "sm", "bg-white")}>
                Use this
              </button>
            </div>
          </div>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <div className="p-6">
            <p className="text-[13px] font-medium text-slate-500">Monthly EMI</p>
            <p className="mt-1 text-4xl font-semibold tracking-tight text-slate-900">{fmt(emi)}</p>
            <div className="mt-6">
              <DonutChart
                data={[
                  { label: "Principal amount", value: Math.round(amount) },
                  { label: "Total interest", value: Math.round(interest) },
                ]}
                colors={["#4f46e5", "#f59e0b"]}
                currency={currency}
                centerLabel="Total payable"
              />
            </div>
            <div className="mt-6 grid grid-cols-3 gap-3 border-t border-slate-100 pt-5 text-center">
              <div>
                <p className="text-[11px] text-slate-500">Principal</p>
                <p className="text-sm font-semibold text-slate-900">{formatCompact(amount, currency)}</p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">Interest</p>
                <p className="text-sm font-semibold text-amber-600">{formatCompact(interest, currency)}</p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">Total payable</p>
                <p className="text-sm font-semibold text-slate-900">{formatCompact(total, currency)}</p>
              </div>
            </div>
            <a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noreferrer" className={buttonClass("success", "md", "mt-5 w-full")}>
              <Share2 /> Share on WhatsApp
            </a>
          </div>
        </Card>

        <Card>
          <CardHeader title="Yearly amortization" />
          <div className="max-h-96 overflow-y-auto">
            <table className="min-w-full">
              <thead className="sticky top-0 border-b border-slate-100 bg-slate-50">
                <tr>
                  <th className="table-th">Year</th>
                  <th className="table-th text-right">Principal</th>
                  <th className="table-th text-right">Interest</th>
                  <th className="table-th text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {schedule.map((r) => (
                  <tr key={r.year}>
                    <td className="table-td font-medium text-slate-900">{r.year}</td>
                    <td className="table-td text-right">{formatCompact(r.principal, currency)}</td>
                    <td className="table-td text-right text-amber-600">{formatCompact(r.interest, currency)}</td>
                    <td className="table-td text-right">{formatCompact(r.balance, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
