const DailyReport = require('../models/DailyReport');
const Project = require('../models/Project');
const MaterialRequest = require('../models/MaterialRequest');
const User = require('../models/User');
const { logAction } = require('../utils/auditLogger');

// Create a new daily report
exports.createDailyReport = async (req, res) => {
  try {
    const dailyReport = new DailyReport(req.body);
    await dailyReport.save();
    
    // Get project name for logging
    let projectName = 'Unknown Project';
    try {
      const project = await Project.findById(dailyReport.project).select('projectName');
      if (project) {
        projectName = project.projectName;
      }
    } catch (err) {
      console.error('Error fetching project for logging:', err);
    }
    
    // Log the action
    await logAction({
      action: 'SUBMIT_DAILY_REPORT',
      performedBy: req.user.id,
      performedByRole: req.user.role,
      description: `Submitted daily report for project ${projectName}`,
      meta: { 
        reportId: dailyReport._id, 
        projectId: dailyReport.project,
        projectName,
        date: dailyReport.date,
        weatherCondition: dailyReport.weatherCondition,
        workTasksCount: dailyReport.workPerformed?.length || 0,
        attendanceCount: dailyReport.siteAttendance?.length || 0
      }
    });
    
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

// Get project progress data - averaged across all PiCs
exports.getProjectProgress = async (req, res) => {
  try {
    const projectId = req.params.projectId;
    
    // Get the project to find all assigned PiCs
    const project = await Project.findById(projectId).select('pic projectName');
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Get all PiCs assigned to this project
    const picIds = project.pic || [];
    
    if (picIds.length === 0) {
      return res.json({
        name: 'No PiCs Assigned',
        progress: [
          { name: 'No PiCs', value: 100, color: '#CCCCCC' }
        ]
      });
    }

    // Get the latest report from each PiC
    const latestReports = await Promise.all(
      picIds.map(async (picId) => {
        return await DailyReport.findOne({ 
          project: projectId, 
          submittedBy: picId 
        }).sort({ date: -1 });
      })
    );

    // Filter out null reports (PiCs with no reports)
    const validReports = latestReports.filter(report => report !== null);
    
    if (validReports.length === 0) {
      return res.json({
        name: 'No Progress Data',
        progress: [
          { name: 'No Reports', value: 100, color: '#CCCCCC' }
        ]
      });
    }

    // Calculate average progress across all PiCs
    const progressData = calculateAverageProgress(validReports, picIds.length);
    res.json(progressData);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Helper function to calculate average progress across multiple PiC reports
function calculateAverageProgress(reports, totalPics) {
  const progressCategories = {
    completed: 0,
    inProgress: 0,
    notStarted: 0
  };

  let totalTasks = 0;
  let reportsWithTasks = 0;

  // Aggregate progress from all reports
  reports.forEach(report => {
    const reportProgress = report.calculateProgress?.();
    if (reportProgress && reportProgress.progress) {
      reportsWithTasks++;
      reportProgress.progress.forEach(category => {
        const taskCount = (category.value / 100) * report.workPerformed.length;
        totalTasks += report.workPerformed.length;
        
        switch (category.name) {
          case 'Completed':
            progressCategories.completed += taskCount;
            break;
          case 'In Progress':
            progressCategories.inProgress += taskCount;
            break;
          case 'Not Started':
            progressCategories.notStarted += taskCount;
            break;
        }
      });
    }
  });

  if (totalTasks === 0) {
    return {
      name: 'No Tasks',
      progress: [
        { name: 'No Tasks', value: 100, color: '#CCCCCC' }
      ]
    };
  }

  // Calculate percentages
  const completedPercent = (progressCategories.completed / totalTasks) * 100;
  const inProgressPercent = (progressCategories.inProgress / totalTasks) * 100;
  const notStartedPercent = (progressCategories.notStarted / totalTasks) * 100;

  return {
    name: `Project Progress (${reportsWithTasks}/${totalPics} PiCs)`,
    progress: [
      { name: 'Completed', value: Math.round(completedPercent * 10) / 10, color: '#4CAF50' },
      { name: 'In Progress', value: Math.round(inProgressPercent * 10) / 10, color: '#5E4FDB' },
      { name: 'Not Started', value: Math.round(notStartedPercent * 10) / 10, color: '#FF6B6B' }
    ],
    metadata: {
      totalPics: totalPics,
      reportingPics: reportsWithTasks,
      pendingPics: totalPics - reportsWithTasks
    }
  };
}


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

// Get averaged PiC contribution percentages for a project
exports.getProjectPicContributions = async (req, res) => {
  try {
    const projectId = req.params.projectId;
    
    // Get the project to find all assigned PiCs
    const project = await Project.findById(projectId).select('pic projectName');
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const picIds = project.pic || [];
    
    if (picIds.length === 0) {
      return res.json({
        averageContribution: 0,
        picContributions: [],
        totalPics: 0,
        reportingPics: 0
      });
    }

    // Get the latest report from each PiC
    const latestReports = await Promise.all(
      picIds.map(async (picId) => {
        const report = await DailyReport.findOne({ 
          project: projectId, 
          submittedBy: picId 
        }).sort({ date: -1 }).populate('submittedBy', 'name');
        return report;
      })
    );

    // Calculate contributions
    const picContributions = [];
    let totalContribution = 0;
    let reportingPics = 0;

    latestReports.forEach((report, index) => {
      const picId = picIds[index];
      const contribution = report?.ai?.pic_contribution_percent || 0;
      
      picContributions.push({
        picId: picId,
        picName: report?.submittedBy?.name || 'Unknown',
        contribution: Math.round(contribution),
        hasReport: !!report,
        lastReportDate: report?.date || null
      });

      if (report) {
        totalContribution += contribution;
        reportingPics++;
      }
    });

    const averageContribution = reportingPics > 0 
      ? Math.round(totalContribution / reportingPics) 
      : 0;

    res.json({
      averageContribution,
      picContributions,
      totalPics: picIds.length,
      reportingPics,
      pendingPics: picIds.length - reportingPics
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// HR - Site: Generate attendance report (stub)
exports.generateAttendanceReportHR = async (req, res) => {
  // TODO: Implement attendance report generation for HR - Site
  res.status(200).json({ message: 'Attendance report generation for HR - Site is not yet implemented.' });
};
