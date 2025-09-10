const Manpower = require('../models/Manpower');
const Project = require('../models/Project');

exports.createManpower = async (req, res) => {
  try {
    const { name, position, status, assignedProject } = req.body;
    
    if (!name || !position) {
      return res.status(400).json({ error: 'Name and position are required' });
    }

    const newManpower = new Manpower({
      name,
      position,
      status: status || 'Active',
      assignedProject: assignedProject || null
    });

    const savedManpower = await newManpower.save();
    res.status(201).json(savedManpower);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

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

    // Process each manpower entry with proper defaults
    const processedData = csvData.map(entry => {
      const processed = {
        name: entry.name,
        position: entry.position,
        status: entry.status || 'Active', // Default to Active if not provided
        avatar: entry.avatar || '',
        assignedProject: null // Default to null (unassigned)
      };

      // If project is provided, we'll need to find the project ID
      if (entry.project && entry.project.trim() !== '') {
        // For now, we'll set assignedProject to null and handle project assignment separately
        // This can be enhanced later to automatically assign projects by name
        processed.assignedProject = null;
      }

      return processed;
    });

    const newManpower = await Manpower.insertMany(processedData);
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

// Reconcile manpower.assignedProject with Project.manpower arrays
exports.reconcileAssignments = async (req, res) => {
  try {
    // Simple role guard (assumes verifyToken populated req.user)
    if (!req.user || !['HR','Admin','admin','hr'].includes((req.user.role||'').toLowerCase())) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const projects = await Project.find({}).select('_id manpower').lean();
    const existingProjectIds = new Set(projects.map(p=> String(p._id)));
    const mpToProject = new Map();
    const conflicts = [];
    projects.forEach(p => {
      (p.manpower||[]).forEach(mid => {
        const s = String(mid);
        if(!mpToProject.has(s)) mpToProject.set(s, String(p._id));
        else if(mpToProject.get(s) !== String(p._id)) conflicts.push({ manpower:s, a:mpToProject.get(s), b:String(p._id) });
      });
    });

    const all = await Manpower.find({}).select('_id assignedProject').lean();
    let updatedToMatchProjectArray=0, clearedMissingProject=0, clearedOrphan=0, unchanged=0, mismatchedOverwritten=0;
    for (const mp of all) {
      const idStr = String(mp._id);
      const expected = mpToProject.get(idStr) || null;
      const current = mp.assignedProject ? String(mp.assignedProject) : null;
      if (current && !existingProjectIds.has(current)) {
        await Manpower.updateOne({ _id: idStr }, { $set: { assignedProject: null } });
        clearedMissingProject++; continue;
      }
      if (!current && expected) { await Manpower.updateOne({ _id: idStr }, { $set: { assignedProject: expected } }); updatedToMatchProjectArray++; continue; }
      if (current && !expected) { await Manpower.updateOne({ _id: idStr }, { $set: { assignedProject: null } }); clearedOrphan++; continue; }
      if (current && expected && current !== expected) { await Manpower.updateOne({ _id: idStr }, { $set: { assignedProject: expected } }); mismatchedOverwritten++; continue; }
      unchanged++;
    }
    res.json({ summary: { updatedToMatchProjectArray, clearedMissingProject, clearedOrphan, mismatchedOverwritten, unchanged, total: all.length }, conflicts });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
};
