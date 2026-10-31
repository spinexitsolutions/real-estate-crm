"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import type { ActionResult } from "@/lib/action";
import { DOCUMENT_CATEGORIES, labelOf } from "@/lib/constants";
import { getDocumentForUser } from "@/lib/doc-access";
import { deleteDocumentFile } from "@/lib/doc-storage";

export async function updateDocument(id: string, data: { name?: string; category?: string }): Promise<ActionResult> {
  const user = await requireUser();
  const doc = await getDocumentForUser(user, id);
  if (!doc) return { error: "Document not found or access denied." };
  const name = data.name?.trim().slice(0, 160);
  const category = data.category && DOCUMENT_CATEGORIES.some((c) => c.value === data.category) ? data.category : undefined;
  if (data.name !== undefined && !name) return { error: "Name cannot be empty." };
  await db.document.update({ where: { id }, data: { ...(name ? { name } : {}), ...(category ? { category } : {}) } });
  if (doc.leadId) {
    const changes = [name && name !== doc.name ? `renamed to "${name}"` : null, category && category !== doc.category ? `moved to ${labelOf(DOCUMENT_CATEGORIES, category)}` : null].filter(Boolean);
    if (changes.length) await logActivity({ type: "DOCUMENT", content: `Document "${doc.name}" ${changes.join(" and ")}`, leadId: doc.leadId, userId: user.id });
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function setDocumentShared(id: string, visibleToCustomer: boolean): Promise<ActionResult> {
  const user = await requireUser();
  const doc = await getDocumentForUser(user, id);
  if (!doc) return { error: "Document not found or access denied." };
  await db.document.update({ where: { id }, data: { visibleToCustomer } });
  if (doc.leadId) {
    await logActivity({ type: "DOCUMENT", content: `${visibleToCustomer ? "Shared" : "Stopped sharing"} "${doc.name}" with the customer portal`, leadId: doc.leadId, userId: user.id });
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteDocument(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const doc = await getDocumentForUser(user, id);
  if (!doc) return { error: "Document not found or access denied." };
  if (user.role === "AGENT" && doc.uploadedById !== user.id) return { error: "Only the uploader or a manager can delete this document." };
  await db.document.delete({ where: { id } });
  await deleteDocumentFile(doc.storagePath);
  if (doc.leadId) await logActivity({ type: "DOCUMENT", content: `Deleted document "${doc.name}"`, leadId: doc.leadId, userId: user.id });
  revalidatePath("/", "layout");
  return { ok: true };
}
