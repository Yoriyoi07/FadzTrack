const express = require('express');
const router = express.Router();
const dailyReportController = require('../controllers/dailyReportController');
const { verifyToken } = require('../middleware/authMiddleware'); 

// 1. Most specific first (with extra path after projectId)
router.get('/mine', verifyToken, dailyReportController.getMyDailyReports);
router.get('/project/:projectId/manpower', verifyToken, dailyReportController.getProjectManpower);
router.get('/project/:projectId/material-deliveries', verifyToken, dailyReportController.getApprovedMaterialDeliveries);
router.get('/project/:projectId/tasks', verifyToken, dailyReportController.getProjectTasks);
router.get('/project/:projectId/progress', verifyToken, dailyReportController.getProjectProgress);

// 2. All daily reports for a project
router.get('/project/:projectId', verifyToken, dailyReportController.getProjectDailyReports);

// 3. Get one daily report by its Mongo ID
router.get('/:id', verifyToken, dailyReportController.getDailyReportById);

// 4. All daily reports (admin/global)
router.get('/', verifyToken, dailyReportController.getAllDailyReports); 

// 5. Create a new daily report
router.post('/', verifyToken, dailyReportController.createDailyReport);

module.exports = router;
