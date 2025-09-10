// utils/budgetPdf.js
// Parse a budget PDF text and sum the amounts for top-level sections A–Z only.
// Supported headers at the start of a line include only single letters A–Z (e.g., "A) ...", "B. ...", "C - ...").
// Assumptions:
// - The section row ends with a total amount (or it appears on the next 1–2 lines).
// - We sum the per-section amounts across all detected headers and return both the breakdown and grand total.

const pdfParse = require('pdf-parse');
let pdfjsLib = null; // lazy-load pdfjs-dist for positional parsing

function parseNumberLoose(s) {
  if (s == null) return null;
  const cleaned = String(s).replace(/[\s,]/g, '');
  const m = cleaned.match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = parseFloat(m[0]);
  return Number.isFinite(n) ? n : null;
}

function extractSectionTotalsFromText(text) {
  const lines = String(text).split(/\r?\n/);
  const results = [];
  // e.g., "A) Site Mgmt", "B. Site Office", "C - Something"
  // Require a punctuation separator after the header to reduce false positives; allow only single-letter A–Z
  const headerRegex = /^\s*([A-Z])\s*(?:\)|\.|-)\s*(.+)$/;

  for (let i = 0; i < lines.length; i++) {
    const raw = String(lines[i] || '');
    const line = raw.replace(/\s+/g, ' ').trim();
    if (!line) continue;

    const m = line.match(headerRegex);
    if (!m) continue;

    const id = (m[1] || '').toString().toUpperCase();
    const title = (m[2] || '').trim();

    // Prefer currency-like numbers on the header line (choose the last one)
    let amount = null;
    const moneyRe = /-?\d{1,3}(?:,\d{3})+(?:\.\d+)?|-?\d+\.\d{2}/g;
    const headerMoney = line.match(moneyRe) || [];
    if (headerMoney.length) {
      const v = parseNumberLoose(headerMoney[headerMoney.length - 1]);
      if (v != null) amount = v;
    }
    // If none on header, scan forward (up to 30 lines or until another section header)
    // Accept numeric-only lines, lines with 'total', or first sub-item lines beginning with the same header id (e.g., 'I.1', 'A.1').
    if (amount == null) {
      for (let k = 1; k <= 30 && i + k < lines.length; k++) {
        const look = String(lines[i + k] || '').replace(/\s+/g, ' ').trim();
        if (!look) continue;
        // Stop if we hit another lettered section header
        if (/^\s*([A-Z])\s*(?:\)|\.|-)\s+/.test(look)) break;
        const isNumericOnly = /^-?[\d,]+(?:\.\d+)?$/.test(look);
        const hasTotalWord = /\b(total|amount)\b/i.test(look);
        const sameSectionSubitem = new RegExp(`^\n?\r?\t?\x20*${id.replace(/[-/\\^$*+?.()|[\]{}]/g, m => `\\${m}`)}\s*\.[\s\d]`, 'i').test(look);
        if (!isNumericOnly && !hasTotalWord && !sameSectionSubitem) continue;
        const m1 = look.match(moneyRe) || [];
        if (m1.length) {
          const v = parseNumberLoose(m1[m1.length - 1]);
          if (v != null) { amount = v; break; }
        } else if (isNumericOnly) {
          const m2 = look.match(/-?\d[\d,]*\.?\d*/g) || [];
          if (m2.length) {
            const v = parseNumberLoose(m2[m2.length - 1]);
            if (v != null) { amount = v; break; }
          }
        }
      }
    }

    if (amount != null) {
      // Remove trailing amount token from the captured title (so it doesn't duplicate in UI)
      const moneyAtEnd = title.match(/(-?\d{1,3}(?:,\d{3})+(?:\.\d+)?|-?\d+\.\d{2})\s*$/);
      if (moneyAtEnd) {
        title = title.slice(0, moneyAtEnd.index).trim().replace(/[,;:.-]+$/,'').trim();
        if (!title) title = id; // fallback to letter if fully stripped
      }
      results.push({ id, letter: id, title, amount });
    }
  }

  // Collapse duplicates for the same header id (A, AA, 1, II, ...)
  const byId = new Map();
  for (const r of results) {
    const prev = byId.get(r.id);
    if (!prev) byId.set(r.id, r);
    else {
      // prefer the larger amount (section totals tend to be larger than incidental numbers)
      byId.set(r.id, (r.amount >= prev.amount) ? r : prev);
    }
  }
  const naturalKey = (s) => {
    // Try numeric sort first
    const n = parseInt(s.id, 10);
    if (Number.isFinite(n)) return { t: 'n', n };
    // Then roman numerals
    const roman = s.id.match(/^[IVXLCDM]+$/);
    if (roman) {
      const val = s.id
        .replace(/CM/g, '900,')
        .replace(/CD/g, '400,')
        .replace(/XC/g, '90,')
        .replace(/XL/g, '40,')
        .replace(/IX/g, '9,')
        .replace(/IV/g, '4,')
        .replace(/M/g, '1000,')
        .replace(/D/g, '500,')
        .replace(/C/g, '100,')
        .replace(/L/g, '50,')
        .replace(/X/g, '10,')
        .replace(/V/g, '5,')
        .replace(/I/g, '1,')
        .split(',')
        .filter(Boolean)
        .map(Number)
        .reduce((a,b)=>a+b,0);
      return { t: 'r', n: val };
    }
    // Finally alpha sort for letter ids like A, AA, AB
    return { t: 'a', s: s.id };
  };
  let sections = [...byId.values()].sort((a,b) => {
    const A = naturalKey(a), B = naturalKey(b);
    if (A.t !== B.t) return A.t.localeCompare(B.t);
    if (A.t === 'a') return String(A.s).localeCompare(String(B.s));
    return (A.n || 0) - (B.n || 0);
  });
  // Heuristic cleanup: if we have at least 5 sections with amount >= 10000, drop any < 1000 as noise
  const bigCount = sections.filter(s => (Number(s.amount) || 0) >= 10000).length;
  if (bigCount >= 5) sections = sections.filter(s => (Number(s.amount) || 0) >= 1000);
  const totalAll = sections.reduce((s, x) => s + (Number(x.amount) || 0), 0);
  return { sections, sectionTotal: totalAll };
}

