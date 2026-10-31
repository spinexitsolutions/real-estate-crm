import "server-only";
import { cache } from "react";
import { db } from "./db";

export const getSettings = cache(async () => {
  const s = await db.settings.findFirst();
  if (s) return s;
  return db.settings.create({ data: {} });
});
