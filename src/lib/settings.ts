import "server-only";
import { cache } from "react";
import { db } from "./db";

export const getSettings = cache(async () => {
  const s = await db.settings.findUnique({ where: { id: 1 } });
  if (s) return s;
  return db.settings.create({ data: { id: 1 } });
});
