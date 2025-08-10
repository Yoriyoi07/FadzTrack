const Project = require('../models/Project');
const { logAction } = require('../utils/auditLogger');
const Manpower = require('../models/Manpower');
const supabase = require('../utils/supabaseClient');
const User = require('../models/User');

/* -------------------- mention helpers -------------------- */
const slugUser = (s = '') => s.toString().trim().toLowerCase().replace(/\s+/g, '');
const extractMentions = (text = '') => {
  // @john, @john_doe, @john-doe, @john.doe, @all
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

    // --- Handle photo uploads (public bucket) ---
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

    // --- Handle document uploads (private bucket) ---
    if (req.files && req.files.documents) {
      for (let file of req.files.documents) {
        const filePath = `project-documents/project-${Date.now()}-${file.originalname}`;
        const { data, error } = await supabase.storage
          .from('documents')
          .upload(filePath, file.buffer, { contentType: file.mimetype, upsert: true });
        if (!error && data) documentsUrls.push(filePath);
      }
    }

    // --- Save project ---
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

    // --- Logging ---
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

    // --- Assign project to manpower ---
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
      .populate('manpower', 'name position');
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
      .populate('manpower', 'name position');
    if (!project) return res.status(404).json({ message: 'Project not found' });
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
      .populate('manpower', 'name position');
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
      .lean();
    res.json(projects);
  } catch (error) {
    console.error('Error fetching assigned projects:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
/* --- GET UNASSIGNED USERS (per role, for dropdowns) --- */
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
      .populate('areamanager', 'name email');
    if (!project) return res.status(404).json({ message: 'No project assigned as Project Manager' });
    res.json(project);
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/* --- GET USERS BY ROLE (for dropdowns etc.) --- */
exports.getUsersByRole = async (req, res) => {
  try {
    const role = req.params.role;
    const users = await User.find({ role }, 'name');
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch users' });
  }
};

/* --- UPDATE ONLY TASKS OF A PROJECT --- */
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
      .populate('manpower', 'name position');
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

exports.addProjectDiscussion = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'Message text required' });

    const projectId = req.params.id;
    const project = await Project.findById(projectId)
      .populate('pic', 'name')
      .populate('staff', 'name')
      .populate('hrsite', 'name')
      .populate('projectmanager', 'name')
      .populate('areamanager', 'name');

    if (!project) return res.status(404).json({ error: 'Project not found' });

    const discussion = {
      user: req.user.id,
      userName: req.user.name,
      text,
      timestamp: new Date(),
      replies: []
    };

    project.discussions.push(discussion);
    await project.save();

    // mentions
    const tags = extractMentions(text);                 // ['john', 'all', ...]
    const members = collectProjectMembers(project);     // [{_id, name, slug}, ...]
    let notifyUserIds = [];

    if (tags.includes('all')) {
      notifyUserIds = members.map(m => m._id);
    } else if (tags.length) {
      const tagSet = new Set(tags);
      notifyUserIds = members
        .filter(m => tagSet.has(m.slug))
        .map(m => m._id);
    }
    notifyUserIds = [...new Set(notifyUserIds)].filter(id => id !== req.user.id);

    // Emit to project room + per-user rooms
    const io = req.app.get('io');
    if (io) {
      const added = project.discussions[project.discussions.length - 1];

      io.to(`project:${projectId}`).emit('project:newDiscussion', {
        projectId,
        message: {
          _id: added._id,
          user: added.user,
          userName: added.userName,
          text: added.text,
          timestamp: added.timestamp,
          replies: added.replies || []
        }
      });

      for (const uid of notifyUserIds) {
        io.to(`user:${uid}`).emit('mentionNotification', {
          fromUserId: req.user.id,
          fromUserName: req.user.name,
          projectId,
          message: text,
          type: 'discussion',
        });
      }
    }

    res.json(project.discussions[project.discussions.length - 1]);
  } catch (err) {
    console.error('Failed to post discussion', err);
    res.status(500).json({ error: 'Failed to post discussion' });
  }
};

exports.replyToProjectDiscussion = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'Reply text required' });

    const projectId = req.params.id;
    const msgId = req.params.msgId;

    const project = await Project.findById(projectId)
      .populate('pic', 'name')
      .populate('staff', 'name')
      .populate('hrsite', 'name')
      .populate('projectmanager', 'name')
      .populate('areamanager', 'name');

    if (!project) return res.status(404).json({ error: 'Project not found' });

    const discussion = project.discussions.id(msgId);
    if (!discussion) return res.status(404).json({ error: 'Discussion not found' });

    const reply = {
      user: req.user.id,
      userName: req.user.name,
      text,
      timestamp: new Date()
    };

    discussion.replies.push(reply);
    await project.save();

    const addedReply = discussion.replies[discussion.replies.length - 1];

    const io = req.app.get('io');
    if (io) {
      io.to(`project:${projectId}`).emit('project:newReply', {
        projectId,
        msgId,
        reply: {
          _id: addedReply._id,
          user: addedReply.user,
          userName: addedReply.userName,
          text: addedReply.text,
          timestamp: addedReply.timestamp
        }
      });

      // mentions for replies
      const tags = extractMentions(text);
      const members = collectProjectMembers(project);
      let notifyUserIds = [];

      if (tags.includes('all')) {
        notifyUserIds = members.map(m => m._id);
      } else if (tags.length) {
        const tagSet = new Set(tags);
        notifyUserIds = members
          .filter(m => tagSet.has(m.slug))
          .map(m => m._id);
      }
      notifyUserIds = [...new Set(notifyUserIds)].filter(id => id !== req.user.id);

      for (const uid of notifyUserIds) {
        io.to(`user:${uid}`).emit('mentionNotification', {
          fromUserId: req.user.id,
          fromUserName: req.user.name,
          projectId,
          message: text,
          type: 'reply',
          discussionId: msgId,
        });
      }
    }

    res.json(addedReply);
  } catch (err) {
    console.error('Failed to post reply', err);
    res.status(500).json({ error: 'Failed to post reply' });
  }
};
