import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { uploadImage } from "@/lib/storage";
import { sniffImageType } from "@/lib/image-sniff";

export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file received." }, { status: 400 });
  if (file.size === 0) return NextResponse.json({ error: "The file is empty." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Image is larger than 8 MB." }, { status: 413 });

  const bytes = Buffer.from(await file.arrayBuffer());
  const mime = sniffImageType(bytes);
  if (!mime) return NextResponse.json({ error: "Only JPG, PNG, WebP or AVIF images are allowed." }, { status: 415 });

  const res = await uploadImage(bytes, mime);
  if ("error" in res) return NextResponse.json({ error: res.error }, { status: 500 });
  return NextResponse.json({ url: res.url });
}
