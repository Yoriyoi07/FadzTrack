const express = require('express');
const router = express.Router();
const hrSiteController = require('../controllers/hrSiteController');
const { verifyToken } = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');

// GET: Get attendance reports for a user
router.get('/reports', verifyToken, hrSiteController.getAttendanceReports);

// GET: Get all attendance reports across all projects (for HR users)
router.get('/all-reports', verifyToken, hrSiteController.getAllAttendanceReports);

// POST: Generate attendance report
router.post('/generate', verifyToken, upload.array('files'), hrSiteController.generateAttendanceReport);

// POST: Submit attendance report
router.post('/submit', verifyToken, hrSiteController.submitAttendanceReport);

module.exports = router;
