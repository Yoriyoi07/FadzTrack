// controllers/projectController.js
const Project = require('../models/Project');
const { logAction } = require('../utils/auditLogger');
const Manpower = require('../models/Manpower');
const supabase = require('../utils/supabaseClient');
const User = require('../models/User');
const Notification = require('../models/Notification');
const PDFDocument = require('pdfkit');
const { Server } = require("socket.io");


// NEW: AI deps
const axios = require('axios');
const { extractPptText } = require('../utils/pptExtract');
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

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
      margins: { top: 60, left: 50, right: 50, bottom: 90 }, // reserve 90px for footer
      bufferPages: true,                                      // let us add footer after body
    });

    const chunks = [];
    doc.on('data', d => chunks.push(d));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    /* ---------- helpers ---------- */
    const drawHeader = () => {
      // logo (optional)
      if (logoBuffer) {
        try { doc.image(logoBuffer, doc.page.width - 110, 18, { width: 60 }); } catch {}
      }
      doc
        .font('Helvetica-Bold').fontSize(20).text('AI Analysis Summary', { align: 'left' })
        .moveDown(0.3)
        .font('Helvetica').fontSize(12);

      if (meta.projectName)    doc.text(`Project: ${meta.projectName}`);
      if (meta.projectLocation)doc.text(`Location: ${meta.projectLocation}`);
      if (meta.filename)       doc.text(`Source: ${meta.filename}`);
      doc.text(`Generated: ${new Date().toLocaleString()}`);
      doc.moveDown(0.6);
      doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).stroke();
      doc.moveDown(0.6);
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
      startDate, endDate, manpower, areamanager
    } = req.body;

    let photos = [];
    let documentsUrls = [];

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

    // private docs (store as objects w/ metadata)
    if (req.files && req.files.documents) {
      for (let file of req.files.documents) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const safeName = (file.originalname || 'file').trim();
        const filePath = `project-documents/project-${Date.now()}/${timestamp}_${safeName}`;

        const { data, error } = await supabase.storage
          .from('documents')
          .upload(filePath, file.buffer, { contentType: file.mimetype, upsert: true });

        if (!error && data) {
          documentsUrls.push({
            path: filePath,
            name: safeName,
            uploadedBy: String(req.user?.id || req.user?._id || ''),
            uploadedByName: req.user?.name || '',
            uploadedAt: new Date()
          });
        }
      }
    }

    const newProject = new Project({
      projectName,
      pic, staff, hrsite,
      projectmanager, contractor, budget, location,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      manpower, areamanager, photos,
      documents: documentsUrls
    });
    const savedProject = await newProject.save();

    await logAction({
      action: 'ADD_PROJECT',
      performedBy: req.user.id,
      performedByRole: req.user.role,
      description: `Added new project ${projectName}`,
      meta: { projectId: savedProject._id }
    });
    if (req.user.role === 'CEO') {
      await logAction({
        action: 'CEO_ADD_PROJECT',
        performedBy: req.user.id,
        performedByRole: req.user.role,
        description: `CEO added new project ${projectName}`,
        meta: { projectId: savedProject._id }
      });
    }

    await Manpower.updateMany(
      { _id: { $in: manpower } },
      { $set: { assignedProject: savedProject._id } }
    );

    res.status(201).json(savedProject);
  } catch (err) {
    console.error('❌ Error adding project:', err);
    res.status(500).json({ error: 'Failed to add project', details: err.message });
  }
};

/* --- UPDATE PROJECT --- */
exports.updateProject = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };
    const updatedProject = await Project.findByIdAndUpdate(id, updates, { new: true });
    if (!updatedProject) return res.status(404).json({ message: 'Project not found' });

    await logAction({
      action: 'UPDATE_PROJECT',
      performedBy: req.user.id,
      performedByRole: req.user.role,
      description: `Updated project ${updatedProject.projectName}`,
      meta: { projectId: updatedProject._id }
    });
    if (req.user.role === 'CEO') {
      await logAction({
        action: 'CEO_UPDATE_PROJECT',
        performedBy: req.user.id,
        performedByRole: req.user.role,
        description: `CEO updated project ${updatedProject.projectName}`,
        meta: { projectId: updatedProject._id }
      });
    }
    res.status(200).json(updatedProject);
  } catch (err) {
    console.error('❌ Error updating project:', err);
    res.status(500).json({ message: 'Failed to update project' });
  }
};

