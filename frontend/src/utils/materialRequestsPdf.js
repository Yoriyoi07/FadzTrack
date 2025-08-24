import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Helpers (similar style to accountsPdf.js)
async function loadImageDataURLWithSize(url) {
  return new Promise((resolve) => {
    if (!url) return resolve(null);
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        c.getContext('2d').drawImage(img, 0, 0);
        resolve({ dataUrl: c.toDataURL('image/png'), w: img.naturalWidth, h: img.naturalHeight });
      };
      img.onerror = () => resolve(null);
      img.src = url;
    } catch {
      resolve(null);
    }
  });
}

function fitInside(w, h, maxW, maxH) {
  if (!w || !h) return { w: maxW, h: maxH };
  const r = Math.min(maxW / w, maxH / h);
  return { w: Math.round(w * r), h: Math.round(h * r) };
}

async function loadFontFromPublic(doc, fileName, family, style) {
  try {
    const base = process.env.PUBLIC_URL || '';
    const url = `${base}/fonts/${fileName}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return false;
    const buf = await res.arrayBuffer();
    const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
    doc.addFileToVFS(fileName, b64);
    doc.addFont(fileName, family, style);
    return true;
  } catch {
    return false;
  }
}

function fontUsable(doc, family, style = 'normal') {
  try {
    doc.setFont(family, style);
    doc.getTextWidth('test');
    return true;
  } catch {
    return false;
  }
}

function formatDateTime(dt = new Date()) {
  try {
    return new Date(dt).toLocaleString();
  } catch {
    return String(dt);
  }
}

function buildFiltersSummary(filters = {}) {
  const parts = [];
  Object.entries(filters).forEach(([k, v]) => {
    if (v && String(v).toLowerCase() !== 'all') parts.push(`${k}: ${v}`);
  });
  return parts.join(' | ');
}

function buildFileName(prefix = 'MaterialRequests') {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const name = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
  return `${prefix}-${name}.pdf`;
}

function computeStatusLabel(req) {
  if (req?.receivedByPIC) return 'Completed';
  const s = (req?.status || '').toLowerCase();
  if (s.includes('approved')) return 'Approved';
  if (s.includes('pending')) return 'Pending';
  if (s.includes('denied') || s.includes('cancel')) return 'Rejected';
  return 'Unknown';
}

export async function exportMaterialRequestsPdf(rows = [], options = {}) {
  const {
    companyName = 'FadzTrack',
    logoPath = `${process.env.PUBLIC_URL || ''}/images/Fadz-logo.png`,
    exporterName = 'Unknown',
    exporterRole = '',
    filters = {},
  } = options;

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });

  // Fonts
  const FAMILY = 'NotoSans';
  const regOk = await loadFontFromPublic(doc, 'NotoSans-Regular.ttf', FAMILY, 'normal');
  const boldOk = await loadFontFromPublic(doc, 'NotoSans-Bold.ttf', FAMILY, 'bold');
  const canUseRegular = regOk && fontUsable(doc, FAMILY, 'normal');
  const canUseBold = boldOk && fontUsable(doc, FAMILY, 'bold');
  const bodyFont = canUseRegular ? FAMILY : 'helvetica';
  const headStyle = canUseBold ? 'bold' : 'normal';

  const marginX = 40;
  let y = 40;

  // Header: logo + company name + context
  const logo = await loadImageDataURLWithSize(logoPath);
  let titleX = marginX;
  if (logo?.dataUrl) {
    const { w: drawW, h: drawH } = fitInside(logo.w, logo.h, 140, 40);
    doc.addImage(logo.dataUrl, 'PNG', marginX, y - 8, drawW, drawH, undefined, 'FAST');
    titleX = marginX + drawW + 10;
  }

  doc.setFont(bodyFont, headStyle);
  doc.setFontSize(18);
  doc.setTextColor(20);
  doc.text(String(companyName), titleX, y + 10);

  doc.setFont(bodyFont, 'normal');
  doc.setFontSize(12);
  doc.setTextColor(90);
  doc.text('Material Requests Export', titleX, y + 26);

  // Divider
  doc.setDrawColor(220);
  doc.setLineWidth(1);
  doc.line(marginX, y + 38, 595 - marginX, y + 38);
  y += 54;

  // Metadata block
  doc.setFont(bodyFont, headStyle);
  doc.setFontSize(12);
  doc.setTextColor(20);
  doc.text('Export Details', marginX, y);

  doc.setFont(bodyFont, 'normal');
  doc.setTextColor(60);
  const meta = [
    `Exported by: ${exporterName}${exporterRole ? ` (${exporterRole})` : ''}`,
    `Date exported: ${formatDateTime(new Date())}`,
  ];
  const filterSummary = buildFiltersSummary(filters);
  if (filterSummary) meta.push(`Filters: ${filterSummary}`);

  let metaY = y + 16;
  meta.forEach((line) => {
    doc.text(line, marginX, metaY);
    metaY += 16;
  });

  // Table
  const tableStartY = metaY + 6;
  const head = [['Date', 'Requester', 'Project', 'Materials', 'Status']];
  const body = rows.map((r) => {
    const materials = Array.isArray(r.materials)
      ? r.materials.map((m) => `${m.materialName || ''}${m.quantity ? ` (${m.quantity})` : ''}`).join(', ')
      : '';
    return [
      r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '',
      String(r.createdBy?.name || ''),
      String(r.project?.projectName || ''),
      materials,
      computeStatusLabel(r),
    ];
  });

  autoTable(doc, {
    startY: tableStartY,
    head,
    body,
    styles: { font: bodyFont, fontStyle: 'normal', fontSize: 10, cellPadding: 5, halign: 'left', overflow: 'linebreak' },
    headStyles: { font: bodyFont, fontStyle: headStyle, fillColor: [59, 130, 246], textColor: 255 },
    theme: 'grid',
    margin: { left: marginX, right: marginX },
    columnStyles: { 3: { cellWidth: 220 } },
    didDrawPage: () => {
      const str = `Generated: ${formatDateTime(new Date())}`;
      doc.setFont(bodyFont, 'normal');
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text(str, marginX, 842 - 24);

      const page = doc.getCurrentPageInfo().pageNumber || 1;
      const pages = doc.getNumberOfPages();
      const label = `Page ${page} of ${pages}`;
      const w = doc.getTextWidth(label);
      doc.text(label, 595 - marginX - w, 842 - 24);
    },
  });

  doc.save(buildFileName());
}


