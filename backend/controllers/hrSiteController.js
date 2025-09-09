const { logAction } = require('../utils/auditLogger');
const Project = require('../models/Project');

// Generate attendance report
exports.generateAttendanceReport = async (req, res) => {
  try {
    const { userId, periodStart, periodEnd } = req.body;
    const files = req.files || [];
    
    // Simulate report generation (replace with actual logic)
    const reportUrl = `https://example.com/reports/attendance-${Date.now()}.pdf`;
    const reportName = `Attendance Report ${new Date(periodStart).toLocaleDateString()} - ${new Date(periodEnd).toLocaleDateString()}`;
    
    // Log the action
    try {
      await logAction({
        action: 'GENERATE_ATTENDANCE_REPORT',
        performedBy: req.user?.id || userId,
        performedByRole: req.user?.role || 'HR - Site',
        description: `Generated attendance report for period ${new Date(periodStart).toLocaleDateString()} - ${new Date(periodEnd).toLocaleDateString()}`,
        meta: { 
          userId,
          periodStart,
          periodEnd,
          filesCount: files.length,
          fileNames: files.map(f => f.originalname),
          reportUrl,
          reportName
        }
      });
    } catch (logErr) {
      console.error('Audit log error (generateAttendanceReport):', logErr);
    }
    
    res.json({ reportUrl, reportName });
  } catch (error) {
    console.error('Error generating attendance report:', error);
    res.status(500).json({ message: 'Failed to generate attendance report' });
  }
};

// Submit attendance report
exports.submitAttendanceReport = async (req, res) => {
  try {
    const { userId, periodStart, periodEnd, reportUrl, reportName, dataFiles } = req.body;
    
    // Simulate saving the report (replace with actual database logic)
    const savedReport = {
      id: Date.now(),
      userId,
      periodStart,
      periodEnd,
      reportUrl,
      reportName,
      dataFiles: dataFiles || [],
      submittedAt: new Date().toISOString()
    };
    
    // Log the action
    try {
      await logAction({
        action: 'SUBMIT_ATTENDANCE_REPORT',
        performedBy: req.user?.id || userId,
        performedByRole: req.user?.role || 'HR - Site',
        description: `Submitted attendance report: ${reportName}`,
        meta: { 
          userId,
          periodStart,
          periodEnd,
          reportUrl,
          reportName,
          dataFilesCount: dataFiles?.length || 0,
          dataFileNames: dataFiles?.map(f => f.name) || [],
          reportId: savedReport.id
        }
      });
    } catch (logErr) {
      console.error('Audit log error (submitAttendanceReport):', logErr);
    }
    
    res.json(savedReport);
  } catch (error) {
    console.error('Error submitting attendance report:', error);
    res.status(500).json({ message: 'Failed to submit attendance report' });
  }
};

// Get attendance reports for a user
exports.getAttendanceReports = async (req, res) => {
  try {
    const { userId } = req.query;
    
    // Simulate fetching reports (replace with actual database logic)
    const reports = [
      {
        id: 1,
        periodStart: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        periodEnd: new Date().toISOString(),
        reportUrl: 'https://example.com/reports/attendance-1.pdf',
        reportName: 'Attendance Report Apr 1 - Apr 14, 2025',
        submittedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        dataFiles: [{ name: 'attendance_data.xlsx' }]
      }
    ];
    
    res.json(reports);
  } catch (error) {
    console.error('Error fetching attendance reports:', error);
    res.status(500).json({ message: 'Failed to fetch attendance reports' });
  }
};

// Get all attendance reports across all projects for HR users
exports.getAllAttendanceReports = async (req, res) => {
  try {
    const { search, projectId, dateFrom, dateTo, sortBy = 'generatedAt', sortOrder = 'desc' } = req.query;
    
    // Build query for projects with attendance reports
    let query = { attendanceReports: { $exists: true, $ne: [] } };
    
    if (projectId) {
      query._id = projectId;
    }
    
    // Get projects with attendance reports
    const projects = await Project.find(query)
      .select('projectName attendanceReports startDate endDate')
      .lean();
    
    // Flatten all attendance reports with project information
    let allReports = [];
    projects.forEach(project => {
      if (project.attendanceReports && project.attendanceReports.length > 0) {
        project.attendanceReports.forEach(report => {
          allReports.push({
            _id: report._id,
            projectId: project._id,
            projectName: project.projectName,
            originalName: report.originalName,
            inputPath: report.inputPath,
            outputPath: report.outputPath,
            generatedAt: report.generatedAt,
            generatedBy: report.generatedBy,
            uploadedByName: report.uploadedByName,
            ai: report.ai,
            projectStartDate: project.startDate,
            projectEndDate: project.endDate
          });
        });
      }
    });
    
    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      allReports = allReports.filter(report => 
        report.projectName.toLowerCase().includes(searchLower) ||
        report.originalName.toLowerCase().includes(searchLower) ||
        report.uploadedByName?.toLowerCase().includes(searchLower)
      );
    }
    
    // Apply date filters
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      allReports = allReports.filter(report => new Date(report.generatedAt) >= fromDate);
    }
    
    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999); // Include the entire day
      allReports = allReports.filter(report => new Date(report.generatedAt) <= toDate);
    }
    
    // Apply sorting
    allReports.sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];
      
      if (sortBy === 'generatedAt') {
        aValue = new Date(aValue);
        bValue = new Date(bValue);
      }
      
      if (sortOrder === 'desc') {
        return bValue > aValue ? 1 : -1;
      } else {
        return aValue > bValue ? 1 : -1;
      }
    });
    
    // Log the action
    try {
      await logAction({
        action: 'VIEW_ALL_ATTENDANCE_REPORTS',
        performedBy: req.user?.id,
        performedByRole: req.user?.role || 'HR',
        description: `Viewed all attendance reports with filters: search="${search}", projectId="${projectId}", dateFrom="${dateFrom}", dateTo="${dateTo}"`,
        meta: { 
          totalReports: allReports.length,
          search,
          projectId,
          dateFrom,
          dateTo,
          sortBy,
          sortOrder
        }
      });
    } catch (logErr) {
      console.error('Audit log error (getAllAttendanceReports):', logErr);
    }
    
    res.json({
      reports: allReports,
      total: allReports.length,
      filters: { search, projectId, dateFrom, dateTo, sortBy, sortOrder }
    });
  } catch (error) {
    console.error('Error fetching all attendance reports:', error);
    res.status(500).json({ message: 'Failed to fetch attendance reports' });
  }
};

