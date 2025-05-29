const express = require('express');
const router = express.Router();
const Project = require('../models/Project'); 
const User = require('../models/User'); 

// Get all projects assigned to a user as PIC
router.get('/assigned/:userId', async (req, res) => {
  const userId = req.params.userId;
  try {
    const projects = await Project.find({ pic: userId })
      .populate('projectmanager', 'name email')
      .populate('pic', 'name email');
    res.json(projects);
  } catch (error) {
    console.error('Error fetching assigned projects:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all projects assigned to a user in ANY role
router.get('/assigned/allroles/:userId', async (req, res) => {
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
});

// Get project assigned to a user as Project Manager
router.get('/assigned/projectmanager/:userId', async (req, res) => {
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
});

// Get users by role (for dropdowns etc.)
router.get('/role/:role', async (req, res) => {
  try {
    const role = req.params.role;
    const users = await User.find({ role }, 'name'); 
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch users' });
  }
});

// --- Project CRUD routes ---

// Create new project
router.post('/', async (req, res) => {
  console.log('📥 Received POST /api/projects');
  console.log('📝 Request body:', req.body);

  try {
    const {
      projectName,
      pic,
      projectmanager,
      areamanager,    
      contractor,
      budget,
      location,
      manpower,
      startDate,
      endDate,
    } = req.body;

    const newProject = new Project({
      projectName,
      pic,
      projectmanager,
      areamanager,  
      contractor,
      budget,
      location,
      manpower,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    });

    const savedProject = await newProject.save();
    res.status(201).json(savedProject);
  } catch (err) {
    console.error('❌ Error saving project:', err);
    res.status(500).json({ message: 'Failed to save project' });
  }
});

// Get ALL projects
router.get('/', async (req, res) => {
  try {
    const projects = await Project.find()
      .populate('projectmanager', 'name email') 
      .populate('pic', 'name email')
      .populate('location', 'name region')
      .populate('manpower', 'name position');

    const formattedProjects = projects.map(p => ({
      id: p._id,
      name: p.projectName,
      location: p.location,
      budget: `₱${p.budget?.toLocaleString()}`,
      projectManager: p.projectmanager, 
      contractor: p.contractor,
      manpower: p.manpower,
      targetDate: `${new Date(p.startDate).toLocaleDateString()} - ${new Date(p.endDate).toLocaleDateString()}`,
      image: 'https://via.placeholder.com/300',
      status: p.status || 'ongoing'
    }));

    res.status(200).json(formattedProjects);
  } catch (err) {
    console.error('Error fetching projects:', err);
    res.status(500).json({ message: 'Failed to fetch projects' });
  }
});

// --- This CATCH-ALL dynamic route goes LAST! ---
// Get one project by ID
router.get('/:id', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('projectmanager', 'name email')
      .populate('pic', 'name email')
      .populate('location', 'name region')
      .populate('manpower', 'name position');

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const formattedProject = {
      id: project._id,
      name: project.projectName,
      location: project.location,
      budget: `₱${project.budget?.toLocaleString()}`,
      projectManager: project.projectmanager,
      contractor: project.contractor,
      pic: project.pic,
      manpower: project.manpower,
      targetDate: `${new Date(project.startDate).toLocaleDateString()} - ${new Date(project.endDate).toLocaleDateString()}`,
      image: 'https://via.placeholder.com/300',
      status: project.status || 'ongoing',
    };

    res.status(200).json(formattedProject);
  } catch (err) {
    console.error('Error fetching project:', err);
    res.status(500).json({ message: 'Failed to fetch project' });
  }
});

module.exports = router;
