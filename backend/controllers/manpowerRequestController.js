const ManpowerRequest = require('../models/ManpowerRequest');
const Project = require('../models/Project'); 
const { logAction } = require('../utils/auditLogger');
const Manpower = require('../models/Manpower');
const User = require('../models/User'); // ensure this exists and has role/name

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
      status: 'Pending',      // Optionally 'Pending PM Approval'
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
      meta: { requestId: newRequest._id, projectId: projectDoc?._id, projectName, context: 'manpower' }
    });

    // CEO-only audit log
    if (req.user.role === 'CEO') {
      await logAction({
        action: 'CEO_CREATED_MANPOWER_REQUEST',
        performedBy: req.user.id,
        performedByRole: req.user.role,
        description: `CEO created manpower request for project ${projectName}`,
    meta: { requestId: newRequest._id, projectId: projectDoc?._id, projectName, context: 'manpower' }
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
    // First, update statuses automatically
    await updateRequestStatuses();
    
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
    
    // First, update statuses automatically (including archiving for completed projects)
    await updateRequestStatuses();
    
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

// NEW: GET manpower requests inbox for all Project Managers (broadcast)
const getManpowerRequestsForProjectManagers = async (req, res) => {
  try {
    // Restrict access to PMs
    if (req.user?.role !== 'Project Manager') {
      return res.status(403).json({ message: 'Only Project Managers can view this list.' });
    }
    
    // First, update statuses automatically (including archiving for completed projects)
    await updateRequestStatuses();
    
    // Show all pending requests (you can add org/region filters here if needed)
    const requests = await ManpowerRequest.find({ status: 'Pending' })
      .sort({ createdAt: -1 })
      .populate('project', 'projectName location')
      .populate('createdBy', 'name email role');
    res.status(200).json(requests);
  } catch (error) {
    console.error('❌ Error fetching PM inbox:', error);
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

    // Only PMs can approve now
    if (req.user?.role !== 'Project Manager') {
      return res.status(403).json({ message: 'Only Project Managers can approve manpower requests.' });
    }

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
      approvedBy: req.user?.name || 'Unknown (PM)',
      manpowerProvided,
      area,
      project
    }, { new: true });

    if (!updated) return res.status(404).json({ message: "Request not found" });

    await logAction({
      action: 'APPROVE_MANPOWER_REQUEST',
      performedBy: req.user.id,
      performedByRole: req.user.role,
      description: `PM approved manpower request for project ${updated.project}`,
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
    
    // First, update statuses automatically (including archiving for completed projects)
    await updateRequestStatuses();
    
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
    
    // First, update statuses automatically (including archiving for completed projects)
    await updateRequestStatuses();
    
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

// Function to automatically update request statuses based on time
const updateRequestStatuses = async () => {
  try {
    const now = new Date();
    
    // Update Pending requests to Overdue if acquisition date has passed
    await ManpowerRequest.updateMany(
      {
        status: 'Pending',
        acquisitionDate: { $lt: now }
      },
      {
        status: 'Overdue'
      }
    );

    // Update Approved requests to Completed if return date has passed
    await ManpowerRequest.updateMany(
      {
        status: 'Approved',
        returnDate: { $lt: now }
      },
      {
        status: 'Completed'
      }
    );

    // Archive requests for completed projects
    await archiveRequestsForCompletedProjects();

    console.log('✅ Manpower request statuses updated automatically');
  } catch (error) {
    console.error('❌ Error updating request statuses:', error);
  }
};

// Function to archive requests for completed/inactive projects
const archiveRequestsForCompletedProjects = async () => {
  try {
    console.log('🔄 Starting comprehensive archive process for completed/inactive projects...');
    
    let totalArchived = 0;
    
    // 1. Find all completed projects (status: 'Completed')
    const completedProjects = await Project.find({ status: 'Completed' }).select('_id projectName endDate');
    console.log(`📋 Found ${completedProjects.length} completed projects:`, completedProjects.map(p => p.projectName));
    
    // 2. Find all projects with end dates that have passed (overdue projects)
    // Note: Overdue projects are NOT archived as they could still be completed
    const now = new Date();
    const overdueProjects = await Project.find({ 
      status: 'Ongoing',
      endDate: { $lt: now }
    }).select('_id projectName endDate');
    console.log(`📋 Found ${overdueProjects.length} overdue projects (not archiving as they could still be completed):`, overdueProjects.map(p => p.projectName));
    
    // 3. Combine all projects that should have their requests archived
    // Note: Only completed projects are archived (overdue projects are excluded)
    const projectsToArchive = [...completedProjects];
    
    if (projectsToArchive.length > 0) {
      for (const project of projectsToArchive) {
        console.log(`🔍 Processing completed project: ${project.projectName} (${project._id})`);
        
        // Find all requests for this project that are not already archived
        const requestsToArchive = await ManpowerRequest.find({
          project: project._id,
          isArchived: { $ne: true }
        });

        console.log(`📝 Found ${requestsToArchive.length} non-archived requests for project ${project.projectName}`);

        if (requestsToArchive.length > 0) {
          // Archive each request individually to preserve their original status and full information
          for (const request of requestsToArchive) {
            const originalStatus = request.status;
            const archiveReason = `Project Completed - Request was ${originalStatus}`;
            
            // Preserve all original information before archiving
            const archivedData = {
              status: 'Archived',
              isArchived: true,
              archivedReason: archiveReason,
              // Preserve original project information
              originalProjectName: project.projectName,
              originalProjectEndDate: project.endDate,
              // Preserve original request information
              originalRequestStatus: originalStatus,
              originalRequestDetails: {
                description: request.description,
                acquisitionDate: request.acquisitionDate,
                duration: request.duration,
                manpowers: request.manpowers,
                createdBy: request.createdBy,
                approvedBy: request.approvedBy,
                received: request.received,
                returnDate: request.returnDate,
                manpowerProvided: request.manpowerProvided,
                area: request.area
              }
            };
            
            await ManpowerRequest.findByIdAndUpdate(request._id, archivedData);
            
            console.log(`  - Request ${request._id}: ${originalStatus} -> Archived (${archiveReason})`);
            totalArchived++;
          }
          
          console.log(`✅ Archived ${requestsToArchive.length} requests for completed project: ${project.projectName}`);
        } else {
          console.log(`ℹ️ No requests to archive for project: ${project.projectName}`);
        }
      }
    } else {
      console.log('ℹ️ No completed projects found');
    }
    
    // 4. Handle requests with soft-deleted projects
    console.log('🔍 Checking for requests with soft-deleted projects...');
    
    // Find all soft-deleted projects
    const softDeletedProjects = await Project.find({ 
      isDeleted: true 
    }).select('_id projectName endDate deletedAt deletionReason');
    console.log(`📋 Found ${softDeletedProjects.length} soft-deleted projects:`, softDeletedProjects.map(p => p.projectName));
    
    // Find all requests that reference soft-deleted projects
    const allRequests = await ManpowerRequest.find({ isArchived: { $ne: true } });
    const requestsWithSoftDeletedProjects = [];
    
    for (const request of allRequests) {
      if (request.project) {
        const softDeletedProject = softDeletedProjects.find(p => p._id.toString() === request.project.toString());
        if (softDeletedProject) {
          requestsWithSoftDeletedProjects.push({ request, project: softDeletedProject });
        }
      }
    }
    
    if (requestsWithSoftDeletedProjects.length > 0) {
      console.log(`⚠️ Found ${requestsWithSoftDeletedProjects.length} requests with soft-deleted project references`);
      
      // Archive these requests individually to preserve their original status
      for (const { request, project } of requestsWithSoftDeletedProjects) {
        const originalStatus = request.status;
        const archivedReason = `Project Cancelled (${project.deletionReason || 'No reason provided'}) - Request was ${originalStatus}`;
        
        // Preserve all original information before archiving
        const archivedData = {
          status: 'Archived',
          isArchived: true,
          archivedReason: archivedReason,
          // Preserve original project information
          originalProjectName: project.projectName,
          originalProjectEndDate: project.endDate,
          // Preserve original request information
          originalRequestStatus: originalStatus,
          originalRequestDetails: {
            description: request.description,
            acquisitionDate: request.acquisitionDate,
            duration: request.duration,
            manpowers: request.manpowers,
            createdBy: request.createdBy,
            approvedBy: request.approvedBy,
            received: request.received,
            returnDate: request.returnDate,
            manpowerProvided: request.manpowerProvided,
            area: request.area
          }
        };
        
        await ManpowerRequest.findByIdAndUpdate(request._id, archivedData);
        
        console.log(`  - Request ${request._id}: ${originalStatus} -> Archived (${archivedReason})`);
        totalArchived++;
      }
      
      console.log(`✅ Archived ${requestsWithSoftDeletedProjects.length} requests with soft-deleted project references`);
    }
    
    console.log(`🎉 Comprehensive archive process completed. Total requests archived: ${totalArchived}`);
  } catch (error) {
    console.error('❌ Error archiving requests for completed/inactive projects:', error);
  }
};

// Function to mark a request as completed (when manpower returns)
const markRequestCompleted = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Only the requesting project manager or HR can mark as completed
    if (req.user?.role !== 'Project Manager' && req.user?.role !== 'HR') {
      return res.status(403).json({ message: 'Only Project Managers or HR can mark requests as completed.' });
    }

    const request = await ManpowerRequest.findById(id);
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    // Only Approved requests can be marked as completed
    if (request.status !== 'Approved') {
      return res.status(400).json({ message: 'Only approved requests can be marked as completed.' });
    }

    // Update manpower assignments back to their original projects
    if (request.manpowerProvided && request.manpowerProvided.length > 0) {
      await Promise.all(request.manpowerProvided.map(async (manpowerId) => {
        await Manpower.findByIdAndUpdate(manpowerId, {
          assignedProject: null // Return to unassigned status
        });
      }));
    }

    // Update request status
    const updated = await ManpowerRequest.findByIdAndUpdate(
      id,
      { 
        status: 'Completed',
        returnDate: new Date() // Set actual return date
      },
      { new: true }
    );

    await logAction({
      action: 'COMPLETE_MANPOWER_REQUEST',
      performedBy: req.user.id,
      performedByRole: req.user.role,
      description: `Marked manpower request as completed for project ${updated.project}`,
      meta: { requestId: updated._id }
    });

    res.json({ message: '✅ Request marked as completed', data: updated });
  } catch (error) {
    console.error('❌ Error marking request as completed:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Function to manually archive a request
const archiveManpowerRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    // Only Project Managers, Area Managers, or HR can archive requests
    if (!['Project Manager', 'Area Manager', 'HR'].includes(req.user?.role)) {
      return res.status(403).json({ message: 'Only Project Managers, Area Managers, or HR can archive requests.' });
    }

    const request = await ManpowerRequest.findById(id);
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    // Check if request is already archived
    if (request.isArchived) {
      return res.status(400).json({ message: 'Request is already archived.' });
    }

    // Archive the request with original status
    const originalStatus = request.status;
    const archivedReason = reason || `Manually archived by user - Request was ${originalStatus}`;
    
    const updated = await ManpowerRequest.findByIdAndUpdate(
      id,
      { 
        status: 'Archived',
        isArchived: true,
        archivedReason: archivedReason
      },
      { new: true }
    );

    await logAction({
      action: 'ARCHIVE_MANPOWER_REQUEST',
      performedBy: req.user.id,
      performedByRole: req.user.role,
      description: `Archived manpower request for project ${updated.project}`,
      meta: { requestId: updated._id, reason: archivedReason }
    });

    res.json({ message: '✅ Request archived successfully', data: updated });
  } catch (error) {
    console.error('❌ Error archiving request:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Function to permanently delete an archived request
const deleteArchivedRequest = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Only Project Managers, Area Managers, or HR can delete archived requests
    if (!['Project Manager', 'Area Manager', 'HR'].includes(req.user?.role)) {
      return res.status(403).json({ message: 'Only Project Managers, Area Managers, or HR can delete archived requests.' });
    }

    const request = await ManpowerRequest.findById(id);
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    // Only archived requests can be permanently deleted
    if (!request.isArchived) {
      return res.status(400).json({ message: 'Only archived requests can be permanently deleted.' });
    }

    await ManpowerRequest.findByIdAndDelete(id);

    await logAction({
      action: 'DELETE_ARCHIVED_MANPOWER_REQUEST',
      performedBy: req.user.id,
      performedByRole: req.user.role,
      description: `Permanently deleted archived manpower request for project ${request.project}`,
      meta: { requestId: request._id }
    });

    res.json({ message: '✅ Archived request permanently deleted' });
  } catch (error) {
    console.error('❌ Error deleting archived request:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Test endpoint to manually trigger archiving (for debugging)
const testArchiveRequests = async (req, res) => {
  try {
    // Only allow in development or for admin users
    if (process.env.NODE_ENV === 'production' && req.user?.role !== 'HR') {
      return res.status(403).json({ message: 'This endpoint is only available in development or for HR users.' });
    }

    console.log('🔧 Manually triggering archive requests for completed projects...');
    
    // Find all completed projects
    const completedProjects = await Project.find({ status: 'Completed' }).select('_id projectName');
    console.log(`Found ${completedProjects.length} completed projects:`, completedProjects.map(p => p.projectName));
    
    let totalArchived = 0;
    
    for (const project of completedProjects) {
      // Find all requests for this project that are not already archived
      const requestsToArchive = await ManpowerRequest.find({
        project: project._id,
        isArchived: { $ne: true }
      });

      console.log(`Project ${project.projectName}: Found ${requestsToArchive.length} requests to archive`);

      if (requestsToArchive.length > 0) {
        // Archive all requests for this completed project
        const result = await ManpowerRequest.updateMany(
          {
            project: project._id,
            isArchived: { $ne: true }
          },
          {
            status: 'Archived',
            isArchived: true,
            archivedReason: 'Project Completed'
          }
        );

        totalArchived += result.modifiedCount;
        console.log(`✅ Archived ${result.modifiedCount} requests for completed project: ${project.projectName}`);
      }
    }

    res.json({ 
      message: `✅ Manual archiving completed. Total requests archived: ${totalArchived}`,
      completedProjects: completedProjects.length,
      totalArchived
    });
  } catch (error) {
    console.error('❌ Error in manual archiving:', error);
    res.status(500).json({ message: 'Server error during manual archiving' });
  }
};

// Debug endpoint to check current state
const debugArchiveState = async (req, res) => {
  try {
    // Only allow in development or for admin users
    if (process.env.NODE_ENV === 'production' && req.user?.role !== 'HR') {
      return res.status(403).json({ message: 'This endpoint is only available in development or for HR users.' });
    }

    console.log('🔍 Debugging archive state...');
    
    // Find all completed projects
    const completedProjects = await Project.find({ status: 'Completed' }).select('_id projectName');
    console.log(`Found ${completedProjects.length} completed projects:`, completedProjects.map(p => p.projectName));
    
    // Also check for projects with null/undefined names
    const allProjects = await Project.find().select('_id projectName status');
    const projectsWithNoName = allProjects.filter(p => !p.projectName || p.projectName === '(NO PROJECT NAME)');
    console.log(`Found ${projectsWithNoName.length} projects with no name:`, projectsWithNoName.map(p => ({ id: p._id, name: p.projectName, status: p.status })));
    
    const debugData = {
      completedProjects: completedProjects.map(p => ({ id: p._id, name: p.projectName })),
      projectsWithNoName: projectsWithNoName.map(p => ({ id: p._id, name: p.projectName, status: p.status })),
      projectRequests: [],
      allProjects: allProjects.map(p => ({ id: p._id, name: p.projectName, status: p.status }))
    };
    
    for (const project of completedProjects) {
      // Find all requests for this project
      const allRequests = await ManpowerRequest.find({ project: project._id });
      const archivedRequests = allRequests.filter(r => r.isArchived);
      const nonArchivedRequests = allRequests.filter(r => !r.isArchived);
      
      debugData.projectRequests.push({
        projectId: project._id,
        projectName: project.projectName,
        totalRequests: allRequests.length,
        archivedRequests: archivedRequests.length,
        nonArchivedRequests: nonArchivedRequests.length,
        requestDetails: allRequests.map(r => ({
          id: r._id,
          status: r.status,
          isArchived: r.isArchived,
          archivedReason: r.archivedReason,
          createdBy: r.createdBy
        }))
      });
      
      console.log(`Project ${project.projectName}: ${allRequests.length} total requests, ${archivedRequests.length} archived, ${nonArchivedRequests.length} not archived`);
    }

    // Also check for requests with no project or invalid project references
    const requestsWithNoProject = await ManpowerRequest.find({ 
      $or: [
        { project: { $exists: false } },
        { project: null },
        { project: { $type: "string", $regex: /^[0-9a-fA-F]{24}$/ } }
      ]
    }).populate('project', 'projectName status');
    
    debugData.requestsWithNoProject = requestsWithNoProject.map(r => ({
      id: r._id,
      project: r.project,
      status: r.status,
      isArchived: r.isArchived,
      createdBy: r.createdBy
    }));

    res.json(debugData);
  } catch (error) {
    console.error('❌ Error in debug state:', error);
    res.status(500).json({ message: 'Server error during debug' });
  }
};

module.exports = {
  createManpowerRequest,
  getAllManpowerRequests,
  updateManpowerRequest,
  deleteManpowerRequest,
  approveManpowerRequest,
  getManpowerRequestsForAreaManager,
  getManpowerRequestsForProjectManagers,
  getSingleManpowerRequest,
  getMyManpowerRequests,
  markManpowerRequestReceived,
  scheduleManpowerReturn,
  updateRequestStatuses,
  markRequestCompleted,
  archiveManpowerRequest,
  deleteArchivedRequest,
  archiveRequestsForCompletedProjects,
  testArchiveRequests,
  debugArchiveState,
};
