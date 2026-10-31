import "server-only";
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { db } from "./db";
import { getSettings } from "./settings";
import { labelOf, PAYMENT_METHODS, PROPERTY_TYPES } from "./constants";
import { formatDate } from "./format";
import { amountInWordsINR, effectiveStatus, summarizeInstallments } from "./payment-plan";

/* ------------------------------------------------------------------ helpers */

const inr = (n: number) => `Rs. ${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n)}`;

type Logo = { data: Buffer; format: "png" | "jpg" } | null;

async function fetchLogo(url: string | null | undefined): Promise<Logo> {
  if (!url) return null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const abs = url.startsWith("http") ? url : `${process.env.APP_URL || "http://localhost:3000"}${url}`;
    const res = await fetch(abs, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf[0] === 0x89 && buf[1] === 0x50) return { data: buf, format: "png" };
    if (buf[0] === 0xff && buf[1] === 0xd8) return { data: buf, format: "jpg" };
    return null; // react-pdf only embeds PNG / JPEG
  } catch {
    return null;
  }
}

function safeColor(c: string | null | undefined) {
  return c && /^#[0-9a-fA-F]{6}$/.test(c) ? c : "#4f46e5";
}

type Company = { name: string; address: string | null; phone: string | null; email: string | null; rera: string | null; color: string; logo: Logo };

async function company(): Promise<Company> {
  const s = await getSettings();
  return {
    name: s.companyName,
    address: s.companyAddress,
    phone: s.companyPhone,
    email: s.companyEmail,
    rera: s.reraNumber,
    color: safeColor(s.brandColor),
    logo: await fetchLogo(s.logoUrl),
  };
}

const styles = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 56, paddingHorizontal: 40, fontSize: 9.5, fontFamily: "Helvetica", color: "#1e293b", lineHeight: 1.4 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingBottom: 14, borderBottomWidth: 2 },
  logo: { width: 110, height: 44, objectFit: "contain" },
  companyName: { fontSize: 15, fontFamily: "Helvetica-Bold" },
  muted: { color: "#64748b" },
  small: { fontSize: 8.5 },
  right: { textAlign: "right" },
  title: { fontSize: 13, fontFamily: "Helvetica-Bold", letterSpacing: 1.5, marginTop: 20 },
  row: { flexDirection: "row" },
  box: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 4, padding: 12 },
  label: { fontSize: 8, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 3 },
  value: { fontSize: 10.5, fontFamily: "Helvetica-Bold" },
  tableHead: { flexDirection: "row", backgroundColor: "#f1f5f9", paddingVertical: 6, paddingHorizontal: 8, fontFamily: "Helvetica-Bold", fontSize: 8.5, color: "#475569" },
  tableRow: { flexDirection: "row", paddingVertical: 6, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  footer: { position: "absolute", bottom: 24, left: 40, right: 40, fontSize: 7.5, color: "#94a3b8", textAlign: "center", borderTopWidth: 1, borderTopColor: "#e2e8f0", paddingTop: 8 },
});

function Header({ c, docTitle, docNo, docDate }: { c: Company; docTitle: string; docNo: string; docDate: string }) {
  return (
    <>
      <View style={[styles.header, { borderBottomColor: c.color }]}>
        <View style={{ maxWidth: 260 }}>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          {c.logo ? <Image src={c.logo} style={styles.logo} /> : <Text style={[styles.companyName, { color: c.color }]}>{c.name}</Text>}
          {c.logo && <Text style={[styles.value, { marginTop: 6 }]}>{c.name}</Text>}
        </View>
        <View style={{ maxWidth: 230 }}>
          {c.address && <Text style={[styles.small, styles.muted, styles.right]}>{c.address}</Text>}
          {c.phone && <Text style={[styles.small, styles.muted, styles.right]}>Phone: {c.phone}</Text>}
          {c.email && <Text style={[styles.small, styles.muted, styles.right]}>{c.email}</Text>}
          {c.rera && <Text style={[styles.small, styles.muted, styles.right]}>RERA: {c.rera}</Text>}
        </View>
      </View>
      <View style={[styles.row, { justifyContent: "space-between", alignItems: "flex-end" }]}>
        <Text style={[styles.title, { color: c.color }]}>{docTitle}</Text>
        <View>
          <Text style={[styles.small, styles.right]}>
            <Text style={styles.muted}>No. </Text>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>{docNo}</Text>
          </Text>
          <Text style={[styles.small, styles.right]}>
            <Text style={styles.muted}>Date </Text>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>{docDate}</Text>
          </Text>
        </View>
      </View>
    </>
  );
}

function Field({ label, value, flex = 1 }: { label: string; value: string; flex?: number }) {
  return (
    <View style={{ flex, paddingRight: 8 }}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value || "-"}</Text>
    </View>
  );
}

function propertyLine(p: { title: string; code: string; type: string; locality: string | null; city: string } | null) {
  if (!p) return "-";
  return `${p.title} (${p.code}), ${labelOf(PROPERTY_TYPES, p.type)}, ${[p.locality, p.city].filter(Boolean).join(", ")}`;
}

