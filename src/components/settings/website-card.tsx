"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Copy, ExternalLink, Globe } from "lucide-react";
import { saveWebsite } from "@/actions/branding";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buttonClass } from "@/components/ui/button-styles";
import { Field, Input, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/utils";

/** Public property website settings: enable, tagline, about, and the shareable URL. */
export function WebsiteCard({ origin, enabled, tagline, about, publishedCount }: { origin: string; enabled: boolean; tagline: string | null; about: string | null; publishedCount: number }) {
  const router = useRouter();
  const [on, setOn] = useState(enabled);
  const [tag, setTag] = useState(tagline ?? "");
  const [text, setText] = useState(about ?? "");
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  const url = `${origin}/site`;

  const save = () =>
    start(async () => {
      const fd = new FormData();
      if (on) fd.set("websiteEnabled", "on");
      fd.set("websiteTagline", tag);
      fd.set("websiteAbout", text);
      const res = await saveWebsite(fd);
      if (res.error) return void toast.error(res.error);
      toast.success("Website settings saved");
      router.refresh();
    });

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            Property website
            {enabled ? <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-600/20" dot="bg-emerald-500">Live</Badge> : <Badge>Off</Badge>}
          </span>
        }
        description="A public listing site for your published properties. Every enquiry becomes a lead in the CRM, auto-assigned with a call reminder."
        action={<Globe className="size-4 text-slate-400" />}
      />
      <div className="space-y-5 p-5">
        <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-slate-200 p-4">
          <span>
            <span className="block text-sm font-medium text-slate-800">Enable public website</span>
            <span className="block text-xs text-slate-500">
              {publishedCount} {publishedCount === 1 ? "property is" : "properties are"} published. Use &quot;Publish on website&quot; on a property to list it.
            </span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={on}
            onClick={() => setOn((v) => !v)}
            className={cn("relative h-6 w-11 shrink-0 rounded-full transition", on ? "bg-brand-600" : "bg-slate-300")}
          >
            <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition", on ? "left-[22px]" : "left-0.5")} />
          </button>
        </label>

        <div>
          <p className="label">Website address</p>
          <div className="flex gap-2">
            <Input readOnly value={url} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
            <Button
              variant="secondary"
              size="icon"
              aria-label="Copy website link"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(url);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                } catch {
                  toast.error("Could not copy");
                }
              }}
            >
              {copied ? <Check /> : <Copy />}
            </Button>
            <a href="/site" target="_blank" rel="noreferrer" className={buttonClass("secondary", "md")}>
              <ExternalLink /> Open
            </a>
          </div>
          <p className="mt-1 text-xs text-slate-500">Share it on WhatsApp, Instagram bio, Google Business Profile and visiting cards.</p>
        </div>

        <Field label="Tagline" hint="Shown as the main headline on the homepage">
          <Input value={tag} onChange={(e) => setTag(e.target.value)} maxLength={160} placeholder="Find your dream home in Mumbai, Pune and Bengaluru" />
        </Field>
        <Field label="About your company">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} placeholder="Years of experience, specialisation, why buyers trust you..." />
        </Field>
      </div>
      <div className="flex justify-end border-t border-slate-100 px-5 py-3.5">
        <Button onClick={save} loading={pending}>
          Save website settings
        </Button>
      </div>
    </Card>
  );
}
