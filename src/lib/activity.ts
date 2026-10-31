import "server-only";
import { db } from "./db";

export async function logActivity(data: {
  type: string;
  content: string;
  userId?: string | null;
  leadId?: string | null;
  propertyId?: string | null;
  dealId?: string | null;
}) {
  try {
    await db.activity.create({ data });
  } catch (e) {
    console.error("Failed to log activity", e);
  }
}
