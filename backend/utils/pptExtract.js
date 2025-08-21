// utils/pptExtract.js
const JSZip = require('jszip');

function decodeEntities(str = '') {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g,  '<')
    .replace(/&gt;/g,  '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g,  "'")
    .replace(/&nbsp;/g, ' ');
}

function extractTextFromSlideXml(xml = '') {
  if (!xml) return '';
  const paras = [];
  const pRe = /<a:p[\s\S]*?<\/a:p>/g;
  const tRe = /<a:t[^>]*>([\s\S]*?)<\/a:t>/g;
  let pMatch;
  while ((pMatch = pRe.exec(xml)) !== null) {
    const pXml = pMatch[0];
    let line = '';
    let tMatch;
    while ((tMatch = tRe.exec(pXml)) !== null) {
      line += decodeEntities(tMatch[1]);
    }
    paras.push(line.trim());
  }
  if (!paras.length) {
    let t2, arr = [];
    while ((t2 = tRe.exec(xml)) !== null) arr.push(decodeEntities(t2[1]).trim());
    return arr.join('\n');
  }
  const compact = [];
  for (const ln of paras) {
    if (ln === '' && compact.length && compact[compact.length - 1] === '') continue;
    compact.push(ln);
  }
  return compact.join('\n');
}

function extractTextFromNotesXml(xml = '') {
  if (!xml) return '';
  const tRe = /<a:t[^>]*>([\s\S]*?)<\/a:t>/g;
  let out = '', m;
  while ((m = tRe.exec(xml)) !== null) {
    const s = decodeEntities(m[1]).trim();
    if (s) out += s + '\n';
  }
  return out.trim();
}

async function extractPptText(buffer) {
  if (!Buffer.isBuffer(buffer)) throw new Error('extractPptText expects a Buffer');
  const isZip = buffer[0] === 0x50 && buffer[1] === 0x4B; // 'PK'
  if (!isZip) throw new Error('Only .pptx is supported');
  const zip = await JSZip.loadAsync(buffer);
  const slideFolder = 'ppt/slides/';
  const noteFolder  = 'ppt/notesSlides/';
  const slideFiles = Object.keys(zip.files)
    .filter(p => p.startsWith(slideFolder) && p.endsWith('.xml'))
    .sort((a, b) => {
      const na = parseInt((a.match(/slide(\d+)\.xml$/) || [0, '0'])[1], 10);
      const nb = parseInt((b.match(/slide(\d+)\.xml$/) || [0, '0'])[1], 10);
      return na - nb;
    });
  if (!slideFiles.length) throw new Error('No slides found');

  let all = [];
  for (const sPath of slideFiles) {
    const sXml = await zip.file(sPath).async('string');
    const slideText = extractTextFromSlideXml(sXml);
    const slideNo = parseInt((sPath.match(/slide(\d+)\.xml$/) || [0, '0'])[1], 10);
    const nPath = `${noteFolder}notesSlide${slideNo}.xml`;
    let notesText = '';
    if (zip.files[nPath]) {
      try {
        const nXml = await zip.file(nPath).async('string');
        notesText = extractTextFromNotesXml(nXml);
      } catch {}
    }
    const block = [
      `--- SLIDE ${slideNo} ---`,
      slideText || '(no visible text)',
      notesText ? `\n[NOTES]\n${notesText}` : ''
    ].join('\n');
    all.push(block.trim());
  }
  return all.join('\n\n');
}

module.exports = { extractPptText };
