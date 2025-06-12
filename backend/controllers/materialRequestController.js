const MaterialRequest = require('../models/MaterialRequest');
const Project = require('../models/Project');
const { logAction } = require('../utils/auditLogger');
const { createAndEmitNotification } = require('./notificationController');
const User = require('../models/User');

// ========== NUDGE PENDING APPROVER ==========
exports.nudgePendingApprover = async (req, res) => {
  try {
    const reqId = req.params.id;
    const picId = req.user.id;
    const request = await MaterialRequest.findById(reqId).populate('project').populate('createdBy');
    if (!request) return res.status(404).json({ message: 'Request not found' });

    const project = request.project;
    let pendingUserId = null, pendingRole = null;

    // Always ensure a single recipient
    if (request.status === 'Pending Project Manager' && project.projectmanager) {
      let pmId = project.projectmanager;
      if (Array.isArray(pmId)) {
        console.error('[FATAL] projectmanager is array! Using first:', pmId);
        pmId = pmId[0];
      }
      pendingUserId = pmId?.toString();
      pendingRole = 'Project Manager';
    } else if (request.status === 'Pending Area Manager' && project.areamanager) {
      let amId = project.areamanager;
      if (Array.isArray(amId)) {
        console.error('[FATAL] areamanager is array! Using first:', amId);
        amId = amId[0];
      }
      pendingUserId = amId?.toString();
      pendingRole = 'Area Manager';
    } else if (request.status === 'Pending CEO') {
      const ceoUser = await User.findOne({ role: 'CEO' });
      if (ceoUser) {
        pendingUserId = ceoUser._id.toString();
        pendingRole = 'CEO';
      }
    }

    if (!pendingUserId) return res.status(400).json({ message: 'No pending approver to nudge.' });

    // Cooldown: Only 1 nudge per PIC → Approver → Role → Request per hour
    if (!request.lastNudges) request.lastNudges = [];
    const now = new Date();
    const nudgeRecord = request.lastNudges.find(
      n => n.pic && n.pic.toString() === picId &&
           n.to && n.to.toString() === pendingUserId &&
           n.role === pendingRole
    );
    if (nudgeRecord && now - nudgeRecord.timestamp < 60 * 60 * 1000) {
      const minutes = Math.ceil((60 * 60 * 1000 - (now - nudgeRecord.timestamp)) / (60 * 1000));
      return res.status(429).json({ message: `You can only nudge every 1 hour. Try again in ${minutes} minute(s).` });
    }
    if (nudgeRecord) {
      nudgeRecord.timestamp = now;
    } else {
      request.lastNudges.push({ pic: picId, to: pendingUserId, role: pendingRole, timestamp: now });
    }
    await request.save();

    // --- DEBUG PRINT ---
    console.log('[NUDGE] Sending nudge notification to:', pendingUserId, 'role:', pendingRole);

    const message = `You have a pending material request to approve for project "${project.projectName}".`;

    await createAndEmitNotification({
      type: 'nudge',
      toUserId: pendingUserId,
      fromUserId: req.user.id,
      message,
      projectId: project._id,
      requestId: reqId,
      meta: { pendingRole, nudgedBy: req.user.name },
      req
    });

    res.json({ message: `Nudge sent to ${pendingRole}` });
  } catch (err) {
    console.error('Nudge error:', err);
    res.status(500).json({ message: 'Failed to nudge pending approver.' });
  }
};

