// controllers/projectController.js
const Project = require('../models/Project');
const { logAction } = require('../utils/auditLogger');
const { hasProfanity, findProfanities } = require('../utils/profanity');
const { createAndEmitNotification } = require('./notificationController');
const User = require('../models/User');
const Manpower = require('../models/Manpower');
const supabase = require('../utils/supabaseClient');
const Notification = require('../models/Notification');
const Chat = require('../models/Chats');
const PDFDocument = require('pdfkit');
const { Server } = require("socket.io");
const XLSX = require('xlsx');
const ExcelJS = require('exceljs');
const { sumBudgetFromPdfBuffer } = require('../utils/budgetPdf');
// Reuse axios for AI summary of attendance
// (Gemini key pulled from env like other AI usage in file)
const GEMINI_API_KEY_ATT = process.env.GEMINI_API_KEY;



// NEW: AI deps
const axios = require('axios');
const { extractPptText } = require('../utils/pptExtract');
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
// use userSockets from app (Server.js sets this on app)
// const userSockets = new Map();
/* -------------------- mention helpers -------------------- */
const slugUser = (s = '') => s.toString().trim().toLowerCase().replace(/\s+/g, '');
const extractMentions = (text = '') => {
  const matches = text.match(/\B@([a-zA-Z0-9._-]+)/g) || [];
  return matches.map(m => m.slice(1).toLowerCase());
};
const collectProjectMembers = (project) => {
  const arr = [
    ...(Array.isArray(project.pic) ? project.pic : project.pic ? [project.pic] : []),
    ...(Array.isArray(project.staff) ? project.staff : project.staff ? [project.staff] : []),
    ...(Array.isArray(project.hrsite) ? project.hrsite : project.hrsite ? [project.hrsite] : []),
    project.projectmanager,
    project.areamanager,
  ].filter(Boolean);

  const byId = new Map();
  for (const u of arr) {
    const id = u?._id?.toString();
    if (!id) continue;
    if (!byId.has(id)) {
      byId.set(id, { _id: id, name: u.name || '', slug: slugUser(u.name || '') });
    }
  }
  return [...byId.values()];
};
/* --------------------------------------------------------- */


function monthName(n) {
  return [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December'
  ][Math.max(0, Math.min(11, n))];
}

function deriveMonthYearFromFilename(name = '') {
  // Looks for things like "APRIL-2025" or "April 2025" in the filename
  const m = String(name).match(/\b(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|SEPT|OCT|NOV|DEC)[A-Z]*[^\w]?[- ]?([12]\d{3})\b/i)
         || String(name).match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s*[- ]?\s*([12]\d{3})\b/i);
  if (!m) return null;

  const monthMap = {
    JAN:0, FEB:1, MAR:2, APR:3, MAY:4, JUN:5,
    JUL:6, AUG:7, SEP:8, SEPT:8, OCT:9, NOV:10, DEC:11
  };
  let monStr = m[1].toUpperCase();
  if (monthMap[monStr] == null) {
    // full name to index
    const idx = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY',
                 'AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'].indexOf(monStr);
    if (idx >= 0) monStr = Object.keys(monthMap)[idx]; // not really used, just guards
  }
  const monIdx =
    monthMap[monStr] ??
    ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER']
      .indexOf(monStr);
  const year = parseInt(m[2], 10);
  if (monIdx >= 0 && Number.isFinite(year)) {
    return { monthIndex: monIdx, year, text: `${monthName(monIdx).toUpperCase()} ${year}` };
  }
  return null;
}

/* ------------------ small filename & doc helpers ------------------ */
function extractOriginalNameFromPath(path = '') {
  const base = (path || '').split('/').pop() || '';
  const underscore = base.indexOf('_'); // e.g. "2025-08-14T12-00-00-000Z_My Doc.pdf"
  if (underscore !== -1 && underscore < base.length - 1) return base.slice(underscore + 1);
  const m = base.match(/^project-\d{8,}-(.+)$/i); // older: "project-1754623938414-My Doc.pdf"
  if (m && m[1]) return m[1];
  return base;
}
function splitNameExt(filename) {
  const dot = filename.lastIndexOf('.');
  if (dot <= 0) return { base: filename, ext: '' };
  return { base: filename.slice(0, dot), ext: filename.slice(dot) };
}
function makeUniqueName(originalName, takenLower) {
  let candidate = originalName;
  let i = 1;
  const { base, ext } = splitNameExt(originalName);
  while (takenLower.has(candidate.toLowerCase())) {
    candidate = `${base} (${i})${ext}`;
    i += 1;
  }
  takenLower.add(candidate.toLowerCase());
  return candidate;
}
function listIncomingFilesMulter(req) {
  if (Array.isArray(req.files)) return req.files;              // upload.array('files') or upload.any()
  if (Array.isArray(req.files?.files)) return req.files.files; // upload.fields([{ name: 'files' }])
  return [];
}
function userCanUploadToProject(project, user) {
  if (!user) return false;
  const allowedRoles = new Set([
    'Person in Charge',
    'Area Manager',
    'Project Manager',
    'Staff',
    'HR - Site',
  ]);
  const roleName = (user.role || '').toString().trim();
  const byRole = roleName && [...allowedRoles].some(r => roleName.toLowerCase() === r.toLowerCase());

  const uid = String(user.id || user._id || '');
  const ids = new Set([
    ...(Array.isArray(project.pic) ? project.pic : project.pic ? [project.pic] : []).map(x => String(x?._id || x)),
    ...(Array.isArray(project.staff) ? project.staff : project.staff ? [project.staff] : []).map(x => String(x?._id || x)),
    ...(Array.isArray(project.hrsite) ? project.hrsite : project.hrsite ? [project.hrsite] : []).map(x => String(x?._id || x)),
    String(project.projectmanager?._id || project.projectmanager || ''),
    String(project.areamanager?._id || project.areamanager || ''),
  ].filter(Boolean));
  const byAssignment = ids.has(uid);
  return byRole || byAssignment;
}
function looksLikeObjectId(s) {
  return typeof s === 'string' && /^[a-f0-9]{24}$/i.test(s);
}
function extractPathFromDoc(d) {
  return (typeof d === 'string') ? d : d?.path;
}
function extractNameFromDoc(d) {
  if (typeof d === 'object' && d?.name) return d.name;
  const p = extractPathFromDoc(d) || '';
  return extractOriginalNameFromPath(p);
}

// Coerce id(s) from body into an array of string ids
function coerceIdArray(val) {
  if (val == null) return [];
  if (Array.isArray(val)) return val.map(v => String(v)).filter(Boolean);
  if (typeof val === 'string') {
    const s = val.trim();
    if (!s) return [];
    // Try JSON array
    if ((s.startsWith('[') && s.endsWith(']')) || (s.startsWith('"') && s.endsWith('"'))) {
      try {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) return parsed.map(v => String(v)).filter(Boolean);
        if (typeof parsed === 'string') return [parsed];
      } catch (_) {}
    }
    // Try comma-separated
    if (s.includes(',')) return s.split(',').map(t => t.trim()).filter(Boolean);
    return [s];
  }
  // Fallback: wrap unknowns
  return [String(val)].filter(Boolean);
}

/* ===== NEW HELPERS: duration parsing + CPA shaping ===== */
function parseDaysFromAny(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const s = value.toLowerCase();

  const mDays = s.match(/(\d+(?:\.\d+)?)\s*(?:d|day|days)\b/);
  if (mDays) return +mDays[1];

  const mHours = s.match(/(\d+(?:\.\d+)?)\s*(?:h|hour|hours)\b/);
  if (mHours) return Math.round(((+mHours[1]) / 24) * 100) / 100;

  return null;
}

function ensureCpaShape(ai) {
  const out = ai && typeof ai === 'object' ? { ...ai } : { critical_path_analysis: [] };
  const wantOrder = ['optimistic','realistic','pessimistic'];
  const parallel = Array.isArray(out.critical_path_days) ? out.critical_path_days : null;

  const byType = new Map(
    (Array.isArray(out.critical_path_analysis) ? out.critical_path_analysis : [])
      .map(x => [String(x?.path_type || '').toLowerCase(), x])
  );

  const pickDefaultDays = (idx, type) => {
    if (parallel && Number.isFinite(parallel[idx])) return parallel[idx];
    if (type === 'optimistic') return 7;
    if (type === 'realistic')  return 14;
    return 21;
  };

  const mk = (type, idx) => {
    const src = byType.get(type) || (out.critical_path_analysis[idx] || {}) || {};
    const fromItem =
      parseDaysFromAny(src.estimated_days) ??
      parseDaysFromAny(src.durationDays) ??
      parseDaysFromAny(src.duration) ??
      parseDaysFromAny(src.duration_text) ??
      parseDaysFromAny(src?.meta?.duration) ??
      null;

    const estimated_days = Number.isFinite(fromItem) ? Math.max(1, Math.round(fromItem)) : pickDefaultDays(idx, type);

    return {
      path_type: type,
      name: (src.name && String(src.name).trim()) || `${type.charAt(0).toUpperCase() + type.slice(1)} Path`,
      estimated_days,
      assumptions: Array.isArray(src.assumptions) && src.assumptions.length ? src.assumptions : ['Derived from available slides.'],
      blockers: Array.isArray(src.blockers) ? src.blockers : [],
      risk: (src.risk && String(src.risk).trim()) || (type === 'pessimistic' ? 'High risk due to possible supply/handover delays' : 'Moderate risk'),
      next: Array.isArray(src.next) ? src.next : [],
      _id: src._id
    };
  };

  out.critical_path_analysis = wantOrder.map((t, i) => mk(t, i));
  return out;
}
/* ======================================================= */

function buildReportPdfBuffer(ai = {}, meta = {}, logoBuffer = null) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      // Increase top margin to give the header more breathing room
      margins: { top: 60, left: 50, right: 50, bottom: 90 }, // reserve 90px for footer
      bufferPages: true,                                      // let us add footer after body
    });

    const chunks = [];
    doc.on('data', d => chunks.push(d));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    /* ---------- helpers ---------- */
    // Utility to truncate a string with a middle ellipsis to fit a given width
    const truncateToWidth = (text, maxWidth) => {
      if (!text) return '';
      const ell = '…';
      const fullW = doc.widthOfString(text);
      if (fullW <= maxWidth) return text;
      let leftLen = Math.ceil(text.length * 0.6);
      let rightLen = Math.max(1, Math.floor(text.length * 0.2));
      // Boundaries
      leftLen = Math.max(1, Math.min(text.length - 1, leftLen));
      rightLen = Math.max(1, Math.min(text.length - leftLen - 1, rightLen));
      let attempt = text.slice(0, leftLen) + ell + text.slice(text.length - rightLen);
      // tighten until it fits
      while (doc.widthOfString(attempt) > maxWidth && (leftLen > 1 || rightLen > 1)) {
        if (leftLen > rightLen && leftLen > 1) leftLen -= 1; else if (rightLen > 1) rightLen -= 1; else leftLen -= 1;
        attempt = text.slice(0, leftLen) + ell + text.slice(text.length - rightLen);
        if (leftLen <= 1 && rightLen <= 1) break;
      }
      return attempt;
    };

    const drawHeader = () => {
    // Absolute-positioned header confined to the top margin.
    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const width = right - left;
  const headerTop = 18; // draw above the flow area
  const headerBottom = doc.page.margins.top - 12; // just above the content top

    // Layout constants
    const logoWidth = 28;
    const gap = 8;
      const leftBlockX = left + (logoBuffer ? (logoWidth + gap) : 0);
      // Two-column layout (left/right)
      const leftColBaseWidth = Math.floor(width * 0.58);
      const leftColWidth = Math.max(80, leftColBaseWidth - (leftBlockX - left));
      const rightColX = left + leftColBaseWidth;
      const rightColWidth = Math.max(80, width - leftColBaseWidth);

    // Logo at left if available
    if (logoBuffer) {
      try { doc.image(logoBuffer, left, headerTop, { width: logoWidth }); } catch {}
    }

    // Company/project on left; export/meta on right
  const companyName = String(meta.companyName || 'FadzTrack');
  const proj = meta.projectName ? `Project: ${meta.projectName}` : '';
    const exportedBy = meta.exportedBy ? `Exported by: ${String(meta.exportedBy)}` : '';
    const when = meta.exportDate instanceof Date ? meta.exportDate : new Date();
  // Short export date without seconds
  const whenText = `Exported: ${when.toLocaleString(undefined, { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}`;
      const sourceRaw = meta.filename ? `Source: ${meta.filename}` : '';
    const disclaimer = 'AI-generated report. Please verify critical information.';

    // First row
    let y = headerTop;
  // Title (truncate if very long to keep to one line)
  doc.font('Helvetica-Bold').fontSize(12);
  const titleRaw = companyName + (proj ? ` — ${proj}` : '');
  const titleTrunc = truncateToWidth(titleRaw, leftColWidth);
  doc.text(titleTrunc, leftBlockX, y, { width: leftColWidth, align: 'left', lineBreak: false });
  // Draw right text without wrapping by measuring width and positioning from the right edge
  const rightTopStr = [exportedBy, whenText].filter(Boolean).join('   |   ');
  doc.font('Helvetica').fontSize(10);
  const rtW = doc.widthOfString(rightTopStr);
  const rtX = Math.max(rightColX, right - rtW);
  doc.text(rightTopStr, rtX, y, { lineBreak: false });

    // Second row: source (left) and disclaimer (right)
  y += 16; // a bit more spacing on the second row
      if (sourceRaw) {
        // Ensure font/size are active before measuring for truncation
        doc.font('Helvetica').fontSize(9);
        const srcTrunc = truncateToWidth(sourceRaw, leftColWidth);
        doc.fillColor('#555')
           .text(srcTrunc, leftBlockX, y, { width: leftColWidth, align: 'left', lineBreak: false });
        doc.fillColor('black');
      }
      // Disclaimer on the right, single line
      doc.font('Helvetica-Oblique').fontSize(9).fillColor('#444');
      const discW = doc.widthOfString(disclaimer);
      const discX = Math.max(rightColX, right - discW);
      doc.text(disclaimer, discX, y, { lineBreak: false });
    doc.fillColor('black');

    // Divider line at bottom of header area
    doc.moveTo(left, headerBottom).lineTo(right, headerBottom).stroke();

    // Reset flow start to the top margin for the first page case
    doc.x = left;
    doc.y = doc.page.margins.top;
    doc.font('Helvetica').fontSize(11);
   };

    const section = (title) => {
      doc.moveDown(0.6);
      doc.font('Helvetica-Bold').fontSize(14).text(title);
      doc.moveDown(0.2);
      doc.font('Helvetica').fontSize(11);
    };

    /* ---------- body ---------- */
    drawHeader();

    section('Summary of Work Done');
    (ai.summary_of_work_done || []).forEach(s => doc.text(`• ${s}`, { indent: 18 }));

    section('Completed Tasks');
    (ai.completed_tasks || []).forEach(s => doc.text(`• ${s}`, { indent: 18 }));
    
    section('Critical Path Analysis');
    (ai.critical_path_analysis || []).forEach((c, i) => {
      const daysFromItem =
        (Number.isFinite(c?.estimated_days) ? c.estimated_days : null) ??
        parseDaysFromAny(c?.duration) ??
        parseDaysFromAny(c?.duration_text);
      const safeDays = Number.isFinite(daysFromItem) ? daysFromItem : (i === 0 ? 7 : i === 1 ? 14 : 21);

      const title = `${i + 1}. ${c?.path_type ? c.path_type.charAt(0).toUpperCase() + c.path_type.slice(1) + ' Path' : 'Path'} — ${safeDays} days`;
      doc.font('Helvetica-Bold').text(title, { indent: 10 });
      doc.font('Helvetica');
      if (c.risk)               doc.text(`Risk: ${c.risk}`, { indent: 20 });
      if (c.blockers?.length)   doc.text(`Blockers: ${c.blockers.join('; ')}`, { indent: 20 });
      if (c.next?.length)       doc.text(`Next: ${c.next.join('; ')}`, { indent: 20 });
      doc.moveDown(0.4);
    });

    section('PiC Performance');
    doc.text(ai?.pic_performance_evaluation?.text || '—', { indent: 10 });
    if (typeof ai?.pic_performance_evaluation?.score === 'number') {
      doc.text(`Score: ${ai.pic_performance_evaluation.score}/100`, { indent: 10 });
    }
    doc.text(`Contribution: ${Math.round(Number(ai.pic_contribution_percent) || 0)}%`, { indent: 10 });
    if (typeof ai?.confidence === 'number') {
      doc.text(`Model Confidence: ${(ai.confidence * 100).toFixed(0)}%`, { indent: 10 });
    }

    if (Array.isArray(ai.task_priorities) && ai.task_priorities.length) {
      section('Task Priorities');
      ai.task_priorities.slice(0,10).forEach((tp, idx) => {
        doc.font('Helvetica-Bold').text(`${idx+1}. [${tp.priority || '—'}] ${tp.task || ''}`, { indent: 12 });
        doc.font('Helvetica');
        if (tp.impact) doc.text(`Impact: ${tp.impact}`, { indent: 24 });
        if (tp.justification) doc.text(`Why: ${tp.justification}`, { indent: 24 });
        doc.moveDown(0.2);
      });
    }

    /* ---------- footer on every page (after body) ---------- */
    const drawFooter = (pageNum, pageCount) => {
      const y = doc.page.height - 55;
      const x1 = doc.page.margins.left;
      const x2 = doc.page.width - doc.page.margins.right;
      doc.moveTo(x1, y).lineTo(x2, y).stroke();
      doc.font('Helvetica').fontSize(9);
      doc.text('Generated by FadzTrack AI', x1, y + 8, { align: 'left' });
      doc.text(`Page ${pageNum} of ${pageCount}`, x1, y + 8, { align: 'right' });
    };

  // After all content is written, iterate buffered pages and add footers/headers
    doc.on('pageAdded', () => {
      // Keep new pages consistent (header is added automatically on first write of that page)
      // Reserve footer space already via bottom margin, so nothing spills over.
    });

    // Finish the document and then decorate pages
    doc.flushPages();

    const range = doc.bufferedPageRange(); // {start, count}
  for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      // Add header to every page except the first (first already has it)
      if (i > 0) drawHeader();
      drawFooter(i + 1, range.count);
    }

    doc.end();
  });
}