/* --- DELETE PROJECT --- */
exports.deleteProject = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedProject = await Project.findByIdAndDelete(id);
    if (!deletedProject) return res.status(404).json({ message: 'Project not found' });

    await logAction({
      action: 'DELETE_PROJECT',
      performedBy: req.user.id,
      performedByRole: req.user.role,
      description: `Deleted project ${deletedProject.projectName}`,
      meta: { projectId: deletedProject._id }
    });
    if (req.user.role === 'CEO') {
      await logAction({
        action: 'CEO_DELETE_PROJECT',
        performedBy: req.user.id,
        performedByRole: req.user.role,
        description: `CEO deleted project ${deletedProject.projectName}`,
        meta: { projectId: deletedProject._id }
      });
    }
    res.status(200).json({ message: 'Project deleted successfully' });
  } catch (err) {
    console.error('❌ Error deleting project:', err);
    res.status(500).json({ message: 'Failed to delete project' });
  }
};

/* --- GET ALL PROJECTS --- */
exports.getAllProjects = async (req, res) => {
  try {
    const projects = await Project.find()
      .populate('projectmanager', 'name email')
      .populate('pic', 'name email')
      .populate('staff', 'name email')
      .populate('hrsite', 'name email')
      .populate('areamanager', 'name email')
      .populate('location', 'name region')
      .populate('manpower', 'name position')
      .populate('contractor', 'name company companyName displayName');

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
    const projects = await Project.find({ pic: userId })
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
      status: 'Ongoing'
    })
      .select('projectName photos budget startDate endDate status location pic projectmanager manpower documents')
      .populate('projectmanager', 'name')
      .populate('pic', 'name')
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
    const candidates = await User.find({ role: 'Person in Charge' }, 'name role');
    const projects = await Project.find({}, 'pic');
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
    const projects = await Project.find({}, 'staff');
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
    const projects = await Project.find({}, 'hrsite');
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
    const project = await Project.findOne({ projectmanager: userId })
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

    project.status = (project.status !== 'Completed') ? 'Completed' : 'Ongoing';
    await project.save();

    res.json({ status: project.status });
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle project status', details: err.message });
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
    
    console.log('🔍 Fetching discussions for project:', req.params.id);
    console.log('🔍 Number of discussions:', project.discussions?.length || 0);
    console.log('🔍 First discussion sample:', project.discussions?.[0]);
    console.log('🔍 All discussions with labels:');
    project.discussions?.forEach((disc, index) => {
      console.log(`🔍 Discussion ${index}:`, {
        _id: disc._id,
        text: disc.text?.substring(0, 50) + '...',
        label: disc.label,
        labelType: typeof disc.label,
        hasLabel: !!disc.label
      });
    });
    
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
    console.log('🔍 Backend received label:', label);
    console.log('🔍 Backend received body:', req.body);
    const projectId = req.params.id;
    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const incoming = Array.isArray(req.files) ? req.files : [];
    const uploadedAttachments = await uploadDiscussionFiles(projectId, incoming);
    if (!text && uploadedAttachments.length === 0) {
      return res.status(400).json({ error: 'Provide text or at least one attachment' });
    }

    const discussion = {
      user: req.user.id,
      userName: req.user.name,
      text,
      timestamp: new Date(),
      replies: [],
      attachments: uploadedAttachments,
      label
    };
    console.log('🔍 Discussion object being saved:', discussion);

    // 1) Persist the message (this is the critical operation)
    project.discussions.push(discussion);
    console.log('💾 About to save project with discussion');
    await project.save();
    console.log('✅ Project saved successfully');

    // Get the added discussion for response
    const responseData = project.discussions[project.discussions.length - 1];
    const io = req.app.get('io');  // <-- Get io from the app
