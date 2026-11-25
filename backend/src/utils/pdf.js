import PDFDocument from "pdfkit";

const BRAND = "#2546EA";
const MUTED = "#64748B";
const LINE = "#E2E8F0";
// Built-in PDF fonts have no ₹ glyph, so amounts use "Rs.".
export const money = (n) => `Rs. ${Number(n || 0).toLocaleString("en-IN")}`;

function header(doc, college, title, subtitle) {
  const { left, right } = doc.page.margins;
  const width = doc.page.width - left - right;
  doc.rect(0, 0, doc.page.width, 6).fill(BRAND);
  doc.fillColor("#0F172A").font("Helvetica-Bold").fontSize(15).text(college, left, 24, { width });
  doc.font("Helvetica-Bold").fontSize(12).fillColor(BRAND).text(title, left, doc.y + 4, { width });
  if (subtitle) doc.font("Helvetica").fontSize(9).fillColor(MUTED).text(subtitle, left, doc.y + 2, { width });
  doc.moveTo(left, doc.y + 8).lineTo(left + width, doc.y + 8).strokeColor(LINE).stroke();
  doc.y += 16;
}

function footers(doc) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    // Writing inside the bottom margin would make PDFKit start a new page.
    const savedBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    const bottom = doc.page.height - 28;
    doc.font("Helvetica").fontSize(8).fillColor(MUTED);
    doc.text(`Generated ${new Date().toLocaleString("en-IN")}`, doc.page.margins.left, bottom, { lineBreak: false });
    doc.text(`Page ${i + 1} of ${range.count}`, doc.page.width - doc.page.margins.right - 80, bottom, { width: 80, align: "right", lineBreak: false });
    doc.page.margins.bottom = savedBottom;
  }
}

/** Stream a paginated table report as PDF. columns: [{key,label}], rows: [{}] */
export function streamTablePdf(res, { filename, college, title, subtitle, columns, rows }) {
  const landscape = columns.length > 6;
  const doc = new PDFDocument({ size: "A4", layout: landscape ? "landscape" : "portrait", margin: 36, bufferPages: true, info: { Title: title, Author: college } });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  doc.pipe(res);

  header(doc, college, title, subtitle);
  const left = doc.page.margins.left;
  const width = doc.page.width - left - doc.page.margins.right;
  const bottomLimit = doc.page.height - doc.page.margins.bottom - 24;

  // Column widths proportional to content length (bounded).
  const weights = columns.map((c) => {
    const longest = Math.max(String(c.label).length, ...rows.slice(0, 200).map((r) => String(r[c.key] ?? "").length));
    return Math.min(28, Math.max(5, longest));
  });
  const total = weights.reduce((a, b) => a + b, 0);
  const widths = weights.map((w) => (w / total) * width);
  const fontSize = landscape && columns.length > 9 ? 7.5 : 8.5;

  const drawHeader = () => {
    const y = doc.y;
    doc.rect(left, y, width, 18).fill(BRAND);
    let x = left;
    doc.font("Helvetica-Bold").fontSize(fontSize).fillColor("#FFFFFF");
    columns.forEach((c, i) => {
      doc.text(String(c.label), x + 4, y + 5, { width: widths[i] - 8, height: 10, ellipsis: true, lineBreak: false });
      x += widths[i];
    });
    doc.y = y + 18;
  };

  drawHeader();
  if (!rows.length) {
    doc.font("Helvetica").fontSize(10).fillColor(MUTED).text("No data for the selected filters.", left, doc.y + 12);
  }
  rows.forEach((r, idx) => {
    doc.font("Helvetica").fontSize(fontSize);
    const cells = columns.map((c) => String(r[c.key] ?? ""));
    const h = Math.max(16, ...cells.map((t, i) => doc.heightOfString(t, { width: widths[i] - 8 }) + 7));
    if (doc.y + h > bottomLimit) {
      doc.addPage();
      doc.y = doc.page.margins.top;
      drawHeader();
      doc.font("Helvetica").fontSize(fontSize); // header switched to bold
    }
    const y = doc.y;
    if (idx % 2 === 1) doc.rect(left, y, width, h).fill("#F8FAFC");
    let x = left;
    doc.fillColor("#0F172A");
    cells.forEach((t, i) => {
      doc.text(t, x + 4, y + 4, { width: widths[i] - 8 });
      x += widths[i];
    });
    doc.moveTo(left, y + h).lineTo(left + width, y + h).strokeColor(LINE).lineWidth(0.5).stroke();
    doc.y = y + h;
  });
  doc.font("Helvetica").fontSize(8).fillColor(MUTED).text(`${rows.length} row(s)`, left, doc.y + 8);
  footers(doc);
  doc.end();
}

