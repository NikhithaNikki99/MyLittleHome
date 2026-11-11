// CSV building (RFC 4180) with protection against spreadsheet formula injection. Pure: no native modules.

// A cell that starts with = + - @ tab or carriage return can run as a formula when the file is opened in Excel,
// Sheets or Numbers. A diary title like "=HYPERLINK(...)" is user text, so such cells get a leading apostrophe.
const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value) {
  if (value === null || value === undefined) return '';
  let text = typeof value === 'string' ? value : String(value);
  if (typeof value === 'string' && FORMULA_START.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// columns: [{ header, value: (row) => any }]. Rows end with CRLF, as the RFC asks; a leading BOM lets Excel
// read UTF-8 (rupee signs, accents, emoji) correctly.
export function buildCsv(columns, rows) {
  const lines = [columns.map((c) => csvCell(c.header)).join(',')];
  for (const row of rows) lines.push(columns.map((c) => csvCell(c.value(row))).join(','));
  return `﻿${lines.join('\r\n')}\r\n`;
}

// Whole rupees and paise as a plain number a spreadsheet can sum: 12345 -> "123.45".
export function paiseToDecimal(paise) {
  const sign = paise < 0 ? '-' : '';
  const abs = Math.abs(paise);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}
