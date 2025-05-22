const express = require('express');
const router = express.Router();
const Project = require('../models/Project'); 

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


router.get('/role/:role', async (req, res) => {
  try {
    const role = req.params.role;
    const users = await User.find({ role }, 'name'); // or 'email' or 'username'
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch users' });
  }
});


router.post('/', async (req, res) => {
   console.log('📥 Received POST /api/projects');
  console.log('📝 Request body:', req.body);

  try {
    const {
      projectName,
      pic,
      projectmanager,
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


router.get('/', async (req, res) => {
  try {
    const projects = await Project.find();

    const formattedProjects = projects.map(p => ({
      id: p._id,
      name: p.projectName,
      location: p.location,
      budget: `₱${p.budget?.toLocaleString()}`,
      projectManager: p.pic,
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





module.exports = router;
