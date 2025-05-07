const express = require('express');
const router = express.Router();
const Project = require('../models/Project'); 

router.post('/', async (req, res) => {
  try {
    const newProject = new Project(req.body);
    const savedProject = await newProject.save();
    res.status(201).json(savedProject);
  } catch (err) {
    console.error('❌ Error saving project:', err);
    res.status(500).json({ message: 'Failed to save project' });
  }
});

module.exports = router;
