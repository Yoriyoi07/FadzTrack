const express = require('express');
const router = express.Router();
const User = require('../models/User'); // make sure this path is correct

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

module.exports = router;
