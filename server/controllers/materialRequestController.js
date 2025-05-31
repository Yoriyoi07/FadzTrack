const MaterialRequest = require('../models/MaterialRequest');
const Project = require('../models/Project');
const { logAction } = require('../utils/auditLogger');

// CREATE
exports.createMaterialRequest = async (req, res) => {
  try {
    const { materials, description, project } = req.body;
    let attachments = [];
    if (req.files && req.files.length > 0) {
      attachments = req.files.map(file => file.filename);
    }

    const newRequest = new MaterialRequest({
      materials: JSON.parse(materials),
      description,
      attachments,
      project,
      createdBy: req.user.id,
    });

    await newRequest.save();

    // Logging (default)
    await logAction({
      action: 'CREATE_MATERIAL_REQUEST',
      performedBy: req.user.id,
      performedByRole: req.user.role,
      description: `Created material request for project ${project}`,
      meta: { requestId: newRequest._id }
    });

    // CEO-specific log
    if (req.user.role === 'CEO') {
      await logAction({
        action: 'CEO_CREATE_MATERIAL_REQUEST',
        performedBy: req.user.id,
        performedByRole: req.user.role,
        description: `CEO created material request for project ${project}`,
        meta: { requestId: newRequest._id }
      });
    }

    res.status(201).json(newRequest);
  } catch (error) {
    console.error('❌ Error creating material request:', error);
    res.status(500).json({ message: 'Failed to create material request' });
  }
};

// GET ALL
exports.getAllMaterialRequests = async (req, res) => {
  try {
    const requests = await MaterialRequest.find()
      .sort({ createdAt: -1 })
      .populate('project', 'projectName')
      .populate('createdBy', 'name role');
    res.status(200).json(requests);
  } catch (error) {
    console.error('❌ Error fetching material requests:', error);
    res.status(500).json({ message: 'Failed to fetch material requests' });
  }
};

// GET SINGLE
exports.getMaterialRequestById = async (req, res) => {
  try {
    const request = await MaterialRequest.findById(req.params.id)
      .populate('project', 'projectName')
      .populate('createdBy', 'name role')
      .populate('approvals.user', 'name role');
    if (!request) return res.status(404).json({ message: 'Not found' });
    res.json(request);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching material request' });
  }
};

// UPDATE
exports.updateMaterialRequest = async (req, res) => {
  try {
    const { materials, description, attachments } = req.body;
    let updatedAttachments = [];
    try {
      updatedAttachments = JSON.parse(attachments || '[]');
    } catch {
      updatedAttachments = [];
    }
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
    ).populate('project', 'projectName')
     .populate('createdBy', 'name role');

    // Regular log
    await logAction({
      action: 'UPDATE_MATERIAL_REQUEST',
      performedBy: req.user.id,
      performedByRole: req.user.role,
      description: `Updated material request for project ${updated?.project?.projectName || updated?.project}`,
      meta: { requestId: updated?._id }
    });

    // CEO-specific log
    if (req.user.role === 'CEO') {
      await logAction({
        action: 'CEO_UPDATE_MATERIAL_REQUEST',
        performedBy: req.user.id,
        performedByRole: req.user.role,
        description: `CEO updated material request for project ${updated?.project?.projectName || updated?.project}`,
        meta: { requestId: updated?._id }
      });
    }

    res.json(updated);
  } catch (err) {
    console.error('Error updating request:', err);
    res.status(500).json({ message: 'Failed to update material request' });
  }
};

// DELETE
exports.deleteMaterialRequest = async (req, res) => {
  try {
    const result = await MaterialRequest.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ message: 'Request not found' });

    // Regular log
    await logAction({
      action: 'DELETE_MATERIAL_REQUEST',
      performedBy: req.user.id,
      performedByRole: req.user.role,
      description: `Deleted material request for project ${result?.project}`,
      meta: { requestId: result?._id }
    });

    // CEO-specific log
    if (req.user.role === 'CEO') {
      await logAction({
        action: 'CEO_DELETE_MATERIAL_REQUEST',
        performedBy: req.user.id,
        performedByRole: req.user.role,
        description: `CEO deleted material request for project ${result?.project}`,
        meta: { requestId: result?._id }
      });
    }

    res.json({ message: 'Request cancelled successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Error cancelling request', err });
  }
};

