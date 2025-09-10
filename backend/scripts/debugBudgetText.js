const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');

async function main() {
  const pdfPath = process.argv[2];
  if (!pdfPath) {
    console.error('Usage: node scripts/debugBudgetText.js <path-to-pdf> [maxLines]');
    process.exit(1);
  }
  const abs = path.resolve(pdfPath);
  if (!fs.existsSync(abs)) {
    console.error('File not found:', abs);
    process.exit(2);
  }
  const maxLines = parseInt(process.argv[3] || '180', 10);
  try {
    const buf = fs.readFileSync(abs);
    const { text } = await pdfParse(buf);
    const allLines = String(text || '').split(/\r?\n/);
    const sectionHeaderRe = /^\s*[A-Z]\s*(?:\)|\.|-)\s+/; // matches A) B. etc
    let lastSectionIdx = -1;
    allLines.forEach((ln, idx) => {
      if (sectionHeaderRe.test(ln)) lastSectionIdx = idx;
    });
    const start = Math.max(0, lastSectionIdx + 1);
    const slice = allLines.slice(start, start + maxLines);
    console.log('--- DEBUG: lines after last lettered section (index', lastSectionIdx, ') ---');
    slice.forEach((ln, i) => {
      const globalIdx = start + i;
      const cleaned = ln.replace(/\t/g, ' ');
      console.log(String(globalIdx).padStart(5, '0') + ' | ' + cleaned);
    });
    console.log('--- END DEBUG (printed', slice.length, 'lines) ---');
  } catch (err) {
    console.error('Parse error:', err.message || err);
    process.exit(3);
  }
}

main();
