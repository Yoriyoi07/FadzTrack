const express = require('express');
const router = express.Router();
const multer = require('multer');
const MaterialRequest = require('../models/MaterialRequest');
const { verifyToken } = require('../middleware/authMiddleware');
const Project = require('../models/Project');

// File storage config
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

router.put('/:id', verifyToken, upload.array('newAttachments'), async (req, res) => {
  try {
    // Parse JSON fields
    const { materials, description, attachments } = req.body;
    let updatedAttachments = [];
    try {
      updatedAttachments = JSON.parse(attachments || '[]');
    } catch {
      updatedAttachments = [];
    }
    // Add any new files
    if (req.files && req.files.length > 0) {
      updatedAttachments = [
        ...updatedAttachments,
        ...req.files.map(file => file.filename)
      ];
    }
    const updated = await MaterialRequest.findByIdAndUpdate(
      req.params.id,
      {
        materials: JSON.parse(materials),
        description,
        attachments: updatedAttachments,
      },
      { new: true }
    ).populate('project').populate('createdBy');
    res.json(updated);
  } catch (err) {
    console.error('Error updating request:', err);
    res.status(500).json({ message: 'Failed to update material request' });
  }
});

// POST /api/requests
router.post('/', verifyToken, upload.array('attachments'), async (req, res) => {
  try {
   const { materials, description, project } = req.body;
    const parsedMaterials = JSON.parse(materials);
    const attachments = req.files.map(file => file.filename);

    const newRequest = new MaterialRequest({
      project,
      createdBy: req.user.id,
      materials: parsedMaterials,
      description,
      attachments
    });

    await newRequest.save();
    res.status(201).json({ message: 'Material request submitted successfully' });
  } catch (error) {
    console.error('❌ Error submitting material request:', error);
    res.status(500).json({ error: 'Failed to submit material request' });
  }
});


router.post('/:id/approve', verifyToken, async (req, res) => {
  const { decision, reason } = req.body;
  const userId = req.user.id;
  const userRole = req.user.role;

  try {
    const request = await MaterialRequest.findById(req.params.id).populate('project');
    if (!request) return res.status(404).json({ message: 'Request not found' });

    const { project } = request;
    if (!project) {
      return res.status(500).json({ message: 'Material Request has no linked project.' });
    }
    if (!project.projectmanager) {
      return res.status(500).json({ message: 'Project has no projectmanager assigned.' });
    }
    if (!project.areamanager) {
      return res.status(500).json({ message: 'Project has no areamanager assigned.' });
    }

    // --- MAKE SURE YOU DEFINE THESE FIRST ---
    const isPM = project.projectmanager && project.projectmanager.toString() === userId;
    const isAM = project.areamanager && project.areamanager.toString() === userId;
    const isCEO = userRole === 'CEO';

    let nextStatus = '';
    let currentStatus = request.status;

    // --- NOW YOU CAN LOG ---
    console.log({
      currentStatus,
      isPM,
      isAM,
      isCEO,
      userRole,
      projectmanager: project.projectmanager,
      areamanager: project.areamanager,
      userId,
    });

    // Now your status/role decision logic:
    if (currentStatus === 'Pending PM' && isPM) {
      nextStatus = decision === 'approved' ? 'Pending AM' : 'Denied by PM';
    } else if (currentStatus === 'Pending AM' && isAM) {
      nextStatus = decision === 'approved' ? 'Pending CEO' : 'Denied by AM';
    } else if (currentStatus === 'Pending CEO' && isCEO) {
      nextStatus = decision === 'approved' ? 'Approved' : 'Denied by CEO';
    } else {
      return res.status(403).json({ message: 'Unauthorized or invalid state' });
    }

    // Role mapping for approvals array
    const roleMap = {
      'Project Manager': 'PM',
      'Area Manager': 'AM',
      'CEO': 'CEO'
    };
    const approvalRole = roleMap[userRole] || userRole;

    // Log the approval
    request.approvals.push({
      role: approvalRole,
      user: userId,
      decision,
      reason,
      timestamp: new Date()
    });

    request.status = nextStatus;
    await request.save();

    res.status(200).json({ message: `Request ${decision} by ${userRole}` });
  } catch (error) {
    console.error('Approval error:', error);
    res.status(500).json({ message: 'Failed to process approval' });
  }
});


router.get('/mine', verifyToken, async (req, res) => {
  const userId = req.user.id;
  const userRole = req.user.role;
  try {
    let requests = [];

    if (userRole === 'PIC' || userRole === 'Person in Charge') {
      requests = await MaterialRequest.find({ createdBy: userId })
        .populate('project')
        .populate('createdBy');
    } else if (userRole === 'PM' || userRole === 'Project Manager') {
      const projects = await Project.find({ projectmanager: userId });
      requests = await MaterialRequest.find({ project: { $in: projects.map(p => p._id) }, status: "Pending PM" })
        .populate('project')
        .populate('createdBy');
    } else if (userRole === 'AM' || userRole === 'Area Manager') {
      const projects = await Project.find({ areamanager: userId });
      requests = await MaterialRequest.find({ project: { $in: projects.map(p => p._id) }, status: "Pending AM" })
        .populate('project')
        .populate('createdBy');
    } else if (userRole === 'CEO') {
      requests = await MaterialRequest.find()
        .populate('project')
        .populate('createdBy');
    } else {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    res.json(requests);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching requests' });
  }
});


// GET /api/requests/:id
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const request = await MaterialRequest.findById(req.params.id)
      .populate('project')
      .populate('createdBy');

    if (!request) {
      return res.status(404).json({ message: 'Material Request not found' });
    }

    res.json(request);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching material request' });
  }
});

// DELETE /api/requests/:id
router.delete('/:id', require('../middleware/authMiddleware').verifyToken, async (req, res) => {
  try {
    const result = await MaterialRequest.findByIdAndDelete(req.params.id);
    if (!result) {
      return res.status(404).json({ message: 'Request not found' });
    }
    res.json({ message: 'Request cancelled successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Error cancelling request', err });
  }
});



module.exports = router;
