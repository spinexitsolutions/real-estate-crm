"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { CircleAlert, GripVertical, ImagePlus, Image as ImageIcon, Link2, LoaderCircle, Star, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { cn } from "@/lib/utils";

const MAX_DIMENSION = 1920;
const QUALITY = 0.82;
const ACCEPT = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_SOURCE_BYTES = 25 * 1024 * 1024;

type Pending = { id: string; name: string; preview: string; progress: number; error?: string };

/** Resizes an image to MAX_DIMENSION on the longest side and re-encodes it as WebP. */
async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", QUALITY));
  // Some browsers can't encode WebP and fall back to PNG; keep whichever is smaller.
  if (!blob) return file;
  return blob.size < file.size || scale < 1 ? blob : file;
}

function uploadWithProgress(blob: Blob, filename: string, onProgress: (p: number) => void) {
  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      let data: { url?: string; error?: string } = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        /* non-JSON */
      }
      if (xhr.status >= 200 && xhr.status < 300 && data.url) resolve(data.url);
      else reject(new Error(data.error || (xhr.status === 401 ? "Session expired. Please sign in again." : "Upload failed.")));
    };
    xhr.onerror = () => reject(new Error("Network error during upload."));
    const fd = new FormData();
    fd.append("file", blob, filename);
    xhr.send(fd);
  });
}