/**
 * Ensures every document is an object with { path, name, uploadedBy, uploadedByName, uploadedAt }.
 * If a doc only has uploadedBy as an ObjectId string and no uploadedByName, we look up the user name.
 */
async function hydrateProjectDocumentMetadata(project) {
  if (!project || !Array.isArray(project.documents) || project.documents.length === 0) return;

  const idsToResolve = [];
  for (const d of project.documents) {
    if (typeof d === 'object' && d && looksLikeObjectId(d.uploadedBy) && !d.uploadedByName) {
      idsToResolve.push(d.uploadedBy);
    }
  }

  const uniqueIds = [...new Set(idsToResolve)];
  const users = uniqueIds.length ? await User.find({ _id: { $in: uniqueIds } }, 'name') : [];
  const nameById = new Map(users.map(u => [String(u._id), u.name || '']));

  project.documents = project.documents.map((d) => {
    if (typeof d === 'string') {
      return {
        path: d,
        name: extractOriginalNameFromPath(d),
        uploadedBy: undefined,
        uploadedByName: undefined,
        uploadedAt: undefined,
      };
    }
    const out = { ...d };
    out.path = out.path || '';
    out.name = out.name || extractOriginalNameFromPath(out.path || '');
    if (looksLikeObjectId(out.uploadedBy) && !out.uploadedByName) {
      const nm = nameById.get(String(out.uploadedBy));
      if (nm) out.uploadedByName = nm;
    }
    return out;
  });
}
/* ------------------------------------------------------------ */

/* --- CREATE PROJECT --- */
exports.addProject = async (req, res) => {
  try {
    const {
      projectName, pic, staff, hrsite,
      projectmanager, contractor, budget, location,
      startDate, endDate, manpower, areamanager, area
    } = req.body;

 

  let photos = [];
  let documentsUrls = [];
  let budgetDocument = null; // store dedicated budget PDF metadata

    // public photos
    if (req.files && req.files.photos) {
      for (let file of req.files.photos) {
        const filePath = `project-photos/project-${Date.now()}-${file.originalname}`;
        const { data, error } = await supabase.storage
          .from('photos')
          .upload(filePath, file.buffer, { contentType: file.mimetype, upsert: true });
        if (!error && data) {
          const { data: publicUrlData } = supabase.storage.from('photos').getPublicUrl(filePath);
          if (publicUrlData?.publicUrl) photos.push(publicUrlData.publicUrl);
        }
      }
    }

  // private docs (store as objects w/ metadata) & separate budgetPdf
    if (req.files && (req.files.documents || req.files.budgetPdf)) {
      const docFiles = [...(req.files.documents || [])];
      if (req.files.budgetPdf) docFiles.push(...req.files.budgetPdf);
      for (let file of docFiles) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const safeName = (file.originalname || 'file').trim();
        const filePath = `project-documents/project-${Date.now()}/${timestamp}_${safeName}`;

        const { data, error } = await supabase.storage
          .from('documents')
          .upload(filePath, file.buffer, { contentType: file.mimetype, upsert: true });

        if (!error && data) {
          const meta = {
            path: filePath,
            name: safeName,
            uploadedBy: String(req.user?.id || req.user?._id || ''),
            uploadedByName: req.user?.name || '',
            uploadedAt: new Date()
          };
          if (/budget|boq|bill\s*of\s*quantities|costs|cost\s*breakdown/i.test(safeName) && /\.pdf$/i.test(safeName) && !budgetDocument) {
            budgetDocument = meta;
          } else {
            documentsUrls.push(meta);
          }
        }
      }
    }

  // If a budget is provided and a budget PDF was uploaded, parse it and deduct detected section totals (letters, numbers, roman numerals)
  let adjustedBudget = Number(budget) || 0;
  let parsedBudgetTotals = null; // { sections: [{letter,title,amount}], totalAll }
  let parsedBudgetTotalAll = 0;
    try {
      // REQUIRE at least one explicit budgetPdf file
      if(!req.files?.budgetPdf || !req.files.budgetPdf.length){
        return res.status(400).json({ message: 'Budget PDF is required' });
      }
      const budgetFile = req.files.budgetPdf[0];
      if (budgetFile && /\.pdf$/i.test(budgetFile.originalname || '')) {
        const { sections, greenItems, totalAll, sectionTotal, rowSum, autoDeductEligible, confidenceSummary } = await sumBudgetFromPdfBuffer(budgetFile.buffer);
        if (Number.isFinite(totalAll) && totalAll > 0) {
          parsedBudgetTotals = { sections, greenItems, sectionTotal, greenTotal: rowSum, totalAll, autoDeductEligible, confidenceSummary };
          parsedBudgetTotalAll = Number(totalAll) || 0;
          // Reject if parsed total exceeds provided numeric budget
          if(parsedBudgetTotalAll > adjustedBudget){
            return res.status(400).json({ message: 'Parsed budget total exceeds provided project budget', parsedTotal: parsedBudgetTotalAll, providedBudget: adjustedBudget });
          }
          if (autoDeductEligible) {
            adjustedBudget = Math.max(0, adjustedBudget - parsedBudgetTotalAll);
          }
        }
      }
    } catch (e) {
      console.warn('Budget PDF parse failed:', e.message);
    }

  const manpowerIds = coerceIdArray(manpower);
  const picIds = coerceIdArray(pic);
  const staffIds = coerceIdArray(staff);
  const hrIds = coerceIdArray(hrsite);

    const newProject = new Project({
      projectName,
      pic: picIds,
      staff: staffIds,
      hrsite: hrIds,
      projectmanager, contractor, budget, location,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      manpower: manpowerIds, areamanager, area, photos,
  documents: documentsUrls,
  ...(budgetDocument ? { budgetDocument } : {}),
      // Store parsed totals as a system document entry for transparency
  ...(parsedBudgetTotals ? { parsedBudgetTotals } : {}),
      // Persist the adjusted budget if any deduction occurred
      ...(adjustedBudget !== undefined ? { budget: adjustedBudget } : {})
    });
    const savedProject = await newProject.save();

    // Log budget deduction (if any)
  if (parsedBudgetTotals) {
      try {
        await logAction({
          action: 'BUDGET_DEDUCTION_FROM_PDF',
          performedBy: req.user.id,
          performedByRole: req.user.role,
  description: parsedBudgetTotals?.autoDeductEligible ? `Applied initial budget deduction (A–Z sections + green items)` : `Parsed budget PDF (auto deduction skipped - low confidence)`,
      meta: { projectId: savedProject._id, projectName: savedProject.projectName, parsedBudgetTotals, originalBudget: Number(budget) || 0, adjustedBudget },
        });
      } catch (_) {}
    }

    await logAction({
      action: 'ADD_PROJECT',
      performedBy: req.user.id,
      performedByRole: req.user.role,
      description: `Added new project ${projectName}`,
      meta: { projectId: savedProject._id, projectName: savedProject.projectName, context: 'project' }
    });
    if (req.user.role === 'CEO') {
      await logAction({
        action: 'CEO_ADD_PROJECT',
        performedBy: req.user.id,
        performedByRole: req.user.role,
        description: `CEO added new project ${projectName}`,
        meta: { projectId: savedProject._id, projectName: savedProject.projectName, context: 'project' }
      });
    }
    // IT specific log (granular visibility for governance)
    if (req.user.role === 'IT') {
      await logAction({
        action: 'IT_ADD_PROJECT',
        performedBy: req.user.id,
        performedByRole: req.user.role,
        description: `IT created project ${projectName}`,
        meta: { projectId: savedProject._id, projectName: savedProject.projectName, context: 'project' }
      });
    }

    await Manpower.updateMany(
      { _id: { $in: manpowerIds } },
      { $set: { assignedProject: savedProject._id } }
    );

    /* ------------------------------------------------------------ */
    /* Auto-create group chat for project members */
    try {
      // Collect unique user ids for chat membership (exclude falsy)
  const memberIds = [
        ...(Array.isArray(pic)? pic: pic? [pic]: []),
        ...(Array.isArray(staff)? staff: staff? [staff]: []),
        ...(Array.isArray(hrsite)? hrsite: hrsite? [hrsite]: []),
        projectmanager,
        areamanager,
      ].filter(Boolean).map(id=> id.toString());
      const uniqueMemberIds = Array.from(new Set(memberIds));
      if (uniqueMemberIds.length) {
        const existingGroup = await Chat.findOne({ isGroup:true, name: projectName, users: { $all: uniqueMemberIds, $size: uniqueMemberIds.length } });
        if (!existingGroup) {
          const groupChat = await Chat.create({
            isGroup: true,
            name: projectName,
            users: uniqueMemberIds,
            creator: req.user.id
          });
          // Emit realtime event
          const io = req.app.get('io');
          if (io) io.emit('chatCreated', groupChat);
        }
      }
      // Preload roles for all unique members to derive correct deep-link per role
      const userDocs = await User.find({ _id: { $in: uniqueMemberIds } }, 'role');
      const roleById = new Map(userDocs.map(u => [String(u._id), u.role]));
      const routeFor = (role, pid) => {
        if (!role) return `/pm/viewprojects/${pid}`; // default fallback
        const r = role.toLowerCase();
        if (r.includes('person in charge')) return `/pic/${pid}`;
        if (r === 'project manager') return `/pm/viewprojects/${pid}`;
        if (r === 'area manager') return `/am/projects/${pid}`;
        if (r === 'ceo') return `/ceo/proj/${pid}`;
        if (r === 'it') return `/it/projects`; // list page (no per-id view currently)
        if (r === 'hr - site') return `/hr-site/current-project`; // simplified
        if (r === 'hr') return `/hr/project-records/${pid}`;
        if (r === 'staff') return `/staff/current-project`;
        return `/pm/viewprojects/${pid}`;
      };
      for (const uid of new Set(uniqueMemberIds)) {
        if (uid === String(req.user.id)) continue;
        try {
          const role = roleById.get(uid);
            await createAndEmitNotification({
              type: 'project_created',
              toUserId: uid,
              fromUserId: req.user.id,
              projectId: savedProject._id,
              message: `You were added to project ${projectName}`,
              meta: { projectName },
              title: 'New Project Assignment',
              icon: 'folder-plus',
              actionUrl: routeFor(role, savedProject._id),
              req
            });
        } catch (notifErr) {
          console.warn('Notification failed for user', uid, notifErr.message);
        }
      }
    } catch (chatErr) {
      console.warn('Project chat/notification setup failed:', chatErr.message);
    }
    /* ------------------------------------------------------------ */

    res.status(201).json(savedProject);
  } catch (err) {
    console.error('❌ Error adding project:', err);
    res.status(500).json({ error: 'Failed to add project', details: err.message });
  } finally {
    // Always release lock
    try {
      const app = req.app; if (app?.locals?.projectCreateLocks) {
        const { projectName, projectmanager, location, startDate, endDate } = req.body || {}; // reuse values if available
        if (projectName && location && startDate && endDate) {
          const fp = [projectName.trim().toLowerCase(), location, startDate, endDate, projectmanager].join('|');
          app.locals.projectCreateLocks.delete(fp);
        }
      }
    } catch (_) {}
  }
};

