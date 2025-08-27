const express = require('express');
const router = express.Router();
const hrSiteController = require('../controllers/hrSiteController');
const { verifyToken } = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');

// GET: Get attendance reports for a user
router.get('/reports', verifyToken, hrSiteController.getAttendanceReports);

// POST: Generate attendance report
router.post('/generate', verifyToken, upload.array('files'), hrSiteController.generateAttendanceReport);

// POST: Submit attendance report
router.post('/submit', verifyToken, hrSiteController.submitAttendanceReport);

module.exports = router;
