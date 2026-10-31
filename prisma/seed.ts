/* Demo data so the CRM looks alive on first run. Run with: npm run db:seed */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

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
  const templates = [
    { name: "Welcome / First Contact", category: "GREETING", body: "Hi {{name}}, thank you for your enquiry with {{company}}. I am {{agent}}, your property advisor. Could you share a convenient time to discuss your requirements?" },
    { name: "Share Property Details", category: "PROPERTY", body: "Hi {{name}}, here is a property that matches your requirement:\n\n{{property}}\nLocation: {{location}}\nPrice: {{price}}\n\nWould you like to schedule a site visit this week?" },
    { name: "Site Visit Confirmation", category: "SITE_VISIT", body: "Hi {{name}}, your site visit for {{property}} is confirmed on {{date}}. Location: {{location}}. I will be there to receive you. - {{agent}}, {{company}}" },
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
