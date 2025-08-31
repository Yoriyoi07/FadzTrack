// src/utils/projectPdf.js
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/* ---------- helpers ---------- */
const pesoIntl = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });
const fmtDate = (d) => {
  if (!d) return 'N/A';
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? 'N/A' : dt.toLocaleDateString();
};
const sanitizeFilename = (s = '') => (s || 'Project').replace(/[\/\\?%*:|"<>]/g, '_');
const readLocation = (p) =>
  p?.location?.name ? `${p.location.name}${p.location?.region ? ` (${p.location.region})` : ''}` : 'N/A';

function readContractor(p) {
  const c = p?.contractor;
  if (!c) return 'N/A';
  if (typeof c === 'string') return c.trim() || 'N/A';
  if (Array.isArray(c)) {
    const names = c
      .map((x) => (typeof x === 'string' ? x : x?.name || x?.company || x?.companyName || ''))
      .map((s) => (typeof s === 'string' ? s.trim() : ''))
      .filter(Boolean);
    return names.length ? names.join(', ') : 'N/A';
  }
  if (typeof c === 'object') {
    for (const v of [c.name, c.company, c.companyName, c.title, c.fullName]) {
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
  }
  if (typeof p?.contractorName === 'string' && p.contractorName.trim()) return p.contractorName.trim();
  return 'N/A';
}

/* image + font utilities */
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

/* Fit (w,h) inside maxW×maxH preserving aspect ratio */
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

/* peso string with safe fallback */
function makePesoText(preferPesoSign, pesoGlyphAvailable) {
  return (n) => {
    const txt = pesoIntl.format(Number(n || 0));
    if (preferPesoSign && pesoGlyphAvailable) {
      return txt.replace('PHP', '₱').replace(/\s+/g, ' ');
    }
    return txt.replace('₱', 'PHP');
  };
}

/* ---------- main ---------- */
export async function exportProjectDetails(project, opts = {}) {
  const {
    contextTitle = 'Project Details',
    includeHrSite = true,
    includeStaff = true,
    includePIC = true,
    includeAM = true,
    includePM = true,
    includeBudget = true,
    preferPesoSign = false, // set true only if your font definitely has ₱
  } = opts;

  const doc = new jsPDF({ unit: 'pt', format: 'a4' }); // 595×842

  // Try to use Noto Sans from /public/fonts for better glyph coverage
  const FAMILY = 'NotoSans';
  const regOk = await loadFontFromPublic(doc, 'NotoSans-Regular.ttf', FAMILY, 'normal');
  const boldOk = await loadFontFromPublic(doc, 'NotoSans-Bold.ttf', FAMILY, 'bold');
  const canUseRegular = regOk && fontUsable(doc, FAMILY, 'normal');
  const canUseBold = boldOk && fontUsable(doc, FAMILY, 'bold');

  const bodyFont = canUseRegular ? FAMILY : 'helvetica';
  const headStyle = canUseBold ? 'bold' : 'normal';
  const pesoText = makePesoText(preferPesoSign, canUseRegular);

  const marginX = 40;
  let y = 36;

  /* -- header: logo (kept ratio) + brand + context -- */
  const logoURL = `${process.env.PUBLIC_URL || ''}/images/Fadz-logo.png`;
  const logo = await loadImageDataURLWithSize(logoURL);
  let titleX = marginX;

  if (logo?.dataUrl) {
    const targetH = 36; // fixed height
    const r = (logo.w && logo.h) ? logo.w / logo.h : 1;
    const targetW = Math.min(160, Math.max(60, targetH * r)); // clamp a bit
    doc.addImage(logo.dataUrl, 'PNG', marginX, y - 8, targetW, targetH, undefined, 'FAST');
    titleX = marginX + targetW + 12; // place text after the logo
  }

  doc.setFont(bodyFont, headStyle);
  doc.setFontSize(18);
  doc.setTextColor(20);
  doc.text('FadzTrack', titleX, y + 12);

  doc.setFont(bodyFont, 'normal');
  doc.setFontSize(12);
  doc.setTextColor(90);
  doc.text(String(contextTitle || ''), titleX, y + 28);

  // divider
  doc.setDrawColor(220);
  doc.setLineWidth(1);
  doc.line(marginX, y + 42, 595 - marginX, y + 42);

  y += 56;

  /* -- project title + right photo (both kept ratio) -- */
  doc.setTextColor(20);
  doc.setFont(bodyFont, headStyle);
  doc.setFontSize(16);
  doc.text(String(project?.projectName || 'Untitled Project'), marginX, y);

  let headerBottom = y;

  const photo = await loadImageDataURLWithSize(project?.photos?.[0]);
  if (photo?.dataUrl) {
    const boxW = 120;
    const boxH = 72;
    const { w: drawW, h: drawH } = fitInside(photo.w, photo.h, boxW, boxH);
    const imgX = 595 - marginX - drawW;
    const imgY = y - 22 + Math.round((boxH - drawH) / 2); // vertical center in the 72pt band
    doc.addImage(photo.dataUrl, 'PNG', imgX, imgY, drawW, drawH, undefined, 'FAST');
    headerBottom = Math.max(headerBottom, imgY + drawH);
  }

  const blockGap = 16;
  const detailsStartY = Math.max(y + 8, headerBottom + blockGap);

  /* -- details table -- */
  const detailsRows = [
    ['Location', readLocation(project)],
    ['Project Manager', project?.projectmanager?.name || 'N/A'],
    ['Contractor', readContractor(project)],
    ['Start Date', fmtDate(project?.startDate)],
    ['End Date', fmtDate(project?.endDate)],
    ['Status', project?.status || 'N/A'],
  ];
  if (includeBudget) detailsRows.splice(1, 0, ['Budget', pesoText(project?.budget)]);

  autoTable(doc, {
    startY: detailsStartY,
    head: [['Field', 'Value']],
    body: detailsRows,
    styles: { font: bodyFont, fontStyle: 'normal', fontSize: 11, cellPadding: 8, halign: 'left' },
    headStyles: { font: bodyFont, fontStyle: headStyle, fillColor: [25, 118, 210], textColor: 255 },
    columnStyles: { 0: { cellWidth: 150 } },
    theme: 'grid',
    margin: { left: marginX, right: marginX },
  });

  /* -- staff table -- */
  const staffRows = [];
  if (includePM && project?.projectmanager) staffRows.push(['Project Manager', project.projectmanager.name || '']);
  if (includeAM && project?.areamanager) staffRows.push(['Area Manager', project.areamanager.name || '']);
  if (includePIC && Array.isArray(project?.pic)) project.pic.forEach((p) => staffRows.push(['Person in Charge', p?.name || '']));
  if (includeHrSite && Array.isArray(project?.hrsite)) project.hrsite.forEach((h) => staffRows.push(['HR - Site', h?.name || '']));
  if (includeStaff && Array.isArray(project?.staff)) project.staff.forEach((s) => staffRows.push(['Staff', s?.name || '']));

  if (staffRows.length) {
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 18,
      head: [['Role', 'Name']],
      body: staffRows,
      styles: { font: bodyFont, fontStyle: 'normal', fontSize: 11, cellPadding: 8, halign: 'left' },
      headStyles: { font: bodyFont, fontStyle: headStyle, fillColor: [76, 175, 80], textColor: 255 },
      theme: 'grid',
      margin: { left: marginX, right: marginX },
    });
  }

  /* -- footer -- */
  const pageCount = doc.getNumberOfPages();
  doc.setFont(bodyFont, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(120);
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const footerY = 842 - 24;
    doc.text(`Generated: ${new Date().toLocaleString()}`, marginX, footerY);
    const label = `Page ${i} of ${pageCount}`;
    const w = doc.getTextWidth(label);
    doc.text(label, 595 - marginX - w, footerY);
  }

  doc.save(`Project-${sanitizeFilename(project?.projectName)}.pdf`);
}

export const generateProjectPDF = (data) => {
  const { companyName, companyLogo, exportedBy, exportDate, filters, projects } = data;
  
  // Create PDF in landscape mode
  const pdf = new jsPDF('landscape', 'mm', 'a4');
  
  // Set font
  pdf.setFont('helvetica');
  
  // Add company logo and header
  pdf.setFontSize(24);
  pdf.setTextColor(30, 41, 59);
  pdf.text(companyName, 20, 30);
  
  pdf.setFontSize(12);
  pdf.setTextColor(100, 116, 139);
  pdf.text(`Exported by: ${exportedBy}`, 20, 40);
  pdf.text(`Export Date: ${exportDate}`, 20, 47);
  
  // Add filter information
  if (filters.status !== 'all' || filters.search || filters.dateFrom || filters.dateTo) {
    pdf.setFontSize(14);
    pdf.setTextColor(30, 41, 59);
    pdf.text('Export Filters:', 20, 60);
    
    pdf.setFontSize(10);
    pdf.setTextColor(100, 116, 139);
    let filterY = 70;
    
    if (filters.status !== 'all') {
      pdf.text(`Status: ${filters.status.charAt(0).toUpperCase() + filters.status.slice(1)}`, 20, filterY);
      filterY += 7;
    }
    
    if (filters.search) {
      pdf.text(`Search: "${filters.search}"`, 20, filterY);
      filterY += 7;
    }
    
    if (filters.dateFrom || filters.dateTo) {
      const dateRange = [];
      if (filters.dateFrom) dateRange.push(`From: ${filters.dateFrom}`);
      if (filters.dateTo) dateRange.push(`To: ${filters.dateTo}`);
      pdf.text(`Date Range: ${dateRange.join(' - ')}`, 20, filterY);
      filterY += 7;
    }
  }
  
  // Add project count
  pdf.setFontSize(12);
  pdf.setTextColor(30, 41, 59);
  pdf.text(`Total Projects: ${projects.length}`, 20, filters.status !== 'all' || filters.search || filters.dateFrom || filters.dateTo ? 85 : 60);
  
  // Create table data
  const tableData = projects.map(project => [
    project.name,
    project.area,
    project.pm,
    project.contractor,
    project.timeline,
    project.pics,
    project.budget
  ]);
  
  // Add table
  pdf.autoTable({
    head: [['Project Name', 'Area', 'Project Manager', 'Contractor', 'Timeline', 'PICs', 'Budget']],
    body: tableData,
    startY: filters.status !== 'all' || filters.search || filters.dateFrom || filters.dateTo ? 95 : 70,
    margin: { top: 20 },
    styles: {
      fontSize: 9,
      cellPadding: 3,
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 40 }, // Project Name
      1: { cellWidth: 30 }, // Area
      2: { cellWidth: 35 }, // Project Manager
      3: { cellWidth: 35 }, // Contractor
      4: { cellWidth: 35 }, // Timeline
      5: { cellWidth: 40 }, // PICs
      6: { cellWidth: 25 }, // Budget
    },
    didDrawPage: function (data) {
      // Add page number
      pdf.setFontSize(10);
      pdf.setTextColor(100, 116, 139);
      pdf.text(`Page ${pdf.internal.getCurrentPageInfo().pageNumber}`, pdf.internal.pageSize.width - 30, pdf.internal.pageSize.height - 10);
    }
  });
  
  // Add footer
  const pageCount = pdf.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(100, 116, 139);
    pdf.text(`${companyName} - Project Export`, 20, pdf.internal.pageSize.height - 10);
    pdf.text(`Generated on ${exportDate}`, pdf.internal.pageSize.width - 60, pdf.internal.pageSize.height - 10);
  }
  
  // Save the PDF
  const fileName = `projects_export_${exportDate.replace(/\//g, '-')}.pdf`;
  pdf.save(fileName);
};
