/* Demo data so the CRM looks alive on first run. Run with: npm run db:seed */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

process.env.TZ = process.env.APP_TIMEZONE || "Asia/Kolkata";
const db = new PrismaClient();

// Deterministic pseudo-random so the demo looks the same every time
let seed = 42;
const rand = () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};
const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
const int = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
const daysAgo = (d: number, h = int(9, 19)) => {
  const x = new Date();
  x.setDate(x.getDate() - d);
  x.setHours(h, pick([0, 15, 30, 45]), 0, 0);
  // never place "past" events in the future
  if (d >= 0 && x > new Date()) return new Date(Date.now() - int(10, 180) * 60000);
  return x;
};
const daysAhead = (d: number, h = int(10, 18)) => {
  const x = new Date();
  x.setDate(x.getDate() + d);
  x.setHours(h, pick([0, 15, 30, 45]), 0, 0);
  return x;
};
const todayAt = (h: number) => {
  const x = new Date();
  x.setHours(h, pick([0, 15, 30, 45]), 0, 0);
  return x;
};

const FIRST = ["Aarav", "Vivaan", "Aditya", "Rohan", "Karan", "Arjun", "Ishaan", "Rahul", "Siddharth", "Nikhil", "Priya", "Ananya", "Neha", "Pooja", "Sneha", "Kavya", "Riya", "Meera", "Simran", "Divya", "Amit", "Vikram", "Manish", "Suresh", "Rajesh", "Deepak", "Harsh", "Tanvi", "Shreya", "Nisha"];
const LAST = ["Sharma", "Verma", "Gupta", "Mehta", "Patel", "Singh", "Reddy", "Nair", "Iyer", "Joshi", "Kapoor", "Malhotra", "Agarwal", "Chopra", "Bansal", "Khanna", "Desai", "Shah", "Rao", "Kulkarni"];
const LOCATIONS = [
  { city: "Mumbai", localities: ["Andheri West", "Powai", "Bandra West", "Goregaon East", "Thane West", "Malad West"] },
  { city: "Pune", localities: ["Baner", "Hinjewadi", "Kharadi", "Wakad", "Koregaon Park"] },
  { city: "Bengaluru", localities: ["Whitefield", "HSR Layout", "Sarjapur Road", "Hebbal", "Electronic City"] },
];
const SOURCES = ["WEBSITE", "FACEBOOK", "INSTAGRAM", "GOOGLE_ADS", "PORTAL_99ACRES", "PORTAL_MAGICBRICKS", "PORTAL_HOUSING", "REFERRAL", "WALK_IN", "WHATSAPP"];
const IMAGES = [
  "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&q=80",
  "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=80",
  "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&q=80",
  "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200&q=80",
  "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200&q=80",
  "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1200&q=80",
  "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200&q=80",
  "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1200&q=80",
  "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=1200&q=80",
  "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&q=80",
  "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=1200&q=80",
  "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1200&q=80",
];

