const Project = require('../models/Project');

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

    const newProject = new Project({
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
    });

    await newProject.save();
    res.status(201).json({ message: 'Project added successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add project', details: err });
  }
};
