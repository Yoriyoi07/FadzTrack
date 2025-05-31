const express = require('express');
const router = express.Router();
const controller = require('../controllers/projectController');
const { verifyToken } = require('../middleware/authMiddleware');

// All "assigned" or "mine" routes must come before '/:id'
router.get('/assigned/:userId', controller.getAssignedProjectsPIC);
router.get('/assigned/allroles/:userId', controller.getAssignedProjectsAllRoles);
router.get('/assigned/projectmanager/:userId', controller.getAssignedProjectManager);
router.get('/role/:role', controller.getUsersByRole);

// CRUD
router.post('/', verifyToken, controller.addProject);
router.get('/', controller.getAllProjects);
router.get('/:id', controller.getProjectById);

module.exports = router;