// ========== CREATE MATERIAL REQUEST ==========
exports.createMaterialRequest = async (req, res) => {
  try {
    const { materials, description, project } = req.body;
    const materialsArray = JSON.parse(materials);
    const missingUnit = materialsArray.some(m => !m.unit || m.unit.trim() === '');
    let attachments = [];

    if (missingUnit) {
      return res.status(400).json({ message: 'Each material must have a unit.' });
    }

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

    const projectDoc = await Project.findById(project);
    const projectName = projectDoc ? projectDoc.projectName : 'Unknown Project';

    // Defensive: Only send to a single projectmanager
    if (projectDoc && projectDoc.projectmanager) {
      let pmId = projectDoc.projectmanager;
      if (Array.isArray(pmId)) {
        console.error('[FATAL NOTIFY] Project.projectmanager is array! Using first:', pmId);
        pmId = pmId[0];
      }
      if (pmId) {
        console.log('[DEBUG] Will send notification to:', pmId);
        await createAndEmitNotification({
          type: 'material_request_created',
          toUserId: pmId,
          fromUserId: req.user.id,
          message: `New material request for project: ${projectName}`,
          projectId: projectDoc._id,
          requestId: newRequest._id,
          meta: { description },
          req
        });
      }
    }

    await logAction({
      action: 'CREATE_MATERIAL_REQUEST',
      performedBy: req.user.id,
      performedByRole: req.user.role,
      description: `Created material request for project ${project}`,
      meta: { requestId: newRequest._id }
    });

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

// ========== GET ALL MATERIAL REQUESTS ==========
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

// ========== GET SINGLE MATERIAL REQUEST ==========
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

// ========== UPDATE MATERIAL REQUEST ==========
exports.updateMaterialRequest = async (req, res) => {
  try {
    const { materials, description, attachments } = req.body;
    const materialsArray = JSON.parse(materials);
    const missingUnit = materialsArray.some(m => !m.unit || m.unit.trim() === '');
    let updatedAttachments = [];

    if (missingUnit) {
      return res.status(400).json({ message: 'Each material must have a unit.' });
    }
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

    await logAction({
      action: 'UPDATE_MATERIAL_REQUEST',
      performedBy: req.user.id,
      performedByRole: req.user.role,
      description: `Updated material request for project ${updated?.project?.projectName || updated?.project}`,
      meta: { requestId: updated?._id }
    });

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

// ========== DELETE MATERIAL REQUEST ==========
exports.deleteMaterialRequest = async (req, res) => {
  try {
    const result = await MaterialRequest.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ message: 'Request not found' });

    await logAction({
      action: 'DELETE_MATERIAL_REQUEST',
      performedBy: req.user.id,
      performedByRole: req.user.role,
      description: `Deleted material request for project ${result?.project}`,
      meta: { requestId: result?._id }
    });

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

// ========== APPROVE MATERIAL REQUEST ==========
exports.approveMaterialRequest = async (req, res) => {
  const { decision, reason } = req.body;
  const userId = req.user.id.toString();
  const userRole = req.user.role;
  try {
    const request = await MaterialRequest.findById(req.params.id).populate('project');
    if (!request) return res.status(404).json({ message: 'Request not found' });

    const { project } = request;
    if (!project) return res.status(500).json({ message: 'No linked project.' });
    if (!project.projectmanager) return res.status(500).json({ message: 'Project has no projectmanager assigned.' });
    if (!project.areamanager) return res.status(500).json({ message: 'Project has no areamanager assigned.' });

    // --- Debug logs ---
    console.log("Approval Debug:");
    console.log("userId: ", userId);
    console.log("userRole: ", userRole);
    console.log("project.projectmanager: ", project.projectmanager);
    console.log("project.areamanager: ", project.areamanager);

    const idsEqual = (a, b) => String(a) === String(b);

    let pmId = project.projectmanager;
    let amId = project.areamanager;
    if (Array.isArray(pmId)) pmId = pmId[0];
    if (Array.isArray(amId)) amId = amId[0];

    const isPM = idsEqual(pmId, userId);
    const isAM = idsEqual(amId, userId);
    const isCEO = userRole === 'CEO';

    let nextStatus = '';
    let currentStatus = request.status;

    // Workflow status logic
    if (currentStatus === 'Pending Project Manager' && isPM) {
      nextStatus = decision === 'approved' ? 'Pending Area Manager' : 'Denied by Project Manager';
    } else if (currentStatus === 'Pending Area Manager' && isAM) {
      nextStatus = decision === 'approved' ? 'Pending CEO' : 'Denied by Area Manager';
    } else if (currentStatus === 'Pending CEO' && isCEO) {
      nextStatus = decision === 'approved' ? 'Approved' : 'Denied by CEO';
    } else {
      console.log('403: Unauthorized or invalid state', {currentStatus, isPM, isAM, isCEO});
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

    // NOTIFY NEXT APPROVER (already in your code)
    if (decision === 'approved') {
      if (nextStatus === 'Pending Area Manager' && project.areamanager) {
        let amId = project.areamanager;
        if (Array.isArray(amId)) amId = amId[0];
        if (amId) {
          await createAndEmitNotification({
            type: 'pending_approval',
            toUserId: amId,
            fromUserId: req.user.id,
            message: `You have a material request pending approval for project "${project.projectName}".`,
            projectId: project._id,
            requestId: request._id,
            meta: { pendingRole: 'Area Manager', fromRole: req.user.role, approvedBy: req.user.name },
            req
          });
        }
      }
      if (nextStatus === 'Pending CEO') {
        const ceoUser = await User.findOne({ role: 'CEO' });
        if (ceoUser) {
          await createAndEmitNotification({
            type: 'pending_approval',
            toUserId: ceoUser._id,
            fromUserId: req.user.id,
            message: `You have a material request pending approval for project "${project.projectName}".`,
            projectId: project._id,
            requestId: request._id,
            meta: { pendingRole: 'CEO', fromRole: req.user.role, approvedBy: req.user.name },
            req
          });
        }
      }
      // Notify PIC/requestor on final approval
      if (nextStatus === 'Approved') {
        const requestorId = request.createdBy;
        await createAndEmitNotification({
          type: 'approved',
          toUserId: requestorId,
          fromUserId: req.user.id,
          message: `Your material request for project "${project.projectName}" has been fully approved.`,
          projectId: project._id,
          requestId: request._id,
          meta: { approvedBy: req.user.name },
          req
        });
      }
    }

    // NOTIFY PIC/REQUESTOR ON DENIED (any stage)
    if (decision === 'denied' && (
      nextStatus === 'Denied by Project Manager' ||
      nextStatus === 'Denied by Area Manager' ||
      nextStatus === 'Denied by CEO'
    )) {
      const requestorId = request.createdBy;
      await createAndEmitNotification({
        type: 'denied',
        toUserId: requestorId,
        fromUserId: req.user.id,
        message: `Your material request for project "${project.projectName}" was denied by the ${userRole}${reason ? `: ${reason}` : ''}.`,
        projectId: project._id,
        requestId: request._id,
        meta: { deniedBy: req.user.name, deniedRole: userRole, reason },
        req
      });
    }

    await logAction({
      action: 'APPROVE_MATERIAL_REQUEST',
      performedBy: req.user.id,
      performedByRole: req.user.role,
      description: `Approved material request for project ${project.projectName}`,
      meta: { requestId: request._id }
    });

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


// ========== GET MY MATERIAL REQUESTS ==========
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

// ========== MARK AS RECEIVED ==========
exports.markReceived = async (req, res) => {
  try {
    const { id } = req.params;
    const request = await MaterialRequest.findById(id);
    if (!request) return res.status(404).json({ message: 'Material request not found' });

    const userId = req.user.id.toString();
    const createdBy = request.createdBy.toString();

    if (createdBy !== userId) {
      return res.status(403).json({ message: 'Not your request.' });
    }

    if (request.status !== 'Approved') return res.status(400).json({ message: 'Request is not approved yet.' });
    if (request.receivedByPIC) return res.status(400).json({ message: 'Already marked as received.' });

    request.receivedByPIC = true;
    request.receivedDate = new Date();
    await request.save();
    res.json({ message: 'Marked as received.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to mark as received', error: err.message });
  }
};
