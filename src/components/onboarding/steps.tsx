"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, Copy, ImagePlus, LoaderCircle, Plus, Sparkles, Trash2, Upload, Users } from "lucide-react";
import { finishOnboarding, inviteTeamStep, loadSampleDataStep, saveBrandStep, saveCompanyStep, type InvitedMember } from "@/actions/onboarding";
import { Button, LinkButton } from "@/components/ui/button";
import { buttonClass } from "@/components/ui/button-styles";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { WhatsAppIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

function Footer({ step, pending, nextLabel = "Save and continue", onSkip }: { step: number; pending: boolean; nextLabel?: string; onSkip?: () => void }) {
  return (
    <div className="mt-8 flex flex-col-reverse gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-2">
        {step > 1 && (
          <Link href={`/onboarding?step=${step - 1}`} className={buttonClass("ghost", "md")}>
            Back
          </Link>
        )}
        {onSkip && (
          <Button variant="ghost" onClick={onSkip} disabled={pending}>
            Skip
          </Button>
        )}
      </div>
      <Button type="submit" loading={pending}>
        {nextLabel} <ArrowRight />
      </Button>
    </div>
  );
}

function useStep(step: number) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const go = (n = step + 1) => router.push(`/onboarding?step=${n}`);
  return { pending, start, go };
}

/* ------------------------------------------------------------------ 1. company */

export function CompanyStep({ initial }: { initial: { companyName: string; companyPhone: string; companyEmail: string; companyAddress: string; city: string; businessType: string } }) {
  const { pending, start, go } = useStep(1);
  return (
    <form
      action={(fd) =>
        start(async () => {
          const r = await saveCompanyStep(fd);
          if (r.error) return void toast.error(r.error);
          go();
        })
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Company name" required className="sm:col-span-2">
          <Input name="companyName" defaultValue={initial.companyName} required />
        </Field>
        <Field label="Business phone" hint="Shown on brochures, receipts and your website">
          <Input name="companyPhone" defaultValue={initial.companyPhone} inputMode="tel" />
        </Field>
        <Field label="Business email">
          <Input name="companyEmail" type="email" defaultValue={initial.companyEmail} />
        </Field>
        <Field label="City">
          <Input name="city" defaultValue={initial.city} placeholder="e.g. Pune" />
        </Field>
        <Field label="You are a">
          <Select
            name="businessType"
            defaultValue={initial.businessType || "BROKER"}
            options={[
              { value: "BROKER", label: "Broker / Agency" },
              { value: "BUILDER", label: "Builder / Developer" },
              { value: "BOTH", label: "Both" },
            ]}
          />
        </Field>
        <Field label="Office address" className="sm:col-span-2">
          <Textarea name="companyAddress" defaultValue={initial.companyAddress} className="min-h-20" />
        </Field>
      </div>
      <Footer step={1} pending={pending} />
    </form>
  );
}

/* ------------------------------------------------------------------ 2. branding */

const COLORS = ["#4f46e5", "#0ea5e9", "#0d9488", "#16a34a", "#ea580c", "#dc2626", "#be185d", "#0f172a"];

export function BrandStep({ initial }: { initial: { logoUrl: string | null; brandColor: string; companyName: string } }) {
  const { pending, start, go } = useStep(2);
  const [logo, setLogo] = useState(initial.logoUrl ?? "");
  const [color, setColor] = useState(initial.brandColor || "#4f46e5");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = async (f: File) => {
    if (f.size > 8 * 1024 * 1024) return void toast.error("Logo must be smaller than 8 MB.");
    setUploading(true);
    try {
      const body = new FormData();
      body.set("file", f);
      const res = await fetch("/api/upload", { method: "POST", body });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error || "Upload failed");
      setLogo(data.url);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <form
      action={(fd) =>
        start(async () => {
          fd.set("logoUrl", logo);
          fd.set("brandColor", color);
          const r = await saveBrandStep(fd);
          if (r.error) return void toast.error(r.error);
          go();
        })
      }
    >
      <div className="grid gap-8 sm:grid-cols-[1fr_1fr]">
        <div>
          <p className="label">Company logo</p>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex h-40 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 text-sm text-slate-500 transition hover:border-brand-300 hover:bg-brand-50/30"
          >
            {uploading ? (
              <LoaderCircle className="size-6 animate-spin text-slate-400" />
            ) : logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="Logo preview" className="max-h-28 max-w-[80%] object-contain" />
            ) : (
              <>
                <ImagePlus className="mb-2 size-7 text-slate-400" />
                <span className="font-medium text-slate-700">Upload logo</span>
                <span className="mt-0.5 text-xs">PNG or JPG, square or wide</span>
              </>
            )}
          </button>
          {logo && (
            <button type="button" onClick={() => setLogo("")} className="mt-2 text-xs font-medium text-slate-500 hover:text-rose-600">
              Remove logo
            </button>
          )}
        </div>
        <div>
          <p className="label">Brand colour</p>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={`Use colour ${c}`}
                className={cn("size-9 rounded-lg ring-offset-2 transition", color === c ? "ring-2 ring-slate-900" : "hover:scale-105")}
                style={{ background: c }}
              />
            ))}
            <label className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-2 text-xs text-slate-600">
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="size-5 cursor-pointer border-0 bg-transparent p-0" />
              Custom
            </label>
          </div>
          <p className="mb-2 mt-6 text-xs font-medium uppercase tracking-wider text-slate-400">Preview</p>
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <div className="flex items-center gap-2 px-4 py-3 text-white" style={{ background: color }}>
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} alt="" className="h-6 w-auto rounded bg-white/90 p-0.5" />
              ) : (
                <span className="flex size-6 items-center justify-center rounded bg-white/20 text-xs font-bold">{initial.companyName.charAt(0)}</span>
              )}
              <span className="truncate text-sm font-semibold">{initial.companyName}</span>
            </div>
            <div className="bg-white px-4 py-3 text-xs text-slate-500">Used on brochures, receipts, the customer portal and your website.</div>
          </div>
        </div>
      </div>
      <Footer step={2} pending={pending || uploading} onSkip={() => go()} />
    </form>
  );
}