/* --- AREA MANAGER: Upload Purchase Order & Deduct Budget --- */
exports.addPurchaseOrder = async (req, res) => {
  try {
    const projectId = req.params.id;
    const { totalValue } = req.body; // numeric deduction amount
    if (!projectId) return res.status(400).json({ message: 'Missing project id' });
    if (!req.user || !['AM','AreaManager','areamanager','am'].includes((req.user.role||'').toLowerCase())) {
      // Soft role match (case-insensitive) – front-end uses 'am'
      if (String(req.user?._id) !== String(req.user?.areamanager)) {
        // fallback simple denial
      }
    }
    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ message: 'Project not found' });
    // Role enforcement: uploader must match project's area manager (if defined)
    if (project.areamanager && String(project.areamanager) !== String(req.user.id)) {
      return res.status(403).json({ message: 'Not authorized to upload PO for this project' });
    }
  const amount = Number(totalValue);
    if (!isFinite(amount) || amount <= 0) return res.status(400).json({ message: 'Invalid total value' });
  if (amount > Number(project.budget||0)) return res.status(400).json({ message: 'Amount exceeds remaining project budget' });
    if (!req.file) return res.status(400).json({ message: 'Missing PO file' });

    // Upload to Supabase
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeName = (req.file.originalname || 'po.pdf').trim();
    const filePath = `project-pos/${projectId}/${timestamp}_${safeName}`;
    const { data, error } = await supabase.storage.from('documents').upload(filePath, req.file.buffer, { contentType: req.file.mimetype || 'application/octet-stream', upsert: true });
    if (error || !data) return res.status(500).json({ message: 'Failed to store PO file' });

    // Deduct budget
    const before = Number(project.budget || 0);
    project.budget = Math.max(0, before - amount);
    project.purchaseOrders = project.purchaseOrders || [];
    project.purchaseOrders.push({
      path: filePath,
      name: safeName,
      amount,
      uploadedAt: new Date(),
      uploadedBy: req.user.id,
      uploadedByName: req.user.name || ''
    });
    await project.save();

    try {
      await logAction({
        action: 'UPLOAD_PURCHASE_ORDER',
        performedBy: req.user.id,
        performedByRole: req.user.role,
        description: `Area Manager uploaded PO and deducted ${amount} from budget`,
        meta: { projectId: project._id, projectName: project.projectName, amount, budgetBefore: before, budgetAfter: project.budget }
      });
    } catch {}

    return res.json({ message: 'PO uploaded', budget: project.budget, purchaseOrders: project.purchaseOrders });
  } catch (e) {
    console.error('addPurchaseOrder failed', e);
    return res.status(500).json({ message: 'Server error' });
  }
};

/* --- AREA MANAGER: Upload PO files only (no amount yet) --- */
exports.addPurchaseOrderFiles = async (req, res) => {
  try {
    const projectId = req.params.id;
    if (!projectId) return res.status(400).json({ message: 'Missing project id' });
    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ message: 'Project not found' });
    if (project.areamanager && String(project.areamanager) !== String(req.user.id)) return res.status(403).json({ message: 'Not authorized' });
    if (!req.files || !req.files.length) return res.status(400).json({ message: 'No files provided' });
    project.purchaseOrders = project.purchaseOrders || [];
    for (const f of req.files) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const safeName = (f.originalname || 'po.pdf').trim();
      const filePath = `project-pos/${projectId}/${timestamp}_${safeName}`;
      const { data, error } = await supabase.storage.from('documents').upload(filePath, f.buffer, { contentType: f.mimetype || 'application/octet-stream', upsert: true });
      if (!error && data) {
        project.purchaseOrders.push({
          path: filePath,
          name: safeName,
          amount: null,
          uploadedAt: new Date(),
          uploadedBy: req.user.id,
          uploadedByName: req.user.name || ''
        });
      }
    }
    await project.save();
    try { await logAction({ action:'UPLOAD_PO_FILES', performedBy:req.user.id, performedByRole:req.user.role, description:`Uploaded ${req.files.length} PO file(s) (no amount yet)`, meta:{ projectId:project._id, projectName:project.projectName, count:req.files.length } }); } catch {}
    return res.json({ message:'PO files uploaded', purchaseOrders: project.purchaseOrders, budget: project.budget });
  } catch(e){ console.error('addPurchaseOrderFiles failed', e); return res.status(500).json({ message:'Server error' }); }
};

/* --- AREA MANAGER: Set amount for a PO (deduct budget once) --- */
exports.updatePurchaseOrderAmount = async (req, res) => {
  try {
    const { id: projectId, poId } = req.params;
    const { amount } = req.body;
    if (!projectId || !poId) return res.status(400).json({ message:'Missing ids' });
    const val = Number(amount);
    if (!isFinite(val) || val <= 0) return res.status(400).json({ message:'Invalid amount' });
    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ message:'Project not found' });
    if (project.areamanager && String(project.areamanager) !== String(req.user.id)) return res.status(403).json({ message:'Not authorized' });
    const po = (project.purchaseOrders || []).find(p => String(p._id) === String(poId));
    if (!po) return res.status(404).json({ message:'PO not found' });
    if (po.amount && po.amount > 0) return res.status(400).json({ message:'Amount already set' });
  const before = Number(project.budget || 0);
  if (val > before) return res.status(400).json({ message: 'Amount exceeds remaining project budget' });
    project.budget = Math.max(0, before - val);
    po.amount = val;
    await project.save();
    try { await logAction({ action:'SET_PO_AMOUNT', performedBy:req.user.id, performedByRole:req.user.role, description:`Set PO amount ${val}`, meta:{ projectId:project._id, projectName:project.projectName, poId, amount:val, budgetBefore:before, budgetAfter:project.budget } }); } catch {}
    return res.json({ message:'Amount set', purchaseOrders: project.purchaseOrders, budget: project.budget });
  } catch(e){ console.error('updatePurchaseOrderAmount failed', e); return res.status(500).json({ message:'Server error' }); }
};

/* --- AREA MANAGER: Delete a PO (restore budget if amount deducted) --- */
exports.deletePurchaseOrder = async (req, res) => {
  try {
    const { id: projectId, poId } = req.params;
    if (!projectId || !poId) return res.status(400).json({ message:'Missing ids' });
    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ message:'Project not found' });
    if (project.areamanager && String(project.areamanager) !== String(req.user.id)) return res.status(403).json({ message:'Not authorized' });
    const idx = (project.purchaseOrders || []).findIndex(p => String(p._id) === String(poId));
    if (idx === -1) return res.status(404).json({ message:'PO not found' });
    const po = project.purchaseOrders[idx];
    const before = Number(project.budget || 0);
    if (po.amount && po.amount > 0) project.budget = before + Number(po.amount);
    project.purchaseOrders.splice(idx,1);
    await project.save();
    try { await logAction({ action:'DELETE_PO', performedBy:req.user.id, performedByRole:req.user.role, description:`Deleted PO (restored ${po.amount||0})`, meta:{ projectId:project._id, projectName:project.projectName, poId, restored: po.amount||0, budgetAfter: project.budget } }); } catch {}
    return res.json({ message:'PO deleted', purchaseOrders: project.purchaseOrders, budget: project.budget });
  } catch(e){ console.error('deletePurchaseOrder failed', e); return res.status(500).json({ message:'Server error' }); }
};

/* --- UPDATE PROJECT --- */
exports.updateProject = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };
    const existing = await Project.findById(id).lean();
    if (!existing) return res.status(404).json({ message: 'Project not found' });

    // Compute field-level diffs (simple strategy: shallow compare primitives + stringify arrays/objects)
    const changes = [];
    const considerKeys = Object.keys(updates);
    for (const key of considerKeys) {
      const before = existing[key];
      const after = updates[key];
      const norm = (v) => {
        if (v == null) return v;
        if (Array.isArray(v)) return [...v].map(x => (x && x._id) ? String(x._id) : String(x)).sort();
        if (typeof v === 'object' && v._id) return String(v._id);
        return v;
      };
      const b = norm(before);
      const a = norm(after);
      const equal = JSON.stringify(b) === JSON.stringify(a);
      if (!equal) {
        changes.push({ field: key, before: before instanceof Date ? before.toISOString() : b, after: after instanceof Date ? after.toISOString() : a });
      }
    }

    const updatedProject = await Project.findByIdAndUpdate(id, updates, { new: true });
    if (!updatedProject) return res.status(404).json({ message: 'Project not found' });

    // If project became Cancelled or soft-deleted via update, free up manpower
    const becameCancelled = String(existing.status) !== 'Cancelled' && String(updatedProject.status) === 'Cancelled';
    const becameDeleted = !existing.isDeleted && !!updatedProject.isDeleted;
    if (becameCancelled || becameDeleted) {
      try {
        const resUnassign = await Manpower.updateMany(
          { assignedProject: id },
          { $set: { assignedProject: null } }
        );
        try {
          await logAction({
            action: 'UNASSIGN_MANPOWER_ON_PROJECT_CANCEL',
            performedBy: req.user.id,
            performedByRole: req.user.role,
            description: `Unassigned ${resUnassign?.modifiedCount || 0} manpower due to project cancellation/update`,
            meta: { projectId: updatedProject._id, projectName: updatedProject.projectName, count: resUnassign?.modifiedCount || 0, context: 'project' }
          });
        } catch (_) {}
      } catch (e) {
        console.warn('Unassign manpower (update) failed:', e.message);
      }
    }

    await logAction({
      action: 'UPDATE_PROJECT',
      performedBy: req.user.id,
      performedByRole: req.user.role,
      description: `Updated project ${updatedProject.projectName}`,
      meta: { projectId: updatedProject._id, projectName: updatedProject.projectName, changedFields: changes, context: 'project' }
    });
    if (req.user.role === 'CEO') {
      await logAction({
        action: 'CEO_UPDATE_PROJECT',
        performedBy: req.user.id,
        performedByRole: req.user.role,
        description: `CEO updated project ${updatedProject.projectName}`,
        meta: { projectId: updatedProject._id, projectName: updatedProject.projectName, changedFields: changes, context: 'project' }
      });
    }
    if (req.user.role === 'IT') {
      await logAction({
        action: 'IT_UPDATE_PROJECT',
        performedBy: req.user.id,
        performedByRole: req.user.role,
        description: `IT updated project ${updatedProject.projectName}`,
        meta: { projectId: updatedProject._id, projectName: updatedProject.projectName, changedFields: changes, context: 'project' }
      });
    }
    res.status(200).json(updatedProject);
  } catch (err) {
    console.error('❌ Error updating project:', err);
    res.status(500).json({ message: 'Failed to update project' });
  }
};

/* --- SOFT DELETE PROJECT --- */
exports.deleteProject = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason = 'Project cancelled by user' } = req.body;
    
    // Find the project first
    const project = await Project.findById(id);
    if (!project) return res.status(404).json({ message: 'Project not found' });
    
    // Check if already soft deleted
    if (project.isDeleted) {
      return res.status(400).json({ message: 'Project is already deleted' });
    }
    
    // Soft delete the project
    const updatedProject = await Project.findByIdAndUpdate(id, {
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy: req.user.id,
      deletionReason: reason,
      status: 'Cancelled' // Set status to Cancelled for soft-deleted projects
    }, { new: true });

    // Unassign all manpower tied to this project so they can be reassigned elsewhere
    try {
      const resUnassign = await Manpower.updateMany(
        { assignedProject: id },
        { $set: { assignedProject: null } }
      );
      try {
        await logAction({
          action: 'UNASSIGN_MANPOWER_ON_PROJECT_CANCEL',
          performedBy: req.user.id,
          performedByRole: req.user.role,
          description: `Unassigned ${resUnassign?.modifiedCount || 0} manpower from cancelled project ${project.projectName}`,
          meta: { projectId: project._id, projectName: project.projectName, count: resUnassign?.modifiedCount || 0, context: 'project' }
        });
      } catch (_) {}
    } catch (e) {
      console.warn('Unassign manpower (cancel) failed:', e.message);
    }

    await logAction({
      action: 'SOFT_DELETE_PROJECT',
      performedBy: req.user.id,
      performedByRole: req.user.role,
      description: `Soft deleted project ${project.projectName} - ${reason}`,
      meta: { projectId: project._id, projectName: project.projectName, reason, context: 'project' }
    });
    
    if (req.user.role === 'CEO') {
      await logAction({
        action: 'CEO_SOFT_DELETE_PROJECT',
        performedBy: req.user.id,
        performedByRole: req.user.role,
        description: `CEO soft deleted project ${project.projectName} - ${reason}`,
        meta: { projectId: project._id, projectName: project.projectName, reason, context: 'project' }
      });
    }
    
    if (req.user.role === 'IT') {
      await logAction({
        action: 'IT_SOFT_DELETE_PROJECT',
        performedBy: req.user.id,
        performedByRole: req.user.role,
        description: `IT soft deleted project ${project.projectName} - ${reason}`,
        meta: { projectId: project._id, projectName: project.projectName, reason, context: 'project' }
      });
    }
    
    res.status(200).json({ 
      message: 'Project cancelled successfully',
      data: updatedProject
    });
  } catch (err) {
    console.error('❌ Error soft deleting project:', err);
    res.status(500).json({ message: 'Failed to cancel project' });
  }
};

/* --- RESTORE SOFT DELETED PROJECT --- */
exports.restoreProject = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Only IT and CEO can restore projects
    if (req.user?.role !== 'IT' && req.user?.role !== 'CEO') {
      return res.status(403).json({ message: 'Only IT and CEO can restore projects' });
    }
    
    // Find the project
    const project = await Project.findById(id);
    if (!project) return res.status(404).json({ message: 'Project not found' });
    
    // Check if project is soft deleted
    if (!project.isDeleted) {
      return res.status(400).json({ message: 'Project is not deleted' });
    }
    
    // Restore the project
    const restoredProject = await Project.findByIdAndUpdate(
      id,
      {
        isDeleted: false,
        deletedAt: null,
        deletedBy: null,
        deletionReason: '',
        status: 'Ongoing' // Reset to Ongoing status
      },
      { new: true }
    );

    await logAction({
      action: 'RESTORE_PROJECT',
      performedBy: req.user.id,
      performedByRole: req.user.role,
      description: `Restored project ${project.projectName}`,
      meta: { projectId: project._id, projectName: project.projectName, context: 'project' }
    });
    
    res.status(200).json({ 
      message: 'Project restored successfully',
      data: restoredProject
    });
  } catch (err) {
    console.error('❌ Error restoring project:', err);
    res.status(500).json({ message: 'Failed to restore project' });
  }
};

