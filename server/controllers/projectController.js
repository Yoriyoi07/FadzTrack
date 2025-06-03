const Project = require('../models/Project');
const { logAction } = require('../utils/auditLogger');

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

    const photos = req.files ? req.files.map(file => '/uploads/' + file.filename) : [];

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
      photos
    });

    const savedProject = await newProject.save();

    // Debug log
    console.log("REQ.USER in addProject:", req.user);

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

// TOGGLE PROJECT STATUS
exports.toggleProjectStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const project = await Project.findById(id);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    project.status = project.status === 'Ongoing' ? 'Completed' : 'Ongoing';
    await project.save();
    res.json({ status: project.status });
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle project status' });
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