/** Stream a fee receipt as PDF. */
export function streamReceiptPdf(res, p, college) {
  const doc = new PDFDocument({ size: "A5", margin: 32, bufferPages: true, info: { Title: `Receipt ${p.receiptNo}`, Author: college.collegeName } });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="receipt-${p.receiptNo}.pdf"`);
  doc.pipe(res);

  header(doc, college.collegeName || "College", "Fee Payment Receipt", [college.address, college.contactPhone].filter(Boolean).join(" · "));
  const left = doc.page.margins.left;
  const width = doc.page.width - left - doc.page.margins.right;

  const kv = (label, value, x, y, w) => {
    doc.font("Helvetica").fontSize(8).fillColor(MUTED).text(label, x, y, { width: w });
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#0F172A").text(value || "-", x, doc.y + 1, { width: w });
  };
  const half = width / 2 - 6;
  let y = doc.y;
  kv("Receipt No.", p.receiptNo, left, y, half);
  kv("Date", new Date(p.paidAt).toLocaleString("en-IN"), left + half + 12, y, half);
  y = doc.y + 10;
  kv("Student", `${p.student?.user?.name || ""} (${p.student?.rollNumber || ""})`, left, y, half);
  kv("Student ID", p.student?.studentId, left + half + 12, y, half);
  y = doc.y + 10;
  kv("Course", `${p.fee?.course?.name || ""}`, left, y, half);
  kv("Semester / Section", `${p.fee?.semester?.name || ""} / ${p.student?.section?.name || "-"}`, left + half + 12, y, half);

  // Amount table
  doc.y += 18;
  const rowLine = (label, amount, bold) => {
    const ry = doc.y;
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(10).fillColor("#0F172A");
    doc.text(label, left + 6, ry + 6, { width: width - 120 });
    doc.text(amount, left + width - 110, ry + 6, { width: 104, align: "right" });
    doc.moveTo(left, ry + 24).lineTo(left + width, ry + 24).strokeColor(LINE).stroke();
    doc.y = ry + 24;
  };
  doc.rect(left, doc.y, width, 20).fill("#EFF4FF");
  doc.font("Helvetica-Bold").fontSize(9).fillColor(BRAND).text("DESCRIPTION", left + 6, doc.y + 6).text("AMOUNT", left + width - 110, doc.y - 10, { width: 104, align: "right" });
  doc.y += 8;
  rowLine(p.fee?.name || "Fee", money(p.amount));
  if (p.fine) rowLine("Late payment fine", money(p.fine));
  rowLine("Total paid", money(p.amount + (p.fine || 0)), true);

  doc.y += 12;
  doc.font("Helvetica").fontSize(9).fillColor(MUTED)
    .text(`Payment method: ${String(p.method).replace(/_/g, " ")}${p.transactionId ? `   ·   Transaction: ${p.transactionId}` : ""}`, left, doc.y, { width })
    .text(`Received by: ${p.receivedBy?.name || "-"}`, left, doc.y + 2, { width });
  doc.y += 24;
  doc.fontSize(8).text("This is a computer-generated receipt and does not require a signature.", left, doc.y, { width, align: "center" });
  footers(doc);
  doc.end();
}
