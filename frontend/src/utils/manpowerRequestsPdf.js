import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/* ---------- utility functions ---------- */
function loadImageDataURLWithSize(url) {
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

function loadFontFromPublic(doc, fontFile, family, style) {
  return new Promise((resolve) => {
    try {
      const fontPath = `${process.env.PUBLIC_URL || ''}/fonts/${fontFile}`;
      fetch(fontPath)
        .then((r) => r.arrayBuffer())
        .then((buf) => {
          try {
            doc.addFileToVFS(fontFile, buf);
            doc.addFont(fontFile, family, style);
            resolve(true);
          } catch {
            resolve(false);
          }
        })
        .catch(() => resolve(false));
    } catch {
      resolve(false);
    }
  });
}

function fontUsable(doc, family, style) {
  try {
    const fonts = doc.getFontList();
    return fonts && fonts[family] && fonts[family][style];
  } catch {
    return false;
  }
}

function fitInside(w, h, maxW, maxH) {
  if (!w || !h) return { w: maxW, h: maxH };
  const r = Math.min(maxW / w, maxH / h, 1);
  return { w: w * r, h: h * r };
}

function formatDateTime(date) {
  if (!date) return 'N/A';
  const dt = new Date(date);
  return Number.isNaN(dt.getTime()) ? 'N/A' : dt.toLocaleString();
}

function buildFileName(prefix = 'Manpower-Requests-Export') {
  const d = new Date();
  const name = `_${pad(d.getHours())}${pad(d.getMinutes())}`;
  return `${prefix}-${name}.pdf`;
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function buildFiltersSummary(filters) {
  const parts = [];
  if (filters.status && filters.status !== 'all') parts.push(`Status: ${filters.status}`);
  if (filters.search) parts.push(`Search: "${filters.search}"`);
  if (filters.dateFrom) parts.push(`From: ${filters.dateFrom}`);
  if (filters.dateTo) parts.push(`To: ${filters.dateTo}`);
  return parts.length ? parts.join(', ') : null;
}

function computeStatusLabel(req) {
  if (req.status === 'Approved') return 'Approved';
  if (req.status === 'Pending') return 'Pending';
  if (req.status === 'Rejected') return 'Rejected';
  if (req.status === 'Completed') return 'Completed';
  if (req.status === 'In Progress') return 'In Progress';
  return 'Unknown';
}

export async function exportManpowerRequestsPdf(rows = [], options = {}) {
  const {
    companyName = 'FadzTrack',
    logoPath = `${process.env.PUBLIC_URL || ''}/images/Fadz-logo.png`,
    exporterName = 'Unknown',
    exporterRole = '',
    filters = {},
    reportTitle = 'Manpower Requests Export',
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
    const { w: drawW, h: drawH } = fitInside(logo.w, logo.h, 180, 60); // increased size
    doc.addImage(logo.dataUrl, 'PNG', marginX, y - 12, drawW, drawH, undefined, 'FAST');
    titleX = marginX + drawW + 16; // more spacing
  }

  doc.setFont(bodyFont, headStyle);
  doc.setFontSize(20); // increased font size
  doc.setTextColor(20);
  doc.text(String(companyName), titleX, y + 16);

  doc.setFont(bodyFont, 'normal');
  doc.setFontSize(12);
  doc.setTextColor(90);
  doc.text(reportTitle, titleX, y + 26);

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
  const head = [['Date', 'Requester', 'Project', 'Manpower Requested', 'Status', 'Acquisition Date']];
  const body = rows.map((r) => {
    const manpowerList = Array.isArray(r.manpowerRequested)
      ? r.manpowerRequested.map((m) => `${m.name || ''}${m.position ? ` (${m.position})` : ''}`).join(', ')
      : '';
    return [
      r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '',
      String(r.createdBy?.name || ''),
      String(r.project?.projectName || ''),
      manpowerList,
      computeStatusLabel(r),
      r.acquisitionDate ? new Date(r.acquisitionDate).toLocaleDateString() : '',
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
    columnStyles: { 3: { cellWidth: 180 } }, // Manpower Requested column
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
