import { sniffImageType } from "./image-sniff";

export type DocMime = "application/pdf" | "image/jpeg" | "image/png" | "image/webp";

export const DOC_MAX_BYTES = 15 * 1024 * 1024;

/** Detects allowed document types (PDF, JPEG, PNG, WebP) from file signature bytes. */
export function sniffDocumentType(b: Uint8Array): DocMime | null {
  if (b.length >= 5 && String.fromCharCode(...b.slice(0, 5)) === "%PDF-") return "application/pdf";
  const img = sniffImageType(b);
  if (img === "image/jpeg" || img === "image/png" || img === "image/webp") return img;
  return null;
}

export const DOC_EXT: Record<DocMime, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