/* ------------------------------------------------------------------ receipt */

export async function loadInstallmentForReceipt(installmentId: string) {
  return db.paymentInstallment.findUnique({
    where: { id: installmentId },
    include: {
      booking: {
        include: {
          lead: { select: { id: true, name: true, phone: true, email: true, assignedToId: true } },
          property: { select: { title: true, code: true, type: true, locality: true, city: true } },
          installments: true,
        },
      },
    },
  });
}

export async function renderReceiptPdf(installmentId: string) {
  const i = await loadInstallmentForReceipt(installmentId);
  if (!i || i.paidAmount <= 0 || !i.receiptNo) return null;
  const c = await company();
  const b = i.booking;
  const summary = summarizeInstallments(b.installments);

  const doc = (
    <Document title={`Receipt ${i.receiptNo}`} author={c.name}>
      <Page size="A4" style={styles.page}>
        <Header c={c} docTitle="PAYMENT RECEIPT" docNo={i.receiptNo} docDate={formatDate(i.paidAt ?? i.updatedAt)} />

        <View style={[styles.box, { marginTop: 16 }]}>
          <Text style={{ fontSize: 10 }}>
            Received with thanks from <Text style={{ fontFamily: "Helvetica-Bold" }}>{b.lead.name}</Text> ({b.lead.phone}) a sum of{" "}
            <Text style={{ fontFamily: "Helvetica-Bold" }}>{inr(i.paidAmount)}</Text> towards <Text style={{ fontFamily: "Helvetica-Bold" }}>{i.label}</Text> for booking{" "}
            {b.bookingNo}.
          </Text>
        </View>

        <View style={[styles.row, { marginTop: 14, gap: 12 }]}>
          <View style={[styles.box, { flex: 1.3, backgroundColor: "#f8fafc" }]}>
            <Text style={styles.label}>Amount received</Text>
            <Text style={{ fontSize: 20, fontFamily: "Helvetica-Bold", color: c.color }}>{inr(i.paidAmount)}</Text>
            <Text style={[styles.small, { marginTop: 4 }]}>{amountInWordsINR(i.paidAmount)}</Text>
          </View>
          <View style={[styles.box, { flex: 1 }]}>
            <Text style={styles.label}>Payment mode</Text>
            <Text style={styles.value}>{labelOf(PAYMENT_METHODS, i.method ?? "OTHER")}</Text>
            <Text style={[styles.label, { marginTop: 8 }]}>Reference</Text>
            <Text style={styles.value}>{i.reference || "-"}</Text>
          </View>
        </View>

        <View style={[styles.box, { marginTop: 14 }]}>
          <View style={styles.row}>
            <Field label="Booking no." value={b.bookingNo} />
            <Field label="Booking date" value={formatDate(b.bookingDate)} />
            <Field label="Unit" value={b.unitNumber ?? "-"} />
          </View>
          <View style={[styles.row, { marginTop: 10 }]}>
            <Field label="Property" value={propertyLine(b.property)} flex={3} />
          </View>
        </View>

        <View style={{ marginTop: 14, borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 4 }}>
          <View style={styles.tableHead}>
            <Text style={{ flex: 3 }}>Particulars</Text>
            <Text style={{ flex: 1.4, textAlign: "right" }}>Amount</Text>
          </View>
          <Row label={`Installment: ${i.label} (due ${formatDate(i.dueDate)})`} value={inr(i.amount)} />
          <Row label="Received against this installment (to date)" value={inr(i.paidAmount)} />
          <Row label="Balance on this installment" value={inr(Math.max(0, i.amount - i.paidAmount))} />
          <Row label="Total agreement value" value={inr(summary.total)} />
          <Row label="Total received to date" value={inr(summary.paid)} />
          <Row label="Total balance outstanding" value={inr(summary.outstanding)} bold color={c.color} />
        </View>

        <View style={[styles.row, { justifyContent: "space-between", marginTop: 48 }]}>
          <View>
            <Text style={[styles.small, styles.muted]}>Subject to realisation of cheque / payment instrument.</Text>
          </View>
          <View style={{ alignItems: "center", width: 180 }}>
            <Text style={[styles.small, { fontFamily: "Helvetica-Bold" }]}>For {c.name}</Text>
            <View style={{ borderTopWidth: 1, borderTopColor: "#94a3b8", width: 160, marginTop: 36 }} />
            <Text style={[styles.small, styles.muted, { marginTop: 3 }]}>Authorised Signatory</Text>
          </View>
        </View>

        <Text style={styles.footer} fixed>
          This is a computer generated receipt. {c.name}
          {c.phone ? ` | ${c.phone}` : ""}
          {c.email ? ` | ${c.email}` : ""}
        </Text>
      </Page>
    </Document>
  );
  return { buffer: await renderToBuffer(doc), filename: `Receipt-${i.receiptNo}.pdf`, installment: i };
}

function Row({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: string }) {
  const f = bold ? { fontFamily: "Helvetica-Bold", color } : {};
  return (
    <View style={styles.tableRow}>
      <Text style={[{ flex: 3 }, f]}>{label}</Text>
      <Text style={[{ flex: 1.4, textAlign: "right" }, f]}>{value}</Text>
    </View>
  );
}

