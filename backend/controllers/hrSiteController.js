const { logAction } = require('../utils/auditLogger');

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

