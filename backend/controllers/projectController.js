const Project = require('../models/Project');
const { logAction } = require('../utils/auditLogger');
const Manpower = require('../models/Manpower'); 
const supabase = require('../utils/supabaseClient');
const getPhotoPath = require('../utils/photoPath');

// CREATE PROJECT
exports.addProject = async (req, res) => {
  try {
    const {
      projectName,
      pic,
      projectmanager, 
      contractor,
      budget,
      location,
      startDate, 
      endDate,   
      manpower,
      areamanager
    } = req.body;

    let photos = [];
    let documentsUrls = [];
    // Handle photo uploads (public bucket)
if (req.files && req.files.photos && req.files.photos.length > 0) {
  for (let file of req.files.photos) {
    const filePath = `project-photos/project-${Date.now()}-${file.originalname}`;
    const { data, error } = await supabase.storage
      .from('photos') // <-- your public photo bucket!
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });
    if (!error && data) {
      // Get public URL for the photo
      const { data: publicUrlData } = supabase.storage
        .from('photos')
        .getPublicUrl(filePath);
      if (publicUrlData && publicUrlData.publicUrl) {
        photos.push(publicUrlData.publicUrl);
      }
    }
  }
}


 // Handle document uploads (private bucket)
    if (req.files && req.files.documents && req.files.documents.length > 0) {
      for (let file of req.files.documents) {
        const filePath = `project-documents/project-${Date.now()}-${file.originalname}`;
        const { data, error } = await supabase.storage
          .from('documents')
          .upload(filePath, file.buffer, {
            contentType: file.mimetype,
            upsert: true,
          });
        if (!error && data) {
          // For private bucket, store only path, not public URL
          documentsUrls.push(filePath);
        }
      }
    }



    // Create the new project
    const newProject = new Project({
      projectName,
      pic,
      projectmanager, 
      contractor,
      budget,
      location,
      startDate: new Date(startDate), 
      endDate: new Date(endDate),   
      manpower,
      areamanager,
      photos,
      documents: documentsUrls, // Store document paths
    });

    // Save project
    const savedProject = await newProject.save();

    // Normal log
    await logAction({
      action: 'ADD_PROJECT',
      performedBy: req.user.id, 
      performedByRole: req.user.role,
      description: `Added new project ${projectName}`,
      meta: { projectId: savedProject._id }
    });

    // CEO-specific log
    if (req.user.role === 'CEO') {
      await logAction({
        action: 'CEO_ADD_PROJECT',
        performedBy: req.user.id,
        performedByRole: req.user.role,
        description: `CEO added new project ${projectName}`,
        meta: { projectId: savedProject._id }
      });
    }
    
    // Update assignedProject for each manpower
    await Manpower.updateMany(
      { _id: { $in: manpower } },
      { $set: { assignedProject: savedProject._id } }
    );

    // Return the saved project
    res.status(201).json(savedProject);
  } catch (err) {
    console.error('❌ Error adding project:', err);
    res.status(500).json({ error: 'Failed to add project', details: err.message });
  }
};

// UPDATE PROJECT
exports.updateProject = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };
    const updatedProject = await Project.findByIdAndUpdate(id, updates, { new: true });
    if (!updatedProject) {
      return res.status(404).json({ message: 'Project not found' });
    }

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

// DELETE PROJECT
exports.deleteProject = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedProject = await Project.findByIdAndDelete(id);
    if (!deletedProject) {
      return res.status(404).json({ message: 'Project not found' });
    }

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

// GET ALL PROJECTS
exports.getAllProjects = async (req, res) => {
  try {
    const projects = await Project.find()
      .populate('projectmanager', 'name email') 
      .populate('pic', 'name email')
      .populate('areamanager', 'name email')
      .populate('location', 'name region')
      .populate('manpower', 'name position');
    res.status(200).json(projects);
  } catch (err) {
    console.error('❌ Error fetching projects:', err);
    res.status(500).json({ message: 'Failed to fetch projects' });
  }
};

// GET PROJECT BY ID
exports.getProjectById = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('projectmanager', 'name email')
      .populate('pic', 'name email')
      .populate('areamanager', 'name email')
      .populate('location', 'name region')
      .populate('manpower', 'name position');
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    res.status(200).json(project);
  } catch (err) {
    console.error('❌ Error fetching project:', err);
    res.status(500).json({ message: 'Failed to fetch project' });
  }
};

