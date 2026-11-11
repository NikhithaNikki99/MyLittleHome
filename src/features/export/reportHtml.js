// HTML for the monthly PDF report. Pure: it only turns already-loaded data into a string, so every rule here
// (escaping above all) is covered by Jest. expo-print renders the string; no script runs in it.
//
// Every piece of text that came from the user or the database goes through esc(). A diary title such as
// "<img src=x onerror=...>" is shown as text, never as markup. The page also sets a Content-Security-Policy
// that forbids scripts and network access, as a second layer.
import { MOODS } from '../../constants/moods';
import { formatMonthKey } from '../../utils/dates';
import { formatPaise } from '../../utils/money';
import { formatMl } from '../../utils/units';
import { REFLECTION_FIELDS } from '../memories/reflectionOptions';

export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Line breaks the user typed become <br>, after escaping, so paragraphs stay readable.
function para(text) {
  return esc(text).replace(/\r?\n/g, '<br>');
}

const CSS = `
  body { font-family: sans-serif; color: #2b2024; margin: 0; padding: 0; font-size: 12px; line-height: 1.5; }
  h1 { font-size: 22px; margin: 0 0 2px; }
  h2 { font-size: 15px; margin: 18px 0 6px; border-bottom: 1px solid #e7cfd6; padding-bottom: 3px; }
  .sub { color: #6b5560; margin: 0 0 8px; }
  table { border-collapse: collapse; width: 100%; }
  td, th { text-align: left; padding: 4px 6px; border-bottom: 1px solid #f0e2e6; vertical-align: top; }
  th { color: #6b5560; font-weight: 600; }
  td.n, th.n { text-align: right; white-space: nowrap; }
  .grid { display: table; width: 100%; }
  .stat { display: inline-block; width: 31%; margin: 0 1% 8px 0; padding: 8px; background: #fbeff2; border-radius: 8px; vertical-align: top; }
  .stat b { display: block; font-size: 15px; }
  .box { margin: 0 0 8px; }
  .box .l { color: #6b5560; font-size: 11px; }
  .note { color: #6b5560; font-size: 11px; margin-top: 18px; }
`;

function stat(label, value, detail) {
  return `<div class="stat"><span>${esc(label)}</span><b>${esc(value)}</b>${detail ? `<span>${esc(detail)}</span>` : ''}</div>`;
}

function moodRows(recap) {
  const rows = MOODS.filter((m) => recap.moodCounts[m.value] > 0).map(
    (m) => `<tr><td>${esc(m.label)}</td><td class="n">${recap.moodCounts[m.value]}</td></tr>`,
  );
  return rows.length ? `<table><tr><th>Mood</th><th class="n">Days</th></tr>${rows.join('')}</table>` : '<p class="sub">No mood check-ins this month.</p>';
}

function categoryRows(breakdown) {
  if (breakdown.categories.length === 0) return '<p class="sub">No spending this month.</p>';
  const rows = breakdown.categories.map(
    (c) => `<tr><td>${esc(c.name)}</td><td class="n">${esc(formatPaise(c.totalPaise))}</td><td class="n">${c.percent}%</td></tr>`,
  );
  return `<table><tr><th>Category</th><th class="n">Spent</th><th class="n">Share</th></tr>${rows.join('')}</table>`;
}

function reflectionBlock(reflection) {
  if (!reflection) return '';
  const boxes = REFLECTION_FIELDS.filter((f) => reflection[f.key])
    .map((f) => `<div class="box"><div class="l">${esc(f.label)}</div>${para(reflection[f.key])}</div>`)
    .join('');
  return `<h2>Your reflection</h2>${boxes}`;
}

function entriesBlock(entries) {
  if (entries.length === 0) return '';
  const rows = entries.map(
    (e) => `<tr><td style="white-space:nowrap">${esc(e.entry_date)}</td><td>${esc(e.title || 'Untitled')}</td></tr>`,
  );
  return `<h2>Diary entries</h2><table>${rows.join('')}</table>`;
}

// recap: from getMonthRecap. breakdown: from getMonthBreakdown. entries: [{ entry_date, title }] for the month.
export function buildMonthlyReportHtml({ monthKey, recap, breakdown, entries, generatedOn }) {
  const month = formatMonthKey(monthKey);
  const waterValue = recap.waterDays ? formatMl(recap.avgWaterMl) : 'None logged';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:">
<title>${esc(`My Little World, ${month}`)}</title><style>${CSS}</style></head>
<body>
<h1>My Little World</h1>
<p class="sub">Monthly report for ${esc(month)}</p>
<div>
${stat('Diary entries', String(recap.entryCount))}
${stat('Spent', formatPaise(breakdown.expensePaise), recap.spendCount ? `${recap.spendCount} ${recap.spendCount === 1 ? 'expense' : 'expenses'}` : '')}
${stat('Income', formatPaise(breakdown.incomePaise))}
${stat('Habits done', String(recap.habitCompletions), 'times')}
${stat('Water, daily average', waterValue, recap.waterDays ? `${recap.waterDays} days logged` : '')}
${stat('Weight', recap.weightNote ?? 'No change to report')}
</div>
${reflectionBlock(recap.reflection)}
<h2>Spending by category</h2>
${categoryRows(breakdown)}
<h2>Mood</h2>
${moodRows(recap)}
${entriesBlock(entries)}
<p class="note">Made on ${esc(generatedOn)} from data stored on this phone. This report is not encrypted.</p>
</body></html>`;
}

export function reportFileName(monthKey) {
  return `my-little-world-${monthKey}.pdf`;
}
