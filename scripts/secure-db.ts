/**
 * Supabase exposes every table in the `public` schema through its auto-generated
 * REST API (PostgREST). EstateDesk only talks to the database from the server via
 * Prisma, so we enable Row Level Security on every table with NO policies:
 * the public REST API (anon / authenticated keys) can no longer read or write
 * anything, while Prisma (connecting as the `postgres` role) is unaffected.
 *
 * Run after every schema change: npm run db:secure
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const tables = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'`;
  for (const { tablename } of tables) {
    await db.$executeRawUnsafe(`ALTER TABLE "public"."${tablename.replace(/"/g, '""')}" ENABLE ROW LEVEL SECURITY`);
  }
  console.log(`Row Level Security enabled on ${tables.length} tables.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