// GET PROJECTS ASSIGNED TO USER AS PIC
exports.getAssignedProjectsPIC = async (req, res) => {
  const userId = req.params.userId;
  try {
    const projects = await Project.find({ pic: userId })
      .populate('projectmanager', 'name email')
      .populate('pic', 'name email')
      .populate('location', 'name region')
      .populate('manpower', 'name position');
    res.json(projects);
  } catch (error) {
    console.error('Error fetching assigned projects:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET PROJECTS ASSIGNED TO USER (ANY ROLE)
exports.getAssignedProjectsAllRoles = async (req, res) => {
  const userId = req.params.userId;
  try {
    const projects = await Project.find({
      $or: [
        { pic: userId },
        { projectmanager: userId },
        { areamanager: userId }
      ]
    })
      .populate('projectmanager', 'name email')
      .populate('pic', 'name email')
      .populate('areamanager', 'name email');
    res.json(projects);
  } catch (error) {
    console.error('Error fetching assigned projects:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET PROJECT WHERE USER IS PROJECT MANAGER
exports.getAssignedProjectManager = async (req, res) => {
  const userId = req.params.userId;
  try {
    const project = await Project.findOne({ projectmanager: userId })
      .populate('projectmanager', 'name email')
      .populate('pic', 'name email')
      .populate('areamanager', 'name email');
    if (!project) {
      return res.status(404).json({ message: 'No project assigned as Project Manager' });
    }
    res.json(project);
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET USERS BY ROLE (for dropdowns etc.)
exports.getUsersByRole = async (req, res) => {
  const User = require('../models/User');
  try {
    const role = req.params.role;
    const users = await User.find({ role }, 'name');
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch users' });
  }
};


// UPDATE ONLY TASKS OF A PROJECT
exports.updateProjectTasks = async (req, res) => {
  try {
    const { id } = req.params;
    const { tasks } = req.body;
    if (!Array.isArray(tasks)) {
      return res.status(400).json({ message: 'Tasks must be an array' });
    }
    const project = await Project.findByIdAndUpdate(
      id,
      { tasks },
      { new: true }
    )
    .populate('projectmanager', 'name email')
    .populate('pic', 'name email')
    .populate('areamanager', 'name email')
    .populate('location', 'name region')
    .populate('manpower', 'name position');
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

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

// TOGGLE PROJECT STATUS (mark as completed or ongoing)
exports.toggleProjectStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const project = await Project.findById(id);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    // Toggle logic
    if (project.status !== 'Completed') {
      project.status = 'Completed';
      await project.save();
    } else {
      project.status = 'Ongoing';
      await project.save();
    }

    res.json({ status: project.status });
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle project status', details: err.message });
  }
};


// GET PROJECT WHERE USER IS PROJECT MANAGER
exports.getAssignedProjectManager = async (req, res) => {
  const userId = req.params.userId;
  try {
    const project = await Project.findOne({ projectmanager: userId })
      .populate('projectmanager', 'name email')
      .populate('pic', 'name email')
      .populate('areamanager', 'name email');
    if (!project) {
      return res.status(404).json({ message: 'No project assigned as Project Manager' });
    }
    res.json(project);
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get projects for user by status
exports.getProjectsByUserAndStatus = async (req, res) => {
  const { userId, role, status } = req.query; // expects /projects/by-user-status?userId=...&role=...&status=...
  if (!userId || !role || !status) {
    return res.status(400).json({ message: 'Missing params' });
  }
  const query = {};
  query[role] = userId;
  query.status = status;
  try {
    const projects = await Project.find(query)
      .populate('projectmanager', 'name email')
      .populate('pic', 'name email')
      .populate('areamanager', 'name email')
      .populate('location', 'name region')
      .populate('manpower', 'name position');
    res.json(projects);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch projects' });
  }
};

// --- DISCUSSIONS --- //

// Get all discussions for a project
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

// Add a new discussion message to a project
exports.addProjectDiscussion = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'Message text required' });
    const project = await Project.findById(req.params.id);
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

    // Get the added discussion (last in array)
    const added = project.discussions[project.discussions.length - 1];

    res.json(added);
  } catch (err) {
    res.status(500).json({ error: 'Failed to post discussion' });
  }
};

// Add a reply to a discussion message in a project
exports.replyToProjectDiscussion = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'Reply text required' });

    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const discussion = project.discussions.id(req.params.msgId);
    if (!discussion) return res.status(404).json({ error: 'Discussion not found' });

    const reply = {
      user: req.user.id,
      userName: req.user.name,
      text,
      timestamp: new Date()
    };

    discussion.replies.push(reply);
    await project.save();

    // Get the added reply (last in array)
    const added = discussion.replies[discussion.replies.length - 1];

    res.json(added);
  } catch (err) {
    res.status(500).json({ error: 'Failed to post reply' });
  }
};