async function main() {
  console.log("Clearing existing data...");
  // Calls / attendance / site visits (calls only SET NULL on lead/user delete, so clear them explicitly)
  await db.callLog.deleteMany();
  await db.siteVisitCheckIn.deleteMany();
  await db.attendance.deleteMany();
  await db.activity.deleteMany();
  await db.whatsAppMessage.deleteMany();
  await db.followUp.deleteMany();
  await db.deal.deleteMany();
  await db.leadProperty.deleteMany();
  await db.lead.deleteMany();
  await db.property.deleteMany();
  await db.whatsAppTemplate.deleteMany();
  await db.user.deleteMany();
  await db.settings.deleteMany();

  await db.settings.create({
    data: {
      id: 1,
      companyName: "Skyline Realty",
      companyPhone: "+91 98200 12345",
      companyEmail: "sales@skylinerealty.in",
      companyAddress: "4th Floor, Trade Centre, BKC, Mumbai 400051",
      leadWebhookKey: randomBytes(16).toString("hex"),
      // --- Branding + public website (website / brochure module) ---
      reraNumber: "A51800012345",
      websiteEnabled: true,
      websiteTagline: "Find your dream home in Mumbai, Pune and Bengaluru",
      websiteAbout:
        "Skyline Realty has helped over 2,500 families buy, sell and rent homes since 2012. Our advisors know every micro-market we work in, every listing is verified before it goes live, and we stay with you from the first site visit to registration and possession.",
    },
  });

  console.log("Creating team...");
  const password = await bcrypt.hash("admin123", 10);
  const admin = await db.user.create({ data: { name: "Aditya Sharma", email: "admin@estatedesk.com", password, role: "ADMIN", phone: "9820012345", monthlyTarget: 5000000 } });
  const manager = await db.user.create({ data: { name: "Neha Kapoor", email: "manager@estatedesk.com", password, role: "MANAGER", phone: "9820011111", monthlyTarget: 4000000 } });
  const agents = await Promise.all(
    [
      { name: "Rohan Mehta", email: "rohan@estatedesk.com", phone: "9820022222" },
      { name: "Priya Nair", email: "priya@estatedesk.com", phone: "9820033333" },
      { name: "Karan Malhotra", email: "karan@estatedesk.com", phone: "9820044444" },
    ].map((a) => db.user.create({ data: { ...a, password, role: "AGENT", monthlyTarget: 2500000 } })),
  );
  const team = [admin, manager, ...agents];
  const salesTeam = [manager, ...agents, ...agents];

  console.log("Creating properties...");
  const propertySpecs = [
    { title: "Sea-facing 3 BHK in Lodha Altamount", type: "APARTMENT", beds: 3, price: 42500000, area: 1650 },
    { title: "Premium 2 BHK near Metro", type: "APARTMENT", beds: 2, price: 14500000, area: 980 },
    { title: "Luxury 4 BHK Villa with Private Pool", type: "VILLA", beds: 4, price: 68000000, area: 4200 },
    { title: "Compact 1 BHK for Investment", type: "APARTMENT", beds: 1, price: 6200000, area: 560 },
    { title: "Grade A Office Space, 3200 sqft", type: "OFFICE", beds: null, price: 52000000, area: 3200 },
    { title: "Corner Plot in Gated Layout", type: "PLOT", beds: null, price: 9800000, area: 2400 },
    { title: "Spacious 3 BHK with Club Access", type: "APARTMENT", beds: 3, price: 18900000, area: 1420 },
    { title: "Penthouse with Terrace Garden", type: "PENTHOUSE", beds: 4, price: 85000000, area: 3800 },
    { title: "High Street Retail Shop", type: "SHOP", beds: null, price: 23500000, area: 650 },
    { title: "Independent House, East Facing", type: "INDEPENDENT_HOUSE", beds: 3, price: 21000000, area: 2100 },
    { title: "Ready to Move 2 BHK", type: "APARTMENT", beds: 2, price: 11200000, area: 890 },
    { title: "Furnished 2 BHK for Rent", type: "APARTMENT", beds: 2, price: 55000, area: 1050, rent: true },
    { title: "3 BHK Family Home for Rent", type: "APARTMENT", beds: 3, price: 85000, area: 1500, rent: true },
    { title: "Studio Apartment for Rent", type: "APARTMENT", beds: 1, price: 28000, area: 450, rent: true },
    { title: "Co-working Ready Office for Lease", type: "OFFICE", beds: null, price: 240000, area: 2800, rent: true },
    { title: "Garden Villa in Gated Community", type: "VILLA", beds: 4, price: 32500000, area: 3100 },
    { title: "Under Construction 2 BHK, Possession 2027", type: "APARTMENT", beds: 2, price: 9500000, area: 840 },
    { title: "Warehouse near Highway", type: "WAREHOUSE", beds: null, price: 36000000, area: 12000 },
  ];
  const statusPool = ["AVAILABLE", "AVAILABLE", "AVAILABLE", "AVAILABLE", "RESERVED", "SOLD"];
  const properties = [];
  for (let i = 0; i < propertySpecs.length; i++) {
    const s = propertySpecs[i];
    const loc = pick(LOCATIONS);
    const locality = pick(loc.localities);
    const img = [IMAGES[i % IMAGES.length], IMAGES[(i + 3) % IMAGES.length], IMAGES[(i + 7) % IMAGES.length]];
    const amenities = ["Parking", "Lift", "Power Backup", "Security", "Gym", "Swimming Pool", "Club House", "CCTV", "Garden", "Gated Community"].filter(() => rand() > 0.45);
    const p = await db.property.create({
      data: {
        code: `PR-${1001 + i}`,
        title: s.title,
        description: `Well-planned ${s.beds ? s.beds + " BHK " : ""}${s.type.toLowerCase().replace("_", " ")} located in ${locality}, ${loc.city}. Excellent connectivity to schools, hospitals and business districts. Clear title, ready documentation and flexible payment plans available.`,
        type: s.type,
        listingType: s.rent ? "RENT" : "SALE",
        status: s.rent ? pick(["AVAILABLE", "AVAILABLE", "RENTED"]) : pick(statusPool),
        price: s.price,
        area: s.area,
        bedrooms: s.beds,
        bathrooms: s.beds ? Math.max(1, s.beds - (rand() > 0.5 ? 0 : 1)) : null,
        furnishing: s.beds ? pick(["UNFURNISHED", "SEMI", "FULLY"]) : null,
        address: `${int(1, 120)}, ${pick(["Sunrise", "Palm", "Orchid", "Emerald", "Skyline", "Royal"])} ${pick(["Heights", "Residency", "Enclave", "Towers", "Gardens"])}`,
        locality,
        city: loc.city,
        amenities: amenities.join(", "),
        images: JSON.stringify(img),
        ownerName: `${pick(FIRST)} ${pick(LAST)}`,
        ownerPhone: `98${int(10000000, 99999999)}`,
        featured: i % 5 === 0,
        agentId: pick(salesTeam).id,
        createdAt: daysAgo(int(5, 150)),
      },
    });
    properties.push(p);
  }

  // --- Public website: publish most available listings with map coordinates (website / brochure module) ---
  // Deterministic (does not consume rand()) so the rest of the seed stays identical.
  const LOCALITY_COORDS: Record<string, [number, number]> = {
    "Andheri West": [19.1364, 72.8296], Powai: [19.1176, 72.906], "Bandra West": [19.0596, 72.8295], "Goregaon East": [19.1663, 72.8526],
    "Thane West": [19.2183, 72.9781], "Malad West": [19.1874, 72.8484], Baner: [18.559, 73.7868], Hinjewadi: [18.5913, 73.7389],
    Kharadi: [18.5515, 73.9348], Wakad: [18.5987, 73.7652], "Koregaon Park": [18.5362, 73.8939], Whitefield: [12.9698, 77.75],
    "HSR Layout": [12.9116, 77.6474], "Sarjapur Road": [12.9107, 77.6855], Hebbal: [13.0358, 77.597], "Electronic City": [12.8452, 77.6602],
  };
  let publishedCount = 0;
  for (const [i, p] of properties.entries()) {
    const base = p.locality ? LOCALITY_COORDS[p.locality] : undefined;
    const publish = (p.status === "AVAILABLE" || p.status === "RESERVED") && publishedCount < 12;
    if (publish) publishedCount++;
    await db.property.update({
      where: { id: p.id },
      data: {
        published: publish,
        latitude: base ? Number((base[0] + ((i % 5) - 2) * 0.0021).toFixed(6)) : null,
        longitude: base ? Number((base[1] + ((i % 3) - 1) * 0.0027).toFixed(6)) : null,
      },
    });
  }
  console.log(`Published ${publishedCount} properties on the website.`);

  console.log("Creating leads...");
  const statusWeights = ["NEW", "NEW", "NEW", "CONTACTED", "CONTACTED", "CONTACTED", "QUALIFIED", "QUALIFIED", "SITE_VISIT", "SITE_VISIT", "NEGOTIATION", "WON", "WON", "LOST", "LOST"];
  const notesPool = [
    "Looking for a ready-to-move property near schools.",
    "Prefers higher floor with good ventilation.",
    "NRI client, decision with family over video call.",
    "Needs home loan assistance, pre-approved with HDFC.",
    "Wants east-facing unit, Vastu compliant.",
    "Upgrading from 2 BHK, flexible on location.",
    "Investor, interested in rental yield above 3%.",
    "Relocating for work, needs possession within 2 months.",
  ];
  const leads = [];
  for (let i = 0; i < 72; i++) {
    const name = `${pick(FIRST)} ${pick(LAST)}`;
    const status = pick(statusWeights);
    const purpose = rand() > 0.8 ? "RENT" : rand() > 0.85 ? "INVEST" : "BUY";
    const budget = purpose === "RENT" ? int(2, 12) * 10000 : int(6, 90) * 1000000;
    const loc = pick(LOCATIONS);
    const created = daysAgo(int(0, 170));
    const agent = pick(salesTeam);
    const ptype = pick(["APARTMENT", "APARTMENT", "APARTMENT", "VILLA", "PLOT", "OFFICE", "INDEPENDENT_HOUSE"]);
    const lead = await db.lead.create({
      data: {
        name,
        phone: `9${int(100000000, 999999999)}`,
        email: rand() > 0.25 ? `${name.toLowerCase().replace(/\s+/g, ".")}${int(1, 99)}@gmail.com` : null,
        source: pick(SOURCES),
        status,
        priority: status === "NEGOTIATION" || status === "SITE_VISIT" ? "HOT" : pick(["HOT", "WARM", "WARM", "COLD"]),
        purpose,
        propertyType: ptype,
        preferredLocation: `${pick(loc.localities)}, ${loc.city}`,
        bedrooms: ["PLOT", "OFFICE"].includes(ptype) ? null : pick([1, 2, 2, 3, 3, 4, null]),
        budgetMin: Math.round(budget * 0.8),
        budgetMax: budget,
        notes: pick(notesPool),
        tags: [rand() > 0.7 ? "NRI" : "", rand() > 0.7 ? "Home Loan" : "", rand() > 0.8 ? "Investor" : "", rand() > 0.8 ? "Urgent" : ""].filter(Boolean).join(", "),
        lostReason: status === "LOST" ? pick(["Budget mismatch", "Bought elsewhere", "Not responding", "Location not suitable", "Postponed plan"]) : null,
        assignedToId: rand() > 0.06 ? agent.id : null,
        createdById: admin.id,
        lastContactedAt: status === "NEW" ? null : daysAgo(int(0, 14)),
        createdAt: created,
        updatedAt: created,
      },
    });
    leads.push(lead);

    await db.activity.create({ data: { type: "CREATED", content: `Lead created from ${lead.source.replace(/_/g, " ").toLowerCase()}`, leadId: lead.id, userId: admin.id, createdAt: created } });
    if (status !== "NEW") {
      await db.activity.create({ data: { type: "CALL", content: pick(["Discussed requirements over call. Client is keen.", "Introductory call done, shared brochure.", "Client asked for options under budget."]), leadId: lead.id, userId: agent.id, createdAt: daysAgo(int(1, 20)) } });
      await db.activity.create({ data: { type: "STATUS", content: `Status changed to ${status.replace("_", " ").toLowerCase()}`, leadId: lead.id, userId: agent.id, createdAt: daysAgo(int(0, 10)) } });
    }

    // shortlist 1-3 properties
    if (status !== "NEW" && rand() > 0.3) {
      const shortlisted = new Set<string>();
      for (let k = 0; k < int(1, 3); k++) shortlisted.add(pick(properties).id);
      for (const pid of shortlisted) await db.leadProperty.create({ data: { leadId: lead.id, propertyId: pid } });
    }
  }

  console.log("Creating follow-ups...");
  const fuTitles: Record<string, string[]> = {
    CALL: ["Follow-up call on shortlisted options", "Check loan eligibility status", "Discuss revised budget", "Call to confirm site visit"],
    MEETING: ["Meeting at office for price discussion", "Meet with family to finalise"],
    SITE_VISIT: ["Site visit with family", "Show sample flat", "Second site visit"],
    WHATSAPP: ["Send new listings on WhatsApp", "Share floor plans and brochure"],
    EMAIL: ["Email cost sheet and payment plan"],
  };
  for (const lead of leads) {
    if (lead.status === "LOST") continue;
    const n = lead.status === "WON" ? 1 : int(1, 3);
    for (let k = 0; k < n; k++) {
      const type = pick(["CALL", "CALL", "CALL", "SITE_VISIT", "MEETING", "WHATSAPP", "EMAIL"]);
      const bucket = rand();
      let dueAt: Date;
      let status = "PENDING";
      if (lead.status === "WON" || bucket < 0.35) {
        dueAt = daysAgo(int(1, 40));
        status = rand() > 0.12 ? "COMPLETED" : "PENDING";
      } else if (bucket < 0.55) dueAt = todayAt(int(9, 20));
      else dueAt = daysAhead(int(1, 21));
      await db.followUp.create({
        data: {
          title: pick(fuTitles[type]),
          type,
          dueAt,
          status,
          priority: lead.priority === "HOT" ? "HIGH" : pick(["MEDIUM", "MEDIUM", "LOW"]),
          notes: rand() > 0.5 ? "Carry printed cost sheet and floor plans." : null,
          outcome: status === "COMPLETED" ? pick(["Interested", "Call back later", "Site visit done", "Documents shared"]) : null,
          completedAt: status === "COMPLETED" ? dueAt : null,
          leadId: lead.id,
          propertyId: type === "SITE_VISIT" ? pick(properties).id : null,
          assignedToId: lead.assignedToId ?? admin.id,
        },
      });
    }
  }

  console.log("Creating deals...");
  const dealLeads = leads.filter((l) => ["NEGOTIATION", "WON", "SITE_VISIT"].includes(l.status));
  for (const lead of dealLeads) {
    if (lead.status === "SITE_VISIT" && rand() > 0.35) continue;
    const prop = pick(properties.filter((p) => p.listingType === (lead.purpose === "RENT" ? "RENT" : "SALE")));
    const stage = lead.status === "WON" ? "WON" : pick(["NEGOTIATION", "NEGOTIATION", "TOKEN", "AGREEMENT"]);
    const closedAt = stage === "WON" ? daysAgo(int(1, 160)) : null;
    const value = Math.round(prop.price * (0.93 + rand() * 0.06));
    const deal = await db.deal.create({
      data: {
        title: `${lead.name.split(" ")[0]} - ${prop.title}`,
        value,
        commissionPct: prop.listingType === "RENT" ? 50 / 12 : pick([1, 1.5, 2, 2]),
        stage,
        expectedCloseDate: stage === "WON" ? closedAt : daysAhead(int(5, 60)),
        closedAt,
        leadId: lead.id,
        propertyId: prop.id,
        agentId: lead.assignedToId ?? admin.id,
        notes: "Negotiation on parking and floor rise charges.",
        createdAt: closedAt ? new Date(closedAt.getTime() - 20 * 86400000) : daysAgo(int(2, 30)),
      },
    });
    await db.activity.create({ data: { type: "DEAL", content: `Deal created: ${deal.title}`, leadId: lead.id, dealId: deal.id, userId: deal.agentId, createdAt: deal.createdAt } });
  }

  console.log("Creating WhatsApp templates...");
  const templates: { name: string; category: string; body: string; metaName?: string; metaLanguage?: string; metaParams?: string }[] = [
    { name: "Welcome / First Contact", category: "GREETING", body: "Hi {{name}}, thank you for your enquiry with {{company}}. I am {{agent}}, your property advisor. Could you share a convenient time to discuss your requirements?" },
    { name: "Share Property Details", category: "PROPERTY", body: "Hi {{name}}, here is a property that matches your requirement:\n\n{{property}}\nLocation: {{location}}\nPrice: {{price}}\n\nWould you like to schedule a site visit this week?", metaName: "property_followup", metaLanguage: "en", metaParams: "name,property,location,price" },
    { name: "Site Visit Confirmation", category: "SITE_VISIT", body: "Hi {{name}}, your site visit for {{property}} is confirmed on {{date}}. Location: {{location}}. I will be there to receive you. - {{agent}}, {{company}}", metaName: "site_visit_confirmation", metaLanguage: "en", metaParams: "name,property,date,location,agent,company" },
    { name: "Gentle Follow-up", category: "FOLLOW_UP", body: "Hi {{name}}, just checking in on your property search. We have a few new listings that fit your budget. Shall I share them?" },
    { name: "Post Site Visit Feedback", category: "FOLLOW_UP", body: "Hi {{name}}, thank you for visiting {{property}} today. How did you like it? Happy to answer any questions on pricing or payment plans." },
    { name: "Payment Reminder", category: "PAYMENT", body: "Dear {{name}}, this is a gentle reminder regarding the upcoming payment for {{property}}. Please reach out if you need any assistance. - {{company}}" },
    { name: "Festive Greetings", category: "FESTIVE", body: "Dear {{name}}, warm wishes to you and your family from all of us at {{company}}. May this festive season bring happiness and new beginnings!" },
  ];
  for (const t of templates) await db.whatsAppTemplate.create({ data: t });

  console.log("Creating WhatsApp message log...");
  for (let i = 0; i < 26; i++) {
    const lead = pick(leads);
    await db.whatsAppMessage.create({
      data: {
        phone: lead.phone,
        body: pick(templates).body.replace(/\{\{name\}\}/g, lead.name.split(" ")[0]).replace(/\{\{company\}\}/g, "Skyline Realty").replace(/\{\{agent\}\}/g, "Rohan").replace(/\{\{\w+\}\}/g, "-"),
        direction: "OUT",
        channel: "LINK",
        status: "SENT",
        leadId: lead.id,
        userId: pick(team).id,
        createdAt: daysAgo(int(0, 30)),
      },
    });
  }

  console.log("Creating WhatsApp conversations...");
  const conversations: { reply: string; replyAgoMin: number; ourText: string; unread: number }[] = [
    { ourText: "Hi {first}, thank you for your enquiry with Skyline Realty. Could you share a convenient time to discuss your requirements?", reply: "Hi, evening after 6 works. Can you share 2 BHK options near metro?", replyAgoMin: 25, unread: 2 },
    { ourText: "Hi {first}, here is a property that matches your requirement. Would you like to schedule a site visit this week?", reply: "Yes, Saturday 11 AM is good for us. Please send the location.", replyAgoMin: 180, unread: 1 },
    { ourText: "Hi {first}, just checking in on your property search. Shall I share new listings?", reply: "Not right now, will get back next month.", replyAgoMin: 60 * 30, unread: 0 },
    { ourText: "Hi {first}, thank you for visiting the site today. How did you like it?", reply: "Liked it. What is the final price with parking?", replyAgoMin: 60 * 50, unread: 0 },
  ];
  const convLeads = leads.filter((l) => !["LOST", "WON"].includes(l.status)).slice(0, conversations.length);
  for (let i = 0; i < convLeads.length; i++) {
    const lead = convLeads[i];
    const c = conversations[i];
    const first = lead.name.split(" ")[0];
    const replyAt = new Date(Date.now() - c.replyAgoMin * 60000);
    const sentAt = new Date(replyAt.getTime() - 40 * 60000);
    await db.whatsAppMessage.create({
      data: { phone: lead.phone, body: c.ourText.replace("{first}", first), direction: "OUT", channel: "API", status: "READ", waMessageId: `wamid.seed.out.${i}`, leadId: lead.id, userId: lead.assignedToId ?? admin.id, createdAt: sentAt },
    });
    await db.whatsAppMessage.create({
      data: { phone: lead.phone, body: c.reply, direction: "IN", channel: "API", status: "RECEIVED", waMessageId: `wamid.seed.in.${i}`, leadId: lead.id, createdAt: replyAt },
    });
    if (i === 0) {
      await db.whatsAppMessage.create({
        data: { phone: lead.phone, body: "Also, is home loan assistance available?", direction: "IN", channel: "API", status: "RECEIVED", waMessageId: `wamid.seed.in.extra`, leadId: lead.id, createdAt: new Date(replyAt.getTime() + 2 * 60000) },
      });
    }
    await db.lead.update({ where: { id: lead.id }, data: { lastInboundAt: replyAt, unreadMessages: c.unread } });
    await db.activity.create({ data: { type: "WHATSAPP", content: `Received: ${c.reply}`, leadId: lead.id, createdAt: replyAt } });
  }

  // ---- Documents and integration log (documents + portal integrations module) ----
  console.log("Creating documents and integration log...");
  await db.integrationLog.deleteMany();
  await db.document.deleteMany();
  {
    const { mkdirSync, rmSync, writeFileSync } = await import("fs");
    const pathMod = await import("path");
    // Placeholder files are only written for local development storage; with Supabase configured,
    // documents are uploaded from the app so the seed skips them.
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      // all Document rows were just wiped, so local files are orphans
      rmSync(pathMod.join(process.cwd(), ".data", "documents"), { recursive: true, force: true });
      const pdfFor = (title: string) =>
        Buffer.from(
          `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n4 0 obj<</Length ${44 + title.length}>>stream\nBT /F1 20 Tf 72 760 Td (${title}) Tj ET\nendstream endobj\n5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n`,
        );
      const docLeads = leads.filter((l) => ["NEGOTIATION", "WON", "SITE_VISIT"].includes(l.status)).slice(0, 4);
      const specs: [string, string, boolean][] = [
        ["PAN Card", "KYC_PAN", false],
        ["Aadhaar Card", "KYC_AADHAAR", false],
        ["Allotment Letter", "ALLOTMENT_LETTER", true],
        ["Agreement for Sale (Draft)", "AGREEMENT", true],
      ];
      let n = 0;
      for (const lead of docLeads) {
        const count = lead.status === "WON" ? 4 : 2;
        for (const [name, category, shared] of specs.slice(0, count)) {
          const storagePath = `leads/${lead.id}/seed-${++n}.pdf`;
          const abs = pathMod.join(process.cwd(), ".data", "documents", storagePath);
          mkdirSync(pathMod.dirname(abs), { recursive: true });
          const bytes = pdfFor(`${name} - ${lead.name}`);
          writeFileSync(abs, bytes);
          await db.document.create({
            data: { name: `${name} - ${lead.name}`, category, storagePath, mimeType: "application/pdf", size: bytes.length, visibleToCustomer: shared, leadId: lead.id, uploadedById: lead.assignedToId ?? admin.id, createdAt: daysAgo(int(1, 20)) },
          });
        }
      }
    }
    const portalLeads = leads.filter((l) => ["FACEBOOK", "INSTAGRAM", "PORTAL_99ACRES", "PORTAL_MAGICBRICKS", "PORTAL_HOUSING"].includes(l.source)).slice(0, 10);
    const logSource: Record<string, string> = { FACEBOOK: "FACEBOOK", INSTAGRAM: "INSTAGRAM", PORTAL_99ACRES: "99ACRES", PORTAL_MAGICBRICKS: "MAGICBRICKS", PORTAL_HOUSING: "HOUSING" };
    for (const l of portalLeads) {
      await db.integrationLog.create({ data: { source: logSource[l.source], status: "OK", message: `New lead ${l.name} (${l.phone})`, leadId: l.id, createdAt: daysAgo(int(0, 6)) } });
    }
    await db.integrationLog.create({ data: { source: "HOUSING", status: "ERROR", message: "Missing or invalid phone number", payload: '{"name":"Unknown","phone":""}', createdAt: daysAgo(2) } });
    await db.integrationLog.create({ data: { source: "FACEBOOK", status: "IGNORED", message: "Ignored event: feed", createdAt: daysAgo(3) } });
  }


  console.log("Creating calls, attendance and site visits...");
  {
    const OFFICE = { lat: 19.066, lng: 72.8686 }; // BKC, Mumbai
    await db.settings.update({
      where: { id: 1 },
      data: { officeLatitude: OFFICE.lat, officeLongitude: OFFICE.lng, officeRadiusM: 300, telephonyWebhookKey: randomBytes(16).toString("hex") },
    });

    // Approximate coordinates for properties so site check-in distance works
    const CITY_CENTER: Record<string, { lat: number; lng: number }> = {
      Mumbai: { lat: 19.076, lng: 72.8777 },
      Pune: { lat: 18.5204, lng: 73.8567 },
      Bengaluru: { lat: 12.9716, lng: 77.5946 },
    };
    const props = await db.property.findMany({ select: { id: true, city: true, latitude: true } });
    for (const p of props) {
      if (p.latitude !== null) continue;
      const c = CITY_CENTER[p.city] ?? CITY_CENTER.Mumbai;
      await db.property.update({ where: { id: p.id }, data: { latitude: c.lat + (rand() - 0.5) * 0.12, longitude: c.lng + (rand() - 0.5) * 0.12 } });
    }

    const SAMPLE_RECORDINGS = [
      "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
      "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
    ];
    const callLeads = leads.filter((l) => l.status !== "NEW" && l.assignedToId);
    const outcomes = ["Interested", "Call back later", "Site visit fixed", "Negotiating", "Not reachable", "Switched off"];
    for (let i = 0; i < 32; i++) {
      const lead = pick(callLeads);
      const agentId = lead.assignedToId!;
      const agentUser = team.find((u) => u.id === agentId);
      const direction = rand() > 0.78 ? "IN" : "OUT";
      const r = rand();
      const status = r < 0.62 ? "ANSWERED" : direction === "IN" ? "MISSED" : r < 0.82 ? "NO_ANSWER" : "BUSY";
      const durationSec = status === "ANSWERED" ? int(35, 900) : 0;
      const startedAt = i < 5 ? new Date(Date.now() - int(10, 300) * 60000) : daysAgo(int(1, 20));
      await db.callLog.create({
        data: {
          direction,
          status,
          provider: "MANUAL",
          fromNumber: direction === "OUT" ? agentUser?.phone ?? null : lead.phone,
          toNumber: direction === "OUT" ? lead.phone : agentUser?.phone ?? null,
          durationSec,
          recordingUrl: status === "ANSWERED" && rand() > 0.55 ? pick(SAMPLE_RECORDINGS) : null,
          outcome: status === "ANSWERED" ? pick(outcomes) : null,
          notes: status === "ANSWERED" && rand() > 0.5 ? "Discussed pricing and payment plan. Shared brochure on WhatsApp." : null,
          leadId: lead.id,
          userId: agentId,
          startedAt,
          endedAt: new Date(startedAt.getTime() + durationSec * 1000),
        },
      });
    }

    // Attendance: last 12 days for manager + agents (Sundays off, a few absences, some late)
    const staff = [manager, ...agents];
    for (let d = 12; d >= 1; d--) {
      const day = new Date();
      day.setDate(day.getDate() - d);
      if (day.getDay() === 0) continue;
      const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
      for (const u of staff) {
        if (rand() < 0.08) continue; // absent
        const inAt = new Date(day);
        inAt.setHours(9, 0, 0, 0);
        inAt.setMinutes(int(10, rand() < 0.2 ? 95 : 58)); // 9:10 - 10:35
        const outAt = new Date(inAt.getTime() + int(8 * 60, 10 * 60) * 60000);
        const far = rand() < 0.15;
        const lat = OFFICE.lat + (far ? 0.02 : (rand() - 0.5) * 0.002);
        const lng = OFFICE.lng + (far ? 0.015 : (rand() - 0.5) * 0.002);
        const dLat = ((lat - OFFICE.lat) * Math.PI) / 180;
        const dLng = ((lng - OFFICE.lng) * Math.PI) / 180;
        const a = Math.sin(dLat / 2) ** 2 + Math.cos((OFFICE.lat * Math.PI) / 180) * Math.cos((lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
        const dist = 2 * 6371000 * Math.asin(Math.sqrt(a));
        await db.attendance.create({
          data: { userId: u.id, date: key, checkInAt: inAt, checkInLat: lat, checkInLng: lng, checkInAccuracy: int(8, 40), checkInDistanceM: dist, checkOutAt: outAt, checkOutLat: lat, checkOutLng: lng, checkOutDistanceM: dist },
        });
      }
    }

    // Site visit check-ins on completed site visit follow-ups
    const visits = await db.followUp.findMany({ where: { type: "SITE_VISIT", status: "COMPLETED", propertyId: { not: null } }, take: 8, include: { property: true } });
    for (const v of visits) {
      const p = v.property!;
      const lat = (p.latitude ?? OFFICE.lat) + (rand() - 0.5) * 0.0015;
      const lng = (p.longitude ?? OFFICE.lng) + (rand() - 0.5) * 0.0015;
      const dLat = ((lat - (p.latitude ?? lat)) * Math.PI) / 180;
      const dLng = ((lng - (p.longitude ?? lng)) * Math.PI) / 180;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat * Math.PI) / 180) ** 2 * Math.sin(dLng / 2) ** 2;
      const dist = p.latitude !== null ? 2 * 6371000 * Math.asin(Math.sqrt(a)) : null;
      const at = v.completedAt ?? v.dueAt;
      await db.siteVisitCheckIn.create({
        data: { leadId: v.leadId, propertyId: p.id, followUpId: v.id, userId: v.assignedToId, latitude: lat, longitude: lng, accuracy: int(5, 25), distanceM: dist, notes: "Family visited the sample flat. Liked the layout.", createdAt: at },
      });
      await db.activity.create({ data: { type: "SITE_VISIT", content: `Checked in at ${p.title}${dist !== null ? ` (${Math.round(dist)} m from the property location)` : ""}`, leadId: v.leadId, propertyId: p.id, userId: v.assignedToId, createdAt: at } });
    }
  }

  // ---------------------------------------------------------------- bookings & payments
  console.log("Creating bookings and payment schedules...");
  {
    const { buildPlan } = await import("../src/lib/payment-plan");
    await db.portalAccess.deleteMany();
    await db.booking.deleteMany();
    const wonDeals = await db.deal.findMany({
      where: { stage: "WON", property: { listingType: "SALE" } },
      include: { property: true, lead: true },
      orderBy: { closedAt: "desc" },
      take: 4,
    });
    const methods = ["UPI", "NEFT", "RTGS", "CHEQUE", "HOME_LOAN"];
    let receiptNo = 1001;
    const year = new Date().getFullYear();
    for (let n = 0; n < wonDeals.length; n++) {
      const d = wonDeals[n];
      // Spread booking dates so schedules are at different stages
      const bookedAt = new Date();
      bookedAt.setDate(bookedAt.getDate() - [210, 130, 75, 25][n]);
      bookedAt.setHours(0, 0, 0, 0);
      const total = Math.round(d.value);
      const plan = buildPlan(n === 2 ? "DOWN_PAYMENT" : "CONSTRUCTION_LINKED", total, bookedAt, { tokenAmount: total > 20000000 ? 200000 : 100000, possessionMonths: 10 });
      const booking = await db.booking.create({
        data: {
          bookingNo: `BK-${year}-${String(n + 1).padStart(4, "0")}`,
          dealId: d.id,
          leadId: d.leadId,
          propertyId: d.propertyId,
          unitNumber: `${["A", "B", "C", "D"][n]}-${1 + n}0${2 + n}`,
          bookingDate: bookedAt,
          agreementDate: new Date(bookedAt.getTime() + 30 * 86400000),
          totalAmount: total,
          notes: n === 1 ? "Covered parking included. Floor rise waived as a goodwill gesture." : null,
          createdById: d.agentId,
          installments: { create: plan.map((r, i) => ({ label: r.label, dueDate: r.dueDate, amount: r.amount, sortOrder: i })) },
        },
        include: { installments: { orderBy: { sortOrder: "asc" } } },
      });
      await db.property.update({ where: { id: d.propertyId! }, data: { status: "SOLD" } });

      const now = Date.now();
      const pastDue = booking.installments.filter((i) => i.dueDate.getTime() < now);
      for (let k = 0; k < pastDue.length; k++) {
        const inst = pastDue[k];
        const isLast = k === pastDue.length - 1;
        // Booking #2: latest past-due installment left unpaid (overdue). Booking #3: latest one part-paid.
        if (n === 1 && isLast && k > 0) continue;
        const partial = n === 2 && isLast && k > 0;
        const paid = partial ? Math.round(inst.amount * 0.4) : inst.amount;
        const baseDate = new Date(inst.dueDate.getTime() + int(0, 4) * 86400000);
        const clamp = (d: Date) => (d.getTime() > now ? new Date(now - 3600000) : d);
        const refFor = (m: string) => (m === "CHEQUE" ? `00${int(1000, 9999)} HDFC Bank` : m === "UPI" ? `UPI${int(100000000, 999999999)}` : `UTR${int(1000000000, 9999999999)}`);
        const method = k === 0 ? "UPI" : methods[(k + n) % methods.length];

        // Each amount received is its own receipt. Demo cases:
        //  - booking 1, 2nd installment: paid in two parts (two receipts)
        //  - booking 2, 2nd installment: first cheque bounced (cancelled receipt), then paid by NEFT
        const parts: { amount: number; method: string; at: Date; cancel?: string }[] =
          n === 0 && k === 1
            ? [
                { amount: Math.round(paid * 0.6), method: "NEFT", at: baseDate },
                { amount: paid - Math.round(paid * 0.6), method: "UPI", at: new Date(baseDate.getTime() + 6 * 86400000) },
              ]
            : n === 1 && k === 1
              ? [
                  { amount: paid, method: "CHEQUE", at: baseDate, cancel: "Cheque bounced - insufficient funds" },
                  { amount: paid, method: "NEFT", at: new Date(baseDate.getTime() + 5 * 86400000) },
                ]
              : [{ amount: paid, method, at: baseDate }];

        let received = 0;
        let lastAt: Date | null = null;
        for (const part of parts) {
          const at = clamp(part.at);
          const no = `RCPT-${receiptNo++}`;
          await db.payment.create({
            data: {
              receiptNo: no,
              bookingId: booking.id,
              installmentId: inst.id,
              amount: part.amount,
              paidAt: at,
              method: part.method,
              reference: refFor(part.method),
              recordedById: d.agentId,
              ...(part.cancel ? { status: "CANCELLED", cancelledAt: clamp(new Date(at.getTime() + 3 * 86400000)), cancelReason: part.cancel, cancelledById: d.agentId } : {}),
            },
          });
          await db.activity.create({
            data: {
              type: "PAYMENT",
              content: `Payment received Rs. ${part.amount.toLocaleString("en-IN")} for ${inst.label} - ${booking.bookingNo} (Receipt ${no})`,
              leadId: d.leadId,
              userId: d.agentId,
              createdAt: at,
            },
          });
          if (part.cancel) {
            await db.activity.create({
              data: {
                type: "PAYMENT",
                content: `Receipt ${no} for Rs. ${part.amount.toLocaleString("en-IN")} (${inst.label} - ${booking.bookingNo}) cancelled: ${part.cancel}`,
                leadId: d.leadId,
                userId: d.agentId,
                createdAt: clamp(new Date(at.getTime() + 3 * 86400000)),
              },
            });
          } else {
            received += part.amount;
            lastAt = at;
          }
        }
        await db.paymentInstallment.update({
          where: { id: inst.id },
          data: { paidAmount: received, status: received >= inst.amount ? "PAID" : received > 0 ? "PARTIAL" : "PENDING", paidAt: lastAt },
        });
      }
      await db.activity.create({
        data: { type: "PAYMENT", content: `Booking ${booking.bookingNo} created for Rs. ${total.toLocaleString("en-IN")} with ${plan.length} installments`, leadId: d.leadId, userId: d.agentId, createdAt: bookedAt },
      });
      if (n === 0) {
        await db.portalAccess.create({ data: { leadId: d.leadId, token: "demo-portal-token-123456", lastViewedAt: new Date(now - 2 * 86400000) } });
      }
    }
    await db.settings.update({ where: { id: 1 }, data: { nextReceiptNo: receiptNo } });
    console.log(`  ${wonDeals.length} bookings, ${receiptNo - 1001} receipts. Demo customer portal: /portal/demo-portal-token-123456`);
  }

  console.log("\nDone. Sign in with:");
  console.log("  Admin   -> admin@estatedesk.com / admin123");
  console.log("  Manager -> manager@estatedesk.com / admin123");
  console.log("  Agent   -> rohan@estatedesk.com / admin123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
