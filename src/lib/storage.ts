import "server-only";
import { randomBytes } from "crypto";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "property-images";

let client: SupabaseClient | null = null;
let bucketReady: Promise<void> | null = null;

export function isSupabaseStorageConfigured() {
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

/** Creates the public bucket once per server process if it does not exist. */
function ensureBucket() {
  if (!bucketReady) {
    bucketReady = (async () => {
      const sb = supabase();
      const { data } = await sb.storage.getBucket(BUCKET);
      if (data) return;
      const { error } = await sb.storage.createBucket(BUCKET, {
        public: true,
        fileSizeLimit: 8 * 1024 * 1024,
        allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/avif"],
      });
      if (error && !/already exists/i.test(error.message)) throw error;
    })().catch((e) => {
      bucketReady = null;
      throw e;
    });
  }
  return bucketReady;
}

export type UploadResult = { url: string } | { error: string };

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" };

export async function uploadImage(bytes: Buffer, mime: string): Promise<UploadResult> {
  const ext = EXT[mime];
  if (!ext) return { error: "Unsupported image type." };
  const now = new Date();
  const key = `properties/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${Date.now().toString(36)}-${randomBytes(6).toString("hex")}.${ext}`;

  if (isSupabaseStorageConfigured()) {
    try {
      await ensureBucket();
      const sb = supabase();
      const { error } = await sb.storage.from(BUCKET).upload(key, bytes, { contentType: mime, cacheControl: "31536000", upsert: false });
      if (error) return { error: `Upload failed: ${error.message}` };
      return { url: sb.storage.from(BUCKET).getPublicUrl(key).data.publicUrl };
    } catch (e) {
      console.error("Supabase upload failed", e);
      return { error: "Could not upload to storage. Please try again." };
    }
  }

  if (process.env.NODE_ENV === "production") {
    return { error: "Configure Supabase Storage to upload photos (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)." };
  }
  // Development fallback: store under public/uploads
  const rel = path.join("uploads", key);
  const abs = path.join(process.cwd(), "public", rel);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, bytes);
  return { url: "/" + rel.split(path.sep).join("/") };
}

/** Deletes an uploaded image. Ignores URLs that do not belong to our storage. Never throws. */
export async function deleteImageByUrl(url: string) {
  try {
    if (url.startsWith("/uploads/")) {
      if (process.env.NODE_ENV === "production") return;
      const abs = path.join(process.cwd(), "public", url);
      if (!abs.startsWith(path.join(process.cwd(), "public", "uploads"))) return;
      await unlink(abs).catch(() => {});
      return;
    }
    if (!isSupabaseStorageConfigured()) return;
    const base = `${process.env.SUPABASE_URL!.replace(/\/$/, "")}/storage/v1/object/public/${BUCKET}/`;
    if (!url.startsWith(base)) return;
    const key = decodeURIComponent(url.slice(base.length).split("?")[0]);
    if (!key || key.includes("..")) return;
    await supabase().storage.from(BUCKET).remove([key]);
  } catch (e) {
    console.error("Failed to delete image", e);
  }
}

export async function deleteImages(urls: string[]) {
  await Promise.all(urls.map(deleteImageByUrl));
}