/* --- GET ALL PROJECTS --- */
exports.getAllProjects = async (req, res) => {
  try {
    const { includeDeleted = false } = req.query;
    const userRole = req.user?.role;
    
    // Build query - exclude soft-deleted projects by default
    let query = { isDeleted: { $ne: true } };
    
    // IT and CEO can see soft-deleted projects if requested
    if ((userRole === 'IT' || userRole === 'CEO') && includeDeleted === 'true') {
      query = {}; // Include all projects including soft-deleted ones
    }
    
    const projects = await Project.find(query)
      .populate('projectmanager', 'name email')
      .populate('pic', 'name email')
      .populate('staff', 'name email')
      .populate('hrsite', 'name email')
      .populate('areamanager', 'name email')
  .populate('area', 'name')
      .populate('location', 'name region')
      .populate('manpower', 'name position')
      .populate('contractor', 'name company companyName displayName')
      .populate('deletedBy', 'name email');

    for (const p of projects) await hydrateProjectDocumentMetadata(p);

    res.status(200).json(projects);
  } catch (err) {
    console.error('❌ Error fetching projects:', err);
    res.status(500).json({ message: 'Failed to fetch projects' });
  }
};

/* --- GET PROJECT BY ID --- */
exports.getProjectById = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('projectmanager', 'name email')
      .populate('pic', 'name email')
      .populate('staff', 'name email')
      .populate('hrsite', 'name email')
      .populate('areamanager', 'name email')
  .populate('area', 'name')
      .populate('location', 'name region')
      .populate('manpower', 'name position')
      .populate('contractor', 'name company companyName displayName');
    if (!project) return res.status(404).json({ message: 'Project not found' });

    await hydrateProjectDocumentMetadata(project);
    await project.save();

    res.status(200).json(project);
  } catch (err) {
    console.error('❌ Error fetching project:', err);
    res.status(500).json({ message: 'Failed to fetch project' });
  }
};