// New simplified extractor: capture ONLY top-level lettered items (A., B., C., etc.) whose line ends with an amount.
// Excludes sub-items like A.1, B.2, etc. and ignores any green table / CSI data.
function extractTopLevelItemTotals(text) {
  const lines = String(text).split(/\r?\n/);
  const headerRegex = /^\s*([A-Z])\s*(?:[.)-])(?!\s*\d)\s*(.*)$/; // negative lookahead prevents A.1
  const moneyRe = /-?\d{1,3}(?:,\d{3})+(?:\.\d+)?|-?\d+\.\d{2}/g;
  const collected = [];
  for (let raw of lines) {
    if (!raw) continue;
    const line = String(raw).replace(/\s+/g,' ').trim();
    if (!line) continue;
    const m = line.match(headerRegex);
    if (!m) continue;
    const letter = m[1];
    const rest = m[2] || '';
    const nums = line.match(moneyRe) || [];
    if (!nums.length) continue; // need an amount on same line as requested
    const amount = parseNumberLoose(nums[nums.length - 1]);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    // Clean title: remove trailing amount token and any stray commas/digits stuck to it.
    let title = rest.replace(nums[nums.length - 1], '').replace(/\s+/g,' ').trim();
    title = title.replace(/[,;:\-]+$/,'').trim();
    if (!title) title = letter; // fallback
    collected.push({ id: letter, letter, title, amount });
  }
  // Deduplicate keeping largest amount per letter
  const map = new Map();
  for (const row of collected) {
    const prev = map.get(row.letter);
    if (!prev || row.amount > prev.amount) map.set(row.letter, row);
  }
  const sections = [...map.values()].sort((a,b)=>a.letter.localeCompare(b.letter));
  const sectionTotal = sections.reduce((s,x)=>s + (Number(x.amount)||0),0);
  return { sections, sectionTotal };
}

// Positional extraction using pdfjs-dist: cluster by Y to rebuild lines, then
// capture rows starting with a single letter section and ending with a large monetary value.
async function extractTopLevelUsingPositions(buffer) {
  try {
    if (!pdfjsLib) {
      pdfjsLib = require('pdfjs-dist');
    }
    const loadingTask = pdfjsLib.getDocument({ data: buffer });
    const doc = await loadingTask.promise;
    const rows = [];
    const maxPages = Math.min(doc.numPages, 10);
    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      const page = await doc.getPage(pageNum);
      const content = await page.getTextContent();
      const lineMap = new Map();
      for (const item of content.items) {
        const str = (item.str || '').trim();
        if (!str) continue;
        const y = Math.round(item.transform[5]);
        const key = Math.round(y / 3) * 3; // bucket
        if (!lineMap.has(key)) lineMap.set(key, []);
        lineMap.get(key).push({ x: item.transform[4], text: str });
      }
      for (const parts of lineMap.values()) {
        parts.sort((a,b)=>a.x-b.x);
        const full = parts.map(p=>p.text).join(' ').replace(/\s+/g,' ').trim();
        if (full) rows.push({ parts, full });
      }
    }
    const headerRe = /^([A-Z])\s*(?:[.)-])\b/;
    const moneyRe = /-?\d{1,3}(?:,\d{3})+(?:\.\d+)?|-?\d+\.\d{2}/g;
    const candidates = [];
    for (const row of rows) {
      if (!headerRe.test(row.full)) continue;
      const nums = row.full.match(moneyRe) || [];
      if (!nums.length) continue;
      const last = nums[nums.length - 1];
      const val = parseNumberLoose(last);
      if (!Number.isFinite(val) || (val < 1000 && !/,/.test(last))) continue; // filter out likely quantities
      const m = row.full.match(headerRe);
      const letter = m[1];
      let title = row.full.replace(last,'').trim();
      title = title.replace(/^([A-Z])\s*(?:[.)-])\s*/,'');
      candidates.push({ id: letter, letter, title, amount: val, source: 'pos' });
    }
    const byLetter = new Map();
    for (const c of candidates) {
      const prev = byLetter.get(c.letter);
      if (!prev || c.amount > prev.amount) byLetter.set(c.letter, c);
    }
    const sections = [...byLetter.values()].sort((a,b)=>a.letter.localeCompare(b.letter));
    const sectionTotal = sections.reduce((s,x)=>s + x.amount,0);
    return { sections, sectionTotal, mode: 'POSITIONAL' };
  } catch (e) {
    return { sections: [], sectionTotal: 0, mode: 'POSITION_ERROR', error: e.message };
  }
}

