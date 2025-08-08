/* ======= ROUTER SECTION ======= */
const express = require('express');
const router = express.Router();
const controller = require('../controllers/projectController');
const { verifyToken } = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');

// All "assigned" or "mine" routes must come before '/:id'
router.get('/assigned/:userId', controller.getAssignedProjectsPIC);
router.get('/assigned/allroles/:userId', controller.getAssignedProjectsAllRoles);
router.get('/assigned/projectmanager/:userId', controller.getAssignedProjectManager);
router.get('/role/:role', controller.getUsersByRole);
router.get('/by-user-status', controller.getProjectsByUserAndStatus);

// NEW: Get all unassigned PICs (PIC/Staff/HR - Site)
router.get('/unassigned-pics', controller.getUnassignedPICs);
router.get('/unassigned-staff', controller.getUnassignedStaff);
router.get('/unassigned-hrsite', controller.getUnassignedHR);


// CRUD
router.post('/',verifyToken,upload.fields([{ name: 'photos', maxCount: 10 },{ name: 'documents', maxCount: 10 }]),controller.addProject);
router.get('/', controller.getAllProjects);
router.get('/:id', controller.getProjectById);
router.patch('/:id/tasks', verifyToken, controller.updateProjectTasks);
router.patch('/:id/toggle-status', controller.toggleProjectStatus);
router.get('/:id/discussions', verifyToken, controller.getProjectDiscussions);
router.post('/:id/discussions', verifyToken, controller.addProjectDiscussion);
router.post('/:id/discussions/:msgId/reply', verifyToken, controller.replyToProjectDiscussion);

module.exports = router;
