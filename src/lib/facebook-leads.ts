import "server-only";
import { intakeLead } from "./lead-intake";
import { budgetFromText, logIntegration } from "./integrations";
import { mapFacebookFields, type FbField } from "./portal-normalize";

type FbLead = { id: string; field_data?: FbField[]; created_time?: string; ad_name?: string; campaign_name?: string; form_id?: string; platform?: string };

async function fetchLead(leadgenId: string, token: string): Promise<FbLead> {
  const url = `https://graph.facebook.com/v21.0/${encodeURIComponent(leadgenId)}?access_token=${encodeURIComponent(token)}&fields=field_data,created_time,ad_name,campaign_name,form_id,platform`;
  const res = await fetch(url, { cache: "no-store" });
  const json = (await res.json().catch(() => ({}))) as FbLead & { error?: { message?: string } };
  if (!res.ok || json.error) throw new Error(json.error?.message || `Graph API returned ${res.status}`);
  return json;
}

export async function processLeadgen(value: { leadgen_id?: string; form_id?: string; ad_id?: string; page_id?: string }, token: string | null) {
  const leadgenId = value.leadgen_id;
  if (!leadgenId) return;
  if (!token) {
    await logIntegration("FACEBOOK", "ERROR", "Page access token is not configured - lead could not be fetched", value);
    return;
  }
  let lead: FbLead;
  try {
    lead = await fetchLead(leadgenId, token);
  } catch (e) {
    await logIntegration("FACEBOOK", "ERROR", `Could not fetch lead ${leadgenId}: ${(e as Error).message}`, value);
    return;
  }
  const source = lead.platform === "ig" ? "INSTAGRAM" : "FACEBOOK";
  const m = mapFacebookFields(lead.field_data ?? []);
  const campaign = lead.campaign_name || lead.ad_name || null;
  const res = await intakeLead({
    name: m.name || "Lead Ads enquiry",
    phone: m.phone,
    email: m.email,
    source,
    message: m.extras.join("\n") || null,
    location: [m.locality, m.city].filter(Boolean).join(", ") || null,
    budget: budgetFromText(m.budget),
    propertyType: m.propertyType,
    bedrooms: m.bedrooms,
    purpose: m.purpose,
    channelLabel: `${source === "INSTAGRAM" ? "Instagram" : "Facebook"} Lead Ads${campaign ? ` - ${campaign}` : ""}`,
    tags: campaign ? [campaign.slice(0, 40)] : [],
  });
  if (!res.ok) await logIntegration(source, "ERROR", res.error, lead);
  else await logIntegration(source, res.duplicate ? "DUPLICATE" : "OK", `${res.duplicate ? "Repeat enquiry" : "New lead"} ${m.name || ""} (${m.phone})${campaign ? ` - ${campaign}` : ""}`, lead, res.leadId);
}

