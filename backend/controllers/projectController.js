const Project = require('../models/Project');
const { logAction } = require('../utils/auditLogger');
const Manpower = require('../models/Manpower');
const supabase = require('../utils/supabaseClient');
const User = require('../models/User');

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

    // Optional: hydrate docs for consistency when listing all
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
    res.json(project.discussions || []);
  } catch (err) {
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
      attachments: uploadedAttachments
    };

    project.discussions.push(discussion);
    await project.save();

    const io = req.app.get('io');
    if (io) {
      const added = project.discussions[project.discussions.length - 1];
      io.to(`project:${projectId}`).emit('project:newDiscussion', {
        projectId,
        message: added
      });
    }
    res.json(project.discussions[project.discussions.length - 1]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to post discussion' });
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

    discussion.replies.push(reply);
    await project.save();

    const io = req.app.get('io');
    if (io) {
      const addedReply = discussion.replies[discussion.replies.length - 1];
      io.to(`project:${projectId}`).emit('project:newReply', {
        projectId,
        msgId,
        reply: addedReply
      });
    }
    res.json(discussion.replies[discussion.replies.length - 1]);
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
