const Project = require('../models/Project');

exports.addProject = async (req, res) => {
  try {
    const {
      projectName,
      designStyle,
      contractor,
      architectDesigner,
      location,
      duration,
      manpower,
    } = req.body;

    const newProject = new Project({
      projectName,
      designStyle,
      contractor,
      architectDesigner,
      location,
      duration,
      manpower,
    });

    await newProject.save();
    res.status(201).json({ message: 'Project added successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add project', details: err });
  }
};
