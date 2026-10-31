"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, ImageUp, LoaderCircle, Palette, Trash2 } from "lucide-react";
import { saveBranding } from "@/actions/branding";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { LogoMark } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

const PRESETS = ["#4f46e5", "#2563eb", "#0f766e", "#059669", "#b45309", "#dc2626", "#be185d", "#7c3aed", "#0f172a"];

/** Company logo, brand colour and RERA number. Used on brochures, the public website, receipts and the CRM sidebar. */
export function BrandingCard({ logoUrl, brandColor, reraNumber }: { logoUrl: string | null; brandColor: string; reraNumber: string | null }) {
  const router = useRouter();
  const [logo, setLogo] = useState(logoUrl ?? "");
  const [color, setColor] = useState(brandColor || "#4f46e5");
  const [rera, setRera] = useState(reraNumber ?? "");
  const [uploading, setUploading] = useState(false);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) return void toast.error("Use a PNG or JPG logo (PNG with transparent background works best).");
    if (file.size > 4 * 1024 * 1024) return void toast.error("Logo should be under 4 MB.");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error || "Upload failed");
      setLogo(data.url);
      toast.success("Logo uploaded. Save to apply.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const save = () =>
    start(async () => {
      const fd = new FormData();
      fd.set("logoUrl", logo);
      fd.set("brandColor", color);
      fd.set("reraNumber", rera);
      const res = await saveBranding(fd);
      if (res.error) return void toast.error(res.error);
      toast.success("Branding saved");
      router.refresh();
    });

  const validColor = /^#[0-9a-fA-F]{6}$/.test(color);

  return (
    <Card>
      <CardHeader title="Branding" description="Your logo and colour appear on brochures, receipts, the public website and the customer portal." action={<Palette className="size-4 text-slate-400" />} />
      <div className="grid gap-6 p-5 lg:grid-cols-[1fr_1fr]">
        <div>
          <p className="label">Company logo</p>
          <div className="flex items-center gap-4">
            <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-[repeating-conic-gradient(#f1f5f9_0%_25%,#fff_0%_50%)] bg-[length:16px_16px]">
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} alt="Company logo" className="max-h-16 max-w-16 object-contain" />
              ) : (
                <LogoMark className="size-10 opacity-40" />
              )}
            </div>
            <div className="space-y-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void upload(f);
                  e.target.value = "";
                }}
              />
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  {uploading ? <LoaderCircle className="animate-spin" /> : <ImageUp />} {logo ? "Replace logo" : "Upload logo"}
                </Button>
                {logo && (
                  <Button variant="ghost" size="sm" onClick={() => setLogo("")} className="text-rose-600 hover:bg-rose-50 hover:text-rose-700">
                    <Trash2 /> Remove
                  </Button>
                )}
              </div>
              <p className="text-xs text-slate-500">PNG or JPG, square or wide, under 4 MB.</p>
            </div>
          </div>

          <Field label="RERA registration number" className="mt-5" hint="Shown on brochures and the website footer">
            <Input value={rera} onChange={(e) => setRera(e.target.value)} placeholder="e.g. A51800012345" />
          </Field>
        </div>

        <div>
          <p className="label">Brand colour</p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={`Use colour ${c}`}
                className={cn("flex size-8 items-center justify-center rounded-lg ring-offset-2 transition", color.toLowerCase() === c && "ring-2 ring-slate-400")}
                style={{ background: c }}
              >
                {color.toLowerCase() === c && <Check className="size-4 text-white" />}
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <input type="color" value={validColor ? color : "#4f46e5"} onChange={(e) => setColor(e.target.value)} className="h-9 w-12 cursor-pointer rounded-lg border border-slate-300 bg-white p-1" aria-label="Pick a custom colour" />
            <Input value={color} onChange={(e) => setColor(e.target.value)} className="w-32 font-mono text-xs" maxLength={7} />
          </div>
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
            <div className="flex items-center gap-2 px-4 py-3 text-white" style={{ background: validColor ? color : "#4f46e5" }}>
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} alt="" className="h-6 max-w-24 rounded bg-white/90 object-contain p-0.5" />
              ) : (
                <LogoMark className="size-6" />
              )}
              <span className="text-sm font-semibold">Brochure and website preview</span>
            </div>
            <div className="bg-white px-4 py-3 text-xs text-slate-500">Buttons, headings and accents use this colour.</div>
          </div>
        </div>
      </div>
      <div className="flex justify-end border-t border-slate-100 px-5 py-3.5">
        <Button onClick={save} loading={pending} disabled={uploading}>
          Save branding
        </Button>
      </div>
    </Card>
  );
}
