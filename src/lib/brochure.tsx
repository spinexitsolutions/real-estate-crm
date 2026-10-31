import "server-only";
import path from "path";
import { readFile } from "fs/promises";
import { Document, Font, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { db } from "./db";
import { formatCompact, formatCurrency, formatDate, formatNumber } from "./format";
import { FURNISHING, LISTING_TYPES, PROPERTY_TYPES, labelOf } from "./constants";
import { parseImages, splitList } from "./utils";

/* ------------------------------------------------------------------ fonts */
// Inter has the rupee glyph (the built-in PDF fonts do not). Loaded from the bundled
// files when available, otherwise from Google Fonts, otherwise we fall back to Helvetica + "Rs".
const FONT_FILES = [
  { weight: 400, file: "Inter-Regular.ttf", url: "https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZg.ttf" },
  { weight: 600, file: "Inter-SemiBold.ttf", url: "https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuGKYMZg.ttf" },
  { weight: 700, file: "Inter-Bold.ttf", url: "https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYMZg.ttf" },
];

let fontPromise: Promise<string> | null = null;

async function loadFontBuffer(f: (typeof FONT_FILES)[number]) {
  try {
    return await readFile(path.join(process.cwd(), "src", "assets", "fonts", f.file));
  } catch {
    const res = await fetch(f.url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`font ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
}

/** Registers the brochure font once per process and returns the family name to use. */
function ensureFont() {
  if (!fontPromise) {
    fontPromise = (async () => {
      try {
        const buffers = await Promise.all(FONT_FILES.map(loadFontBuffer));
        Font.register({
          family: "Inter",
          fonts: FONT_FILES.map((f, i) => ({ src: `data:font/ttf;base64,${buffers[i].toString("base64")}`, fontWeight: f.weight })),
        });
        Font.registerHyphenationCallback((word) => [word]);
        return "Inter";
      } catch (e) {
        console.error("Brochure font unavailable, using Helvetica", e);
        fontPromise = null; // retry next time
        return "Helvetica";
      }
    })();
  }
  return fontPromise;
}

/* ----------------------------------------------------------------- images */
type Img = { data: Buffer; format: "jpg" | "png" };

/** Fetches an image (remote or /uploads) and converts it to JPEG/PNG, which react-pdf supports. Returns null on any failure. */
async function loadImage(src: string, opts: { maxWidth: number; keepAlpha?: boolean }): Promise<Img | null> {
  try {
    let buf: Buffer;
    if (src.startsWith("/")) {
      buf = await readFile(path.join(process.cwd(), "public", src.replace(/^\/+/, "")));
    } else if (/^https?:\/\//i.test(src)) {
      const res = await fetch(src, { signal: AbortSignal.timeout(10000), headers: { Accept: "image/jpeg,image/png,image/*;q=0.8" } });
      if (!res.ok) return null;
      buf = Buffer.from(await res.arrayBuffer());
    } else return null;

    try {
      const sharp = (await import("sharp")).default;
      const img = sharp(buf, { failOn: "none" }).rotate().resize({ width: opts.maxWidth, withoutEnlargement: true });
      if (opts.keepAlpha) return { data: await img.png().toBuffer(), format: "png" };
      return { data: await img.flatten({ background: "#ffffff" }).jpeg({ quality: 82, mozjpeg: true }).toBuffer(), format: "jpg" };
    } catch {
      // sharp not available: only pass through formats react-pdf understands
      if (buf[0] === 0xff && buf[1] === 0xd8) return { data: buf, format: "jpg" };
      if (buf[0] === 0x89 && buf[1] === 0x50) return { data: buf, format: "png" };
      return null;
    }
  } catch {
    return null;
  }
}

function dataUri(img: Img) {
  return `data:image/${img.format === "jpg" ? "jpeg" : "png"};base64,${img.data.toString("base64")}`;
}

/* ------------------------------------------------------------------ data */
export async function getBrochureData(propertyId: string) {
  const [property, settings] = await Promise.all([
    db.property.findUnique({ where: { id: propertyId }, include: { agent: { select: { name: true, phone: true, email: true } } } }),
    db.settings.findUnique({ where: { id: 1 } }),
  ]);
  if (!property || !settings) return null;
  return { property, settings };
}

type BrochureData = NonNullable<Awaited<ReturnType<typeof getBrochureData>>>;

/* ---------------------------------------------------------------- render */
export async function renderBrochure(data: BrochureData, origin?: string) {
  const { property: p, settings: s } = data;
  const family = await ensureFont();
  const rupee = family === "Inter";
  const money = (v: number) => {
    const out = formatCompact(v, s.currency);
    return rupee ? out : out.replace("₹", "Rs ");
  };
  const full = (v: number) => {
    const out = formatCurrency(v, s.currency);
    return rupee ? out : out.replace("₹", "Rs ");
  };

  const photos = parseImages(p.images);
  const [logo, ...imgs] = await Promise.all([
    s.logoUrl ? loadImage(s.logoUrl, { maxWidth: 400, keepAlpha: true }) : Promise.resolve(null),
    ...photos.slice(0, 4).map((u, i) => loadImage(u, { maxWidth: i === 0 ? 1600 : 700 })),
  ]);
  const loaded = imgs.filter((x): x is Img => !!x);
  const cover = loaded[0];
  const thumbs = loaded.slice(1, 4);

  const brand = /^#[0-9a-f]{6}$/i.test(s.brandColor) ? s.brandColor : "#4f46e5";
  const rent = p.listingType === "RENT";
  const location = [p.locality, p.city].filter(Boolean).join(", ");
  const amenities = splitList(p.amenities).slice(0, 18);
  const description = (p.description || "").trim();
  const desc = description.length > 650 ? `${description.slice(0, 640).trimEnd()}...` : description;
  const specs: { label: string; value: string }[] = [
    { label: "Property type", value: labelOf(PROPERTY_TYPES, p.type) },
    { label: "Listing", value: labelOf(LISTING_TYPES, p.listingType) },
    ...(p.bedrooms ? [{ label: "Bedrooms", value: `${p.bedrooms} BHK` }] : []),
    ...(p.bathrooms ? [{ label: "Bathrooms", value: String(p.bathrooms) }] : []),
    ...(p.area ? [{ label: "Area", value: `${formatNumber(p.area)} ${p.areaUnit === "sqft" ? "sq ft" : p.areaUnit}` }] : []),
    ...(p.furnishing ? [{ label: "Furnishing", value: labelOf(FURNISHING, p.furnishing) }] : []),
    ...(!rent && p.area && p.areaUnit === "sqft" && p.price ? [{ label: "Rate", value: `${money(p.price / p.area).replace(/\s?K$/, "K")}/sq ft` }] : []),
  ].slice(0, 6);
  const contactName = p.agent?.name ?? s.companyName;
  const contactPhone = p.agent?.phone || s.companyPhone || "";
  const website = s.websiteEnabled && origin ? `${origin.replace(/^https?:\/\//, "")}/site` : null;

  const st = StyleSheet.create({
    page: { fontFamily: family, fontSize: 9.5, color: "#0f172a", paddingBottom: 54 },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 36, paddingTop: 26, paddingBottom: 14 },
    brandRow: { flexDirection: "row", alignItems: "center" },
    logo: { maxHeight: 40, maxWidth: 120, marginRight: 10, objectFit: "contain" },
    logoBox: { width: 34, height: 34, borderRadius: 8, backgroundColor: brand, marginRight: 10, alignItems: "center", justifyContent: "center" },
    logoInitial: { color: "#fff", fontSize: 15, fontWeight: 700 },
    company: { fontSize: 13, fontWeight: 700 },
    companySub: { fontSize: 8, color: "#64748b", marginTop: 2 },
    headerRight: { alignItems: "flex-end" },
    accent: { height: 3, backgroundColor: brand, marginHorizontal: 36, borderRadius: 2 },
    body: { paddingHorizontal: 36, paddingTop: 16 },
    cover: { width: "100%", height: 250, borderRadius: 10, objectFit: "cover" },
    coverEmpty: { width: "100%", height: 120, borderRadius: 10, backgroundColor: "#f1f5f9", alignItems: "center", justifyContent: "center" },
    badgeRow: { position: "absolute", top: 12, left: 12, flexDirection: "row" },
    badge: { backgroundColor: "#ffffff", color: "#0f172a", fontSize: 8, fontWeight: 600, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 4, marginRight: 5 },
    thumbs: { flexDirection: "row", marginTop: 8, justifyContent: "space-between" },
    thumb: { width: "32.4%", height: 82, borderRadius: 7, objectFit: "cover" },
    titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginTop: 16 },
    title: { fontSize: 17, fontWeight: 700, lineHeight: 1.25, maxWidth: 330 },
    meta: { fontSize: 9, color: "#64748b", marginTop: 4 },
    priceBox: { alignItems: "flex-end" },
    price: { fontSize: 20, fontWeight: 700, color: brand },
    priceSub: { fontSize: 8, color: "#64748b", marginTop: 2 },
    sectionTitle: { fontSize: 8, fontWeight: 600, color: "#64748b", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 6, marginTop: 14 },
    specs: { flexDirection: "row", flexWrap: "wrap", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8 },
    spec: { width: "33.33%", paddingVertical: 8, paddingHorizontal: 10 },
    specLabel: { fontSize: 7.5, color: "#64748b" },
    specValue: { fontSize: 10.5, fontWeight: 600, marginTop: 2 },
    chips: { flexDirection: "row", flexWrap: "wrap" },
    chip: { fontSize: 8, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 10, backgroundColor: "#f1f5f9", color: "#334155", marginRight: 4, marginBottom: 4 },
    desc: { fontSize: 9.5, lineHeight: 1.5, color: "#334155" },
    contact: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 14, padding: 12, borderRadius: 8, backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0" },
    contactName: { fontSize: 11, fontWeight: 700 },
    contactSub: { fontSize: 8.5, color: "#64748b", marginTop: 2 },
    cta: { backgroundColor: brand, color: "#fff", fontSize: 9, fontWeight: 600, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
    footer: { position: "absolute", bottom: 20, left: 36, right: 36, borderTopWidth: 1, borderTopColor: "#e2e8f0", paddingTop: 8, flexDirection: "row", justifyContent: "space-between" },
    footerText: { fontSize: 7, color: "#94a3b8", maxWidth: 360 },
  });

  const doc = (
    <Document title={`${p.title} - ${s.companyName}`} author={s.companyName} subject="Property brochure">
      <Page size="A4" style={st.page}>
        <View style={st.header}>
          <View style={st.brandRow}>
            {logo ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={dataUri(logo)} style={st.logo} />
            ) : (
              <View style={st.logoBox}>
                <Text style={st.logoInitial}>{s.companyName.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <View>
              <Text style={st.company}>{s.companyName}</Text>
              <Text style={st.companySub}>{[s.companyPhone, s.companyEmail].filter(Boolean).join("   |   ")}</Text>
            </View>
          </View>
          <View style={st.headerRight}>
            <Text style={{ fontSize: 8, color: "#64748b" }}>Property brochure</Text>
            <Text style={{ fontSize: 10, fontWeight: 600, marginTop: 2 }}>{p.code}</Text>
            {s.reraNumber ? <Text style={{ fontSize: 7.5, color: "#64748b", marginTop: 2 }}>RERA: {s.reraNumber}</Text> : null}
          </View>
        </View>
        <View style={st.accent} />

        <View style={st.body}>
          {cover ? (
            <View>
              {/* eslint-disable-next-line jsx-a11y/alt-text */}
              <Image src={dataUri(cover)} style={st.cover} />
              <View style={st.badgeRow}>
                <Text style={st.badge}>{labelOf(LISTING_TYPES, p.listingType)}</Text>
                {p.status === "RESERVED" ? <Text style={st.badge}>Reserved</Text> : null}
              </View>
            </View>
          ) : (
            <View style={st.coverEmpty}>
              <Text style={{ color: "#94a3b8" }}>Photos available on request</Text>
            </View>
          )}
          {thumbs.length > 0 && (
            <View style={st.thumbs}>
              {thumbs.map((t, i) => (
                // eslint-disable-next-line jsx-a11y/alt-text
                <Image key={i} src={dataUri(t)} style={st.thumb} />
              ))}
              {Array.from({ length: 3 - thumbs.length }).map((_, i) => (
                <View key={`e${i}`} style={{ width: "32.4%" }} />
              ))}
            </View>
          )}

          <View style={st.titleRow}>
            <View>
              <Text style={st.title}>{p.title}</Text>
              <Text style={st.meta}>{[location, p.address].filter(Boolean).join("  |  ")}</Text>
            </View>
            <View style={st.priceBox}>
              <Text style={st.price}>
                {money(p.price)}
                {rent ? <Text style={{ fontSize: 10, color: "#64748b" }}> /month</Text> : null}
              </Text>
              <Text style={st.priceSub}>{full(p.price)}</Text>
            </View>
          </View>

          <Text style={st.sectionTitle}>Key details</Text>
          <View style={st.specs}>
            {specs.map((x, i) => (
              <View key={x.label} style={[st.spec, i >= 3 ? { borderTopWidth: 1, borderTopColor: "#e2e8f0" } : {}, i % 3 !== 0 ? { borderLeftWidth: 1, borderLeftColor: "#e2e8f0" } : {}]}>
                <Text style={st.specLabel}>{x.label}</Text>
                <Text style={st.specValue}>{x.value}</Text>
              </View>
            ))}
          </View>

          {amenities.length > 0 && (
            <>
              <Text style={st.sectionTitle}>Amenities</Text>
              <View style={st.chips}>
                {amenities.map((a) => (
                  <Text key={a} style={st.chip}>
                    {a}
                  </Text>
                ))}
              </View>
            </>
          )}

          {desc ? (
            <>
              <Text style={st.sectionTitle}>About this property</Text>
              <Text style={st.desc}>{desc}</Text>
            </>
          ) : null}

          <View style={st.contact} wrap={false}>
            <View>
              <Text style={{ fontSize: 7.5, color: "#64748b" }}>For site visits and best price, contact</Text>
              <Text style={[st.contactName, { marginTop: 2 }]}>{contactName}</Text>
              <Text style={st.contactSub}>{[contactPhone, website].filter(Boolean).join("   |   ")}</Text>
            </View>
            {contactPhone ? <Text style={st.cta}>Call {contactPhone}</Text> : null}
          </View>
        </View>

        <View style={st.footer} fixed>
          <Text style={st.footerText}>
            {[s.companyName, s.companyAddress].filter(Boolean).join(", ")}. Prices and availability are subject to change. This brochure is for information only and does not constitute an offer.
          </Text>
          <Text style={st.footerText}>Generated {formatDate(new Date())}</Text>
        </View>
      </Page>
    </Document>
  );

  const buffer = await renderToBuffer(doc);
  const filename = `${p.code}-${p.title}`.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 80) + ".pdf";
  return { buffer, filename };
}

export function pdfResponse(buffer: Buffer | Uint8Array, filename: string, download: boolean) {
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