/* ------------------------------------------------------------------ 3. team */

type Row = { name: string; email: string; role: string };

export function TeamStep({ maxUsers, currentUsers, appUrl }: { maxUsers: number; currentUsers: number; appUrl: string }) {
  const { pending, start, go } = useStep(3);
  const [rows, setRows] = useState<Row[]>([{ name: "", email: "", role: "AGENT" }]);
  const [created, setCreated] = useState<InvitedMember[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const left = maxUsers > 0 ? Math.max(0, maxUsers - currentUsers) : 5;

  const set = (i: number, patch: Partial<Row>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const shareText = (m: InvitedMember) =>
    `Hi ${m.name.split(" ")[0]}, you have been added to our CRM.\nSign in: ${appUrl}/login\nEmail: ${m.email}\nTemporary password: ${m.password}\nPlease change your password from My Profile after signing in.`;

  if (created.length || skipped.length)
    return (
      <div>
        {created.length > 0 && (
          <>
            <p className="text-sm text-slate-600">Share these sign-in details with your team. Passwords are shown only once.</p>
            <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200">
              {created.map((m) => (
                <li key={m.email} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900">
                      {m.name} <span className="font-normal text-slate-500">- {m.role.toLowerCase()}</span>
                    </p>
                    <p className="font-mono text-xs text-slate-600">
                      {m.email} / {m.password}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard?.writeText(shareText(m));
                        toast.success("Copied");
                      }}
                    >
                      <Copy /> Copy
                    </Button>
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(shareText(m))}`}
                      target="_blank"
                      rel="noreferrer"
                      className={buttonClass("success", "sm")}
                    >
                      <WhatsAppIcon className="size-4" /> Share
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
        {skipped.length > 0 && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Not added: {skipped.join("; ")}
          </div>
        )}
        <div className="mt-8 flex justify-end border-t border-slate-100 pt-6">
          <Button onClick={() => go()}>
            Continue <ArrowRight />
          </Button>
        </div>
      </div>
    );

  return (
    <form
      action={() =>
        start(async () => {
          const r = await inviteTeamStep(rows);
          if (r.error) return void toast.error(r.error);
          setCreated(r.data?.created ?? []);
          setSkipped(r.data?.skipped ?? []);
          if (!r.data?.created.length && !r.data?.skipped.length) go();
        })
      }
    >
      {maxUsers > 0 && (
        <p className="mb-4 flex items-center gap-2 text-sm text-slate-500">
          <Users className="size-4" /> Your plan includes {maxUsers} users ({left} more can be added).
        </p>
      )}
      <div className="space-y-3">
        {rows.map((r, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1.2fr_140px_auto]">
            <Input placeholder="Full name" value={r.name} onChange={(e) => set(i, { name: e.target.value })} aria-label="Full name" />
            <Input placeholder="email@company.com" type="email" value={r.email} onChange={(e) => set(i, { email: e.target.value })} aria-label="Email" />
            <Select
              value={r.role}
              onChange={(e) => set(i, { role: e.target.value })}
              aria-label="Role"
              options={[
                { value: "AGENT", label: "Agent" },
                { value: "MANAGER", label: "Manager" },
                { value: "ADMIN", label: "Admin" },
              ]}
            />
            <Button variant="ghost" size="icon" onClick={() => setRows((x) => (x.length > 1 ? x.filter((_, j) => j !== i) : [{ name: "", email: "", role: "AGENT" }]))} aria-label="Remove row">
              <Trash2 />
            </Button>
          </div>
        ))}
      </div>
      {rows.length < Math.min(5, left || 5) && (
        <Button variant="outline" size="sm" className="mt-3" onClick={() => setRows((x) => [...x, { name: "", email: "", role: "AGENT" }])}>
          <Plus /> Add another
        </Button>
      )}
      <p className="mt-4 text-xs text-slate-500">Each member gets a temporary password you can share on WhatsApp. Agents only see leads assigned to them.</p>
      <Footer step={3} pending={pending} nextLabel="Add team" onSkip={() => go()} />
    </form>
  );
}

/* ------------------------------------------------------------------ 4. leads */

export function LeadsStep({ urls, hasSample }: { urls: { label: string; url: string }[]; hasSample: boolean }) {
  const { pending, start, go } = useStep(4);
  const [loaded, setLoaded] = useState(hasSample);
  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 p-5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <Upload className="size-[18px]" />
          </span>
          <p className="mt-3 text-sm font-semibold text-slate-900">Import from Excel / CSV</p>
          <p className="mt-1 text-sm text-slate-500">Bring your existing leads in a few clicks. Duplicates are skipped automatically.</p>
          <LinkButton href="/leads" variant="secondary" size="sm" className="mt-4">
            Import later from Leads
          </LinkButton>
        </div>
        <div className="rounded-xl border border-slate-200 p-5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
            <Sparkles className="size-[18px]" />
          </span>
          <p className="mt-3 text-sm font-semibold text-slate-900">Explore with sample data</p>
          <p className="mt-1 text-sm text-slate-500">Adds 10 leads, 4 properties and follow-ups tagged &quot;Sample&quot;. Delete them any time.</p>
          <Button
            size="sm"
            variant={loaded ? "secondary" : "primary"}
            className="mt-4"
            loading={pending}
            disabled={loaded}
            onClick={() =>
              start(async () => {
                const r = await loadSampleDataStep();
                if (r.error) return void toast.error(r.error);
                setLoaded(true);
                toast.success(`Added ${r.data?.leads} sample leads and ${r.data?.properties} properties`);
              })
            }
          >
            {loaded ? "Sample data loaded" : "Load sample data"}
          </Button>
        </div>
      </div>

      <h2 className="mt-8 text-sm font-semibold text-slate-900">Connect your lead sources</h2>
      <p className="mt-1 text-sm text-slate-500">Share these private links with your portal account manager or paste them in your website form. New leads are assigned and a call reminder is created automatically.</p>
      <ul className="mt-4 space-y-2">
        {urls.map((u) => (
          <li key={u.label} className="flex flex-col gap-1.5 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3">
            <span className="w-32 shrink-0 text-xs font-medium text-slate-600">{u.label}</span>
            <code className="min-w-0 flex-1 truncate text-xs text-slate-700">{u.url}</code>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(u.url);
                toast.success("Link copied");
              }}
              className="inline-flex items-center gap-1 self-start text-xs font-medium text-brand-600 hover:underline sm:self-auto"
            >
              <Copy className="size-3.5" /> Copy
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-slate-500">
        Facebook, Instagram and more are on the{" "}
        <Link href="/integrations" className="font-medium text-brand-600 hover:underline">
          Integrations
        </Link>{" "}
        page.
      </p>
      <div className="mt-8 flex flex-col-reverse gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:justify-between">
        <Link href="/onboarding?step=3" className={buttonClass("ghost", "md")}>
          Back
        </Link>
        <Button onClick={() => go()}>
          Continue <ArrowRight />
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ 5. done */

export function DoneStep() {
  const [pending, start] = useTransition();
  return (
    <Button size="lg" loading={pending} onClick={() => start(() => finishOnboarding())}>
      Go to my dashboard <ArrowRight />
    </Button>
  );
}