// APPROVAL
exports.approveMaterialRequest = async (req, res) => {
  const { decision, reason } = req.body;
  const userId = req.user.id;
  const userRole = req.user.role;

  try {
    const request = await MaterialRequest.findById(req.params.id).populate('project');
    if (!request) return res.status(404).json({ message: 'Request not found' });
    const { project } = request;
    if (!project) return res.status(500).json({ message: 'No linked project.' });
    if (!project.projectmanager) return res.status(500).json({ message: 'Project has no projectmanager assigned.' });
    if (!project.areamanager) return res.status(500).json({ message: 'Project has no areamanager assigned.' });

    const isPM = project.projectmanager && project.projectmanager.toString() === userId;
    const isAM = project.areamanager && project.areamanager.toString() === userId;
    const isCEO = userRole === 'CEO';
    let nextStatus = '';
    let currentStatus = request.status;

    // Follow your status workflow
    if (currentStatus === 'Pending Project Manager' && isPM) {
      nextStatus = decision === 'approved' ? 'Pending Area Manager' : 'Denied by Project Manager';
    } else if (currentStatus === 'Pending Area Manager' && isAM) {
      nextStatus = decision === 'approved' ? 'Pending CEO' : 'Denied by Area Manager';
    } else if (currentStatus === 'Pending CEO' && isCEO) {
      nextStatus = decision === 'approved' ? 'Approved' : 'Denied by CEO';
    } else {
      return res.status(403).json({ message: 'Unauthorized or invalid state' });
    }

    request.approvals.push({
      role: userRole,
      user: userId,
      decision,
      reason,
      timestamp: new Date()
    });
    request.status = nextStatus;
    await request.save();

    // Regular log
    await logAction({
      action: 'APPROVE_MATERIAL_REQUEST',
      performedBy: req.user.id,
      performedByRole: req.user.role,
      description: `Approved material request for project ${project.projectName}`,
      meta: { requestId: request._id }
    });

    // CEO-specific log
    if (userRole === 'CEO') {
      await logAction({
        action: 'CEO_APPROVE_MATERIAL_REQUEST',
        performedBy: req.user.id,
        performedByRole: req.user.role,
        description: `CEO approved material request for project ${project.projectName}`,
        meta: { requestId: request._id }
      });
    }

    res.status(200).json({ message: `Request ${decision} by ${userRole}` });
  } catch (error) {
    console.error('Approval error:', error);
    res.status(500).json({ message: 'Failed to process approval' });
  }
};

// GET BY ROLE (mine)
exports.getMyMaterialRequests = async (req, res) => {
  const userId = req.user.id;
  const userRole = req.user.role;
  try {
    let requests = [];
    if (userRole === 'PIC' || userRole === 'Person in Charge') {
      requests = await MaterialRequest.find({ createdBy: userId }).populate('project').populate('createdBy');
    } else if (userRole === 'PM' || userRole === 'Project Manager') {
      const projects = await Project.find({ projectmanager: userId });
      requests = await MaterialRequest.find({ project: { $in: projects.map(p => p._id) } }).populate('project').populate('createdBy');
    } else if (userRole === 'AM' || userRole === 'Area Manager') {
      const projects = await Project.find({ areamanager: userId });
      requests = await MaterialRequest.find({ project: { $in: projects.map(p => p._id) } }).populate('project').populate('createdBy');
    } else if (userRole === 'CEO') {
      requests = await MaterialRequest.find().populate('project').populate('createdBy');
    } else {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    res.json(requests);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching requests' });
  }
};

// MARK AS RECEIVED (no CEO log needed)
exports.markReceived = async (req, res) => {
  try {
    const { id } = req.params;
    const request = await MaterialRequest.findById(id);
    if (!request) return res.status(404).json({ message: 'Material request not found' });
    if (request.status !== 'Approved') return res.status(400).json({ message: 'Request is not approved yet.' });
    if (request.createdBy.toString() !== req.user.id) return res.status(403).json({ message: 'Not your request.' });
    if (request.receivedByPIC) return res.status(400).json({ message: 'Already marked as received.' });

    request.receivedByPIC = true;
    request.receivedDate = new Date();
    await request.save();
    res.json({ message: 'Marked as received.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to mark as received', error: err.message });
  }
};
