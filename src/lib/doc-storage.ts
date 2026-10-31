import "server-only";
import { randomBytes } from "crypto";
import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DOC_EXT, type DocMime } from "./doc-sniff";

/** Private bucket for customer documents (KYC, agreements, deeds). Files are only served via short-lived signed URLs. */
const BUCKET = process.env.SUPABASE_DOCUMENTS_BUCKET || "documents";
const LOCAL_ROOT = path.join(process.cwd(), ".data", "documents");

let client: SupabaseClient | null = null;
let bucketReady: Promise<void> | null = null;

export function isDocStorageRemote() {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function supabase() {
  if (!client) {
    client = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

function ensureBucket() {
  if (!bucketReady) {
    bucketReady = (async () => {
      const sb = supabase();
      const { data } = await sb.storage.getBucket(BUCKET);
      if (data) return;
      const { error } = await sb.storage.createBucket(BUCKET, { public: false, fileSizeLimit: 15 * 1024 * 1024 });
      if (error && !/already exists/i.test(error.message)) throw error;
    })().catch((e) => {
      bucketReady = null;
      throw e;
    });
  }
  return bucketReady;
}

function safeLocal(storagePath: string) {
  if (!storagePath || storagePath.includes("..")) return null;
  const abs = path.join(LOCAL_ROOT, storagePath);
  return abs.startsWith(LOCAL_ROOT + path.sep) ? abs : null;
}

export async function uploadDocument(bytes: Buffer, mime: DocMime, folder: string): Promise<{ storagePath: string } | { error: string }> {
  const now = new Date();
  const cleanFolder = folder.replace(/[^a-zA-Z0-9_/-]/g, "").replace(/\/+/g, "/").replace(/^\/|\/$/g, "") || "misc";
  const storagePath = `${cleanFolder}/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${Date.now().toString(36)}-${randomBytes(8).toString("hex")}.${DOC_EXT[mime]}`;

  if (isDocStorageRemote()) {
    try {
      await ensureBucket();
      const { error } = await supabase().storage.from(BUCKET).upload(storagePath, bytes, { contentType: mime, upsert: false });
      if (error) return { error: `Upload failed: ${error.message}` };
      return { storagePath };
    } catch (e) {
      console.error("Document upload failed", e);
      return { error: "Could not upload to storage. Please try again." };
    }
  }
  if (process.env.NODE_ENV === "production") {
    return { error: "Configure Supabase Storage to upload documents (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)." };
  }
  const abs = safeLocal(storagePath)!;
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, bytes);
  return { storagePath };
}

/** Short-lived signed URL (remote storage only). Returns null for local dev storage. */
export async function signedDocumentUrl(storagePath: string, seconds = 300, downloadName?: string | null) {
  if (!isDocStorageRemote()) return null;
  await ensureBucket();
  const { data, error } = await supabase()
    .storage.from(BUCKET)
    .createSignedUrl(storagePath, seconds, downloadName ? { download: downloadName } : undefined);
  if (error) throw error;
  return data.signedUrl;
}

/** Reads a locally stored document (development fallback). */
export async function readLocalDocument(storagePath: string) {
  const abs = safeLocal(storagePath);
  if (!abs) return null;
  try {
    return await readFile(abs);
  } catch {
    return null;
  }
}

export async function deleteDocumentFile(storagePath: string) {
  try {
    if (isDocStorageRemote()) {
      if (storagePath && !storagePath.includes("..")) await supabase().storage.from(BUCKET).remove([storagePath]);
      return;
    }
    const abs = safeLocal(storagePath);
    if (abs) await unlink(abs).catch(() => {});
  } catch (e) {
    console.error("Failed to delete document file", e);
  }
}

/** Builds a Response that delivers the document: redirect to a signed URL, or stream the local file. */
export async function documentResponse(doc: { storagePath: string; mimeType: string; name: string }, inline: boolean) {
  const ext = doc.storagePath.split(".").pop() ?? "";
  const fileName = /\.[a-z0-9]{2,4}$/i.test(doc.name) ? doc.name : `${doc.name}.${ext}`;
  if (isDocStorageRemote()) {
    const url = await signedDocumentUrl(doc.storagePath, 300, inline ? null : fileName);
    if (!url) return new Response("Not found", { status: 404 });
    return Response.redirect(url, 302);
  }
  const bytes = await readLocalDocument(doc.storagePath);
  if (!bytes) return new Response("File not found", { status: 404 });
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${fileName.replace(/[^\w.\- ]/g, "_")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
