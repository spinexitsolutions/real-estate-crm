import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Bath,
  BedDouble,
  Building2,
  CalendarDays,
  Check,
  Handshake,
  Layers,
  MapPin,
  Maximize,
  Phone,
  Sparkles,
  Star,
  User,
  Users,
  Activity as ActivityIcon,
  Sofa,
} from "lucide-react";
import { requireUser, leadScope, isManager } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import {
  DEAL_STAGES,
  FURNISHING,
  LEAD_STATUSES,
  LISTING_TYPES,
  OPEN_LEAD_STATUSES,
  PRIORITIES,
  PROPERTY_TYPES,
  labelOf,
} from "@/lib/constants";
import { formatBudget, formatCompact, formatCurrency, formatDate, formatRelative } from "@/lib/format";
import { parseImages, splitList } from "@/lib/utils";
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { Badge, OptionBadge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { ImageGallery, PropertyMoreMenu, PropertyShareButtons, PropertyStatusMenu } from "@/components/properties/property-actions";
import { ShortlistButton } from "@/components/properties/shortlist-button";
import { BrochureActions, PublishToggle } from "@/components/properties/brochure-actions";
import { brochureUrl, originFrom } from "@/lib/brochure-link";
import { headers } from "next/headers";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await db.property.findUnique({ where: { id }, select: { title: true } });
  return { title: p?.title ?? "Property" };
}

