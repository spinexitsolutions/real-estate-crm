"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CircleCheck,
  Circle,
  Download,
  Ellipsis,
  Eye,
  EyeOff,
  FileImage,
  FileText,
  FolderOpen,
  Pencil,
  Share2,
  Trash2,
  Upload,
  CircleAlert,
} from "lucide-react";
import { deleteDocument, setDocumentShared, updateDocument } from "@/actions/documents";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Select } from "@/components/ui/field";
import { Dropdown, DropdownItem } from "@/components/ui/dropdown";
import { ConfirmDialog } from "@/components/ui/confirm";
import { DOCUMENT_CATEGORIES, labelOf } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export type DocItem = {
  id: string;
  name: string;
  category: string;
  mimeType: string;
  size: number;
  visibleToCustomer: boolean;
  createdAt: string;
  uploadedBy: string | null;
  canDelete: boolean;
};

type Links = { leadId?: string; dealId?: string; bookingId?: string; propertyId?: string };

const KYC = [
  { value: "KYC_PAN", label: "PAN Card" },
  { value: "KYC_AADHAAR", label: "Aadhaar Card" },
  { value: "KYC_PHOTO", label: "Photograph" },
];

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function DocIcon({ mime, className }: { mime: string; className?: string }) {
  const isPdf = mime === "application/pdf";
  return (
    <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", isPdf ? "bg-rose-50 text-rose-600" : "bg-sky-50 text-sky-600", className)}>
      {isPdf ? <FileText className="size-[18px]" /> : <FileImage className="size-[18px]" />}
    </span>
  );
}

