const express = require('express');
const router = express.Router();
const dailyReportController = require('../controllers/dailyReportController');
const projectController = require('../controllers/projectController');
const materialRequestController  = require('../controllers/materialRequestController');
const manpowerController = require('../controllers/manpowerController');
const { verifyToken } = require('../middleware/authMiddleware'); 

// Most specific routes first
router.get('/project/:projectId/manpower', verifyToken, dailyReportController.getProjectManpower);
router.get('/project/:projectId/material-deliveries', verifyToken, dailyReportController.getApprovedMaterialDeliveries);
router.get('/project/:projectId/tasks', verifyToken, dailyReportController.getProjectTasks);
// Generic route last
router.get('/project/:projectId', verifyToken, dailyReportController.getProjectDailyReports);

// Create a new daily report
router.post('/', verifyToken, dailyReportController.createDailyReport);

module.exports = router;
