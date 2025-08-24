const Manpower = require('../models/Manpower');

exports.getAllManpower = async (req, res) => {
  try {
    const manpower = await Manpower.find()
      .populate('assignedProject', 'projectName location')
      .sort({ createdAt: -1 });
    
    // Transform the data to include project information
    const transformedManpower = manpower.map(man => ({
      ...man.toObject(),
      project: man.assignedProject?.projectName || null,
      location: man.assignedProject?.location || null
    }));
    
    res.json(transformedManpower);
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
    // Fetch manpower whose assignedProject is null (unassigned) and status is 'Active'
    const unassignedActiveManpower = await Manpower.find({ 
      assignedProject: null, 
      status: 'Active' 
    });
    res.json(unassignedActiveManpower);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateManpower = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const updatedManpower = await Manpower.findByIdAndUpdate(
      id, 
      updates, 
      { new: true }
    ).populate('assignedProject', 'projectName location');
    
    if (!updatedManpower) {
      return res.status(404).json({ error: 'Manpower not found' });
    }
    
    // Transform the response to include project information
    const response = {
      ...updatedManpower.toObject(),
      project: updatedManpower.assignedProject?.projectName || null,
      location: updatedManpower.assignedProject?.location || null
    };
    
    res.json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
