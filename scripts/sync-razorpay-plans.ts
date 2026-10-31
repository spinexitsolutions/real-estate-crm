/**
 * Creates Razorpay plans (monthly + yearly) for every active Plan that does not have one yet
 * and stores the ids. Amounts include 18% GST. Run: npm run razorpay:sync-plans
 * Needs RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET. Razorpay plans are immutable: when you change a
 * price, clear the stored id (super admin panel or DB) and run this again to create a new plan.
 */
import { rawDb } from "../src/lib/db";
import { priceWithGst } from "../src/lib/billing-core";

const API = "https://api.razorpay.com/v1";

async function createPlan(period: "monthly" | "yearly", name: string, amountPaise: number, code: string) {
  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
  const res = await fetch(`${API}/plans`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify({ period, interval: 1, item: { name, amount: amountPaise, currency: "INR", description: `${name} (incl. 18% GST)` }, notes: { planCode: code } }),
  });
  const json = (await res.json()) as { id?: string; error?: { description?: string } };
  if (!res.ok || !json.id) throw new Error(json.error?.description || `Razorpay error ${res.status}`);
  return json.id;
}

async function main() {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    console.error("Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET first.");
    process.exit(1);
  }
  const plans = await rawDb.plan.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } });
  for (const p of plans) {
    const data: { razorpayPlanIdMonthly?: string; razorpayPlanIdYearly?: string } = {};
    if (!p.razorpayPlanIdMonthly && p.priceMonthly > 0) {
      data.razorpayPlanIdMonthly = await createPlan("monthly", `${p.name} - Monthly`, priceWithGst(p.priceMonthly) * 100, p.code);
    }
    if (!p.razorpayPlanIdYearly && p.priceYearly > 0) {
      data.razorpayPlanIdYearly = await createPlan("yearly", `${p.name} - Yearly`, priceWithGst(p.priceYearly) * 100, p.code);
    }
    if (Object.keys(data).length) {
      await rawDb.plan.update({ where: { id: p.id }, data });
      console.log(`${p.name}: created ${Object.keys(data).join(", ")}`);
    } else console.log(`${p.name}: already synced`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => rawDb.$disconnect());