export function DocumentsClient({
  title,
  items,
  links,
  canShareWithCustomer,
  showKycChecklist,
}: {
  title: string;
  items: DocItem[];
  links: Links;
  canShareWithCustomer: boolean;
  showKycChecklist: boolean;
}) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadCategory, setUploadCategory] = useState<string | undefined>();
  const grouped = useMemo(() => {
    const map = new Map<string, DocItem[]>();
    for (const d of items) map.set(d.category, [...(map.get(d.category) ?? []), d]);
    return DOCUMENT_CATEGORIES.filter((c) => map.has(c.value)).map((c) => ({ category: c, docs: map.get(c.value)! }));
  }, [items]);

  const openUpload = (category?: string) => {
    setUploadCategory(category);
    setUploadOpen(true);
  };

  return (
    <Card>
      <CardHeader
        title={title}
        description={items.length ? `${items.length} file${items.length === 1 ? "" : "s"}` : "KYC, agreements, deeds and receipts"}
        action={
          <Button size="sm" onClick={() => openUpload()}>
            <Upload /> Upload
          </Button>
        }
      />
      {showKycChecklist && (
        <div className="grid grid-cols-3 gap-2 border-b border-slate-100 px-5 py-3">
          {KYC.map((k) => {
            const done = items.some((d) => d.category === k.value);
            return (
              <button
                key={k.value}
                type="button"
                onClick={() => !done && openUpload(k.value)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-left text-xs font-medium transition",
                  done ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-dashed border-slate-300 text-slate-500 hover:border-brand-300 hover:text-brand-700",
                )}
                title={done ? `${k.label} uploaded` : `Upload ${k.label}`}
              >
                {done ? <CircleCheck className="size-4 shrink-0" /> : <Circle className="size-4 shrink-0" />}
                <span className="truncate">{k.label}</span>
              </button>
            );
          })}
        </div>
      )}
      {items.length === 0 ? (
        <EmptyState icon={FolderOpen} title="No documents yet" description="Upload KYC, agreements, sale deeds and receipts. Files are stored privately." />
      ) : (
        <div className="divide-y divide-slate-100">
          {grouped.map((g) => (
            <div key={g.category.value}>
              <p className="bg-slate-50/70 px-5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{g.category.label}</p>
              <ul className="divide-y divide-slate-100">
                {g.docs.map((d) => (
                  <DocRow key={d.id} doc={d} canShare={canShareWithCustomer} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      {uploadOpen && <UploadModal links={links} defaultCategory={uploadCategory} canShare={canShareWithCustomer} onClose={() => setUploadOpen(false)} />}
    </Card>
  );
}

export function DocRow({ doc, canShare, context }: { doc: DocItem; canShare: boolean; context?: { href: string; label: string; sub?: string } }) {
  const router = useRouter();
  const [preview, setPreview] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pending, start] = useTransition();

  const toggleShare = () =>
    start(async () => {
      const res = await setDocumentShared(doc.id, !doc.visibleToCustomer);
      if (res.error) return void toast.error(res.error);
      toast.success(doc.visibleToCustomer ? "Hidden from customer portal" : "Shared on customer portal");
      router.refresh();
    });

  return (
    <li className="flex items-center gap-3 px-5 py-3">
      <DocIcon mime={doc.mimeType} />
      <button type="button" onClick={() => setPreview(true)} className="min-w-0 flex-1 text-left">
        <p className="truncate text-sm font-medium text-slate-800 hover:text-brand-700">{doc.name}</p>
        <p className="truncate text-xs text-slate-500">
          {formatBytes(doc.size)} - {formatDate(doc.createdAt)}
          {doc.uploadedBy ? ` - ${doc.uploadedBy}` : ""}
        </p>
      </button>
      {context && (
        <Link href={context.href} className="hidden w-48 shrink-0 md:block">
          <span className="block truncate text-sm font-medium text-slate-700 hover:text-brand-700">{context.label}</span>
          {context.sub && <span className="block truncate text-xs text-slate-500">{context.sub}</span>}
        </Link>
      )}
      {context && <Badge className="hidden shrink-0 lg:inline-flex">{labelOf(DOCUMENT_CATEGORIES, doc.category)}</Badge>}
      {doc.visibleToCustomer && (
        <Badge className="hidden bg-emerald-50 text-emerald-700 ring-emerald-600/20 sm:inline-flex">
          <Share2 className="size-3" /> Shared
        </Badge>
      )}
      <a href={`/api/documents/${doc.id}/download`} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Download">
        <Download className="size-4" />
      </a>
      <Dropdown
        trigger={({ toggle }) => (
          <button onClick={toggle} disabled={pending} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="More actions">
            <Ellipsis className="size-4" />
          </button>
        )}
      >
        {(close) => (
          <>
            <DropdownItem
              icon={Eye}
              onClick={() => {
                close();
                setPreview(true);
              }}
            >
              Preview
            </DropdownItem>
            {canShare && (
              <DropdownItem
                icon={doc.visibleToCustomer ? EyeOff : Share2}
                onClick={() => {
                  close();
                  toggleShare();
                }}
              >
                {doc.visibleToCustomer ? "Hide from customer" : "Share with customer"}
              </DropdownItem>
            )}
            <DropdownItem
              icon={Pencil}
              onClick={() => {
                close();
                setRenaming(true);
              }}
            >
              Rename / category
            </DropdownItem>
            {doc.canDelete && (
              <DropdownItem
                icon={Trash2}
                danger
                onClick={() => {
                  close();
                  setDeleting(true);
                }}
              >
                Delete
              </DropdownItem>
            )}
          </>
        )}
      </Dropdown>

      {preview && <PreviewModal doc={doc} onClose={() => setPreview(false)} />}
      {renaming && <RenameModal doc={doc} onClose={() => setRenaming(false)} />}
      <ConfirmDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        title="Delete this document?"
        description={`"${doc.name}" will be permanently deleted from storage.`}
        successMessage="Document deleted"
        action={async () => {
          const r = await deleteDocument(doc.id);
          router.refresh();
          return r;
        }}
      />
    </li>
  );
}

export function PreviewModal({ doc, onClose }: { doc: DocItem; onClose: () => void }) {
  const src = `/api/documents/${doc.id}/download?inline=1`;
  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={doc.name}
      description={`${labelOf(DOCUMENT_CATEGORIES, doc.category)} - ${formatBytes(doc.size)}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <a href={`/api/documents/${doc.id}/download`} className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand-600 px-3.5 text-sm font-medium text-white hover:bg-brand-700">
            <Download className="size-4" /> Download
          </a>
        </>
      }
    >
      {doc.mimeType === "application/pdf" ? (
        <iframe src={src} title={doc.name} className="h-[70vh] w-full rounded-lg border border-slate-200" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={doc.name} className="mx-auto max-h-[70vh] rounded-lg object-contain" />
      )}
    </Modal>
  );
}

function RenameModal({ doc, onClose }: { doc: DocItem; onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(doc.name);
  const [category, setCategory] = useState(doc.category);
  const [pending, start] = useTransition();
  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title="Edit document"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            loading={pending}
            onClick={() =>
              start(async () => {
                const res = await updateDocument(doc.id, { name, category });
                if (res.error) return void toast.error(res.error);
                toast.success("Document updated");
                onClose();
                router.refresh();
              })
            }
          >
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Category">
          <Select value={category} onChange={(e) => setCategory(e.target.value)} options={DOCUMENT_CATEGORIES} />
        </Field>
      </div>
    </Modal>
  );
}

type Queued = { id: string; file: File; name: string; progress: number; error?: string; done?: boolean };

const ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp";

function UploadModal({ links, defaultCategory, canShare, onClose }: { links: Links; defaultCategory?: string; canShare: boolean; onClose: () => void }) {
  const router = useRouter();
  const [category, setCategory] = useState(defaultCategory ?? "OTHER");
  const [share, setShare] = useState(false);
  const [queue, setQueue] = useState<Queued[]>([]);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const add = (files: FileList | File[]) => {
    const next: Queued[] = [];
    for (const f of Array.from(files)) {
      const base = f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
      next.push({
        id: `${f.name}-${f.size}-${Math.random().toString(36).slice(2)}`,
        file: f,
        name: base || f.name,
        progress: 0,
        error: f.size > 15 * 1024 * 1024 ? "Larger than 15 MB" : undefined,
      });
    }
    setQueue((q) => [...q, ...next]);
  };

  const uploadOne = (item: Queued) =>
    new Promise<boolean>((resolve) => {
      const fd = new FormData();
      fd.set("file", item.file);
      fd.set("name", item.name);
      fd.set("category", category);
      fd.set("visibleToCustomer", share ? "1" : "0");
      for (const [k, v] of Object.entries(links)) if (v) fd.set(k, v);
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/documents");
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setQueue((q) => q.map((x) => (x.id === item.id ? { ...x, progress: Math.round((e.loaded / e.total) * 100) } : x)));
      };
      xhr.onload = () => {
        let msg = "Upload failed";
        try {
          const j = JSON.parse(xhr.responseText) as { error?: string };
          if (j.error) msg = j.error;
        } catch {}
        const ok = xhr.status >= 200 && xhr.status < 300;
        setQueue((q) => q.map((x) => (x.id === item.id ? { ...x, progress: 100, done: ok, error: ok ? undefined : msg } : x)));
        resolve(ok);
      };
      xhr.onerror = () => {
        setQueue((q) => q.map((x) => (x.id === item.id ? { ...x, error: "Network error" } : x)));
        resolve(false);
      };
      xhr.send(fd);
    });

  const start = async () => {
    setBusy(true);
    let ok = 0;
    for (const item of queue) {
      if (item.done || item.error) continue;
      if (await uploadOne(item)) ok++;
    }
    setBusy(false);
    if (ok) {
      toast.success(`${ok} document${ok === 1 ? "" : "s"} uploaded`);
      router.refresh();
    }
    setQueue((q) => {
      const remaining = q.filter((x) => !x.done);
      if (!remaining.length) onClose();
      return remaining;
    });
  };

  const pendingCount = queue.filter((x) => !x.done && !x.error).length;

  return (
    <Modal
      open
      onClose={() => !busy && onClose()}
      title="Upload documents"
      description="PDF, JPG, PNG or WebP up to 15 MB. Files are stored privately."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button loading={busy} disabled={!pendingCount} onClick={start}>
            <Upload /> Upload {pendingCount ? `${pendingCount} file${pendingCount === 1 ? "" : "s"}` : ""}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category">
            <Select value={category} onChange={(e) => setCategory(e.target.value)} options={DOCUMENT_CATEGORIES} />
          </Field>
          {canShare && (
            <Field label="Customer portal">
              <label className="flex h-[38px] cursor-pointer items-center gap-2.5 rounded-lg border border-slate-300 px-3 text-sm text-slate-700">
                <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} className="size-4 accent-brand-600" />
                Share with customer
              </label>
            </Field>
          )}
        </div>
        <input ref={inputRef} type="file" multiple accept={ACCEPT} className="hidden" onChange={(e) => e.target.files && add(e.target.files)} />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            if (e.dataTransfer.files.length) add(e.dataTransfer.files);
          }}
          className={cn(
            "flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition",
            drag ? "border-brand-400 bg-brand-50/50" : "border-slate-200 hover:border-brand-300 hover:bg-brand-50/30",
          )}
        >
          <span className="mb-2 flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <Upload className="size-5" />
          </span>
          <span className="text-sm font-medium text-slate-900">Drag files here or click to browse</span>
          <span className="mt-1 text-xs text-slate-500">You can select several files at once</span>
        </button>
        {queue.length > 0 && (
          <ul className="space-y-2">
            {queue.map((q) => (
              <li key={q.id} className="rounded-lg border border-slate-200 p-2.5">
                <div className="flex items-center gap-2.5">
                  <DocIcon mime={q.file.type === "application/pdf" ? "application/pdf" : "image/jpeg"} className="size-8" />
                  <Input
                    value={q.name}
                    disabled={busy || q.done}
                    onChange={(e) => setQueue((all) => all.map((x) => (x.id === q.id ? { ...x, name: e.target.value } : x)))}
                    className="h-8 flex-1"
                  />
                  <span className="w-14 text-right text-xs text-slate-500">{formatBytes(q.file.size)}</span>
                  {!busy && (
                    <button type="button" onClick={() => setQueue((all) => all.filter((x) => x.id !== q.id))} className="rounded p-1 text-slate-400 hover:text-rose-600" aria-label="Remove">
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
                {q.error ? (
                  <p className="mt-1.5 flex items-center gap-1 text-xs text-rose-600">
                    <CircleAlert className="size-3.5" /> {q.error}
                  </p>
                ) : (
                  (busy || q.progress > 0) && (
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className={cn("h-full rounded-full transition-all", q.done ? "bg-emerald-500" : "bg-brand-500")} style={{ width: `${q.progress}%` }} />
                    </div>
                  )
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