/* --- GET PROJECTS ASSIGNED TO USER AS PIC --- */
exports.getAssignedProjectsPIC = async (req, res) => {
  const userId = req.params.userId;
  try {
    const projects = await Project.find({ 
      pic: userId,
      isDeleted: { $ne: true } // Exclude soft-deleted projects
    })
      .populate('projectmanager', 'name email')
      .populate('pic', 'name email')
      .populate('staff', 'name email')
      .populate('hrsite', 'name email')
      .populate('location', 'name region')
      .populate('manpower', 'name position')
      .populate('contractor', 'name company companyName displayName');

    res.json(projects);
  } catch (error) {
    console.error('Error fetching assigned projects:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/* --- GET PROJECTS ASSIGNED TO USER (ANY ROLE) --- */
exports.getAssignedProjectsAllRoles = async (req, res) => {
  const userId = req.params.userId;
  try {
    const projects = await Project.find({
      $or: [
        { pic: userId },
        { staff: userId },
        { hrsite: userId },
        { projectmanager: userId },
        { areamanager: userId }
      ],
      status: 'Ongoing',
      isDeleted: { $ne: true } // Exclude soft-deleted projects
    })
      // Include staff / hrsite / areamanager so caller (e.g. Area Manager header, staff/hrsite fallback) can resolve names
      .select('projectName photos budget startDate endDate status location pic staff hrsite projectmanager areamanager manpower documents')
      .populate('projectmanager', 'name email')
      .populate('areamanager', 'name email')
      .populate('pic', 'name email')
      .populate('staff', 'name email')
      .populate('hrsite', 'name email')
      .populate('location', 'name region')
      .populate('manpower', 'name position')
      .populate('contractor', 'name company companyName displayName');

    res.json(projects);
  } catch (error) {
    console.error('Error fetching assigned projects:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/* --- GET UNASSIGNED USERS --- */
exports.getUnassignedPICs = async (req, res) => {
  try {
    // Support both role labels used in DB: 'PIC' and 'Person in Charge'
    const candidates = await User.find({ role: { $in: ['Person in Charge', 'PIC'] } }, 'name role');
    // Only treat users as "busy" if they are on an ongoing, not-deleted project
    const projects = await Project.find({ isDeleted: { $ne: true }, status: 'Ongoing' }, 'pic status');
    const assigned = new Set();
    projects.forEach(p => Array.isArray(p.pic) && p.pic.forEach(id => assigned.add(id.toString())));
    const unassigned = candidates.filter(u => !assigned.has(u._id.toString()));
    res.json(unassigned);
  } catch (e) {
    res.status(500).json({ message: 'Failed to fetch unassigned PICs' });
  }
};
exports.getUnassignedStaff = async (req, res) => {
  try {
    const candidates = await User.find({ role: 'Staff' }, 'name role');
    const projects = await Project.find({ isDeleted: { $ne: true }, status: 'Ongoing' }, 'staff status');
    const assigned = new Set();
    projects.forEach(p => Array.isArray(p.staff) && p.staff.forEach(id => assigned.add(id.toString())));
    const unassigned = candidates.filter(u => !assigned.has(u._id.toString()));
    res.json(unassigned);
  } catch (e) {
    res.status(500).json({ message: 'Failed to fetch unassigned Staff' });
  }
};
exports.getUnassignedHR = async (req, res) => {
  try {
    const candidates = await User.find({ role: 'HR - Site' }, 'name role');
    const projects = await Project.find({ isDeleted: { $ne: true }, status: 'Ongoing' }, 'hrsite status');
    const assigned = new Set();
    projects.forEach(p => Array.isArray(p.hrsite) && p.hrsite.forEach(id => assigned.add(id.toString())));
    const unassigned = candidates.filter(u => !assigned.has(u._id.toString()));
    res.json(unassigned);
  } catch (e) {
    res.status(500).json({ message: 'Failed to fetch unassigned HR - Site' });
  }
};

/* --- GET PROJECT WHERE USER IS PROJECT MANAGER --- */
exports.getAssignedProjectManager = async (req, res) => {
  const userId = req.params.userId;
  try {
    const project = await Project.findOne({ 
      projectmanager: userId,
      isDeleted: { $ne: true } // Exclude soft-deleted projects
    })
      .populate('projectmanager', 'name email')
      .populate('pic', 'name email')
      .populate('staff', 'name email')
      .populate('hrsite', 'name email')
      .populate('areamanager', 'name email')
      .populate('contractor', 'name company companyName displayName');

    if (!project) return res.status(404).json({ message: 'No project assigned as Project Manager' });

    await hydrateProjectDocumentMetadata(project);
    await project.save();
    res.json(project);
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/* --- GET USERS BY ROLE --- */
exports.getUsersByRole = async (req, res) => {
  try {
    const role = req.params.role;
    const users = await User.find({ role }, 'name');
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch users' });
  }
};

/* --- UPDATE ONLY TASKS --- */
exports.updateProjectTasks = async (req, res) => {
  try {
    const { id } = req.params;
    const { tasks } = req.body;
    if (!Array.isArray(tasks)) return res.status(400).json({ message: 'Tasks must be an array' });

    const project = await Project.findByIdAndUpdate(
      id,
      { tasks },
      { new: true }
    )
      .populate('projectmanager', 'name email')
      .populate('pic', 'name email')
      .populate('staff', 'name email')
      .populate('hrsite', 'name email')
      .populate('areamanager', 'name email')
      .populate('location', 'name region')
      .populate('manpower', 'name position');
    if (!project) return res.status(404).json({ message: 'Project not found' });

    await logAction({
      action: 'UPDATE_PROJECT_TASKS',
      performedBy: req.user.id,
      performedByRole: req.user.role,
      description: `Updated tasks for project ${project.projectName}`,
      meta: { projectId: project._id }
    });

    res.json(project);
  } catch (error) {
    console.error('❌ Error updating project tasks:', error);
    res.status(500).json({ message: 'Failed to update project tasks' });
  }
};

/* --- TOGGLE PROJECT STATUS --- */
exports.toggleProjectStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const project = await Project.findById(id);
    if (!project) return res.status(404).json({ message: 'Project not found' });
    const goingToComplete = project.status !== 'Completed';
    // Basic validation: require at least 1 report & 1 document before completion
    if (goingToComplete) {
      const docCount = Array.isArray(project.documents) ? project.documents.length : 0;
      const reportCount = Array.isArray(project.reports) ? project.reports.length : 0;
      if (docCount === 0 || reportCount === 0) {
        return res.status(400).json({
          error: 'PRECONDITION_FAILED',
          message: 'Cannot complete project until at least one report and one file are uploaded.',
          details: { documents: docCount, reports: reportCount }
        });
      }
    }

    project.status = goingToComplete ? 'Completed' : 'Ongoing';
    await project.save();

    // Audit log entry
    try {
      await logAction({
        action: goingToComplete ? 'COMPLETE_PROJECT' : 'REOPEN_PROJECT',
        performedBy: req.user.id,
        performedByRole: req.user.role,
        description: `${goingToComplete ? 'Completed' : 'Reopened'} project ${project.projectName}`,
        meta: { projectId: project._id, projectName: project.projectName, previousStatus: goingToComplete ? 'Ongoing' : 'Completed', newStatus: project.status, context: 'project' }
      });
    } catch (logErr) {
      console.warn('Audit log (toggleProjectStatus) failed:', logErr.message);
    }

    res.json({ status: project.status });
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle project status', details: err.message });
  }
};

// Lightweight project specific audit logs (PM visibility)
exports.getProjectAuditLogsForPM = async (req, res) => {
  try {
    const { id } = req.params; // project id
    const project = await Project.findById(id).select('_id projectmanager');
    if (!project) return res.status(404).json({ message: 'Project not found' });
    // Only allow if requester is the project manager
    if (String(project.projectmanager) !== String(req.user.id)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    const AuditLog = require('../models/AuditLog');
    const logs = await AuditLog.find({ 'meta.projectId': id, action: { $in: ['COMPLETE_PROJECT', 'REOPEN_PROJECT', 'ADD_PROJECT_DOCUMENTS', 'ADD_PROJECT_REPORT', 'ADD_PROJECT', 'UPDATE_PROJECT', 'DELETE_PROJECT_DOCUMENT'] } })
      .sort({ timestamp: -1 })
      .limit(25)
      .populate('performedBy', 'name role');
    res.json(logs);
  } catch (e) {
    res.status(500).json({ message: 'Failed to fetch audit logs' });
  }
};

/* --- GET PROJECTS BY USER AND STATUS --- */
exports.getProjectsByUserAndStatus = async (req, res) => {
  const { userId, role, status } = req.query;
  if (!userId || !role || !status) return res.status(400).json({ message: 'Missing params' });

  const query = {};
  query[role] = userId;
  query.status = status;
  try {
    const projects = await Project.find(query)
      .populate('projectmanager', 'name email')
      .populate('pic', 'name email')
      .populate('staff', 'name email')
      .populate('hrsite', 'name email')
      .populate('areamanager', 'name email')
      .populate('location', 'name region')
      .populate('manpower', 'name position')
      .populate('contractor', 'name company companyName displayName');

    res.json(projects);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch projects' });
  }
};

/* --- DISCUSSIONS --- */
exports.getProjectDiscussions = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('discussions.user', 'name')
      .populate('discussions.replies.user', 'name');
    if (!project) return res.status(404).json({ error: 'Project not found' });
    
    
    res.json(project.discussions || []);
  } catch (err) {
    console.error('❌ Error fetching discussions:', err);
    res.status(500).json({ error: 'Failed to fetch discussions' });
  }
};

// helper
async function uploadDiscussionFiles(projectId, incomingFiles = []) {
  const saved = [];
  for (const file of incomingFiles) {
    const originalName = (file.originalname || 'file').trim();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filePath = `project-discussions/project-${projectId}/${timestamp}_${originalName}`;
    const { data, error } = await supabase.storage
      .from('documents')
      .upload(filePath, file.buffer, {
        contentType: file.mimetype || 'application/octet-stream',
        upsert: true
      });
    if (!error && data) saved.push({ path: filePath, name: originalName });
    else if (error) console.error('Supabase upload (discussion) error:', error);
  }
  return saved;
}

// POST discussion
exports.addProjectDiscussion = async (req, res) => {
  try {
    const text = (req.body?.text || '').trim();
    const label = req.body?.label || '';
    const projectId = req.params.id;
    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    // Handle file uploads (if any)
    const incoming = Array.isArray(req.files) ? req.files : [];
    const uploadedAttachments = await uploadDiscussionFiles(projectId, incoming);
    if (!text && uploadedAttachments.length === 0) {
      return res.status(400).json({ error: 'Provide text or at least one attachment' });
    }

    // Create a new discussion object
    const discussion = {
      user: req.user.id,
      userName: req.user.name,
      text,
      timestamp: new Date(),
      replies: [],
      attachments: uploadedAttachments,
      label: req.body?.label || '',
    };

    // Persist the message
    project.discussions.push(discussion);
    await project.save();

    const responseData = project.discussions[project.discussions.length - 1];

    // --- Profanity detection & HR notification (project discussions) ---
    try {
      if (text && hasProfanity(text)) {
        const profs = findProfanities(text);
        const hrUsers = await User.find({ role: { $regex: /^hr(\s*-\s*site)?$/i } }, '_id role');
        console.log('[ProfanityDetection] Project discussion profanity detected', { projectId, discussionId: responseData._id, profanities: profs, hrCount: hrUsers.length });
        for (const hr of hrUsers) {
          const tabParam = 'Discussions';
          // HR project record route pattern assumption
          const base = hr.role === 'hrsite' ? '/hr-site/project-records' : '/hr/project-records';
          const actionUrl = `${base}/${projectId}?tab=${encodeURIComponent(tabParam)}&focus=${responseData._id}`;
          await createAndEmitNotification({
            type: 'discussion_profanity_alert',
            toUserId: hr._id,
            fromUserId: req.user.id,
            message: `Profanity detected in project discussion: ${profs.join(', ')}`,
            projectId: project._id,
            referenceId: responseData._id,
            meta: { projectId: String(projectId), discussionId: String(responseData._id), profanities: profs },
            title: 'Profanity Detected',
            severity: 'warning',
            icon: 'alert-triangle',
            actionUrl,
            req
          });
        }
      }
    } catch (pfErr) {
      console.error('Profanity alert (project discussion) error:', pfErr);
    }

    // Log the action
    try {
      await logAction({
        action: 'UPLOAD_PROJECT_DISCUSSION',
        performedBy: req.user.id,
        performedByRole: req.user.role,
        description: `Added discussion to project ${project.projectName}`,
        meta: { 
          projectId: project._id, 
          projectName: project.projectName,
          discussionId: responseData._id,
          hasText: !!text,
          hasAttachments: uploadedAttachments.length > 0,
          attachmentCount: uploadedAttachments.length,
          label: label || 'none'
        }
      });
    } catch (logErr) {
      console.error('Audit log error (addProjectDiscussion):', logErr);
    }

    const io = req.app.get('io');
    if (io) {
      // Emit a structured payload so clients can verify projectId and access the message
      try {
        console.log(`[socket emit] project:newDiscussion -> project:${projectId}`, { projectId, messageId: responseData?._id });
      } catch (e) { }
      io.to(`project:${projectId}`).emit('project:newDiscussion', { projectId, message: responseData });
    }

    // Broadcast notification to project members (excluding the user who created the discussion)
    const involvedUsers = collectProjectMembers(project); // Get users involved in the project
    // Iterate and notify each involved user. Always save notification to DB.
    const appUserSockets = req.app.get('userSockets'); // Map<userId, Set<socketId>>
    for (const user of involvedUsers) {
      try {
        if (String(user._id) === String(req.user.id)) continue; // skip creator

        const notifPayload = {
          type: 'discussion',
          toUserId: user._id,
          fromUserId: req.user.id,
          message: `${req.user.name} added a new discussion: "${text.slice(0, 50)}..." ${label ? `[${label}]` : ''}`,
          projectId: project._id,
          referenceId: responseData._id,
          meta: { discussionId: responseData._id },
        };

        // Save notification to DB
        const createdNotif = await Notification.create(notifPayload);

        // Emit to all active sockets for that user (if any)
        if (appUserSockets && typeof appUserSockets.get === 'function') {
          const socketSet = appUserSockets.get(String(user._id));
          if (socketSet && socketSet.size) {
            for (const sid of socketSet) {
              try { io.to(sid).emit('notification', createdNotif); } catch (emitErr) { console.error('Emit error to', sid, emitErr); }
            }
          } else {
            // no active sockets for this user
          }
        }
      } catch (innerErr) {
        console.error('Error creating/emitting discussion notification for user', user._id, innerErr);
      }
    }

    res.status(201).json(responseData);
  } catch (err) {
    console.error('❌ Error in addProjectDiscussion:', err);
    res.status(500).json({ error: 'Failed to post discussion', details: err.message });
  }
};



// POST reply
exports.replyToProjectDiscussion = async (req, res) => {
  try {
    const text = (req.body?.text || '').trim();
    const { id: projectId, msgId } = req.params;
    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const discussion = project.discussions.id(msgId);
    if (!discussion) return res.status(404).json({ error: 'Discussion not found' });

    const incoming = Array.isArray(req.files) ? req.files : [];
    const uploadedAttachments = await uploadDiscussionFiles(projectId, incoming);
    if (!text && uploadedAttachments.length === 0) {
      return res.status(400).json({ error: 'Provide text or at least one attachment' });
    }

    const reply = {
      user: req.user.id,
      userName: req.user.name,
      text,
      timestamp: new Date(),
      attachments: uploadedAttachments
    };

    // Persist the reply (this is the critical operation)
    discussion.replies.push(reply);
    await project.save();

    const responseReply = discussion.replies[discussion.replies.length - 1];

    // Log the action
    try {
      await logAction({
        action: 'UPLOAD_PROJECT_DISCUSSION',
        performedBy: req.user.id,
        performedByRole: req.user.role,
        description: `Replied to discussion in project ${project.projectName}`,
        meta: { 
          projectId: project._id, 
          projectName: project.projectName,
          discussionId: msgId,
          replyId: responseReply._id,
          hasText: !!text,
          hasAttachments: uploadedAttachments.length > 0,
          attachmentCount: uploadedAttachments.length
        }
      });
    } catch (logErr) {
      console.error('Audit log error (replyToProjectDiscussion):', logErr);
    }
    const io = req.app.get('io');
    if (io) {
      try {
        console.log(`[socket emit] project:newReply -> project:${projectId}`, { projectId, msgId, replyId: responseReply?._id });
      } catch (e) { }
      // Include the parent message id so clients can attach the reply to the correct discussion
      io.to(`project:${projectId}`).emit('project:newReply', { projectId, msgId, reply: responseReply });
    }

    // Create a notification for the users who are mentioned or involved in the discussion
    const involvedUsers = collectProjectMembers(project);
    involvedUsers.forEach(async (user) => {
      if (user._id.toString() !== req.user.id.toString()) { // Don't notify the user who replied
        const notif = {
          message: `${req.user.name} replied to a discussion: "${text.slice(0, 50)}..."`,
          type: 'reply',
          toUserId: user._id,
          fromUserId: req.user.id,
          projectId: project._id,
          referenceId: responseReply._id,
          meta: { replyId: responseReply._id },
        };

        // Save the notification to MongoDB
        const newNotification = new Notification(notif);
        await newNotification.save();

        // Emit the notification to the user's socket(s)
        const userSockets = req.app.get('userSockets');
        if (userSockets && typeof userSockets.get === 'function') {
          const socketSet = userSockets.get(String(user._id));
          if (socketSet && socketSet.size) {
            for (const sid of socketSet) {
              try {
                io.to(sid).emit('notification', notif);
              } catch (emitErr) {
                console.error('Emit error to', sid, emitErr);
              }
            }
          }
        }
      }
    });

    res.status(201).json(responseReply);

  } catch (err) {
    console.error('❌ Error in replyToProjectDiscussion:', err);
    res.status(500).json({ error: 'Failed to post reply' });
  }
};


/* ====================== UPLOAD PROJECT DOCUMENTS ====================== */
exports.uploadProjectDocuments = async (req, res) => {
  try {
    const { id } = req.params;
    const overwrite = String(req.query.overwrite || '0') === '1';

    const project = await Project.findById(id);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    if (!userCanUploadToProject(project, req.user)) {
      return res.status(403).json({ message: 'Not allowed to delete documents for this project' });
    }

    const incoming = listIncomingFilesMulter(req);
    if (!incoming.length) {
      return res.status(400).json({ message: 'No files uploaded (expected field name "files")' });
    }

    const existingDocs = Array.isArray(project.documents) ? project.documents : [];
    const existingLower = new Set(
      existingDocs.map(d => extractNameFromDoc(d).toLowerCase())
    );
    const takenLower = new Set(existingLower);

    const addedDocs = [];
    const renamed = [];
    const replaced = [];

    async function removeExistingWithName(originalName) {
      const origLower = (originalName || '').toLowerCase();
      const toRemove = (project.documents || []).filter(d =>
        extractNameFromDoc(d).toLowerCase() === origLower
      );

      if (toRemove.length) {
        const relPaths = toRemove
          .map(d => extractPathFromDoc(d))
          .filter(Boolean)
          .map(p => p.replace(/^.*?project-documents\//, 'project-documents/'));

        if (relPaths.length) {
          const { error: rmError } = await supabase.storage
            .from('documents')
            .remove(relPaths);
          if (rmError) console.error('Supabase remove error:', rmError);
        }

        project.documents = (project.documents || []).filter(d => !toRemove.includes(d));
      }
      return toRemove.length;
    }

    for (const file of incoming) {
      const originalNameRaw = (file.originalname || 'file').trim();
      const originalKey = originalNameRaw.toLowerCase();
      let finalName = originalNameRaw;

      if (existingLower.has(originalKey)) {
        if (overwrite) {
          const removedCount = await removeExistingWithName(originalNameRaw);
          if (removedCount > 0) replaced.push({ originalName: originalNameRaw, removed: removedCount });
          takenLower.add(originalKey);
        } else {
          const unique = makeUniqueName(originalNameRaw, takenLower);
          if (unique !== originalNameRaw) renamed.push({ from: originalNameRaw, to: unique });
          finalName = unique;
        }
      } else {
        takenLower.add(originalKey);
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filePath = `project-documents/project-${id}/${timestamp}_${finalName}`;

      const { data, error } = await supabase.storage
        .from('documents')
        .upload(filePath, file.buffer, {
          contentType: file.mimetype || 'application/octet-stream',
          upsert: true
        });

      if (error) {
        console.error('Supabase upload error:', error);
        continue;
      }
      if (data) {
        addedDocs.push({
          path: filePath,
          name: finalName,
          uploadedBy: String(req.user?.id || req.user?._id || ''),
          uploadedByName: req.user?.name || '',
          uploadedAt: new Date()
        });
      }
    }

    if (addedDocs.length) {
      project.documents = [...(project.documents || []), ...addedDocs];
    }
    await project.save();

    await logAction({
      action: 'ADD_PROJECT_DOCUMENTS',
      performedBy: req.user.id,
      performedByRole: req.user.role,
      description:
        `Uploaded ${addedDocs.length} document(s)` +
        (renamed.length ? `, renamed ${renamed.length} duplicate(s)` : '') +
        (replaced.length ? `, replaced ${replaced.reduce((a, r) => a + r.removed, 0)} old file(s)` : '') +
        ` for project ${project.projectName}`,
      meta: { projectId: project._id, projectName: project.projectName, added: addedDocs.length, renamed, replaced, context: 'project' }
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`project:${id}`).emit('project:documentsUpdated', { projectId: String(id) });
    }

    return res.status(200).json({
      documents: project.documents,
      added: addedDocs,
      renamed,
      replaced
    });
  } catch (err) {
    console.error('❌ uploadProjectDocuments error:', err);
    return res.status(500).json({ message: 'Upload failed', details: err.message });
  }
};

/* ====================== DELETE ONE PROJECT DOCUMENT ====================== */
exports.deleteProjectDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const { path } = req.body;
    if (!path) return res.status(400).json({ message: 'Missing path' });

    const project = await Project.findById(id);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    // Permit CEO to delete any project document; otherwise require normal upload/delete permissions
    if (!req.user || String(req.user.role || '').toLowerCase() !== 'ceo') {
      if (!userCanUploadToProject(project, req.user)) {
        return res.status(403).json({ message: 'Not allowed to delete documents for this project' });
      }
    }

    const relative = path.replace(/^.*?project-documents\//, 'project-documents/');
    const { error } = await supabase.storage.from('documents').remove([relative]);
    if (error) console.error('Supabase remove error:', error);

    project.documents = (project.documents || []).filter(d => extractPathFromDoc(d) !== path);
    await project.save();

    // Audit log the deletion
    try {
      await logAction({
        action: (req.user && String(req.user.role || '').toLowerCase() === 'ceo') ? 'CEO_DELETE_PROJECT_DOCUMENT' : 'DELETE_PROJECT_DOCUMENT',
        performedBy: req.user?.id,
        performedByRole: req.user?.role,
        description: `${req.user?.name || 'Unknown'} deleted document ${path} from project ${project.projectName}`,
  meta: { projectId: project._id, projectName: project.projectName, path, context: 'project' }
      });
    } catch (logErr) {
      console.error('Audit log error (deleteProjectDocument):', logErr);
    }

    const io = req.app.get('io');
    if (io) {
      io.to(`project:${id}`).emit('project:documentsUpdated', { projectId: String(id) });
    }

    res.json({ documents: project.documents });
  } catch (e) {
    console.error('deleteProjectDocument error:', e);
    res.status(500).json({ message: 'Failed to delete file' });
  }
};

/* ====================== REPORTS: AI helpers ====================== */
function coerceJson(text = '') {
  const t = text.trim();
  const fence = t.match(/^\s*```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fence ? fence[1] : t;
}
const REPORT_SYS = `
You analyze a construction/project PPT and return STRICT JSON ONLY with this shape:
{
  "summary_of_work_done": string[],                // short bullet points
  "completed_tasks": string[],                     // concrete items completed
  "critical_path_analysis": [                      // EXACTLY three objects, in this order:
    {
      "path_type": "optimistic",                   // "optimistic" | "realistic" | "pessimistic"
      "name": string,                              // short label (e.g., "Floors 20–23 finishing")
      "estimated_days": number,                    // time-to-complete in DAYS (integer)
      "assumptions": string[],                     // what assumptions you used
      "blockers": string[],                        // known or likely blockers
      "risk": string,                              // short risk statement
      "next": string[]                             // next steps after completion
    },
    { "path_type": "realistic",  "name": string, "estimated_days": number, "assumptions": string[], "blockers": string[], "risk": string, "next": string[] },
    { "path_type": "pessimistic","name": string, "estimated_days": number, "assumptions": string[], "blockers": string[], "risk": string, "next": string[] }
  ],
  "task_priorities": [                             // ordered highest impact first (max 7)
    { "task": string, "priority": "High"|"Medium"|"Low", "justification": string, "impact": string }
  ],
  "pic_performance_evaluation": {                  // must NEVER be empty
    "text": string,                                // concise narrative (2–4 sentences) based on the PPT
    "score": number                                // 0–100 integer
  },
  "pic_contribution_percent": number,              // 0–100 integer
  "confidence": number                             // 0–1 float
}
Rules:
- Output JSON ONLY (no markdown fences, no prose).
- "critical_path_analysis" MUST be exactly 3 entries: optimistic, realistic, pessimistic.
- Provide a concise "task_priorities" list (if derivable) – focus on uncompleted or gating work; max 7 items.
- All numeric fields must be numbers (not strings).
- If the PPT is sparse, infer sensible values from context instead of saying "insufficient".
- Use the field name "estimated_days" for durations (integers in days). Do not use other names like "durationDays".
`;

async function generateReportJsonFromText(rawText) {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not set');
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
  const payload = {
    contents: [{ parts: [{ text: `${REPORT_SYS}\n\n---\nPPT TEXT:\n${rawText}` }]}],
    generationConfig: { temperature: 0.2, topP: 0.9, maxOutputTokens: 2048 }
  };
  const { data } = await axios.post(`${url}?key=${GEMINI_API_KEY}`, payload, { timeout: 60000 });
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  if (!text) throw new Error('Empty AI response');
  const cleaned = coerceJson(text);
  const parsed = JSON.parse(cleaned);

  // defaults
  const def = {
    summary_of_work_done: [],
    completed_tasks: [],
    critical_path_analysis: [],
    task_priorities: [],
    pic_performance_evaluation: { text: '', score: null },
    pic_contribution_percent: 0,
    confidence: 0.6
  };
  const out = { ...def, ...parsed };

  // normalize CPA
  const wantOrder = ['optimistic', 'realistic', 'pessimistic'];
  let cpa = Array.isArray(out.critical_path_analysis) ? out.critical_path_analysis : [];
  cpa = cpa.map((c = {}) => ({
    path_type: (c.path_type || '').toString().toLowerCase(),
    name: c.name || '',
    estimated_days: Number.isFinite(c.estimated_days) ? Math.max(1, Math.round(c.estimated_days)) : null,
    assumptions: Array.isArray(c.assumptions) ? c.assumptions : [],
    blockers: Array.isArray(c.blockers) ? c.blockers : [],
    risk: c.risk || '',
    next: Array.isArray(c.next) ? c.next : []
  }));
  const byType = new Map(cpa.map(x => [x.path_type, x]));
  const safeCPA = wantOrder.map((t, i) => {
    const picked = byType.get(t) || {};
    return {
      path_type: t,
      name: picked.name || (t.charAt(0).toUpperCase() + t.slice(1) + ' path'),
      estimated_days: Number.isFinite(picked.estimated_days) ? picked.estimated_days : (t === 'optimistic' ? 7 : t === 'realistic' ? 14 : 21),
      assumptions: picked.assumptions?.length ? picked.assumptions : ['Derived from available slides.'],
      blockers: picked.blockers || [],
      risk: picked.risk || (t === 'pessimistic' ? 'Potential supply or handover delays' : 'Moderate'),
      next: picked.next || []
    };
  });
  out.critical_path_analysis = safeCPA;

  // PiC perf must never be blank
  const perf = out.pic_performance_evaluation || {};
  if (!perf.text || typeof perf.text !== 'string') {
    const doneCt = (out.completed_tasks || []).length;
    const sumCt = (out.summary_of_work_done || []).length;
    const trend = doneCt >= 5 ? 'strong' : doneCt >= 3 ? 'steady' : 'emerging';
    perf.text = `The PiC shows ${trend} progress with ${doneCt} documented completions across key areas. Coordination appears adequate and site cadence is maintained. Focus should shift to unblocked handovers and closing open scopes.`;
  }
  if (!Number.isFinite(perf.score)) {
    const base = Math.min(95, 60 + ((out.completed_tasks || []).length * 5));
    perf.score = Math.max(50, Math.round(base));
  }
  out.pic_performance_evaluation = perf;

  if (!Number.isFinite(out.pic_contribution_percent)) {
    const denom = Math.max(1, (out.summary_of_work_done || []).length);
    out.pic_contribution_percent = Math.min(100, Math.round(((out.completed_tasks || []).length / denom) * 60 + 20));
  }
  if (!Number.isFinite(out.confidence)) out.confidence = 0.6;

  return out;
}

function normalizeAi(ai, rawText = '') {
  const out = {
    summary_of_work_done: Array.isArray(ai?.summary_of_work_done) ? ai.summary_of_work_done : [],
    completed_tasks: Array.isArray(ai?.completed_tasks) ? ai.completed_tasks : [],
  critical_path_analysis: Array.isArray(ai?.critical_path_analysis) ? ai.critical_path_analysis : [],
  task_priorities: Array.isArray(ai?.task_priorities) ? ai.task_priorities : [],
    pic_performance_evaluation: ai?.pic_performance_evaluation || { text: '', score: null },
    pic_contribution_percent: Number.isFinite(ai?.pic_contribution_percent) ? ai.pic_contribution_percent : 0,
    confidence: Number.isFinite(ai?.confidence) ? ai.confidence : 0.6,
  };

  const WANT = ['optimistic', 'realistic', 'pessimistic'];
  const byType = new Map(
  out.critical_path_analysis.map(c => [c?.path_type, c])
  );

  const mk = (type, fallbackName) => {
    const src = byType.get(type) || {};
    const est =
      Number.isFinite(src.estimated_days) ? Math.max(1, Math.round(src.estimated_days)) :
      Number.isFinite(src.durationDays)    ? Math.max(1, Math.round(src.durationDays)) :
      (type === 'optimistic' ? 7 : type === 'realistic' ? 14 : 21);

    return {
      path_type: type,
      name: (src.name && String(src.name).trim()) || fallbackName,
      estimated_days: est,
      assumptions: Array.isArray(src.assumptions) && src.assumptions.length
        ? src.assumptions
        : ['Derived from available slides.'],
      blockers: Array.isArray(src.blockers) ? src.blockers : [],
      risk: (src.risk && String(src.risk).trim())
        || (type === 'pessimistic' ? 'High risk due to possible supply/handover delays' : 'Moderate risk'),
      next: Array.isArray(src.next) ? src.next : [],
    };
  };

  out.critical_path_analysis = [
    mk('optimistic',  'Optimistic Path'),
    mk('realistic',   'Realistic Path'),
    mk('pessimistic', 'Pessimistic Path'),
  ];

  const perf = out.pic_performance_evaluation || {};
  if (!perf.text || typeof perf.text !== 'string') {
    const doneCt = (out.completed_tasks || []).length;
    const trend = doneCt >= 5 ? 'strong' : doneCt >= 3 ? 'steady' : 'emerging';
    perf.text = `Progress appears ${trend}, with documented completions and continued activity across scopes. Priority is clearing dependencies and closing remaining work fronts.`;
  }
  if (!Number.isFinite(perf.score)) {
    const base = Math.min(95, 60 + ((out.completed_tasks || []).length * 5));
    perf.score = Math.max(55, Math.round(base));
  }
  out.pic_performance_evaluation = perf;

  if (!(out.pic_contribution_percent >= 0 && out.pic_contribution_percent <= 100)) {
    const denom = Math.max(1, (out.summary_of_work_done || []).length);
    out.pic_contribution_percent = Math.min(
      100,
      Math.round(((out.completed_tasks || []).length / denom) * 60 + 20)
    );
  }

  if (!(out.confidence > 0 && out.confidence <= 1)) out.confidence = 0.6;

  return out;
}

function naiveAnalyze(text = '', picName = '') {
  const lines = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const bullets = lines.filter(s => s.length <= 200);

  const summary = bullets.slice(0, 6);
  const completed = bullets.filter(s =>
    /done|completed|finished|achieved|installed|construction completed|cladding installation completed/i.test(s)
  );

  const floorNums = (text.match(/\b(1?\d|2\d|3\d|4\d) ?(st|nd|rd|th)?\b/gi) || [])
    .map(s => parseInt(s, 10))
    .filter(n => Number.isFinite(n));
  const uniqueFloors = [...new Set(floorNums)].length;

  const unit = Math.max(1, Math.ceil(uniqueFloors * 2));
  const optimisticDays  = unit;
  const realisticDays   = Math.max(unit + 5, Math.round(unit * 1.7));
  const pessimisticDays = Math.max(realisticDays + 7, Math.round(unit * 2.4));

  const scopeName = uniqueFloors >= 2
    ? `Floors ${Math.min(...floorNums)}–${Math.max(...floorNums)} closeout`
    : (bullets[0]?.replace(/^[-•\d.)\s]*/, '').slice(0, 60) || 'Scope closeout');

  const cpa = [
    {
      path_type: 'optimistic',
      name: scopeName,
      estimated_days: optimisticDays || 7,
      assumptions: ['All handovers ready; materials and access available.', 'Crew continuity maintained.'],
      blockers: [],
      risk: 'Low if handover is on time.',
      next: ['Punchlisting', 'Turnover documentation']
    },
    {
      path_type: 'realistic',
      name: scopeName,
      estimated_days: realisticDays || 14,
      assumptions: ['Minor rework and coordination with other trades.', 'Standard inspection cycle.'],
      blockers: ['Partial handovers', 'Inter-trade access conflicts'],
      risk: 'Moderate schedule friction.',
      next: ['QC inspections', 'Close NCRs, if any']
    },
    {
      path_type: 'pessimistic',
      name: scopeName,
      estimated_days: pessimisticDays || 21,
      assumptions: ['Late handover of areas and sporadic manpower constraints.'],
      blockers: ['Late material approvals', 'Design clarifications'],
      risk: 'High if dependencies slip.',
      next: ['Re-baseline affected activities', 'Escalate blockers early']
    }
  ];

  const doneCt = completed.length;
  const sumCt = summary.length || 1;
  const contribution = Math.min(100, Math.round((doneCt / sumCt) * 60 + 20));

  return {
    summary_of_work_done: summary,
    completed_tasks: completed.slice(0, 10),
    critical_path_analysis: cpa,
    task_priorities: summary.slice(0,5).map((t,i)=> ({
      task: t.replace(/^[-•\d.)\s]*/, '').slice(0,80),
      priority: i<2 ? 'High' : i<4 ? 'Medium' : 'Low',
      justification: i<2 ? 'High leverage or blocking progress' : 'Supports overall completion cadence',
      impact: i<2 ? 'Accelerates critical path' : 'Improves readiness/quality'
    })),
    pic_performance_evaluation: {
      text: `${picName || 'The PiC'} maintains steady site cadence with ${doneCt} recorded completions. Coordination across shared areas is evident; upcoming focus is eliminating access conflicts and securing timely handovers.`,
      score: Math.max(55, Math.min(92, 65 + doneCt * 4))
    },
    pic_contribution_percent: contribution,
    confidence: 0.6
  };
}

/* ====================== REPORTS: List (with migration) ====================== */
exports.getProjectReports = async (req, res) => {
  try {
    const { id } = req.params;
    const project = await Project.findById(id, 'reports');
    if (!project) return res.status(404).json({ message: 'Project not found' });

    // MIGRATE: ensure stored AI objects have path_type + estimated_days
    let changed = false;
    for (const rep of (project.reports || [])) {
      if (!rep.ai) continue;
      const before = JSON.stringify(rep.ai.critical_path_analysis || []);
      rep.ai = ensureCpaShape(rep.ai);
      const after = JSON.stringify(rep.ai.critical_path_analysis || []);
      if (before !== after) changed = true;
    }
    if (changed) await project.save();

    const reports = (project.reports || []).slice().sort((a,b) => new Date(b.uploadedAt||0) - new Date(a.uploadedAt||0));
    res.json({ reports });
  } catch (e) {
    res.status(500).json({ message: 'Failed to list reports' });
  }
};

/* ====================== REPORTS: Delete ====================== */
exports.deleteProjectReport = async (req, res) => {
  try {
    const { id, reportId } = req.params;
    const project = await Project.findById(id);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    if (!userCanUploadToProject(project, req.user)) {
      return res.status(403).json({ message: 'Not allowed to delete reports for this project' });
    }

    const rep = project.reports.id(reportId);
    if (!rep) return res.status(404).json({ message: 'Report not found' });

    // Additional ownership restriction: if role is PIC, only allow deletion of own report
    const roleLower = String(req.user.role || '').toLowerCase();
    if (roleLower.includes('pic') && rep.uploadedBy && String(rep.uploadedBy) !== String(req.user.id)) {
      return res.status(403).json({ message: 'PIC can only delete their own uploaded reports' });
    }

    const toRemove = [];
    if (rep.path)     toRemove.push(rep.path.replace(/^.*?project-reports\//, 'project-reports/'));
    if (rep.jsonPath) toRemove.push(rep.jsonPath.replace(/^.*?project-reports\//, 'project-reports/'));
    if (rep.pdfPath)  toRemove.push(rep.pdfPath.replace(/^.*?project-reports\//, 'project-reports/'));
    if (toRemove.length) {
      const { error } = await supabase.storage.from('documents').remove(toRemove);
      if (error) console.error('Supabase remove (report) error:', error);
    }

    rep.deleteOne();
    await project.save();

    const io = req.app.get('io');
    if (io) io.to(`project:${id}`).emit('project:reportsUpdated', { projectId: String(id) });

    const reports = (project.reports || []).slice().sort((a,b) => new Date(b.uploadedAt||0) - new Date(a.uploadedAt||0));
    res.json({ reports });
  } catch (e) {
    console.error('deleteProjectReport error:', e);
    res.status(500).json({ message: 'Failed to delete report' });
  }
};

/* ====================== REPORTS: Signed URL helper ====================== */
exports.getReportSignedUrl = async (req, res) => {
  try {
    const { path } = req.query;
    if (!path) return res.status(400).json({ message: 'Missing path' });
    const { data, error } = await supabase
      .storage
      .from('documents')
      .createSignedUrl(path, 60 * 10);
    if (error || !data?.signedUrl) return res.status(500).json({ message: 'Failed to create signed URL' });
    return res.json({ signedUrl: data.signedUrl });
  } catch (e) {
    return res.status(500).json({ message: 'Server error' });
  }
};

/* --- GET PROJECT USERS FOR MENTIONS --- */
exports.getProjectUsers = async (req, res) => {
  
  try {
    const { id } = req.params;
    
    const project = await Project.findById(id);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }


    // Get all users in the project (PM, PIC, Staff, HR Site, Area Manager)
    const projectUsers = await User.find({
      $or: [
        { _id: project.projectmanager },
        { _id: { $in: project.pic || [] } },
        { _id: { $in: project.staff || [] } },
        { _id: { $in: project.hrsite || [] } },
        { _id: project.areamanager }
      ]
    }).select('name _id');

    res.json(projectUsers);
  } catch (err) {
    console.error('❌ Error fetching project users:', err);
    res.status(500).json({ message: 'Failed to fetch project users' });
  }
};

/* ====================== UPLOAD PROJECT REPORTS ====================== */
exports.uploadProjectReport = async (req, res) => {
  try {
    const { id } = req.params;

    // Find project and permission check
    const project = await Project.findById(id);
    if (!project) return res.status(404).json({ message: 'Project not found' });
    if (!userCanUploadToProject(project, req.user)) {
      return res.status(403).json({ message: 'Not allowed to upload reports for this project' });
    }

    // Accept exactly one file under field name "report"
    const file = Array.isArray(req.files?.report) ? req.files.report[0]
              : Array.isArray(req.files)         ? req.files[0]
              : req.file;
    if (!file) return res.status(400).json({ message: 'No report uploaded (expected field name "report")' });

    const originalName = (file.originalname || 'Report.pptx').trim();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const baseDir   = `project-reports/project-${id}`;
    const srcPath   = `${baseDir}/${timestamp}_${originalName}`;

    // 1) Upload raw PPTX into 'documents' bucket
    const up1 = await supabase.storage
      .from('documents')
      .upload(srcPath, file.buffer, {
        contentType: file.mimetype || 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        upsert: true
      });
    if (up1.error) throw up1.error;

    // 2) Extract text from PPTX
    let extractedText = '';
    try {
      extractedText = await extractPptText(file.buffer);
    } catch (e) {
      const reportDoc = {
        path: srcPath,
        name: originalName,
        uploadedBy: req.user.id,
        uploadedByName: req.user.name,
        uploadedAt: new Date(),
        status: 'failed',
        error: `PPT text extraction failed: ${e.message}`
      };
      project.reports.push(reportDoc);
      await project.save();
      return res.status(200).json({ message: 'Report stored but extraction failed', report: reportDoc });
    }

    // 3) AI JSON (Gemini) with a safe fallback
    let aiJson;
    try {
      aiJson = await generateReportJsonFromText(extractedText);
    } catch (e) {
      aiJson = naiveAnalyze(extractedText, req.user?.name || '');
    }
    // <<< ensure scenarios + non‑blank performance
    aiJson = normalizeAi(aiJson, extractedText);
    // NEW: force CPA to have path_type + estimated_days (migration-proof for UI)
    aiJson = ensureCpaShape(aiJson);

    // 4) Upload JSON artifact
    const jsonPath = `${baseDir}/${timestamp}_analysis.json`;
    const up2 = await supabase.storage
      .from('documents')
      .upload(jsonPath, Buffer.from(JSON.stringify(aiJson, null, 2)), {
        contentType: 'application/json',
        upsert: true
      });
    if (up2.error) throw up2.error;

    // 5) Build & upload short PDF summary
    let pdfPath = '';
    try {
      // Prepare branding/meta
      const companyName = process.env.COMPANY_NAME || 'FadzTrack';
      const companyLogoUrl = process.env.COMPANY_LOGO_URL || 'https://fadztrack.online/images/Fadz-logo.png';
      let logoBuffer = null;
      try {
        if (companyLogoUrl) {
          const resp = await axios.get(companyLogoUrl, { responseType: 'arraybuffer' });
          logoBuffer = Buffer.from(resp.data);
        }
      } catch (e) {
        // Logo optional; continue without it
      }

      const pdfBuf = await buildReportPdfBuffer(
        aiJson,
        {
          title: 'AI Analysis Summary',
          projectName: project.projectName,
          filename: originalName,
          companyName,
          exportedBy: req.user?.name || '',
          exportDate: new Date()
        },
        logoBuffer
      );
      pdfPath = `${baseDir}/${timestamp}_analysis.pdf`;
      const up3 = await supabase.storage
        .from('documents')
        .upload(pdfPath, pdfBuf, { contentType: 'application/pdf', upsert: true });
      if (up3.error) throw up3.error;
    } catch (e) {
      console.warn('PDF render failed, continuing without pdfPath:', e.message);
    }

    // 6) Save to Mongo
    const reportDoc = {
      path: srcPath,
      name: originalName,
      uploadedBy: req.user.id,
      uploadedByName: req.user.name,
      uploadedAt: new Date(),
      jsonPath,
      pdfPath: pdfPath || undefined,
      status: 'ready',
      ai: aiJson
    };
    project.reports.push(reportDoc);
    await project.save();

    // 7) Notify via socket
    const io = req.app.get('io');
    if (io) io.to(`project:${id}`).emit('project:reportsUpdated', { projectId: String(id) });

    return res.status(201).json({ report: reportDoc });
  } catch (err) {
    console.error('uploadProjectReport error:', err);
    return res.status(500).json({ message: 'Upload/AI failed', details: err.message });
  }
};

/* ====================== ATTENDANCE (Excel) - Unified ====================== */
// Unified set of allowed attendance codes
const ATTENDANCE_CODES = new Set(['P','A','L','EO','SE','AL','R','HD']);

// Parse any attendance workbook (schedule or daily) into structured rows
function parseAttendanceWorkbook(buf){
  const wb = XLSX.read(buf, { type:'buffer' });
  let chosen = null; // { sheetName, rows2d, headerIdx }
  for(const sn of wb.SheetNames){
    const ws = wb.Sheets[sn];
    const rows2d = XLSX.utils.sheet_to_json(ws, { header:1, blankrows:false });
    const hdrIdx = rows2d.findIndex(r => Array.isArray(r) && r.some(c => /\bID\b/i.test(String(c))) && r.some(c => /name/i.test(String(c))));
    if(hdrIdx !== -1){
      chosen = { sheetName: sn, rows2d, headerIdx: hdrIdx };
      if(/schedule|att/i.test(sn)) break;
    }
  }
  if(!chosen){
    const sn = wb.SheetNames[0];
    const ws = wb.Sheets[sn];
    chosen = { sheetName: sn, rows2d: XLSX.utils.sheet_to_json(ws, { header:1, blankrows:false }), headerIdx: 0 };
  }
  const { sheetName, rows2d, headerIdx } = chosen;
const header = rows2d[headerIdx] || [];

const STATIC_COLS = new Set(['NAME','POSITION','P','L','A','AL','EO','SE','R','HD','ATTENDANCE','ATTENDANCE%','ATTENDANCE RATE']);
  const idColIdx   = header.findIndex(c => /\bID\b/i.test(String(c)));
  const nameColIdx = header.findIndex(c => /name/i.test(String(c)));
  const deptIdx    = header.findIndex(c => /department/i.test(String(c)));
  const cardIdx    = header.findIndex(c => /card\s*number/i.test(String(c)));

  // NEW: find a Position column by common variants
  const posIdx = header.findIndex(c =>
    /position|role|designation|job\s*title|title/i.test(String(c || ''))
  );
  // If header already contains a Day 1 column, start scanning from there; else use last static column +1
  let firstDayIdx = header.findIndex(c => /day\s*1/i.test(String(c||'')));
  if(firstDayIdx === -1){
    const staticIndices = header.map((h,i)=> STATIC_COLS.has(String(h||'').toUpperCase()) ? i : -1).filter(i=> i>=0);
    const lastStatic = staticIndices.length ? Math.max(...staticIndices) : Math.max(nameColIdx, idColIdx, deptIdx, cardIdx);
    firstDayIdx = (lastStatic>=0? lastStatic : 0) + 1;
  }
  const afterIdx = firstDayIdx < 0 ? 1 : firstDayIdx; // inclusive start of day scan

  const maxCols = header.length > 0 ? Math.max(header.length, ...rows2d.slice(headerIdx+1).map(r => r.length)) : 0;
  const dayGroups = []; // { name:'Day 1', idxList:[colIdx(es)] }
  const dayNameSeen = new Set();
  for(let col = afterIdx; col < maxCols; col++){
    const hRaw = String(header[col]||'').trim();
    if(hRaw && STATIC_COLS.has(hRaw.toUpperCase())) continue; // skip static metrics
    // Derive candidate day name
    let baseName = '';
    const mDay = hRaw.match(/day\s*(\d+)/i);
    if(mDay){
      baseName = `Day ${mDay[1]}`;
    } else if(/^(\d{1,2})$/.test(hRaw)) { // numeric day
      baseName = `Day ${hRaw}`;
    } else if(!hRaw){
      continue; // empty header before any day markers
    } else if(/time-?in|time-?out/i.test(hRaw)){
      // rely on previous day group if header just says Time-In/Out (rare), skip otherwise
      continue;
    } else if(/day/i.test(hRaw)){
      baseName = hRaw.replace(/\(.*?\)/,'').trim();
    } else {
      // heuristic: stop if we run into long stretch of non-day labeled columns after groups started
      if(dayGroups.length) break;
      continue;
    }
    // Sample data presence
    const sampleRows = rows2d.slice(headerIdx+1, headerIdx+50);
    const hasData = sampleRows.some(r => r && r[col] != null && String(r[col]).trim() !== '');
    if(!hasData) continue;
    // Group Time-In/Time-Out variants into one day (store both indices)
    const existing = dayGroups.find(d=> d.name === baseName);
    if(existing){
      existing.idxList.push(col);
    } else {
      dayGroups.push({ name: baseName, idxList:[col] });
      dayNameSeen.add(baseName);
      if(dayGroups.length >= 31) break;
    }
  }

  // Fallback: if no day groups found, try legacy scan (kept minimal) to avoid empty result
  if(!dayGroups.length){
    const legacy = [];
    let dayCounter = 1;
    for(let col = afterIdx; col < maxCols; col++){
      const sampleRows = rows2d.slice(headerIdx+1, headerIdx+50);
      const hasData = sampleRows.some(r => r && r[col] != null && String(r[col]).trim() !== '');
      if(!hasData) continue;
      legacy.push({ name: `Day ${dayCounter}`, idxList:[col] });
      dayCounter++; if(dayCounter>31) break;
    }
    if(legacy.length) dayGroups.push(...legacy);
  }

  if(dayGroups.length === 0){
    console.warn('Attendance parse: no day columns detected.', { sheetName, header });
  } else {
    console.log('Attendance parse debug:', { sheetName, detectedDayCols: dayGroups.map(d=> d.name), fromColumn: afterIdx });
  }

  const rows = [];
  for (let i = headerIdx + 1; i < rows2d.length; i++) {
    const row = rows2d[i];
    if (!row || row.every(c => c == null || String(c).trim() === '')) continue;

    const name = nameColIdx >= 0 ? row[nameColIdx] : row[1];
    if (!name || String(name).trim() === '') continue;
    if (/^summary$/i.test(String(name).trim())) continue;

    const id       = idColIdx >= 0 ? row[idColIdx] : undefined;
    const position = posIdx   >= 0 ? String(row[posIdx] || '').trim() : ''; // <— NEW

    const daysRaw = {};
    dayGroups.forEach(g => {
      const values = [];
      for (const idx of g.idxList) {
        const v = row[idx];
        if (v != null && String(v).trim() !== '') values.push(String(v).trim());
      }
      if (!values.length) return;
      // Prefer a time-looking value over a bare code 'A'/'P' etc. to avoid defaulting to Absent when time exists in second column
      const timeRegexes = [/(\d{1,2}):(\d{2})/,/(\d{3,4})$/,/(\d{1,2})\s*[-/]\s*(\d{1,2})/,/(AM|PM)$/i];
      let chosen = null;
      for(const val of values){
        if(timeRegexes.some(r=> r.test(val))){ chosen = val; break; }
      }
      if(!chosen){
        // If any value is a non 'A' attendance code (e.g. P,L,AL) pick that before 'A'
        const nonA = values.find(v=> /^(P|L|EO|SE|AL|R|HD)$/i.test(v));
        chosen = nonA || values[0];
      }
      daysRaw[g.name] = chosen;
    });

    if(process.env.ATT_DEBUG && rows.length < 5){
      console.log('[ATT DEBUG] Row parsed', { name: String(name).trim(), daysRaw });
    }
    rows.push({ id, name: String(name).trim(),position, daysRaw });
  }
  return { rows, dayCols: dayGroups.map(d=> d.name) };
}

// Interpret a single cell value -> { code, time }
function interpretAttendanceValue(val){
  if(val == null) return { code:'', time:null };
  const raw = String(val).trim();
  if(!raw) return { code:'', time:null };
  const upper = raw.toUpperCase();
  if(ATTENDANCE_CODES.has(upper)) return { code: upper, time:null };
  if(/^25$/.test(upper)) return { code:'AL', time:null };
  if(/^26$/.test(upper)) return { code:'A', time:null };
  if(/^NULL$/i.test(upper)) return { code:'HD', time:null };
  // Excel time fraction (0.xx) or hour number (<24)
  if(!isNaN(Number(raw)) && /^\d+(\.\d+)?$/.test(raw)){
    const num = Number(raw);
    if(num>0 && num<1){
      const mins = Math.round(num*24*60);
      const hh=Math.floor(mins/60), mm=mins%60; const late = mins>420;
      return { code: late?'L':'P', time:`${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}` };
    }
    if(num>=0 && num<24){
      const mins = num*60; const late = mins>420;
      return { code: late?'L':'P', time:`${String(Math.floor(num)).padStart(2,'0')}:00` };
    }
  }
  if(/^(\d{3,4})$/.test(raw)){
    const digits = raw.padStart(4,'0');
    const hh=parseInt(digits.slice(0,2),10), mm=parseInt(digits.slice(2),10);
    if(hh<24 && mm<60){ const mins=hh*60+mm; const late=mins>420; return { code: late?'L':'P', time:`${digits.slice(0,2)}:${digits.slice(2)}` }; }
  }
  if(/^(\d{1,2}):(\d{2}):(\d{2})$/.test(upper)){
    const m3 = upper.match(/^(\d{1,2}):(\d{2}):(\d{2})$/); const hh=parseInt(m3[1],10), mm=parseInt(m3[2],10); if(hh<24 && mm<60){ const mins=hh*60+mm; const late=mins>420; return { code: late?'L':'P', time:`${String(hh).padStart(2,'0')}:${m3[2]}` }; }
  }
  if(/^(\d{1,2})(:?\d{2})?\s?[AP]M$/.test(upper.replace(/\s+/g,''))){
    const norm = upper.replace(/\s+/g,'');
    const mAm = norm.match(/^(\d{1,2})(:?\d{2})?([AP])M$/);
    if(mAm){ let hh=parseInt(mAm[1],10); const mmStr=(mAm[2]||':00').replace(':',''); let mm=parseInt(mmStr,10)||0; if(mAm[3]==='P' && hh<12) hh+=12; if(mAm[3]==='A' && hh===12) hh=0; if(hh<24 && mm<60){ const mins=hh*60+mm; const late=mins>420; return { code: late?'L':'P', time:`${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}` }; } }
  }
  const m = upper.match(/^(\d{1,2}):(\d{2})$/);
  if(m){ const hh=parseInt(m[1],10), mm=parseInt(m[2],10); const mins=hh*60+mm; const late=mins>420; return { code: late?'L':'P', time: raw }; }
  // Shift range formats: HH-HH, HH-HH:, HH- HH, possibly with second time separated by newline or dash
  if(/^(\d{1,2})\s*[-/]\s*(\d{1,2})/.test(upper)){
    const parts = upper.match(/^(\d{1,2})\s*[-/]\s*(\d{1,2})/);
    if(parts){
      const start = parseInt(parts[1],10);
      if(Number.isFinite(start)){
        const mins = start*60; // assume :00
        const late = mins > 420;
        return { code: late ? 'L':'P', time: `${String(start).padStart(2,'0')}:00` };
      }
    }
    return { code:'P', time:null };
  }
  // Cells containing multiple fragments like '08- 16:' may split; strip trailing colons/dashes
  if(/^(\d{1,2})[:\-]$/.test(upper)){
    const start = parseInt(upper,10);
    if(Number.isFinite(start)){
      const late = start*60 > 420;
      return { code: late ? 'L':'P', time:`${String(start).padStart(2,'0')}:00` };
    }
  }
  // Empty marker or placeholder
  if(/^(--|NA|N\/A)$/.test(upper)) return { code:'A', time:null };
  // Textual forms
  if(/^abs/i.test(upper)) return { code:'A', time:null };
  if(/^lat/i.test(upper)) return { code:'L', time:null };
  if(/^pre/i.test(upper)) return { code:'P', time:null };
  if(/^half/i.test(upper)) return { code:'HD', time:null };
  // Fallback -> mark as Absent (explicitly, avoids leaking unknown codes)
  return { code:'A', time:null };
}

function enrichAttendance(parsed){
  const { rows, dayCols } = parsed;
  const enriched = rows.map(r => {
    const days = {};
    const totals = { P:0, A:0, L:0, EO:0, SE:0, AL:0, R:0, HD:0 };
    dayCols.forEach(d => {
      const cell = r.daysRaw[d];
      if(cell == null) return;
      const { code, time } = interpretAttendanceValue(cell);
      if(!code) return;
      days[d] = { code, time };
      if(totals[code] !== undefined) totals[code] += 1;
    });
    const totalCalendarDays = dayCols.length;
    const denom = Math.max(1, totalCalendarDays - totals.AL - totals.SE); // exclude leave & sick
    const numerator = totals.P + totals.L + totals.HD; // count late + half day as presence contribution
    const attendanceRate = (numerator / denom * 100).toFixed(2);
    return { ...r, days, totals, attendanceRate };
  });
  const summary = {
    totalEmployees: enriched.length,
    avgAttendance: enriched.length ? (enriched.reduce((s,e)=> s + Number(e.attendanceRate),0)/enriched.length).toFixed(2) : '0.00',
    totalAbsent: enriched.reduce((s,e)=> s + e.totals.A, 0)
  };
  return { enriched, summary };
}

async function buildAttendanceWorkbook(parsed, aiSummary, opts = {}) {
  const now = new Date();
  const byFilename = opts.sourceFilename ? deriveMonthYearFromFilename(opts.sourceFilename) : null;
  const monthIndex = byFilename?.monthIndex ?? now.getMonth();
  const year = byFilename?.year ?? now.getFullYear();
  const titleText = `ATTENDANCE MONITORING — ${monthName(monthIndex).toUpperCase()} ${year}`;
  const createdStamp = `Created on: ${monthName(now.getMonth())} ${now.getDate()}, ${now.getFullYear()}`;

  // Prepare data (we’ll just render codes like the reference sheet)
  const { enriched } = enrichAttendance(parsed);
  const dayCols = parsed.dayCols || []; // e.g. ["Day 1","Day 2",...]
  const dayLabels = dayCols.map(d => String(d).replace(/^Day\s+/i, '').trim()); // ["1","2",...]

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Attendance');

  // --- Colors (ARGB), fixed palette to avoid “black” cells ---
  const colorMap = {
    P:  'FFDCFCE7', // green
    L:  'FFFDE68A', // yellow
    A:  'FFFCA5A5', // red
    AL: 'FFDDD6FE', // purple
    EO: 'FFE0F2FE', // light blue
    SE: 'FFF5D0FE', // pink-violet
    R:  'FFD1FAE5', // teal/green
    HD: 'FFFAE8B4', // tan
  };

  const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
  const headerFont = { bold: true, color: { argb: 'FFFFFFFF' } };
  const thin = { style: 'thin', color: { argb: 'FF94A3B8' } };
  const border = { top: thin, left: thin, right: thin, bottom: thin };

  // --- Column widths ---
  const firstDayCol = 3;
  const lastDayCol = firstDayCol + dayLabels.length - 1;
  ws.getColumn(1).width = 28; // Name
  ws.getColumn(2).width = 18; // Position
  for (let c = firstDayCol; c <= lastDayCol; c++) ws.getColumn(c).width = 5;

  // Legend immediately after days, with one spacer column
  const legendSwatchCol = lastDayCol + 2;
  const legendLabelCol  = lastDayCol + 3;
  ws.getColumn(legendSwatchCol).width = 4;
  ws.getColumn(legendLabelCol).width = 26;

  // --- Title row (merged above the table) ---
  ws.mergeCells(1, 1, 1, lastDayCol); // merge across Name..last day
  ws.getCell(1, 1).value = titleText;
  ws.getCell(1, 1).font = { bold: true, size: 20 };
  ws.getCell(1, 1).alignment = { vertical: 'middle', horizontal: 'left' };

  // Created on stamp (top-right, above the legend)
  ws.getCell(1, legendLabelCol).value = createdStamp;
  ws.getCell(1, legendLabelCol).alignment = { horizontal: 'left' };

  // --- Header row ---
  const headerRow = ws.getRow(3);
  headerRow.getCell(1).value = 'NAME';
  headerRow.getCell(2).value = 'POSITION';
  headerRow.getCell(1).fill = headerFill;
  headerRow.getCell(2).fill = headerFill;
  headerRow.getCell(1).font = headerFont;
  headerRow.getCell(2).font = headerFont;
  headerRow.getCell(1).alignment = { horizontal: 'center' };
  headerRow.getCell(2).alignment = { horizontal: 'center' };
  headerRow.getCell(1).border = border;
  headerRow.getCell(2).border = border;

  dayLabels.forEach((d, i) => {
    const c = firstDayCol + i;
    const cell = headerRow.getCell(c);
    cell.value = d;                 // numeric: 1..N
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.alignment = { horizontal: 'center' };
    cell.border = border;
  });

  // --- Data rows (codes + color fills) ---
  let rIdx = 4;
  for (const r of enriched) {
    ws.getCell(rIdx, 1).value = r.name || '';
    ws.getCell(rIdx, 2).value = r.position || '';
    ws.getCell(rIdx, 1).border = border;
    ws.getCell(rIdx, 2).border = border;

    dayCols.forEach((dayKey, i) => {
      const c = firstDayCol + i;
      const code = r.days?.[dayKey]?.code || '';   // e.g. "P", "A", "L", ...
      const cell = ws.getCell(rIdx, c);
      cell.value = code;
      cell.alignment = { horizontal: 'center' };
      cell.border = border;
      const argb = colorMap[code];
      if (argb) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
    });

    rIdx++;
  }

  // --- Legend (right after the days) ---
  ws.getCell(3, legendLabelCol).value = 'LEGEND';
  ws.getCell(3, legendLabelCol).font = { bold: true, size: 12 };
  const legendItems = [
    ['A','ABSENT'],
    ['P','PRESENT'],
    ['L','7:01 ONWARDS'],
    ['EO','EARLY OUT'],
    ['SE','SICK OR EMERGENCY LEAVE'],
    ['AL','APPROVED LEAVE'],
    ['R','RESCUE'],
    ['HD','HALFDAY'],
  ];
  legendItems.forEach((pair, idx) => {
    const [code, label] = pair;
    const row = 4 + idx;
    const sw = ws.getCell(row, legendSwatchCol);
    sw.value = code;
    sw.alignment = { horizontal: 'center' };
    sw.border = border;
    const argb = colorMap[code];
    if (argb) sw.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
    ws.getCell(row, legendLabelCol).value = label;
  });

  // Freeze panes at first data row / first day col
  ws.views = [{ state: 'frozen', xSplit: firstDayCol - 1, ySplit: 3 }];

  // (Optional) AI Summary sheet—unchanged if you still want it
  if (aiSummary && typeof aiSummary === 'object') {
    const aiSheet = wb.addWorksheet('AI Summary');
    aiSheet.addRow(['Insights']);
    (aiSummary.insights || []).forEach(i => aiSheet.addRow([i]));
    aiSheet.addRow([]);
    aiSheet.addRow(['Top Absent']);
    (aiSummary.top_absent || []).forEach(t => aiSheet.addRow([`${t.name}: ${t.absent}`]));
    aiSheet.addRow([]);
    aiSheet.addRow(['Average Attendance', aiSummary.average_attendance]);
    aiSheet.getColumn(1).width = 60;
  }

  return wb.xlsx.writeBuffer();
}

// Shared AI summary helper (Gemini) -> structured JSON or null
async function generateAttendanceAiSummary(projectName, enriched, summary){
  if(!GEMINI_API_KEY_ATT) return null;

  const plain = enriched.slice(0,50).map(e => ({ name: e.name, totals: e.totals, rate: e.attendanceRate }));
  const prompt = `You are an attendance analyst. Given JSON of attendance counts per worker and overall summary, produce:
- 3 key insights
- top 3 most absent employees (name & absent days)
- average attendance percentage stated clearly
Return STRICT JSON with keys: insights (string[]), top_absent ({name, absent}[]), average_attendance (number).
Project: ${projectName}
Summary: ${JSON.stringify(summary)}
Rows: ${JSON.stringify(plain)}`;

  const endpoints = [
    'v1beta/models/gemini-1.5-flash-latest:generateContent',
    'v1beta/models/gemini-1.5-pro-latest:generateContent',
    'v1beta/models/gemini-pro:generateContent'
  ];

  for(const ep of endpoints){
    try{
      const { data } = await axios.post(
        `https://generativelanguage.googleapis.com/${ep}?key=${GEMINI_API_KEY_ATT}`,
        { contents:[{ parts:[{ text: prompt }]}]}
      );
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const cleaned = coerceJson(text);            // <-- use your existing coerceJson()
      const parsed = JSON.parse(cleaned);

      // validate shape
      if (Array.isArray(parsed.insights) && Array.isArray(parsed.top_absent)) {
        return parsed;
      }
    } catch(e){
      // try the next endpoint
    }
  }
  return null; // caller will fallback
}


// Handle generic attendance upload
exports.uploadAttendance = async (req,res) => {
  try {
    const { id } = req.params;
    const project = await Project.findById(id);
    if(!project) return res.status(404).json({ message:'Project not found' });
    if(!req.file) return res.status(400).json({ message:'No file uploaded' });
    const buf = req.file.buffer;
    const parsed = parseAttendanceWorkbook(buf);
    const { enriched, summary } = enrichAttendance(parsed);
    const aiSummary = await generateAttendanceAiSummary(project.projectName, enriched, summary);
    const ts = Date.now();
    const inputPath = `attendance/${project._id}/input-${ts}-${req.file.originalname}`;
    const outputPath = `attendance/${project._id}/output-${ts}-${req.file.originalname}`;
    const up1 = await supabase.storage.from('documents').upload(inputPath, buf, { upsert:true, contentType: req.file.mimetype });
   const workbookBuf = await buildAttendanceWorkbook(parsed, aiSummary, {
  sourceFilename: req.file?.originalname,  // <-- lets us render APRIL 2025 if present
});
    const up2 = await supabase.storage.from('documents').upload(outputPath, Buffer.from(workbookBuf), { upsert:true, contentType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    if(up1.error || up2.error) return res.status(500).json({ message:'Failed to store files' });
    project.attendanceReports = project.attendanceReports || [];
  project.attendanceReports.push({ originalName:req.file.originalname, inputPath, outputPath, generatedAt:new Date(), generatedBy:req.user?.id, uploadedByName: req.user?.name, ai: aiSummary });
    await project.save();
    res.json({ message:'Attendance processed', report: project.attendanceReports.at(-1) });
  } catch(err){
    console.error('Attendance upload failed:', err);
    res.status(500).json({ message:'Failed to process attendance' });
  }
};

// Backward-compatible alias for schedule upload (uses same pipeline now)
exports.uploadAttendanceSchedule = exports.uploadAttendance;

exports.listAttendanceReports = async (req,res)=>{
  try {
    const { id } = req.params;
    const project = await Project.findById(id).select('attendanceReports');
    if(!project) return res.status(404).json({ message:'Project not found' });
    res.json({ reports: project.attendanceReports||[] });
  } catch(e){
    res.status(500).json({ message:'Failed to list attendance reports' });
  }
};

// Delete a single attendance report (and both stored files)
exports.deleteAttendanceReport = async (req,res)=>{
  try {
    const { id, reportId } = req.params;
    const project = await Project.findById(id);
    if(!project) return res.status(404).json({ message:'Project not found' });
    project.attendanceReports = project.attendanceReports || [];
    const rep = project.attendanceReports.id(reportId);
    if(!rep) return res.status(404).json({ message:'Attendance report not found' });
    // Basic permission: must be uploader or project manager / area manager (simplistic)
    const userId = String(req.user?._id||req.user?.id||'');
    const isOwner = rep.generatedBy && String(rep.generatedBy)===userId;
    const pm = project.projectmanager && String(project.projectmanager)===userId;
    const am = project.areamanager && String(project.areamanager)===userId;
    if(!isOwner && !pm && !am){
      return res.status(403).json({ message:'Not authorized to delete this attendance report' });
    }
    const toRemove = [];
    if(rep.inputPath) toRemove.push(rep.inputPath);
    if(rep.outputPath) toRemove.push(rep.outputPath);
    if(toRemove.length){
      const { error } = await supabase.storage.from('documents').remove(toRemove);
      if(error) console.warn('Supabase attendance remove error:', error.message);
    }
    rep.deleteOne();
    await project.save();
    res.json({ reports: project.attendanceReports });
  } catch(e){
    console.error('deleteAttendanceReport error:', e);
    res.status(500).json({ message:'Failed to delete attendance report' });
  }
};

exports.getAttendanceSignedUrl = async (req,res)=>{
  try {
    const { path } = req.query;
    if(!path) return res.status(400).json({ message:'Missing path' });
    const { data, error } = await supabase.storage.from('documents').createSignedUrl(path, 60*10);
    if(error||!data?.signedUrl) return res.status(500).json({ message:'Failed to sign url' });
    res.json({ signedUrl: data.signedUrl });
  } catch(e){
    res.status(500).json({ message:'Failed to sign attendance url' });
  }
};

/* ===================== PROJECT PHOTO (primary) ===================== */
exports.uploadProjectPhoto = async (req, res) => {
  try {
    const projectId = req.params.id;
    if (!projectId) return res.status(400).json({ message: 'Missing project id' });
    if (!req.file) return res.status(400).json({ message: 'No photo uploaded' });

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    const file = req.file;
    const filePath = `project-photos/project-${Date.now()}-${file.originalname}`;
    const { error: uploadError } = await supabase.storage
      .from('photos')
      .upload(filePath, file.buffer, { contentType: file.mimetype, upsert: false });
    if (uploadError) {
      console.error('uploadProjectPhoto supabase error:', uploadError);
      return res.status(500).json({ message: 'Failed to store photo' });
    }
    const { data: publicUrlData } = supabase.storage.from('photos').getPublicUrl(filePath);
    const photoUrl = publicUrlData?.publicUrl;
    if (!photoUrl) return res.status(500).json({ message: 'Failed to get public URL' });

    // Put as first photo; keep others
    const existing = Array.isArray(project.photos) ? project.photos : [];
    project.photos = [photoUrl, ...existing.filter(p => p !== photoUrl)].slice(0, 10);
    await project.save();

    return res.json({ message: 'Photo uploaded', photoUrl });
  } catch (err) {
    console.error('uploadProjectPhoto error:', err);
    return res.status(500).json({ message: 'Server error uploading photo' });
  }
};
