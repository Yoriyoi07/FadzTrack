const ManpowerRequest = require('../models/ManpowerRequest');
const Project = require('../models/Project'); 
const { logAction } = require('../utils/auditLogger');
const Manpower = require('../models/Manpower');
// CREATE Manpower Request
const createManpowerRequest = async (req, res) => {
  try {
    const {
      acquisitionDate,
      duration,
      project,
      manpowers,
      description
    } = req.body;

    let manpowerArr = [];
    try {
      if (typeof manpowers === 'string') {
        manpowerArr = JSON.parse(manpowers);
      } else if (Array.isArray(manpowers)) {
        manpowerArr = manpowers;
      } else {
        manpowerArr = [];
      }
    } catch {
      return res.status(400).json({ message: 'Invalid manpowers format.' });
    }
    const createdBy = req.user?.id || req.user?._id;
    if (!createdBy) {
      return res.status(400).json({ message: 'No user authenticated' });
    }

    const newRequest = new ManpowerRequest({
      acquisitionDate: new Date(acquisitionDate),
      duration: Number(duration),
      project,
      manpowers: (manpowerArr || []).map(mp => ({
        type: mp.type,
        quantity: Number(mp.quantity)
      })),
      description,
      createdBy,              
      status: 'Pending',      
      approvedBy: '',
      received: false,
      returnDate: null
    });

    await newRequest.save();

    // Project name for description
    let projectName = project;
    let projectDoc = null;  
    try {
      projectDoc = await Project.findById(project).select('projectName');  
      if (projectDoc) {
        projectName = projectDoc.projectName;
      }
    } catch (err) {
      projectName = project;
    }

    // Regular log
    await logAction({
      action: 'CREATED_MANPOWER_REQUEST',
      performedBy: req.user.id,
      performedByRole: req.user.role,
      description: `Created manpower request for project ${projectName}`,
      meta: { requestId: newRequest._id, projectName }
    });

    // CEO-only audit log
    if (req.user.role === 'CEO') {
      await logAction({
        action: 'CEO_CREATED_MANPOWER_REQUEST',
        performedBy: req.user.id,
        performedByRole: req.user.role,
        description: `CEO created manpower request for project ${projectName}`,
        meta: { requestId: newRequest._id, projectName }
      });
    }

    res.status(201).json({ message: '✅ Manpower request created successfully' });
  } catch (error) {
    console.error('❌ Error creating request:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// READ - Get all manpower requests
const getAllManpowerRequests = async (req, res) => {
  try {
    const requests = await ManpowerRequest.find()
      .populate({
        path: 'project',
        populate: {
          path: 'areamanager',
          model: 'User',
          select: 'name'
        }
      })
      .populate('createdBy', 'name');

    res.json(requests);
  } catch (error) {
    console.error('Failed to fetch manpower requests:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET manpower requests assigned to the area manager's projects
const getManpowerRequestsForAreaManager = async (req, res) => {
  try {
    const areaManagerId = req.query.areaManager;
    if (!areaManagerId) {
      return res.status(400).json({ message: 'Area manager ID is required.' });
    }
    const projects = await Project.find({ areamanager: areaManagerId }).select('_id');
    const projectIds = projects.map(p => p._id);

    if (projectIds.length === 0) {
      return res.status(200).json([]);
    }

    const requests = await ManpowerRequest.find({ project: { $in: projectIds } })
      .sort({ createdAt: -1 })
      .populate('project', 'projectName location')
      .populate('createdBy', 'name email role');
    res.status(200).json(requests);
  } catch (error) {
    console.error('❌ Error fetching area manager manpower requests:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// UPDATE - Update a specific request
const updateManpowerRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };
    if (typeof updates.manpowers === 'string') {
      try {
        updates.manpowers = JSON.parse(updates.manpowers);
      } catch {
        return res.status(400).json({ message: 'Invalid manpowers format' });
      }
    }
    const updatedRequest = await ManpowerRequest.findByIdAndUpdate(id, updates, { new: true });
    if (!updatedRequest) {
      return res.status(404).json({ message: 'Request not found' });
    }

    await logAction({
      action: 'UPDATE_MANPOWER_REQUEST',
      performedBy: req.user.id,
      performedByRole: req.user.role,
      description: `Updated manpower request for project ${updatedRequest.project}`,
      meta: { requestId: updatedRequest._id }
    });

    // CEO-only audit log
    if (req.user.role === 'CEO') {
      await logAction({
        action: 'CEO_UPDATED_MANPOWER_REQUEST',
        performedBy: req.user.id,
        performedByRole: req.user.role,
        description: `CEO updated manpower request for project ${updatedRequest.project}`,
        meta: { requestId: updatedRequest._id }
      });
    }

    res.status(200).json({ message: '✅ Request updated successfully', data: updatedRequest });
  } catch (error) {
    console.error('❌ Error updating request:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE - Remove a specific request
const deleteManpowerRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedRequest = await ManpowerRequest.findByIdAndDelete(id);

    if (!deletedRequest) {
      return res.status(404).json({ message: 'Request not found' });
    }

    await logAction({
      action: 'DELETE_MANPOWER_REQUEST',
      performedBy: req.user.id,
      performedByRole: req.user.role,
      description: `Deleted manpower request for project ${deletedRequest.project}`,
      meta: { requestId: deletedRequest._id }
    });

    // CEO-only audit log
    if (req.user.role === 'CEO') {
      await logAction({
        action: 'CEO_DELETED_MANPOWER_REQUEST',
        performedBy: req.user.id,
        performedByRole: req.user.role,
        description: `CEO deleted manpower request for project ${deletedRequest.project}`,
        meta: { requestId: deletedRequest._id }
      });
    }

    res.status(200).json({ message: '🗑️ Request deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting request:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const approveManpowerRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { manpowerProvided, area, project } = req.body;

    // Validate manpower IDs array
    if (!Array.isArray(manpowerProvided) || manpowerProvided.length === 0) {
      return res.status(400).json({ message: "No manpower selected." });
    }

    // Update manpower status to active and assign to project
    await Promise.all(manpowerProvided.map(async (manpowerId) => {
      await Manpower.findByIdAndUpdate(manpowerId, {
        status: 'Active',
        assignedProject: project
      });
    }));

    // Update manpower request
    const updated = await ManpowerRequest.findByIdAndUpdate(id, {
      status: "Approved",
      approvedBy: req.user?.name || 'Unknown',
      manpowerProvided,
      area,
      project
    }, { new: true });

    if (!updated) return res.status(404).json({ message: "Request not found" });

    await logAction({
      action: 'APPROVE_MANPOWER_REQUEST',
      performedBy: req.user.id,
      performedByRole: req.user.role,
      description: `Approved manpower request for project ${updated.project}`,
      meta: { requestId: updated._id }
    });

    res.status(200).json({ message: "✅ Request approved", data: updated });
  } catch (error) {
    console.error("❌ Error approving request:", error);
    res.status(500).json({ message: "Server error" });
  }
};


const getSingleManpowerRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const request = await ManpowerRequest.findById(id)
      .populate('project', 'projectName location')
      .populate('createdBy', 'name email role');
    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }
    res.json(request);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

const getMyManpowerRequests = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized, no user found." });
    }
    const requests = await ManpowerRequest.find({ createdBy: userId })
      .sort({ createdAt: -1 })
      .populate('project', 'projectName location')
      .populate('createdBy', 'name email role');
    res.status(200).json(requests);
  } catch (error) {
    console.error('❌ Error fetching my manpower requests:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const markManpowerRequestReceived = async (req, res) => {
  try {
    const { id } = req.params;
    const { received } = req.body;
    const updated = await ManpowerRequest.findByIdAndUpdate(
      id,
      { received: !!received },
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: "Request not found" });
    res.json({ message: 'Marked as received', data: updated });
  } catch (err) {
    console.error('Error marking as received:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

const scheduleManpowerReturn = async (req, res) => {
  try {
    const { id } = req.params;
    const { returnDate } = req.body;
    if (!returnDate) return res.status(400).json({ message: "No return date provided" });
    const updated = await ManpowerRequest.findByIdAndUpdate(
      id,
      { returnDate },
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: "Request not found" });
    res.json({ message: 'Return scheduled', data: updated });
  } catch (err) {
    console.error('Error scheduling return:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  createManpowerRequest,
  getAllManpowerRequests,
  updateManpowerRequest,
  deleteManpowerRequest,
  approveManpowerRequest,
  getManpowerRequestsForAreaManager,
  getSingleManpowerRequest,
  getMyManpowerRequests,
  markManpowerRequestReceived,
  scheduleManpowerReturn,
};
