"use client";

import { useRef, useState, useTransition } from "react";
import { BadgeCheck, Copy, Ellipsis, FileText, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Dropdown, DropdownItem } from "@/components/ui/dropdown";
import { Field, Input, Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { TEMPLATE_CATEGORIES, TEMPLATE_VARIABLES, labelOf } from "@/lib/constants";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { META_PARAM_KEYS, parseMetaParams } from "@/lib/whatsapp-window";
import { createTemplate, deleteTemplate, updateTemplate } from "@/actions/whatsapp";

type Template = { id: string; name: string; category: string; body: string; updatedAt: string; metaName: string | null; metaLanguage: string; metaParams: string };

const META_LANGUAGES = [
  { value: "en", label: "English (en)" },
  { value: "en_US", label: "English US (en_US)" },
  { value: "en_GB", label: "English UK (en_GB)" },
  { value: "hi", label: "Hindi (hi)" },
];

const CATEGORY_TONES: Record<string, string> = {
  GREETING: "bg-sky-50 text-sky-700 ring-sky-600/20",
  FOLLOW_UP: "bg-amber-50 text-amber-700 ring-amber-600/20",
  PROPERTY: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
  SITE_VISIT: "bg-violet-50 text-violet-700 ring-violet-600/20",
  PAYMENT: "bg-rose-50 text-rose-700 ring-rose-600/20",
  FESTIVE: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  GENERAL: "bg-slate-50 text-slate-700 ring-slate-500/20",
};

export function HighlightedBody({ body, className }: { body: string; className?: string }) {
  const parts = body.split(/(\{\{\s*\w+\s*\}\})/g);
  return (
    <p className={cn("whitespace-pre-wrap break-words", className)}>
      {parts.map((p, i) =>
        /^\{\{\s*\w+\s*\}\}$/.test(p) ? (
          <span key={i} className="rounded bg-emerald-100/80 px-1 font-medium text-emerald-800">
            {p.replace(/\s/g, "")}
          </span>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </p>
  );
}

export function TemplatesManager({ templates, canDelete }: { templates: Template[]; canDelete: boolean }) {
  const [editing, setEditing] = useState<Template | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Template | null>(null);
  const [filter, setFilter] = useState("");

  const categories = TEMPLATE_CATEGORIES.filter((c) => templates.some((t) => t.category === c.value));
  const visible = templates.filter((t) => !filter || t.category === filter);

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          <FilterChip active={!filter} onClick={() => setFilter("")}>
            All <span className="text-slate-400">{templates.length}</span>
          </FilterChip>
          {categories.map((c) => (
            <FilterChip key={c.value} active={filter === c.value} onClick={() => setFilter(c.value)}>
              {c.label} <span className="text-slate-400">{templates.filter((t) => t.category === c.value).length}</span>
            </FilterChip>
          ))}
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus /> New template
        </Button>
      </div>

      {visible.length === 0 ? (
        <Card>
          <EmptyState
            icon={FileText}
            title="No templates yet"
            description="Save frequently used messages with variables like {{name}} and {{property}} to reply in seconds."
            action={
              <Button onClick={() => setCreating(true)}>
                <Plus /> Create template
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((t) => (
            <Card key={t.id} className="flex flex-col p-5 transition hover:border-slate-300">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold text-slate-900">{t.name}</h3>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <Badge className={CATEGORY_TONES[t.category] ?? CATEGORY_TONES.GENERAL}>{labelOf(TEMPLATE_CATEGORIES, t.category)}</Badge>
                    {t.metaName && (
                      <span title={`Meta template: ${t.metaName} (${t.metaLanguage})`} className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                        <BadgeCheck className="size-3.5" /> Approved template
                      </span>
                    )}
                  </div>
                </div>
                <Dropdown
                  trigger={({ toggle }) => (
                    <button type="button" onClick={toggle} className="flex size-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Template actions">
                      <Ellipsis className="size-4" />
                    </button>
                  )}
                >
                  {(close) => (
                    <>
                      <DropdownItem
                        icon={Pencil}
                        onClick={() => {
                          close();
                          setEditing(t);
                        }}
                      >
                        Edit
                      </DropdownItem>
                      <DropdownItem
                        icon={Copy}
                        onClick={() => {
                          close();
                          navigator.clipboard?.writeText(t.body).then(
                            () => toast.success("Template copied"),
                            () => toast.error("Could not copy"),
                          );
                        }}
                      >
                        Copy text
                      </DropdownItem>
                      {canDelete && (
                        <DropdownItem
                          icon={Trash2}
                          danger
                          onClick={() => {
                            close();
                            setDeleting(t);
                          }}
                        >
                          Delete
                        </DropdownItem>
                      )}
                    </>
                  )}
                </Dropdown>
              </div>
              <div className="mt-4 flex-1 rounded-lg bg-slate-50 p-3.5 text-[13px] leading-relaxed text-slate-600">
                <HighlightedBody body={t.body} className="line-clamp-6" />
              </div>
              <p className="mt-3 truncate text-xs text-slate-400">
                <span suppressHydrationWarning>Updated {formatRelative(t.updatedAt)}</span>
                {t.metaName && <span className="font-mono"> - {t.metaName}</span>}
              </p>
            </Card>
          ))}
        </div>
      )}

      <TemplateModal open={creating} onClose={() => setCreating(false)} />
      <TemplateModal open={!!editing} template={editing ?? undefined} onClose={() => setEditing(null)} />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete template?"
        description={`"${deleting?.name ?? ""}" will be removed for the whole team.`}
        action={() => deleteTemplate(deleting!.id)}
        successMessage="Template deleted"
      />
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition",
        active ? "border-brand-300 bg-brand-50 text-brand-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
      )}
    >
      {children}
    </button>
  );
}

function TemplateModal({ open, onClose, template }: { open: boolean; onClose: () => void; template?: Template }) {
  const [pending, start] = useTransition();
  const [body, setBody] = useState(template?.body ?? "");
  const [lastId, setLastId] = useState<string | undefined>(template?.id);
  const [wasOpen, setWasOpen] = useState(open);
  const [params, setParams] = useState<string[]>(parseMetaParams(template?.metaParams));
  const [metaName, setMetaName] = useState(template?.metaName ?? "");
  const ref = useRef<HTMLTextAreaElement>(null);

  // Reset fields when the modal opens for a different template
  if (open !== wasOpen || template?.id !== lastId) {
    setWasOpen(open);
    setLastId(template?.id);
    if (open) {
      setBody(template?.body ?? "");
      setParams(parseMetaParams(template?.metaParams));
      setMetaName(template?.metaName ?? "");
    }
  }

  const insert = (key: string) => {
    const el = ref.current;
    const token = `{{${key}}}`;
    if (!el) return setBody((b) => b + token);
    const s = el.selectionStart ?? body.length;
    const e = el.selectionEnd ?? body.length;
    const next = body.slice(0, s) + token + body.slice(e);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + token.length, s + token.length);
    });
  };

  const submit = (fd: FormData) => {
    fd.set("body", body);
    fd.set("metaParams", params.join(","));
    start(async () => {
      const res = template ? await updateTemplate(template.id, fd) : await createTemplate(fd);
      if (res.error) return void toast.error(res.error);
      toast.success(template ? "Template updated" : "Template created");
      onClose();
    });
  };

  return (
    <Modal
      open={open}
      onClose={() => !pending && onClose()}
      size="xl"
      title={template ? "Edit template" : "New template"}
      description="Use variables to personalise each message automatically."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" form="template-form" loading={pending}>
            {template ? "Save changes" : "Create template"}
          </Button>
        </>
      }
    >
      <form
        id="template-form"
        key={template?.id ?? "new"}
        onSubmit={(e) => {
          e.preventDefault();
          submit(new FormData(e.currentTarget));
        }}
        className="grid gap-6 md:grid-cols-[1.15fr_1fr]"
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Template name" required>
              <Input name="name" required defaultValue={template?.name} placeholder="e.g. Site visit reminder" />
            </Field>
            <Field label="Category">
              <Select name="category" options={TEMPLATE_CATEGORIES} defaultValue={template?.category ?? "GENERAL"} />
            </Field>
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[13px] font-medium text-slate-700">
                Message<span className="ml-0.5 text-rose-500">*</span>
              </span>
              <span className="text-xs text-slate-400">{body.length} / 1024</span>
            </div>
            <textarea ref={ref} value={body} onChange={(e) => setBody(e.target.value)} rows={9} maxLength={1024} required className="input resize-y" placeholder="Hi {{name}}, ..." />
          </div>
          <div className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2">
              <BadgeCheck className="size-4 text-emerald-600" />
              <p className="text-[13px] font-semibold text-slate-800">WhatsApp API approval (optional)</p>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              To message leads via the API outside the 24-hour window or in bulk, create the same template in Meta Business Manager and enter its exact name here once approved.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Meta template name">
                <Input name="metaName" value={metaName} onChange={(e) => setMetaName(e.target.value)} placeholder="e.g. property_followup" className="font-mono text-[13px]" />
              </Field>
              <Field label="Language">
                <Select name="metaLanguage" options={META_LANGUAGES} defaultValue={template?.metaLanguage ?? "en"} />
              </Field>
            </div>
            {metaName && (
              <div className="mt-3">
                <p className="mb-1.5 text-xs font-medium text-slate-500">Parameter order (fills {"{{1}}"}, {"{{2}}"}... in the approved template)</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  {params.map((k, i) => (
                    <span key={i} className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-2 py-1 text-[11.5px] font-medium text-brand-700 ring-1 ring-inset ring-brand-600/20">
                      <span className="font-mono text-brand-400">{`{{${i + 1}}}`}</span> {k}
                      <button type="button" onClick={() => setParams((p) => p.filter((_, j) => j !== i))} className="ml-0.5 text-brand-400 hover:text-brand-700" aria-label={`Remove ${k}`}>
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                  {META_PARAM_KEYS.filter((k) => !params.includes(k)).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setParams((p) => [...p, k])}
                      className="rounded-md border border-dashed border-slate-300 px-2 py-1 text-[11.5px] font-medium text-slate-500 hover:border-brand-300 hover:text-brand-700"
                    >
                      + {k}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium text-slate-500">Insert variable</p>
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATE_VARIABLES.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => insert(v.key)}
                  title={v.label}
                  className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 font-mono text-[11.5px] font-medium text-emerald-700 transition hover:bg-emerald-100"
                >
                  {`{{${v.key}}}`}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div>
          <p className="label">Preview</p>
          <div className="rounded-xl bg-[#efeae2] p-4" style={{ backgroundImage: "radial-gradient(rgba(0,0,0,0.035) 1px, transparent 1px)", backgroundSize: "14px 14px" }}>
            <div className="ml-auto max-w-[95%] rounded-lg rounded-tr-none bg-[#d9fdd3] px-3 py-2 text-[13px] leading-relaxed text-slate-800 shadow-sm">
              {body ? <HighlightedBody body={body} /> : <p className="text-slate-400">Your message preview</p>}
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-500">Highlighted variables are replaced with lead and property details when sending.</p>
        </div>
      </form>
    </Modal>
  );
}
