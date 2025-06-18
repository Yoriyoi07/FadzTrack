const DailyReport = require('../models/DailyReport');
const Project = require('../models/Project');
const MaterialRequest = require('../models/MaterialRequest');
const User = require('../models/User');

// Create a new daily report
exports.createDailyReport = async (req, res) => {
  try {
    const dailyReport = new DailyReport(req.body);
    await dailyReport.save();
    res.status(201).json(dailyReport);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Get all daily reports for a project
exports.getProjectDailyReports = async (req, res) => {
  try {
    const reports = await DailyReport.find({ project: req.params.projectId })
      .populate('submittedBy', 'name')
      .populate('siteAttendance.manpower')
      .populate('materialDeliveries.delivery');
    res.json(reports);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get project progress data
// dailyReportController.js
exports.getProjectProgress = async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const latestReport = await DailyReport.findOne({ project: projectId })
      .sort({ date: -1 })
      .populate('project', 'name');

    if (!latestReport) {
      return res.json({
        name: 'No Progress Data',
        progress: [
          { name: 'No Data', value: 100, color: '#CCCCCC' }
        ]
      });
    }

    const progressData = latestReport.calculateProgress?.();
    if (!progressData) {
      return res.json({
        name: 'No Tasks',
        progress: [
          { name: 'No Tasks', value: 100, color: '#CCCCCC' }
        ]
      });
    }

    res.json(progressData);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// Get manpower list for project
exports.getProjectManpower = async (req, res) => {
  try {
    console.log('Fetching manpower for project:', req.params.projectId);
    const project = await Project.findById(req.params.projectId)
      .populate('manpower');
    if (!project) {
      console.log('Project not found');
      return res.status(404).json({ message: 'Project not found' });
    }
    console.log('Project manpower:', project.manpower);
    res.json(project.manpower);
  } catch (error) {
    console.error('Error fetching manpower:', error);
    res.status(500).json({ message: error.message });
  }
};

// Get approved material deliveries for project
exports.getApprovedMaterialDeliveries = async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Get all users in the project (PM and subordinates)
    const projectUsers = await User.find({
      $or: [
        { _id: project.projectmanager },
        { _id: { $in: project.pic } }
      ]
    });

    const userIds = projectUsers.map(user => user._id);

    // Get approved material deliveries from these users
    const deliveries = await MaterialRequest.find({
      requestedBy: { $in: userIds },
      status: 'Approved by CEO'
    });

    res.json(deliveries);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get project tasks
exports.getProjectTasks = async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Map to return only task names
    const tasks = (project.tasks || []).map(t => t.name);

    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getApprovedMaterialDeliveries = async (req, res) => {
  try {
    const { projectId } = req.params;
    // Get only material requests for this project that are "Approved"
    const deliveries = await MaterialRequest.find({
      project: projectId,
      status: 'Approved'
    }).select('materials _id'); // Optionally, select only fields you need
    res.json(
      // Flatten to an array of materials if you want, or send as is
      deliveries.flatMap(delivery =>
        (delivery.materials || []).map(mat => ({
          ...mat.toObject(),
          requestId: delivery._id // add reference to parent request
        }))
      )
    );
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAllDailyReports = async (req, res) => {
  try {
    const reports = await DailyReport.find()
      .populate('submittedBy', 'name')
      .populate('project', 'projectName'); 
    res.json(reports);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// Get daily reports submitted by the logged-in user
exports.getMyDailyReports = async (req, res) => {
  try {
    const userId = req.user.id; 
    const reports = await DailyReport.find({ submittedBy: userId })
      .populate('submittedBy', 'name')
      .populate('project', 'projectName');
    res.json(reports);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get a daily report by its ID
exports.getDailyReportById = async (req, res) => {
  try {
    const report = await DailyReport.findById(req.params.id)
      .populate('submittedBy', 'name')
      .populate('siteAttendance.manpower')
      .populate('materialDeliveries.delivery')
      .populate('project', 'projectName');
    if (!report) {
      return res.status(404).json({ message: 'Daily report not found' });
    }
    res.json(report);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
