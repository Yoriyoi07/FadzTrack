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

async function extractPptText(buffer, { ocr = true, ocrLang = 'eng' } = {}) {
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
  // We may need to read media relationships for image-only slides.
  // Map slide -> array of embedded image paths (simplistic rel parsing)
  const relCache = {};
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
    let finalSlideText = slideText;
    let ocrAdded = '';
    if ((!finalSlideText || finalSlideText === '(no visible text)') && ocr) {
      // Attempt OCR: find image files referenced by slide (naive: look for r:embed ids in slide xml)
      try {
        const embedIds = Array.from(sXml.matchAll(/r:embed="(rId[^"]+)"/g)).map(m => m[1]);
        // Parse slide rels file
        const relPath = sPath.replace('slides/slide', 'slides/_rels/slide') + '.rels';
        let imagePaths = [];
        if (zip.files[relPath]) {
          const relXml = await zip.file(relPath).async('string');
            imagePaths = Array.from(relXml.matchAll(/<Relationship[^>]+Id="(rId[^"]+)"[^>]+Target="([^"]+)"/g))
              .filter(r => embedIds.includes(r[1]) && /(media\/image\d+\.(png|jpg|jpeg))/i.test(r[2]))
              .map(r => `ppt/${r[2]}`);
        }
        const { createWorker } = (() => { try { return require('tesseract.js'); } catch { return {}; } })();
        if (createWorker && imagePaths.length) {
          const worker = await createWorker(ocrLang, 1, { logger: ()=>{} });
          for (const imgRel of imagePaths) {
            if (!zip.files[imgRel]) continue;
            const imgBuf = await zip.file(imgRel).async('nodebuffer');
            try {
              const { data: { text: ocrText } } = await worker.recognize(imgBuf);
              const clean = (ocrText || '').trim();
              if (clean) ocrAdded += (ocrAdded ? '\n' : '') + clean;
            } catch {}
          }
          await worker.terminate();
        }
      } catch {}
    }
    if (ocrAdded) {
      finalSlideText = [finalSlideText, '[OCR]', ocrAdded].filter(Boolean).join('\n');
    }
    const block = [
      `--- SLIDE ${slideNo} ---`,
      finalSlideText || '(no visible text)',
      notesText ? `\n[NOTES]\n${notesText}` : ''
    ].join('\n');
    all.push(block.trim());
  }
  return all.join('\n\n');
}

module.exports = { extractPptText };