export function PhotoManager({
  images,
  onChange,
  onBusyChange,
}: {
  images: string[];
  onChange: (next: string[] | ((prev: string[]) => string[])) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [showUrl, setShowUrl] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [broken, setBroken] = useState<Record<string, boolean>>({});
  const activeRef = useRef(0);

  const setBusy = (delta: number) => {
    activeRef.current += delta;
    onBusyChange?.(activeRef.current > 0);
  };

  const handleFiles = async (list: FileList | File[]) => {
    const files = Array.from(list);
    const valid = files.filter((f) => {
      if (!ACCEPT.includes(f.type)) {
        toast.error(`${f.name}: only JPG, PNG, WebP or AVIF images are allowed.`);
        return false;
      }
      if (f.size > MAX_SOURCE_BYTES) {
        toast.error(`${f.name}: file is too large (max 25 MB before compression).`);
        return false;
      }
      return true;
    });
    await Promise.all(
      valid.map(async (file) => {
        const id = Math.random().toString(36).slice(2);
        const preview = URL.createObjectURL(file);
        setPending((p) => [...p, { id, name: file.name, preview, progress: 0 }]);
        setBusy(1);
        try {
          const blob = await compressImage(file);
          const name = file.name.replace(/\.[^.]+$/, "") + (blob.type === "image/webp" ? ".webp" : "");
          const url = await uploadWithProgress(blob, name, (progress) => setPending((p) => p.map((x) => (x.id === id ? { ...x, progress } : x))));
          onChange((prev) => [...prev, url]);
          setPending((p) => p.filter((x) => x.id !== id));
          URL.revokeObjectURL(preview);
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Upload failed.";
          setPending((p) => p.map((x) => (x.id === id ? { ...x, error: msg } : x)));
          toast.error(`${file.name}: ${msg}`);
        } finally {
          setBusy(-1);
        }
      }),
    );
  };

  const addUrl = () => {
    const url = imageUrl.trim();
    if (!/^https?:\/\//i.test(url)) return void toast.error("Please enter a valid image URL starting with http:// or https://");
    if (images.includes(url)) return void toast.error("This image is already added.");
    onChange((prev) => [...prev, url]);
    setImageUrl("");
  };

  const move = (from: number, to: number) => {
    if (from === to) return;
    onChange((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT.join(",")}
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <div
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          if (!e.dataTransfer.files.length) return;
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition",
          dragOver ? "border-brand-400 bg-brand-50/60" : "border-slate-200 bg-slate-50/40",
        )}
      >
        <span className="mb-3 flex size-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <Upload className="size-5" />
        </span>
        <p className="text-sm font-medium text-slate-900">Drag and drop photos here</p>
        <p className="mt-1 text-xs text-slate-500">JPG, PNG, WebP or AVIF. Large photos are optimised automatically.</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Button variant="primary" size="sm" onClick={() => inputRef.current?.click()}>
            <ImagePlus /> Upload photos
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setShowUrl((s) => !s)}>
            <Link2 /> Add image URL
          </Button>
        </div>
      </div>

      {showUrl && (
        <div className="mt-3 flex gap-2">
          <Input
            value={imageUrl}
            autoFocus
            onChange={(e) => setImageUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addUrl();
              }
            }}
            placeholder="https://example.com/photo.jpg"
          />
          <Button variant="secondary" onClick={addUrl}>
            Add
          </Button>
        </div>
      )}

      {images.length === 0 && pending.length === 0 ? (
        <div className="mt-4 flex items-center justify-center gap-2 py-3 text-sm text-slate-400">
          <ImageIcon className="size-4" /> No photos added yet
        </div>
      ) : (
        <>
          <p className="mt-4 text-xs text-slate-500">Drag photos to reorder. The first photo is used as the cover.</p>
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {images.map((src, i) => (
              <div
                key={src}
                draggable
                onDragStart={(e) => {
                  setDragIndex(i);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(e) => {
                  if (dragIndex === null) return;
                  e.preventDefault();
                  setOverIndex(i);
                }}
                onDrop={(e) => {
                  if (dragIndex === null) return;
                  e.preventDefault();
                  e.stopPropagation();
                  move(dragIndex, i);
                  setDragIndex(null);
                  setOverIndex(null);
                }}
                onDragEnd={() => {
                  setDragIndex(null);
                  setOverIndex(null);
                }}
                className={cn(
                  "group relative aspect-[4/3] cursor-grab overflow-hidden rounded-lg border bg-slate-100 active:cursor-grabbing",
                  overIndex === i && dragIndex !== i ? "border-brand-500 ring-4 ring-brand-500/15" : "border-slate-200",
                  dragIndex === i && "opacity-40",
                )}
              >
                {broken[src] ? (
                  <div className="flex h-full items-center justify-center text-xs text-slate-400">Preview unavailable</div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={src} alt="" draggable={false} className="h-full w-full object-cover" onError={() => setBroken((b) => ({ ...b, [src]: true }))} />
                )}
                {i === 0 && <span className="absolute left-2 top-2 rounded-md bg-slate-900/70 px-1.5 py-0.5 text-[11px] font-medium text-white">Cover</span>}
                <span className="absolute bottom-2 left-2 rounded-md bg-white/90 p-1 text-slate-500 opacity-0 shadow-xs transition group-hover:opacity-100">
                  <GripVertical className="size-3.5" />
                </span>
                <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition group-hover:opacity-100">
                  {i > 0 && (
                    <button type="button" title="Set as cover" onClick={() => move(i, 0)} className="rounded-md bg-white/90 p-1.5 text-slate-700 shadow-xs hover:bg-white">
                      <Star className="size-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    title="Remove"
                    onClick={() => onChange((list) => list.filter((x) => x !== src))}
                    className="rounded-md bg-white/90 p-1.5 text-rose-600 shadow-xs hover:bg-white"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            ))}
            {pending.map((p) => (
              <div key={p.id} className="relative aspect-[4/3] overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.preview} alt="" className="h-full w-full object-cover opacity-50" />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-3">
                  {p.error ? (
                    <>
                      <CircleAlert className="size-5 text-rose-600" />
                      <p className="line-clamp-2 text-center text-[11px] font-medium text-rose-700">{p.error}</p>
                      <button type="button" onClick={() => setPending((list) => list.filter((x) => x.id !== p.id))} className="text-[11px] font-medium text-slate-700 underline">
                        Dismiss
                      </button>
                    </>
                  ) : (
                    <>
                      <LoaderCircle className="size-5 animate-spin text-brand-600" />
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/80">
                        <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${p.progress}%` }} />
                      </div>
                      <p className="text-[11px] font-medium text-slate-700">{p.progress < 100 ? `Uploading ${p.progress}%` : "Processing..."}</p>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
