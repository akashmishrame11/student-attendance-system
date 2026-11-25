import path from "node:path";
import ExcelJS from "exceljs";
import { parseCSV } from "./query.js";

/** Convert an ExcelJS cell value to a plain trimmed string. */
function cellText(v) {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if (v.richText) return v.richText.map((t) => t.text).join("").trim();
    if (v.text !== undefined) return String(v.text).trim(); // hyperlinks
    if (v.result !== undefined) return cellText(v.result); // formulas
    return "";
  }
  return String(v).trim();
}

/**
 * Parse an uploaded spreadsheet (CSV or XLSX, in memory) into an array of
 * objects keyed by the header row. Only the first worksheet is read.
 */
export async function parseSpreadsheet(file) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext === ".csv") return parseCSV(file.buffer.toString("utf8").replace(/^﻿/, ""));

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(file.buffer);
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const headers = [];
  ws.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => { headers[col] = cellText(cell.value); });
  const rows = [];
  ws.eachRow({ includeEmpty: false }, (row, rowNo) => {
    if (rowNo === 1) return;
    const obj = {};
    headers.forEach((h, col) => { if (h) obj[h] = cellText(row.getCell(col).value); });
    if (Object.values(obj).some((v) => v !== "")) rows.push(obj);
  });
  return rows;
}

/** Build an .xlsx buffer from report columns/rows. */
export async function buildWorkbook(title, columns, rows) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Attendify";
  wb.created = new Date();
  const ws = wb.addWorksheet(title.slice(0, 31).replace(/[\\/?*[\]:]/g, "-"));
  ws.columns = columns.map((c) => ({ header: c.label, key: c.key, width: Math.min(40, Math.max(10, c.label.length + 4)) }));
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2546EA" } };
  for (const r of rows) ws.addRow(Object.fromEntries(columns.map((c) => [c.key, r[c.key] ?? ""])));
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  // Fit column widths to content.
  ws.columns.forEach((col) => {
    let max = String(col.header).length;
    col.eachCell?.({ includeEmpty: false }, (cell) => { max = Math.max(max, String(cell.value ?? "").length); });
    col.width = Math.min(50, max + 2);
  });
  return wb.xlsx.writeBuffer();
}
