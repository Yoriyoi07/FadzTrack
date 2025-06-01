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

    // For now, returning a static list of common construction tasks
    // In a real application, you would want to store tasks in the database
    const tasks = [
      'Foundation Work',
      'Structural Work',
      'Electrical Installation',
      'Plumbing Installation',
      'HVAC Installation',
      'Interior Finishing',
      'Exterior Finishing',
      'Landscaping',
      'Site Preparation',
      'Demolition'
    ];

    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}; 