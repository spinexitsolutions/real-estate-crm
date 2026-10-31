import "server-only";
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { splitGstInclusive } from "./billing-core";
import { formatDate } from "./format";
import { amountInWordsINR } from "./payment-plan";

const inr = (n: number) => `Rs. ${new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}`;

export function platformSeller() {
  return {
    name: process.env.PLATFORM_LEGAL_NAME || process.env.NEXT_PUBLIC_APP_NAME || "EstateDesk",
    gstin: process.env.PLATFORM_GSTIN || null,
    address: process.env.PLATFORM_ADDRESS || null,
    state: process.env.PLATFORM_STATE || null,
    email: process.env.PLATFORM_SUPPORT_EMAIL || null,
    phone: process.env.PLATFORM_SUPPORT_PHONE || null,
    sac: "998314", // SAC for IT design & development / software services (SaaS)
  };
}

export type InvoicePdfInput = {
  number: string;
  date: Date;
  amount: number; // total incl. GST
  status: string;
  description: string | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  paymentRef: string | null;
  buyer: { name: string; email: string | null; phone: string | null; address: string | null; state: string | null; gstin: string | null };
};

const s = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 56, paddingHorizontal: 44, fontSize: 9.5, fontFamily: "Helvetica", color: "#1e293b", lineHeight: 1.45 },
  row: { flexDirection: "row" },
  muted: { color: "#64748b" },
  h1: { fontSize: 16, fontFamily: "Helvetica-Bold" },
  label: { fontSize: 7.5, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 2 },
  box: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 4, padding: 10 },
  th: { flexDirection: "row", backgroundColor: "#f1f5f9", paddingVertical: 6, paddingHorizontal: 8, fontFamily: "Helvetica-Bold", fontSize: 8.5 },
  tr: { flexDirection: "row", paddingVertical: 6, paddingHorizontal: 8, borderTopWidth: 1, borderTopColor: "#f1f5f9" },
  footer: { position: "absolute", bottom: 26, left: 44, right: 44, textAlign: "center", fontSize: 7.5, color: "#94a3b8" },
});

export async function renderInvoicePdf(inv: InvoicePdfInput) {
  const seller = platformSeller();
  const g = splitGstInclusive(inv.amount, seller.state, inv.buyer.state);
  const doc = (
    <Document title={`Invoice ${inv.number}`} author={seller.name}>
      <Page size="A4" style={s.page}>
        <View style={[s.row, { justifyContent: "space-between", borderBottomWidth: 2, borderBottomColor: "#4f46e5", paddingBottom: 12 }]}>
          <View style={{ maxWidth: 300 }}>
            <Text style={s.h1}>{seller.name}</Text>
            {seller.address && <Text style={s.muted}>{seller.address}</Text>}
            {seller.gstin && <Text>GSTIN: {seller.gstin}</Text>}
            {(seller.email || seller.phone) && <Text style={s.muted}>{[seller.email, seller.phone].filter(Boolean).join(" | ")}</Text>}
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ fontSize: 13, fontFamily: "Helvetica-Bold", color: "#4f46e5", letterSpacing: 1 }}>TAX INVOICE</Text>
            <Text style={{ marginTop: 6 }}>No. {inv.number}</Text>
            <Text>Date: {formatDate(inv.date)}</Text>
            <Text style={{ marginTop: 2, color: inv.status === "PAID" ? "#047857" : "#be123c", fontFamily: "Helvetica-Bold" }}>{inv.status}</Text>
          </View>
        </View>

        <View style={[s.row, { marginTop: 16, gap: 12 }]}>
          <View style={[s.box, { flex: 1 }]}>
            <Text style={s.label}>Billed to</Text>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>{inv.buyer.name}</Text>
            {inv.buyer.address && <Text style={s.muted}>{inv.buyer.address}</Text>}
            {inv.buyer.state && <Text style={s.muted}>State: {inv.buyer.state}</Text>}
            {inv.buyer.gstin && <Text>GSTIN: {inv.buyer.gstin}</Text>}
            {(inv.buyer.email || inv.buyer.phone) && <Text style={s.muted}>{[inv.buyer.email, inv.buyer.phone].filter(Boolean).join(" | ")}</Text>}
          </View>
          <View style={[s.box, { flex: 1 }]}>
            <Text style={s.label}>Subscription period</Text>
            <Text>{inv.periodStart && inv.periodEnd ? `${formatDate(inv.periodStart)} to ${formatDate(inv.periodEnd)}` : "-"}</Text>
            <Text style={[s.label, { marginTop: 8 }]}>Payment reference</Text>
            <Text>{inv.paymentRef ?? "-"}</Text>
            <Text style={[s.label, { marginTop: 8 }]}>Place of supply</Text>
            <Text>{inv.buyer.state ?? "-"}</Text>
          </View>
        </View>

        <View style={{ marginTop: 16, borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 4 }}>
          <View style={s.th}>
            <Text style={{ flex: 4 }}>Description</Text>
            <Text style={{ flex: 1 }}>SAC</Text>
            <Text style={{ flex: 1.6, textAlign: "right" }}>Amount</Text>
          </View>
          <View style={s.tr}>
            <Text style={{ flex: 4 }}>{(inv.description ?? "Subscription").replace(/\s*\(incl\. 18% GST\)/i, "")}</Text>
            <Text style={{ flex: 1 }}>{seller.sac}</Text>
            <Text style={{ flex: 1.6, textAlign: "right" }}>{inr(g.taxable)}</Text>
          </View>
          {g.intraState ? (
            <>
              <Row label="CGST @ 9%" value={inr(g.cgst)} />
              <Row label="SGST @ 9%" value={inr(g.sgst)} />
            </>
          ) : (
            <Row label="IGST @ 18%" value={inr(g.igst)} />
          )}
          <View style={[s.tr, { backgroundColor: "#f8fafc" }]}>
            <Text style={{ flex: 5, fontFamily: "Helvetica-Bold" }}>Total</Text>
            <Text style={{ flex: 1.6, textAlign: "right", fontFamily: "Helvetica-Bold" }}>{inr(g.total)}</Text>
          </View>
        </View>
        <Text style={{ marginTop: 8 }}>Amount in words: {amountInWordsINR(Math.round(g.total))}</Text>

        <View style={[s.row, { justifyContent: "space-between", marginTop: 48 }]}>
          <Text style={[s.muted, { fontSize: 8.5, maxWidth: 280 }]}>
            {seller.gstin ? "Tax is payable on reverse charge: No." : "This invoice is issued by an entity that is not registered under GST, if no GSTIN is shown."}
          </Text>
          <View style={{ alignItems: "center", width: 180 }}>
            <Text style={{ fontSize: 8.5, fontFamily: "Helvetica-Bold" }}>For {seller.name}</Text>
            <View style={{ borderTopWidth: 1, borderTopColor: "#94a3b8", width: 160, marginTop: 34 }} />
            <Text style={[s.muted, { fontSize: 8, marginTop: 3 }]}>Authorised Signatory</Text>
          </View>
        </View>

        <Text style={s.footer} fixed>
          This is a computer generated invoice. {seller.name}
          {seller.email ? ` | ${seller.email}` : ""}
        </Text>
      </Page>
    </Document>
  );
  return renderToBuffer(doc);
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.tr}>
      <Text style={{ flex: 5, color: "#475569" }}>{label}</Text>
      <Text style={{ flex: 1.6, textAlign: "right" }}>{value}</Text>
    </View>
  );
}
