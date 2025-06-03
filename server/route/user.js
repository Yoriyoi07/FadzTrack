const express = require('express');
const router = express.Router();
const User = require('../models/User'); 
const Project = require('../models/Project');
const Location = require('../models/Location');

// Fetch users by role
router.get('/role/:role', async (req, res) => {
  try {
    const role = req.params.role;
    const users = await User.find({ role }, 'name');
    res.json(users);
  } catch (err) {
    console.error('Error fetching users by role:', err);
    res.status(500).json({ message: 'Failed to fetch users' });
  }
});

router.get('/:userId/locations', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).populate('locations');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user.locations);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch locations' });
  }
});

router.put('/:userId/locations', async (req, res) => {
  try {
    const { locations } = req.body; // array of location ObjectIds 
    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { locations },
      { new: true }
    ).populate('locations');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user.locations);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update locations' });
  }
});

router.get('/assigned/:userId', async (req, res) => {
  const userId = req.params.userId;

  try {
    // Step 1: Find the user to check role
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    let project;

    // Step 2: If role is PIC, return only one project where user is the PIC
    if (user.role === 'PIC') {
      project = await Project.findOne({ pic: userId });
      if (!project) return res.status(404).json({ message: 'No project assigned to this PIC' });
      return res.json([project]); // return as array to keep frontend consistent
    }

    // Step 3: Otherwise, return all assigned projects (e.g. for project managers)
    const projects = await Project.find({
      $or: [
        { projectmanager: userId },
        { pic: userId }
      ]
    });

    res.json(projects);
  } catch (error) {
    console.error('Error fetching assigned projects:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/:userId/locations', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Assuming assignedLocations is an array of ObjectIds or strings
    const locations = await Location.find({ _id: { $in: user.assignedLocations || [] } });
    res.json(locations);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch assigned locations' });
  }
});

// GET all PICs who are NOT assigned to any project
router.get('/pics-available', async (req, res) => {
  try {
    // 1. Get all users with role "Person in Charge" or "PIC" (check your data)
    // If your DB uses "Person in Charge" use that, otherwise use "PIC"
    const allPICs = await User.find({ role: { $in: ["Person in Charge", "PIC"] } }, 'name _id');

    // 2. Get all assigned PIC IDs from all projects
    const projects = await Project.find({}, 'pic');
    const assignedPicIds = new Set();
    projects.forEach(proj => {
      if (Array.isArray(proj.pic)) {
        proj.pic.forEach(picId => assignedPicIds.add(picId.toString()));
      }
    });

    // 3. Filter only those PICs not assigned in any project
    const availablePICs = allPICs.filter(pic => !assignedPicIds.has(pic._id.toString()));

    res.json(availablePICs);
  } catch (err) {
    console.error("Error fetching available PICs:", err);
    res.status(500).json({ message: 'Failed to fetch available PICs' });
  }
});


module.exports = router;
