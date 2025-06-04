const Manpower = require('../models/Manpower');

exports.getAllManpower = async (req, res) => {
  try {
    const manpower = await Manpower.find().sort({ createdAt: -1 });
    res.json(manpower);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.uploadManpowerFromCSV = async (req, res) => {
  try {
    const csvData = req.body.manpowers; 
    if (!Array.isArray(csvData)) {
      return res.status(400).json({ error: 'Invalid CSV format' });
    }

    const newManpower = await Manpower.insertMany(csvData);
    res.status(201).json(newManpower);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getUnassignedManpower = async (req, res) => {
  try {
    // Fetch manpower whose assignedProject is null (unassigned) and status is 'Inactive'
    const unassignedInactiveManpower = await Manpower.find({ 
      assignedProject: null, 
      status: 'Inactive' 
    });
    res.json(unassignedInactiveManpower);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};