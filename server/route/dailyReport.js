const express = require('express');
const router = express.Router();
const dailyReportController = require('../controllers/dailyReportController');
const projectController = require('../controllers/projectController');
const materialRequestController  = require('../controllers/materialRequestController');
const manpowerController = require('../controllers/manpowerController');
const { authenticateToken } = require('../middleware/auth');

// Most specific routes first
router.get('/project/:projectId/manpower', authenticateToken, dailyReportController.getProjectManpower);
router.get('/project/:projectId/material-deliveries', authenticateToken, dailyReportController.getApprovedMaterialDeliveries);
router.get('/project/:projectId/tasks', authenticateToken, dailyReportController.getProjectTasks);
// Generic route last
router.get('/project/:projectId', authenticateToken, dailyReportController.getProjectDailyReports);

// Create a new daily report
router.post('/', authenticateToken, dailyReportController.createDailyReport);

module.exports = router; 