export default async function PropertyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const settings = await getSettings();
  const currency = settings.currency;

  const property = await db.property.findUnique({
    where: { id },
    include: {
      agent: { select: { id: true, name: true, phone: true, email: true } },
      interests: {
        where: { lead: leadScope(user) },
        orderBy: { createdAt: "desc" },
        include: { lead: { include: { assignedTo: { select: { name: true } } } } },
      },
      deals: {
        where: user.role === "AGENT" ? { agentId: user.id } : {},
        orderBy: { createdAt: "desc" },
        include: { lead: { select: { id: true, name: true } }, agent: { select: { name: true } } },
      },
      activities: { orderBy: { createdAt: "desc" }, take: 15, include: { user: { select: { name: true } } } },
    },
  });
  if (!property) notFound();

  const images = parseImages(property.images);
  const amenities = splitList(property.amenities);
  const location = [property.locality, property.city].filter(Boolean).join(", ");
  const interestedIds = new Set(property.interests.map((i) => i.leadId));

  // Matching leads: open leads whose requirements roughly fit this property
  const purposes = property.listingType === "RENT" ? ["RENT"] : ["BUY", "INVEST"];
  const candidates = await db.lead.findMany({
    where: {
      ...leadScope(user),
      status: { in: OPEN_LEAD_STATUSES },
      purpose: { in: purposes },
      id: { notIn: [...interestedIds] },
      OR: [{ budgetMax: null }, { budgetMax: { gte: property.price * 0.85 } }],
      AND: [
        { OR: [{ budgetMin: null }, { budgetMin: { lte: property.price * 1.15 } }] },
        { OR: [{ propertyType: null }, { propertyType: property.type }] },
      ],
    },
    take: 60,
    orderBy: { updatedAt: "desc" },
  });
  const loc = [property.city, property.locality].filter(Boolean).map((s) => s!.toLowerCase());
  const matches = candidates
    .map((l) => {
      let score = 40;
      const pref = (l.preferredLocation ?? "").toLowerCase();
      if (property.locality && pref.includes(property.locality.toLowerCase())) score += 30;
      else if (pref.includes(property.city.toLowerCase())) score += 15;
      else if (pref && !loc.some((x) => pref.includes(x))) score -= 15;
      if (l.bedrooms && property.bedrooms) score += l.bedrooms === property.bedrooms ? 15 : Math.abs(l.bedrooms - property.bedrooms) === 1 ? 0 : -20;
      if (l.budgetMax && l.budgetMax >= property.price) score += 10;
      if (l.priority === "HOT") score += 5;
      return { lead: l, score: Math.max(0, Math.min(100, score)) };
    })
    .filter((m) => m.score >= 40)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  const shareText = [
    `*${property.title}*`,
    `${labelOf(PROPERTY_TYPES, property.type)} ${labelOf(LISTING_TYPES, property.listingType).toLowerCase()}`,
    `Location: ${location}`,
    `Price: ${formatCurrency(property.price, currency)}${property.listingType === "RENT" ? " per month" : ""}`,
    property.bedrooms ? `Configuration: ${property.bedrooms} BHK${property.bathrooms ? `, ${property.bathrooms} Bath` : ""}` : null,
    property.area ? `Area: ${property.area.toLocaleString("en-IN")} ${property.areaUnit}` : null,
    amenities.length ? `Amenities: ${amenities.slice(0, 6).join(", ")}` : null,
    `Ref: ${property.code}`,
    "",
    `${settings.companyName}${settings.companyPhone ? ` | ${settings.companyPhone}` : ""}`,
  ]
    .filter((x) => x !== null)
    .join("\n");

  const origin = originFrom(await headers());
  const publicBrochure = brochureUrl(property.id, origin);

  const canDelete = isManager(user) || property.agentId === user.id;
  const specs = [
    { icon: Building2, label: "Type", value: labelOf(PROPERTY_TYPES, property.type) },
    property.bedrooms !== null && { icon: BedDouble, label: "Bedrooms", value: `${property.bedrooms} BHK` },
    property.bathrooms !== null && { icon: Bath, label: "Bathrooms", value: String(property.bathrooms) },
    property.area && { icon: Maximize, label: "Area", value: `${property.area.toLocaleString("en-IN")} ${property.areaUnit}` },
    property.furnishing && { icon: Sofa, label: "Furnishing", value: labelOf(FURNISHING, property.furnishing) },
    property.area &&
      property.listingType === "SALE" && { icon: Layers, label: `Rate per ${property.areaUnit}`, value: formatCurrency(Math.round(property.price / property.area), currency) },
    { icon: CalendarDays, label: "Listed on", value: formatDate(property.createdAt) },
  ].filter(Boolean) as { icon: typeof Building2; label: string; value: string }[];

  return (
    <>
      <Link href="/properties" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="size-4" /> All properties
      </Link>

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{property.code}</Badge>
            <OptionBadge list={LISTING_TYPES} value={property.listingType} />
            {property.featured && (
              <Badge className="bg-amber-50 text-amber-700 ring-amber-600/20">
                <Star className="size-3 fill-current" /> Featured
              </Badge>
            )}
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{property.title}</h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
            <MapPin className="size-4" />
            {[property.address, location].filter(Boolean).join(", ")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PropertyStatusMenu id={property.id} status={property.status} />
          <PublishToggle id={property.id} published={property.published} siteUrl={`/site?to=/properties/${property.id}`} />
          <BrochureActions propertyId={property.id} title={property.title} publicUrl={publicBrochure} shareText={shareText} />
          <PropertyShareButtons text={shareText} />
          <PropertyMoreMenu id={property.id} featured={property.featured} canDelete={canDelete} />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-6">
          <Card className="p-4">
            {images.length > 0 ? (
              <ImageGallery images={images} title={property.title} />
            ) : (
              <div className="flex aspect-[16/7] flex-col items-center justify-center rounded-xl bg-slate-50 text-slate-400">
                <Building2 className="size-10" />
                <p className="mt-2 text-sm">No photos added</p>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Overview" />
            <div className="grid gap-px overflow-hidden bg-slate-100 sm:grid-cols-2 lg:grid-cols-4">
              {specs.map((s) => (
                <div key={s.label} className="flex items-center gap-3 bg-white p-4">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-500">
                    <s.icon className="size-[18px]" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs text-slate-500">{s.label}</p>
                    <p className="truncate text-sm font-medium text-slate-900">{s.value}</p>
                  </div>
                </div>
              ))}
            </div>
            {property.description && (
              <div className="border-t border-slate-100 p-5">
                <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">{property.description}</p>
              </div>
            )}
            {amenities.length > 0 && (
              <div className="border-t border-slate-100 p-5">
                <p className="mb-3 text-sm font-medium text-slate-900">Amenities</p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {amenities.map((a) => (
                    <span key={a} className="flex items-center gap-2 text-sm text-slate-600">
                      <span className="flex size-5 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                        <Check className="size-3" />
                      </span>
                      {a}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <Sparkles className="size-4 text-brand-600" /> Matching leads
                </span>
              }
              description="Open leads whose budget, type and location fit this property."
            />
            {matches.length === 0 ? (
              <EmptyState icon={Sparkles} title="No matching leads right now" description="As new enquiries come in, suitable buyers will appear here." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {matches.map(({ lead, score }) => (
                  <li key={lead.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                    <Avatar name={lead.name} />
                    <div className="min-w-0 flex-1">
                      <Link href={`/leads/${lead.id}`} className="text-sm font-medium text-slate-900 hover:text-brand-700">
                        {lead.name}
                      </Link>
                      <p className="truncate text-xs text-slate-500">
                        {formatBudget(lead.budgetMin, lead.budgetMax, currency)}
                        {lead.bedrooms ? ` | ${lead.bedrooms} BHK` : ""}
                        {lead.preferredLocation ? ` | ${lead.preferredLocation}` : ""}
                      </p>
                    </div>
                    <OptionBadge list={PRIORITIES} value={lead.priority} withDot />
                    <div className="flex w-24 items-center gap-2" title="Match score">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div className={`h-full rounded-full ${score >= 75 ? "bg-emerald-500" : score >= 55 ? "bg-amber-500" : "bg-slate-400"}`} style={{ width: `${score}%` }} />
                      </div>
                      <span className="text-xs font-medium text-slate-600">{score}%</span>
                    </div>
                    <ShortlistButton leadId={lead.id} propertyId={property.id} shortlisted={false} />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Activity" />
            {property.activities.length === 0 ? (
              <EmptyState icon={ActivityIcon} title="No activity yet" />
            ) : (
              <ol className="relative space-y-5 p-5">
                {property.activities.map((a, i) => (
                  <li key={a.id} className="relative flex gap-3">
                    {i < property.activities.length - 1 && <span className="absolute left-[7px] top-5 h-[calc(100%+4px)] w-px bg-slate-200" />}
                    <span className="relative mt-1 size-[15px] shrink-0 rounded-full border-2 border-brand-200 bg-white" />
                    <div className="min-w-0">
                      <p className="text-sm text-slate-700">{a.content}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {a.user?.name ?? "System"} - {formatRelative(a.createdAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{property.listingType === "RENT" ? "Monthly rent" : "Asking price"}</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">{formatCompact(property.price, currency)}</p>
            <p className="mt-0.5 text-sm text-slate-500">{formatCurrency(property.price, currency)}</p>
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-center">
              <div>
                <p className="text-xl font-semibold text-slate-900">{property.interests.length}</p>
                <p className="text-xs text-slate-500">Interested leads</p>
              </div>
              <div>
                <p className="text-xl font-semibold text-slate-900">{property.deals.length}</p>
                <p className="text-xs text-slate-500">Deals</p>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="People" />
            <div className="space-y-4 p-5">
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Listing agent</p>
                {property.agent ? (
                  <div className="flex items-center gap-3">
                    <Avatar name={property.agent.name} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900">{property.agent.name}</p>
                      <p className="truncate text-xs text-slate-500">{property.agent.phone ?? property.agent.email}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">Unassigned</p>
                )}
              </div>
              <div className="border-t border-slate-100 pt-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Owner</p>
                {property.ownerName || property.ownerPhone ? (
                  <div className="space-y-1.5 text-sm">
                    {property.ownerName && (
                      <p className="flex items-center gap-2 text-slate-700">
                        <User className="size-4 text-slate-400" /> {property.ownerName}
                      </p>
                    )}
                    {property.ownerPhone && (
                      <a href={`tel:${property.ownerPhone}`} className="flex items-center gap-2 text-brand-600 hover:text-brand-700">
                        <Phone className="size-4" /> {property.ownerPhone}
                      </a>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">Not added</p>
                )}
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <Users className="size-4 text-slate-400" /> Interested leads
                </span>
              }
            />
            {property.interests.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-slate-500">No leads have shortlisted this property yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {property.interests.map(({ lead }) => (
                  <li key={lead.id} className="flex items-center gap-3 px-5 py-3">
                    <Avatar name={lead.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <Link href={`/leads/${lead.id}`} className="block truncate text-sm font-medium text-slate-900 hover:text-brand-700">
                        {lead.name}
                      </Link>
                      <p className="truncate text-xs text-slate-500">{lead.assignedTo?.name ?? "Unassigned"}</p>
                    </div>
                    <OptionBadge list={LEAD_STATUSES} value={lead.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <Handshake className="size-4 text-slate-400" /> Deals
                </span>
              }
              action={
                <Link href={`/deals?new=1&propertyId=${property.id}`} className="text-[13px] font-medium text-brand-600 hover:text-brand-700">
                  New deal
                </Link>
              }
            />
            {property.deals.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-slate-500">No deals on this property yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {property.deals.map((d) => (
                  <li key={d.id}>
                    <Link href={`/deals?open=${d.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900">{d.lead.name}</p>
                        <p className="text-xs text-slate-500">
                          {formatCompact(d.value, currency)} - {d.agent?.name ?? "Unassigned"}
                        </p>
                      </div>
                      <OptionBadge list={DEAL_STAGES} value={d.stage} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