// Extract row-level amounts by scanning for lines ending with a currency-like number while
// skipping headers, CSI codes, grand totals, and section-like lines. The last number on a row
// is treated as that row's total amount.
function extractRowAmountsFromText(text) {
  const lines = String(text).split(/\r?\n/);
  const moneyRe = /-?\d{1,3}(?:,\d{3})+(?:\.\d+)?|-?\d+\.\d{2}/g;
  const isSectionHeader = (s) => /^\s*[A-Z]\s*(?:\)|\.|-)\s+/.test(s);
  const isTotalLine = (s) => /\b(grand\s*total|overall\s*total|sub\s*total|total\s*amount|total\s*cost|total\s*estimate|^total\b)\b/i.test(s);
  const headerWordRe = /\b(ITEM|DESCRIPTION|UNIT|QUANTITY|QTY|RATE|PRICE|MATERIAL|OTHERS|TOTAL|AMOUNT)\b/i;
  const codeLineRe = /^\s*\d{2}\s*\d{2}\s*\d{2}\b/; // e.g. 03 50 00
  const standaloneAmountRe = /^\s*\d{1,3}(?:,\d{3})*(?:\.\d+)?\s*$/;

  // 1. Locate last lettered section header (end of blue table)
  let lastSectionIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const t = String(lines[i]||'').replace(/\s+/g,' ').trim();
    if (isSectionHeader(t)) lastSectionIdx = i;
  }
  // 2. Find green table header (ITEM/DESCRIPTION/AMOUNT). If not found, fall back to scanning immediately
  // after the last section header because some PDFs lose the header row in extraction.
  let headerIdx = -1;
  for (let i = lastSectionIdx + 1; i < lines.length; i++) {
    const line = String(lines[i]||'').replace(/\s+/g,' ').trim();
    if (!line) continue;
    if (/\bAMOUNT\b/i.test(line) && /DESCRIPTION/i.test(line) && /(ITEM|NO\.?)/i.test(line)) { headerIdx = i; break; }
  }
  const scanStart = (headerIdx !== -1)
    ? headerIdx + 1
    : (lastSectionIdx !== -1 ? lastSectionIdx + 1 : 0);

  const rowAmounts = [];
  const rowItems = [];
  let inCodeBlock = false;
  let capturedForBlock = false;
  let blockLines = []; // accumulate lines for current item block (code + fragments)
  // Maintain a small sliding window of recent lines to allow fallback grouping
  const recent = [];
  for (let i = scanStart; i < lines.length; i++) {
    const raw = String(lines[i]||'');
    const line = raw.replace(/\s+/g,' ').trim();
    if (isTotalLine(line)) break;
    if (!line) {
      // blank resets current code block context (if we haven't captured amount yet we just drop it)
      inCodeBlock = false;
      capturedForBlock = false;
      recent.length = 0;
      blockLines = [];
      continue;
    }
    // Skip repeated header fragments
    if (/ITEM/i.test(line) && /AMOUNT/i.test(line) && /DESCRIPTION/i.test(line)) continue;

    if (codeLineRe.test(line)) {
      // Start a new item code block
      inCodeBlock = true;
      capturedForBlock = false;
      recent.length = 0;
      recent.push(line);
      blockLines = [line];
      continue;
    }

    // If we're in a code block, allow continuation title fragments (all caps words, short, no money)
    if (inCodeBlock && !capturedForBlock) {
      const moneyOnLine = line.match(moneyRe) || [];
      const isAllCapsFragment = /^[A-Z0-9 &'./-]+$/.test(line) && moneyOnLine.length === 0 && line.length <= 30;
      if (isAllCapsFragment) {
        // keep accumulating within the same code block until we hit the standalone amount
        recent.push(line);
        blockLines.push(line);
        continue;
      }
    }

    // Standalone amount line: only one number which is the amount itself
    if (inCodeBlock && !capturedForBlock && standaloneAmountRe.test(line)) {
      const amt = parseNumberLoose(line);
      if (Number.isFinite(amt)) {
        rowAmounts.push(amt);
        // Build a title from blockLines
        const joined = blockLines.join(' ').replace(/\s+/g,' ').trim();
        const codeMatch = joined.match(codeLineRe);
        let code = '';
        let title = joined;
        if (codeMatch) {
          code = codeMatch[0].trim();
          title = joined.replace(codeLineRe, '').trim();
        }
        rowItems.push({ index: rowItems.length + 1, code, title, amount: amt });
        capturedForBlock = true; // prevent double counting if repeated
        recent.length = 0;
        blockLines = [];
      }
      continue;
    }

    // Fallback: if we are NOT currently in a code block, but we see a pure amount line
    // and the recent window (previous up to 4 lines) contains an initial CSI-like code line fragment
    // followed by uppercase fragments, treat it as an item.
    if (!inCodeBlock && standaloneAmountRe.test(line)) {
      // Inspect previous few lines (already stored in recent)
      const windowLines = recent.slice(-5); // slightly larger window now that we build titles
      const hasCode = windowLines.some(l => codeLineRe.test(l));
      const onlyFragments = windowLines.every(l => codeLineRe.test(l) || (/^[A-Z0-9 &'./-]+$/.test(l) && !(moneyRe.test(l))));
      if (hasCode && onlyFragments) {
        const amt = parseNumberLoose(line);
        if (Number.isFinite(amt)) {
          rowAmounts.push(amt);
          const joined = windowLines.join(' ').replace(/\s+/g,' ').trim();
          const codeMatch = joined.match(codeLineRe);
          let code = '';
          let title = joined;
          if (codeMatch) {
            code = codeMatch[0].trim();
            title = joined.replace(codeLineRe, '').trim();
          }
          rowItems.push({ index: rowItems.length + 1, code, title, amount: amt });
          // reset recent after capture
          recent.length = 0;
          continue;
        }
      }
    }

    // Update sliding window (cap at 6 lines)
    recent.push(line);
    if (recent.length > 6) recent.shift();

    // Detail lines (units, quantities, etc.) we ignore; they often contain multiple numbers including repeated final amount
    // Heuristic: lines starting with measurement unit (m2, m, pcs, etc.) or containing multiple monetary numbers
    const nums = line.match(moneyRe) || [];
    if (nums.length > 1) continue;
    // If we haven't captured amount yet and we encounter another code line will be handled next iteration
  }
  const rowSum = rowItems.reduce((s,v)=>s+ (Number(v.amount)||0),0);
  return { rowAmounts, rowItems, rowSum };
}

// Extremely simple fallback: grab any line that contains some text and ends with a single
// currency-like number (no additional numeric tokens that look like money). Intended for
// cases where the PDF flattened multi-column tables into simple "ITEM NAME    12,345.67" lines.
// Excludes obvious headers / total lines / section headers.
function extractSimpleItemLines(text) {
  const lines = String(text).split(/\r?\n/);
  const moneyRe = /-?\d{1,3}(?:,\d{3})+(?:\.\d+)?|-?\d+\.\d{2}/g;
  const isSectionHeader = (s) => /^\s*[A-Z]\s*(?:\)|\.|-)\s+/.test(s);
  const isTotalLine = (s) => /\b(grand\s*total|overall\s*total|sub\s*total|total\s*amount|total\s*cost|total\s*estimate|^total\b)\b/i.test(s);
  const headerWordRe = /\b(ITEM|DESCRIPTION|UNIT|QUANTITY|QTY|RATE|PRICE|MATERIAL|OTHERS|TOTAL|AMOUNT)\b/i;
  const items = [];
  for (const raw of lines) {
    const line = String(raw || '').replace(/\s+/g,' ').trim();
    if (!line) continue;
    if (isSectionHeader(line)) continue;
    if (isTotalLine(line)) continue;
    if (headerWordRe.test(line)) continue;
    if (!/[A-Za-z]/.test(line)) continue; // must contain letters (avoid pure numeric lines)
    const moneyMatches = line.match(moneyRe) || [];
    if (moneyMatches.length !== 1) continue; // only keep simple one-number lines
    const amtStr = moneyMatches[0];
    // Ensure amount appears as the last token (allow trailing spaces)
    if (!new RegExp(`${amtStr.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\s*$`).test(line)) continue;
    const amount = parseNumberLoose(amtStr);
    if (!Number.isFinite(amount)) continue;
    // Title = line without the trailing amount
    const title = line.slice(0, line.lastIndexOf(amtStr)).trim().replace(/[-:.]+$/,'').trim();
    if (title.length < 2) continue;
    // Filter out lines that look like section-like short codes only
    if (/^[A-Z]{1,3}$/.test(title)) continue;
    items.push({ index: items.length + 1, code: '', title, amount });
  }
  const simpleSum = items.reduce((s,v)=>s + (Number(v.amount)||0), 0);
  return { simpleItems: items, simpleSum };
}

// Look for lines like "Grand Total", "TOTAL", "Total Amount" and pick the last number on that line.
function extractKeywordTotalsFromText(text) {
  const lines = String(text).split(/\r?\n/);
  const entries = [];
  const kwRegex = /(grand\s*total|total\s*amount|overall\s*total|total)\b/i;
  for (const raw of lines) {
    const line = String(raw || '').replace(/\s+/g, ' ').trim();
    if (!line) continue;
    const mkw = line.match(kwRegex);
    if (!mkw) continue;
    const nums = line.match(/-?\d[\d,]*\.?\d*/g);
    if (!nums || !nums.length) continue;
    const amt = parseNumberLoose(nums[nums.length - 1]);
    if (amt != null) entries.push({ label: mkw[1], line, amount: amt });
  }
  // Prefer the largest value on keyword lines, which is typically the grand total
  const best = entries.reduce((p, c) => (p && p.amount > c.amount) ? p : c, null);
  return { keywordTotals: entries, keywordBestTotal: best ? best.amount : 0 };
}

// Fallback: sum all currency-like numbers across the document (can overcount on some docs)
function sumAllCurrencyLikeNumbers(text) {
  const nums = String(text).match(/(?:[$₱]|PHP)?\s*-?\d{1,3}(?:,\d{3})+(?:\.\d+)?|-?\d+\.\d{2}/g) || [];
  const values = nums
    .map(n => parseNumberLoose(n))
    .filter(v => Number.isFinite(v) && Math.abs(v) >= 1); // ignore tiny/zero
  const total = values.reduce((s, v) => s + v, 0);
  return { allNumbers: values, allNumbersSum: total };
}

// Sum rows that start with CSI-like codes such as '03 50 00', '09 50 00'
function extractCsiHeaderTotalsFromText(text) {
  const lines = String(text).split(/\r?\n/);
  const amounts = [];
  const moneyRe = /-?\d{1,3}(?:,\d{3})+(?:\.\d+)?|-?\d+\.\d{2}/g;
  const csiRe = /^\s*(\d{2})\s*(\d{2})\s*(\d{2})\b/;
  for (const raw of lines) {
    const line = String(raw || '').replace(/\s+/g, ' ').trim();
    if (!line) continue;
    if (!csiRe.test(line)) continue;
    if (/\b(ITEM|DESCRIPTION|UNIT RATE|UNIT|QUANTITY|AMOUNT)\b/i.test(line)) continue;
    const nums = line.match(moneyRe) || [];
    if (!nums.length) continue;
    const last = parseNumberLoose(nums[nums.length - 1]);
    if (!Number.isFinite(last)) continue;
    amounts.push(last);
  }
  const csiSum = amounts.reduce((s,v)=>s+v,0);
  return { csiAmounts: amounts, csiSum };
}

async function sumBudgetFromPdfBuffer(buffer) {
  if (!buffer || !buffer.length) return { sections: [], totalAll: 0 };
  const { text } = await pdfParse(buffer);
  const t = text || '';
  // Simplified "item + amount only" strategy.
  const moneyRe = /-?\d{1,3}(?:,\d{3})+(?:\.\d+)?|-?\d+\.\d{2}/g;
  const lines = t.split(/\r?\n/);

  // -------------------------------------------------------
  // EARLY MODE: strictly capture rows where only ITEM (possibly multi-line block) + single AMOUNT exist.
  // A block: one or more consecutive non-empty lines containing no monetary numbers (except possible CSI code digits)
  // followed (within N lines) by a pure amount line (only one number token). Intermediate blank columns in PDF are lost in text, so we infer by absence of other numbers.
  // -------------------------------------------------------
  function extractItemOnlyBlocks(linesArr) {
    const items = [];
    const isHeader = (l) => /\b(ITEM|DESCRIPTION|UNIT|QUANTITY|QTY|RATE|PRICE|MATERIAL|OTHERS|TOTAL|AMOUNT)\b/i.test(l);
    const pureAmountRe = /^-?[\d,]+(?:\.\d+)?$/; // standalone amount
    const csiStartRe = /^(?:\d{2}\s+){2,4}\d{2}\b/; // e.g. 03 50 00
    for (let i=0; i<linesArr.length; i++) {
      let line = String(linesArr[i]||'').replace(/\s+/g,' ').trim();
      if(!line) continue;
      if(isHeader(line)) continue;
      // Skip if line already contains a money token (would indicate we have other columns -> skip for strict mode)
      if(moneyRe.test(line)) continue;
      // Candidate start: CSI code or alphabetic phrase with at least 2 letters
      if(!csiStartRe.test(line) && (line.match(/[A-Za-z]/g)||[]).length < 2) continue;
      // Accumulate block lines (allow up to 5 extra lines) until we hit amount line
      const blockLines = [line];
      let j = i+1; let amountVal = null; let amountRaw = null; let amountIdx = -1;
      // Extended lookahead (40 lines) to catch distant amount lines (e.g., section K amount separated by blank space)
      for (; j < linesArr.length && j <= i+40; j++) {
        let l2 = String(linesArr[j]||'').replace(/\s+/g,' ').trim();
        if(!l2) continue; // skip blank lines within block
        if(isHeader(l2)) break; // stop at header reappearance
        // Stop if new lettered section starts (avoid absorbing next section)
        if(/^[A-Z]\./.test(l2)) break;
        if(pureAmountRe.test(l2)) {
          // ensure this numeric line looks like a real money amount (comma or >=500)
            const v = parseNumberLoose(l2);
            if(Number.isFinite(v) && (/,/.test(l2) || v >= 500)) { amountVal = v; amountRaw = l2; amountIdx = j; break; }
          // else keep scanning
        }
        // If this line contains any moneyRe pattern -> abort this block (means extra numeric columns present)
        if(moneyRe.test(l2)) { amountVal = null; break; }
        // If a new CSI start appears before finding amount, treat as a new item start (abort current)
        if(csiStartRe.test(l2)) { amountVal = null; break; }
        blockLines.push(l2);
      }
      if(amountVal != null) {
        let rawTitle = blockLines.join(' ').replace(/\s+/g,' ').trim();
        // If the amount got concatenated to the end of the title due to missing column gap, strip it.
        const trailingAmt = rawTitle.match(/(-?\d{1,3}(?:,\d{3})+(?:\.\d+)?|-?\d+\.\d{2})\s*$/);
        if (trailingAmt) {
          const possible = parseNumberLoose(trailingAmt[1]);
          // Only strip if parsed matches the captured amount (avoid removing legitimate numbers within title)
          if (possible === amountVal) {
            rawTitle = rawTitle.slice(0, trailingAmt.index).trim().replace(/[,;:.-]+$/,'').trim();
          }
        }
        if((rawTitle.match(/[A-Za-z]/g)||[]).length >= 2) {
          items.push({ index: items.length+1, code: '', title: rawTitle, amount: amountVal, source: 'item-only-block', lineIndex: i });
          i = amountIdx; // jump past amount line
        }
      }
    }
    return items;
  }

  const strictItems = extractItemOnlyBlocks(lines);
  // Helper to normalize broken uppercase word fragments (e.g., ENVIRONME NTAL -> ENVIRONMENTAL, U NDERLAYMEN T -> UNDERLAYMENT)
  function normalizeBrokenCapsTitle(title) {
    if (!title) return title;
    // Preserve leading section letter prefix like "D." or "A." so it won't merge into next word
    let prefix = '';
    if (/^[A-Z]\./.test(title)) {
      prefix = title.slice(0,2); // e.g. 'D.'
      title = title.slice(2).trim();
    }
    let parts = title.split(/\s+/);
    const isCaps = (s) => /^[A-Z]+$/.test(s);
    const common = new Set(['AND','FOR','THE','WITH','OF','SITE','LINE','GRADE','TAX','PERMIT','BUSINESS','BUILDING','CAST','DECKS','METAL','SHEATHING','FINISH','CARPENTRY','PLASTER','RENDER','WALL','ASSEMBLIES','CLADDING','TILE','SLAB','FINISHES','CEILING','SYSTEMS','OTHERS','TEMPORARY','PLANT','EQUIPMENT','SERVICE','UTILITIES','QUALITY','CONTROL','ENVIRONMENTAL','HEALTH','SAFETY']);
    let changed = true;
    while (changed) {
      changed = false;
      for (let i=0; i<parts.length-1; i++) {
        const a = parts[i], b = parts[i+1];
        if (!isCaps(a) || !isCaps(b)) continue;
        // Conditions to merge: single-letter fragment, or long+short split inside same word
        if (a.length <= 2 || b.length <= 2 || (a.length >= 6 && b.length <= 4 && !common.has(a) && !common.has(b))) {
          const merged = a + b; // simple concatenation
            parts.splice(i,2,merged);
            changed = true;
            i--; // re-evaluate at this position for cascading merges
            continue;
        }
      }
    }
    // Dictionary-based multi-token merge (handles ENVIRONME NTAL -> ENVIRONMENTAL, U NDERLAYMEN T -> UNDERLAYMENT)
  const dictWords = new Set(['ENVIRONMENTAL','UNDERLAYMENT']);
    let i = 0;
    while (i < parts.length) {
      if (!isCaps(parts[i])) { i++; continue; }
      let combined = parts[i];
      let j = i+1;
      while (j < parts.length && isCaps(parts[j]) && combined.length <= 20) {
        const test = combined + parts[j];
        if (dictWords.has(test)) {
          combined = test;
          j++;
          break; // accept first match
        }
        combined += parts[j];
        if (dictWords.has(combined)) { j++; break; }
        j++;
      }
      if (dictWords.has(combined)) {
        parts.splice(i, (j - i), combined);
        continue; // re-check at same index for further merges
      }
      i++;
    }
    // Additional pass: merge uppercase tokens split by layout (e.g., ENVIRONME NTAL,) even if punctuation on second token
    const punctStrip = (s) => s.replace(/[.,;:]+$/,'');
    const rebuilt = [];
    for (let k=0; k<parts.length; k++) {
      if (k < parts.length -1) {
        const aRaw = parts[k];
        const bRaw = parts[k+1];
        const a = punctStrip(aRaw);
        const b = punctStrip(bRaw);
        // Don't merge a single-letter that likely belonged to a section prefix (handled separately)
        if (isCaps(a) && isCaps(b) && !(a.length === 1 && prefix)) {
          const combo = a + b;
            if (dictWords.has(combo) || (a.length >=3 && b.length >=3 && combo.length >= 10 && !common.has(a) && !common.has(b))) {
              // Preserve punctuation from second token if any
              const punct = bRaw.slice(b.length);
              rebuilt.push(combo + punct);
              k++; // skip next
              continue;
            }
        }
      }
      rebuilt.push(parts[k]);
    }
    parts = rebuilt;
    // Explicit pattern joins for known split fragments (e.g., ENVIRONME NTAL -> ENVIRONMENTAL)
    const joinPatterns = [
      { parts: ['ENVIRONME','NTAL'], join: 'ENVIRONMENTAL' },
      { parts: ['UNDERLAYMEN','T'], join: 'UNDERLAYMENT' }
    ];
    for (let jp of joinPatterns) {
      for (let idx=0; idx < parts.length-1; idx++) {
        if (parts[idx] === jp.parts[0] && punctStrip(parts[idx+1]) === jp.parts[1]) {
          const punct = parts[idx+1].slice(punctStrip(parts[idx+1]).length);
          parts.splice(idx,2,jp.join + punct);
        }
      }
    }
    // Fix specific pattern: ANDU NDERLAYMENT -> AND UNDERLAYMENT
    for (let k=0; k<parts.length-1; k++) {
      if (parts[k] === 'ANDU' && parts[k+1] === 'NDERLAYMENT') {
        parts.splice(k,2,'AND','UNDERLAYMENT');
      }
    }
    // Final cleanup: collapse any accidental double letters from over-merge (e.g., ANDUNDERLAYMENT -> AND UNDERLAYMENT not desired)
    // Only split if token starts with ANDUNDERLAYMENT exactly pattern
    for (let k=0; k<parts.length; k++) {
      if (/^ANDUNDERLAYMENT$/.test(parts[k])) {
        parts.splice(k,1,'AND','UNDERLAYMENT');
      }
    }
  let out = parts.join(' ');
  if (prefix) out = prefix + ' ' + out;
  return out;
  }
  if (strictItems.length) {
    // Filter out titles that include sub-item markers (e.g. D.3) mid-title or unit+quantity patterns (e.g. 'lot 0.75')
    const unitTokens = ['lot','m','m2','sqm','sq.m','pcs','pc','kg','bag','bags','set','sets','unit','units','osm'];
    const unitPattern = new RegExp(`\\b(?:${unitTokens.join('|')})\\b\\s*\n?\r?\t?\x20*\d`,'i');
    let filtered = strictItems.filter(it => {
      const t = it.title || '';
      if (/\b[A-Z]\.[0-9]+/.test(t)) return false; // contains sub-item marker
      if (unitPattern.test(t)) return false; // has unit + quantity pattern
      // Exclude titles that are just a unit + quantity (safety)
      if (/^(?:lot|m2|sqm|pcs|pc|kg|bag|bags|set|sets|unit|units)\b/i.test(t) && /\d/.test(t)) return false;
      return true;
    });
    // Secondary pass: add any missing letter section (A-K) where header line exists with pure amount line later
    const haveLetter = new Set(filtered.map(it => (it.title.match(/^([A-Z])\./)||[])[1] ));
    const targetLetters = ['A','B','C','D','E','F','G','H','I','J','K'];
    const headerRe = /^\s*([A-Z])\.\s*([A-Z][A-Z \-/&]+)$/; // e.g. K. OTHERS
    for (let i=0;i<lines.length;i++) {
      const raw = String(lines[i]||'').replace(/\s+/g,' ').trim();
      if(!raw) continue;
      const m = raw.match(headerRe);
      if(!m) continue;
      const letter = m[1];
      if(!targetLetters.includes(letter)) continue;
      if(haveLetter.has(letter)) continue;
      // look ahead for pure amount line
      for (let j=i+1;j<lines.length && j<=i+60;j++) {
        const l2 = String(lines[j]||'').replace(/\s+/g,' ').trim();
        if(!l2) continue;
        if(/^\s*[A-Z]\.\s+/.test(l2)) break; // next header -> stop
        if(/^-?[\d,]+(?:\.\d+)?$/.test(l2)) {
          const v = parseNumberLoose(l2);
          if(Number.isFinite(v) && (/,/.test(l2) || v>=500)) {
            // Clean raw header title if amount concatenated
            let hdr = raw;
            const lateAmt = hdr.match(/(-?\d{1,3}(?:,\d{3})+(?:\.\d+)?|-?\d+\.\d{2})\s*$/);
            if (lateAmt) {
              const pv = parseNumberLoose(lateAmt[1]);
              if (pv === v) {
                hdr = hdr.slice(0, lateAmt.index).trim().replace(/[,;:.-]+$/,'').trim();
              }
            }
            filtered.push({ index: 0, code: '', title: hdr, amount: v, source: 'late-letter-capture', lineIndex: i });
          }
          break;
        }
        // abort if line has other money pattern (extra columns)
        if(moneyRe.test(l2)) break;
      }
    }
  // Normalize broken caps fragments in titles
  filtered.forEach(it => { it.title = normalizeBrokenCapsTitle(it.title); });
  // Reindex after filtering
    filtered.forEach((it,i)=> it.index = i+1);
    const totalAll = filtered.reduce((s,x)=>s + (Number(x.amount)||0),0);
    return {
      mode: 'ITEM_ONLY_AMOUNT',
      sections: [],
      greenItems: filtered,
      sectionTotal: 0,
      rowSum: totalAll,
      csiSum: 0,
      totalAll,
      autoDeductEligible: true,
      confidenceSummary: { strategy: 'strict-item-plus-amount', itemCount: filtered.length, removed: strictItems.length - filtered.length }
    };
  }
  const items = [];
  const debugCandidates = [];
  // Pass 0: Capture rows that are ONLY item (possibly CSI code) + amount with blank middle columns.
  // Criteria: line starts with CSI-like code (two-digit groups) or uppercase words, has exactly one monetary token,
  // and after removing leading CSI groups and trailing amount there are no remaining standalone numbers.
  for (let li=0; li<lines.length; li++) {
    const raw = lines[li];
    let line = String(raw||'').replace(/\s+/g,' ').trim();
    if(!line) continue;
    if(/\b(ITEM|DESCRIPTION|UNIT|QUANTITY|QTY|RATE|PRICE|MATERIAL|OTHERS|TOTAL|AMOUNT)\b/i.test(line)) continue;
    const moneyTokens = line.match(moneyRe)||[];
    if(moneyTokens.length === 1) {
      const amtTok = moneyTokens[0];
      const amount = parseNumberLoose(amtTok);
      if(!Number.isFinite(amount)) continue;
      if(!/,/.test(amtTok) && amount < 500) continue;
      // Extract working copy w/o amount
      const withoutAmount = line.replace(amtTok,'').trim();
      // Detect leading CSI code clusters and strip them for analysis
      let remainder = withoutAmount.replace(/^((\d{2}\s+){2,4}\d{2})/, '').trim();
      // If remainder still contains digits (other than inside words) treat as having extra columns -> skip
      if(/\d/.test(remainder)) {
        // maybe it's just the code broken with description lines following and amount is separate single-number line; handle later
      } else {
        // Accept as clean item-only row (code+amount or description+amount only)
        const title = withoutAmount.replace(/[,;:.-]+$/,'').trim();
        if((title.match(/[A-Za-z]/g)||[]).length >= 2) {
          items.push({ index: items.length+1, code: '', title, amount, source: 'item-only-line', lineIndex: li });
        }
      }
    }
    // Multi-line variant: CSI code/description line followed by pure amount numeric-only line within next 2 lines
    if(/^(\d{2}\s+){2,4}\d{2}\b/.test(line)) {
      // Skip if we already captured this line via single-line rule
      const lookAmountLine = (offset) => {
        const l2 = String(lines[li+offset]||'').replace(/\s+/g,' ').trim();
        if(!l2) return null;
        if(/^-?[\d,]+(?:\.\d+)?$/.test(l2)) {
          const val = parseNumberLoose(l2);
          if(Number.isFinite(val) && (/,/.test(l2) || val >= 500)) return { val, raw: l2, idx: li+offset };
        }
        return null;
      };
      let found = lookAmountLine(1) || lookAmountLine(2);
      if(found) {
        const codeTitle = line.replace(/[,;:.-]+$/,'').trim();
        if(!items.some(it => it.lineIndex === li)) {
          items.push({ index: items.length+1, code: '', title: codeTitle, amount: found.val, source: 'item-only-multiline', lineIndex: li });
        }
      }
    }
  }

  for (let li = 0; li < lines.length; li++) {
    const raw = lines[li];
    const line = String(raw||'').replace(/\s+/g,' ').trim();
    if(!line) continue;
    if(/\b(ITEM|DESCRIPTION|UNIT|QUANTITY|QTY|RATE|PRICE|MATERIAL|OTHERS|TOTAL|AMOUNT)\b/i.test(line)) continue;
    const nums = line.match(moneyRe)||[];
    if(nums.length !== 1) continue;
    const amtToken = nums[0];
    const amount = parseNumberLoose(amtToken);
    if(!Number.isFinite(amount)) continue;
    if(!/,/.test(amtToken) && amount < 500) continue;
    let title = line.replace(amtToken,'').trim();
    if((title.match(/[A-Za-z]/g)||[]).length < 2) continue;
    title = title.replace(/[,;:.-]+$/,'').trim();
    items.push({ index: items.length+1, code: '', title, amount, lineIndex: li, source: 'single-line' });
  }

  // Fallback 1: If no items captured, try description line followed by standalone amount line
  if (items.length === 0) {
    for (let i = 0; i < lines.length - 1; i++) {
      const line = String(lines[i]||'').replace(/\s+/g,' ').trim();
      if(!line) continue;
      if(/\b(ITEM|DESCRIPTION|UNIT|QUANTITY|QTY|RATE|PRICE|MATERIAL|OTHERS|TOTAL|AMOUNT)\b/i.test(line)) continue;
      // description must contain letters and NOT end with a number
      if(!/[A-Za-z]/.test(line)) continue;
      // allow ending digit (e.g., item codes like 1 or 10) – removed earlier restriction
      const next = String(lines[i+1]||'').replace(/\s+/g,' ').trim();
      if(!next) continue;
    if(/^-?[\d,]+(?:\.\d+)?$/.test(next)) { // pure numeric
        const val = parseNumberLoose(next);
        if(Number.isFinite(val) && val >= 500) {
      items.push({ index: items.length+1, code: '', title: line, amount: val, source: 'desc+numeric-next', lineIndex: i });
        }
      }
    }
  }

  // Fallback 2: If still none, capture any line whose LAST token is a large monetary value, ignoring earlier numeric tokens
  if (items.length === 0) {
    for (let li=0; li<lines.length; li++) {
      const raw = lines[li];
      const line = String(raw||'').replace(/\s+/g,' ').trim();
      if(!line) continue;
      if(/\b(ITEM|DESCRIPTION|UNIT|QUANTITY|QTY|RATE|PRICE|MATERIAL|OTHERS|TOTAL|AMOUNT)\b/i.test(line)) continue;
      if(!/[A-Za-z]/.test(line)) continue;
      const nums = line.match(moneyRe)||[];
      if(!nums.length) continue;
      const lastTok = nums[nums.length-1];
      const amount = parseNumberLoose(lastTok);
      if(!Number.isFinite(amount)) continue;
      if(!/,/.test(lastTok) && amount < 1000) continue; // require stronger threshold for this loose mode
      // ensure last token is at end
      if(!new RegExp(`${lastTok.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\s*$`).test(line)) continue;
      // avoid obvious section headers A. Something
      if(/^\s*[A-Z]\s*(?:[.)-])\s+/.test(line)) continue;
      let title = line.replace(lastTok,'').trim();
      title = title.replace(/[,;:.-]+$/,'').trim();
      if((title.match(/[A-Za-z]/g)||[]).length < 2) continue;
      items.push({ index: items.length+1, code: '', title, amount, source: 'loose-last-token', lineIndex: li });
    }
  }

  // Fallback 3: Broader capture even if some items already found – lines with multiple numeric tokens where last looks like total
  const existingLineSet = new Set();
  // Build set by reconstructing title+amount for simple duplicate prevention
  for (const it of items) existingLineSet.add(`${it.title}|${it.amount}`);
  const multiLineAdds = [];
  for (let li=0; li<lines.length; li++) {
    const raw = lines[li];
    const line = String(raw||'').replace(/\s+/g,' ').trim();
    if(!line) continue;
    if(/\b(ITEM|DESCRIPTION|UNIT|QUANTITY|QTY|RATE|PRICE|MATERIAL|OTHERS|TOTAL|AMOUNT)\b/i.test(line)) continue;
    if(/^\s*[A-Z]\s*(?:[.)-])\s+/.test(line)) continue; // section header
    if(!/[A-Za-z]/.test(line)) continue;
    const nums = line.match(moneyRe)||[];
    if(nums.length < 2) continue; // need multiple numbers to treat last as total
    const lastTok = nums[nums.length-1];
    const amount = parseNumberLoose(lastTok);
    if(!Number.isFinite(amount)) continue;
    // Accept if last token has comma OR >= 1000 OR (>= 500 and has decimals .00/.50/.25 typical pricing)
    if(!/,/.test(lastTok) && amount < 1000 && !(amount >= 500 && /\.00|\.25|\.50|\.75$/.test(lastTok))) continue;
    // Ensure last token at end
    if(!new RegExp(`${lastTok.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\s*$`).test(line)) continue;
    // Build title by stripping trailing amount and any trailing small numeric tokens before it (like qty x rate)
    let titlePart = line;
    // Remove last token
    titlePart = titlePart.slice(0, titlePart.lastIndexOf(lastTok)).trim();
    // Optionally strip trailing rate/qty patterns (e.g., '10 2.50') if present
    titlePart = titlePart.replace(/(\d[\d,]*\s+){1,3}$/,'').trim();
    if((titlePart.match(/[A-Za-z]/g)||[]).length < 2) continue;
    const dedupeKey = `${titlePart}|${amount}`;
    if(existingLineSet.has(dedupeKey)) continue;
    existingLineSet.add(dedupeKey);
    multiLineAdds.push({ index: items.length + multiLineAdds.length + 1, code: '', title: titlePart, amount, source: 'multi-last', lineIndex: li });
  }
  if (multiLineAdds.length) {
    // Append in order found
    for (const m of multiLineAdds) items.push(m);
  }

  // Collect debug candidate lines with numbers for troubleshooting if still empty
  if (items.length === 0) {
    for (const raw of lines) {
      const line = String(raw||'').replace(/\s+/g,' ').trim();
      if(!line) continue;
      const nums = line.match(moneyRe)||[];
      if(nums.length) debugCandidates.push({ line, nums });
      if(debugCandidates.length >= 30) break;
    }
  }
  // Post-process titles: remove residual numeric qty/rate columns so only description remains
  if (items.length) {
    const unitTokens = new Set(['m','m2','sqm','sq.m','pcs','pc','lot','lump','lump-sum','ls','set','sets','kg','bag','bags','unit','units','osm']);
    for (const it of items) {
      let tokens = it.title.split(/\s+/);
      // Remove trailing numeric clusters (quantities/rates) at end
      while (tokens.length) {
        const t = tokens[tokens.length-1];
        if (unitTokens.has(t.toLowerCase()) || /^\d[\d,]*(?:\.\d+)?$/.test(t)) { tokens.pop(); continue; }
        break;
      }
      // Drop isolated numeric tokens inside, keep those with letters
      tokens = tokens.filter(t => !/^\d[\d,]*(?:\.\d+)?$/.test(t) || /[A-Za-z]/.test(t));
      // Reconstruct
      let cleaned = tokens.join(' ').replace(/[,;:.-]+$/,'').trim();
      if (cleaned.length < 2) cleaned = it.title; // fallback
      // Truncate at first pattern that looks like start of qty/rate columns: unit token followed by one or more numbers
      const colIdx = cleaned.split(/\s+/).findIndex((tok, idx, arr) => {
        const lower = tok.toLowerCase();
        if (unitTokens.has(lower)) {
          // next tokens numeric?
          if (idx+1 < arr.length && /^\d/.test(arr[idx+1])) return true;
        }
        return false;
      });
      if (colIdx > 1) {
        cleaned = cleaned.split(/\s+/).slice(0, colIdx).join(' ');
      }
      // If after cleaning the title starts with a unit token or is very short, attempt to prepend previous line's leading words
      if ((unitTokens.has(cleaned.split(/\s+/)[0]?.toLowerCase()||'') || cleaned.split(/\s+/).length < 2) && Number.isInteger(it.lineIndex) && it.lineIndex > 0) {
        const prev = String(lines[it.lineIndex-1]||'').replace(/\s+/g,' ').trim();
        if(prev && /[A-Za-z]/.test(prev) && !/^\d+$/.test(prev)) {
          const prevShort = prev.split(/\s+/).slice(0,5).join(' ');
          cleaned = `${prevShort} ${cleaned}`.trim();
        }
      }
      it.title = cleaned;
    }
  }
  // -------------------------------------------------------
  // Positional fallback: if too few items (< 10) attempt better column parsing
  // -------------------------------------------------------
  async function positionalItems(buffer) {
    try {
      if (!pdfjsLib) pdfjsLib = require('pdfjs-dist');
      const loadingTask = pdfjsLib.getDocument({ data: buffer });
      const doc = await loadingTask.promise;
      const rows = [];
      const maxPages = Math.min(doc.numPages, 15);
      for (let p=1; p<=maxPages; p++) {
        const page = await doc.getPage(p);
        const content = await page.getTextContent();
        const lineMap = new Map();
        for (const item of content.items) {
          const s = (item.str||'').trim();
          if(!s) continue;
            const y = Math.round(item.transform[5]);
            const key = Math.round(y/2)*2;
            if(!lineMap.has(key)) lineMap.set(key, []);
            lineMap.get(key).push({ x: item.transform[4], text: s });
        }
        for (const parts of lineMap.values()) {
          parts.sort((a,b)=>a.x-b.x);
          const tokens = parts.map(p=>p.text);
          const full = tokens.join(' ').replace(/\s+/g,' ').trim();
          if(full) rows.push({ tokens, full });
        }
      }
      const moneyTokenRe = /^(?:[$₱]?\d{1,3}(?:,\d{3})+(?:\.\d+)?|[$₱]?\d+\.\d{2}|[$₱]?\d{3,})$/;
      const unitTokens = new Set(['M','M2','SQM','SQ.M','PCS','PC','LOT','LUMP','LS','SET','SETS','KG','BAG','BAGS','UNIT','UNITS','OSM']);
      const out = [];
      for (const r of rows) {
        // Find candidate amount token: last token that matches money pattern & value >= 300 or contains comma
        let amtIdx = -1, amtVal = null, amtRaw = null;
        for (let i=r.tokens.length-1; i>=0; i--) {
          const tk = r.tokens[i];
          if (!moneyTokenRe.test(tk)) continue;
          const val = parseNumberLoose(tk);
          if(!Number.isFinite(val)) continue;
          if(!/,/.test(tk) && val < 300) continue;
          amtIdx = i; amtVal = val; amtRaw = tk; break;
        }
        if(amtIdx === -1) continue;
        // Build description from tokens before first numeric/unit column cluster
        const before = r.tokens.slice(0, amtIdx);
        if(before.length < 1) continue;
        // Truncate at start of trailing numeric column region: find first index after at least 2 leading textual tokens where token is unit or number
        let cut = before.length;
        for (let i=2; i<before.length; i++) {
          const tk = before[i];
          const isNum = /^\d/.test(tk) || moneyTokenRe.test(tk);
          const isUnit = unitTokens.has(tk.toUpperCase());
          if (isUnit || isNum) { cut = i; break; }
        }
        let descTokens = before.slice(0, cut);
        // Remove dangling punctuation
        let title = descTokens.join(' ').replace(/[,;:.-]+$/,'').trim();
        if((title.match(/[A-Za-z]/g)||[]).length < 2) continue;
        // Deduplicate against existing items by title+amount
        const key = `${title}|${amtVal}`;
        out.push({ title, amount: amtVal, source: 'positional' });
      }
      // Deduplicate out by key keep first
      const map = new Map();
      for (const o of out) { const k=`${o.title}|${o.amount}`; if(!map.has(k)) map.set(k,o); }
      return [...map.values()];
    } catch(e){
      return [];
    }
  }

  if (items.length < 10) {
    const pos = await positionalItems(buffer);
    if (pos.length > items.length) {
      // Replace items with positional results, add indices
      items.length = 0;
      pos.forEach((p,i)=> items.push({ index: i+1, code: '', title: p.title, amount: p.amount, source: p.source }));
    }
  }
  const totalAll = items.reduce((s,x)=>s + (Number(x.amount)||0),0);
  // Normalize titles in fallback path
  items.forEach(it => { it.title = normalizeBrokenCapsTitle(it.title); });
  return {
    mode: 'ITEM_AMOUNT_ONLY',
    sections: [],
    greenItems: items,
    sectionTotal: 0,
    rowSum: totalAll,
    csiSum: 0,
    totalAll,
    autoDeductEligible: true,
    confidenceSummary: { strategy: 'single-line-one-amount', itemCount: items.length },
    _debug: items.length === 0 ? { candidates: debugCandidates } : undefined
  };
}

module.exports = {
  sumBudgetFromPdfBuffer,
  extractSectionTotalsFromText,
  extractRowAmountsFromText,
  extractCsiHeaderTotalsFromText,
  extractSimpleItemLines,
  extractTopLevelItemTotals,
  extractTopLevelUsingPositions,
};