/* ------------------------------------------------------------------ statement */

export async function loadBookingForStatement(bookingId: string) {
  return db.booking.findUnique({
    where: { id: bookingId },
    include: {
      lead: { select: { id: true, name: true, phone: true, email: true, assignedToId: true } },
      property: { select: { title: true, code: true, type: true, locality: true, city: true } },
      installments: { orderBy: [{ sortOrder: "asc" }, { dueDate: "asc" }] },
    },
  });
}

const STATUS_TEXT: Record<string, string> = { PENDING: "Pending", PARTIAL: "Part paid", PAID: "Paid", WAIVED: "Waived", OVERDUE: "Overdue" };

export async function renderStatementPdf(bookingId: string) {
  const b = await loadBookingForStatement(bookingId);
  if (!b) return null;
  const c = await company();
  const now = new Date();
  const s = summarizeInstallments(b.installments, now);

  const doc = (
    <Document title={`Statement ${b.bookingNo}`} author={c.name}>
      <Page size="A4" style={styles.page}>
        <Header c={c} docTitle="ACCOUNT STATEMENT" docNo={b.bookingNo} docDate={formatDate(now)} />
        <View style={[styles.box, { marginTop: 16 }]}>
          <View style={styles.row}>
            <Field label="Customer" value={`${b.lead.name} (${b.lead.phone})`} flex={2} />
            <Field label="Booking date" value={formatDate(b.bookingDate)} />
            <Field label="Unit" value={b.unitNumber ?? "-"} />
          </View>
          <View style={[styles.row, { marginTop: 10 }]}>
            <Field label="Property" value={propertyLine(b.property)} flex={3} />
          </View>
        </View>

        <View style={[styles.row, { marginTop: 12, gap: 10 }]}>
          {[
            ["Agreement value", inr(s.total)],
            ["Received", inr(s.paid)],
            ["Outstanding", inr(s.outstanding)],
            ["Overdue", inr(s.overdue)],
          ].map(([l, v], idx) => (
            <View key={l} style={[styles.box, { flex: 1, backgroundColor: idx === 3 && s.overdue > 0 ? "#fff1f2" : "#f8fafc" }]}>
              <Text style={styles.label}>{l}</Text>
              <Text style={[styles.value, idx === 3 && s.overdue > 0 ? { color: "#be123c" } : {}]}>{v}</Text>
            </View>
          ))}
        </View>

        <View style={{ marginTop: 14, borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 4 }}>
          <View style={styles.tableHead} fixed>
            <Text style={{ width: 18 }}>#</Text>
            <Text style={{ flex: 3 }}>Installment</Text>
            <Text style={{ flex: 1.3 }}>Due date</Text>
            <Text style={{ flex: 1.5, textAlign: "right" }}>Amount</Text>
            <Text style={{ flex: 1.5, textAlign: "right" }}>Received</Text>
            <Text style={{ flex: 1.5, textAlign: "right" }}>Balance</Text>
            <Text style={{ flex: 1.2, textAlign: "right" }}>Status</Text>
          </View>
          {b.installments.map((i, n) => {
            const st = effectiveStatus(i, now);
            return (
              <View key={i.id} style={styles.tableRow} wrap={false}>
                <Text style={{ width: 18, color: "#94a3b8" }}>{n + 1}</Text>
                <View style={{ flex: 3 }}>
                  <Text>{i.label}</Text>
                  {i.receiptNo && (
                    <Text style={[styles.small, styles.muted]}>
                      {i.receiptNo} - {formatDate(i.paidAt)}
                    </Text>
                  )}
                </View>
                <Text style={{ flex: 1.3 }}>{formatDate(i.dueDate)}</Text>
                <Text style={{ flex: 1.5, textAlign: "right" }}>{inr(i.amount)}</Text>
                <Text style={{ flex: 1.5, textAlign: "right" }}>{inr(i.paidAmount)}</Text>
                <Text style={{ flex: 1.5, textAlign: "right" }}>{inr(i.status === "WAIVED" ? 0 : Math.max(0, i.amount - i.paidAmount))}</Text>
                <Text style={{ flex: 1.2, textAlign: "right", color: st === "OVERDUE" ? "#be123c" : st === "PAID" ? "#047857" : "#475569", fontFamily: "Helvetica-Bold" }}>
                  {STATUS_TEXT[st] ?? st}
                </Text>
              </View>
            );
          })}
        </View>
        <Text style={[styles.small, styles.muted, { marginTop: 10 }]}>
          Outstanding in words: {amountInWordsINR(s.outstanding)}
        </Text>

        <Text style={styles.footer} fixed render={({ pageNumber, totalPages }) => `Computer generated statement as on ${formatDate(now)}. ${c.name}. Page ${pageNumber} of ${totalPages}`} />
      </Page>
    </Document>
  );
  return { buffer: await renderToBuffer(doc), filename: `Statement-${b.bookingNo}.pdf`, booking: b };
}

export function pdfResponse(buffer: Buffer, filename: string, inline = true) {
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
