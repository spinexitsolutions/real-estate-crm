import { db, rawDb, runAsTenant } from "../src/lib/db";
(async () => {
  const orgs = await rawDb.organization.findMany();
  for (const o of orgs) {
    const n = await runAsTenant(o.id, () => db.lead.count());
    const all = await runAsTenant(o.id, () => db.lead.findMany({ select: { organizationId: true } }));
    console.log(o.name, "sees", n, "leads; rows from another org:", all.filter((l) => l.organizationId !== o.id).length);
  }
  const [a, b] = orgs;
  const bl = await rawDb.lead.findFirstOrThrow({ where: { organizationId: b.id } });
  const read = await runAsTenant(a.id, () => db.lead.findUnique({ where: { id: bl.id } }));
  console.log("cross-org findUnique:", read ? "LEAK" : "blocked");
  const upd = await runAsTenant(a.id, () => db.lead.updateMany({ where: { id: bl.id }, data: { name: "hacked" } }));
  console.log("cross-org updateMany count:", upd.count);
  try { await runAsTenant(a.id, () => db.lead.update({ where: { id: bl.id }, data: { name: "hacked" } })); console.log("cross-org update: LEAK"); } catch { console.log("cross-org update: blocked"); }
  try { await runAsTenant(a.id, () => db.lead.delete({ where: { id: bl.id } })); console.log("cross-org delete: LEAK"); } catch { console.log("cross-org delete: blocked"); }
  const created = await runAsTenant(a.id, () => db.activity.create({ data: { type: "NOTE", content: "x", leadId: bl.id } })).catch((e) => (console.log("   ->", e.name), null));
  const al = await rawDb.lead.findFirstOrThrow({ where: { organizationId: a.id } });
  const okCreate = await runAsTenant(a.id, () => db.activity.create({ data: { type: "NOTE", content: "own lead ok", leadId: al.id } }));
  console.log("create in A on A's own lead:", okCreate.organizationId === a.id ? "ok" : "BUG");
  await rawDb.activity.delete({ where: { id: okCreate.id } });
  const reassign = await runAsTenant(a.id, () => db.lead.update({ where: { id: al.id }, data: { assignedToId: (bl.assignedToId as string) } })).catch((e) => e.name);
  console.log("assign A's lead to B's user:", typeof reassign === "string" ? `blocked (${reassign})` : "LEAK");
  console.log("create in A pointing at B's lead:", created ? `created with org ${created.organizationId === a.id ? "A" : "B"}` : "blocked");
  if (created) await rawDb.activity.delete({ where: { id: created.id } });
  try { await rawDb.lead.create({ data: { name: "no org", phone: "1234567" } as never }); console.log("raw insert without org: LEAK"); } catch { console.log("raw insert without org: blocked by DB"); }
  try { await db.lead.count(); console.log("no context: LEAK"); } catch (e) { console.log("no context:", (e as Error).name); }
  console.log("Harbour lead name still:", (await rawDb.lead.findUniqueOrThrow({ where: { id: bl.id } })).name);
  await rawDb.$disconnect();
})();