if (io) {
  io.to(`project:${projectId}`).emit('project:newDiscussion', responseData);
} 
    console.log('📤 Backend sending response:', responseData);
    console.log('📤 Response label:', responseData.label);
    console.log('📤 Response label type:', typeof responseData.label);
    
    // 2) Send the HTTP response now (this is the success contract)
    res.status(201).json(responseData);

    // 3) Fire-and-forget side effects; don't let errors crash the route
    process.nextTick(async () => {
      try {
        console.log('🔄 Starting side effects...');
        
        // TEMPORARILY DISABLED: All side effects for debugging
        console.log('📢 All side effects temporarily disabled for debugging');
        console.log('📡 Socket.IO disabled');
        console.log('📢 Notifications disabled');
        
      } catch (sideEffectError) {
        console.error('❌ Error in side effects (non-critical):', sideEffectError);
      }
    });
  } catch (err) {
    console.error('❌ Error in addProjectDiscussion:', err);
    console.error('❌ Error stack:', err.stack);
    console.error('❌ Error name:', err.name);
    console.error('❌ Error message:', err.message);
    console.error('❌ Error code:', err.code);
    
    // Check if this is a validation error
    if (err.name === 'ValidationError') {
      console.error('❌ Validation error details:', err.errors);
    }
    
    // Check if this is a MongoDB error
    if (err.code) {
      console.error('❌ MongoDB error code:', err.code);
    }
    
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

    // 1) Persist the reply (this is the critical operation)
    discussion.replies.push(reply);
    await project.save();

    // Get the added reply for response
const responseReply = discussion.replies[discussion.replies.length - 1];
const io = req.app.get('io');
if (io) {
  io.to(`project:${projectId}`).emit('project:newReply', responseReply);
}
// 2) Send the HTTP response now (this is the success contract)
res.status(201).json(responseReply);

    // 3) Fire-and-forget side effects; don't let errors crash the route
    process.nextTick(async () => {
      try {
        console.log('🔄 Starting reply side effects...');
        
        // TEMPORARILY DISABLED: All side effects for debugging
        console.log('📢 All reply side effects temporarily disabled for debugging');
        console.log('📡 Socket.IO disabled');
        console.log('📢 Reply notifications disabled');
        
      } catch (sideEffectError) {
        console.error('❌ Error in reply side effects (non-critical):', sideEffectError);
      }
    });
  } catch (err) {
    console.error(err);
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
      return res.status(403).json({ message: 'Not allowed to upload documents for this project' });
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
      meta: { projectId: project._id, added: addedDocs.length, renamed, replaced }
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

    if (!userCanUploadToProject(project, req.user)) {
      return res.status(403).json({ message: 'Not allowed to delete documents for this project' });
    }

    const relative = path.replace(/^.*?project-documents\//, 'project-documents/');
    const { error } = await supabase.storage.from('documents').remove([relative]);
    if (error) console.error('Supabase remove error:', error);

    project.documents = (project.documents || []).filter(d => extractPathFromDoc(d) !== path);
    await project.save();

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
    pic_performance_evaluation: ai?.pic_performance_evaluation || { text: '', score: null },
    pic_contribution_percent: Number.isFinite(ai?.pic_contribution_percent) ? ai.pic_contribution_percent : 0,
    confidence: Number.isFinite(ai?.confidence) ? ai.confidence : 0.6,
  };

  const WANT = ['optimistic', 'realistic', 'pessimistic'];
  const byType = new Map(
    out.critical_path_analysis.map(c => [String(c?.path_type || '').toLowerCase(), c])
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
  console.log('🎯 getProjectUsers endpoint called!');
  console.log('🎯 Request params:', req.params);
  console.log('🎯 Request headers:', req.headers);
  
  try {
    const { id } = req.params;
    console.log('🔍 getProjectUsers called for project ID:', id);
    
    const project = await Project.findById(id);
    if (!project) {
      console.log('❌ Project not found:', id);
      return res.status(404).json({ message: 'Project not found' });
    }

    console.log('📋 Project found:', project.projectName);
    console.log('👥 Project manager:', project.projectmanager);
    console.log('👥 PIC:', project.pic);
    console.log('👥 Staff:', project.staff);
    console.log('👥 HR Site:', project.hrsite);
    console.log('👥 Area Manager:', project.areamanager);

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

    console.log('✅ Found project users:', projectUsers);
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
      const pdfBuf = await buildReportPdfBuffer(aiJson, {
        title: 'AI Analysis Summary',
        projectName: project.projectName,
        filename: originalName
      });
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
