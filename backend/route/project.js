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


// CRUD
router.post('/', verifyToken, upload.array('photos'), controller.addProject);
router.get('/', controller.getAllProjects);
router.get('/:id', controller.getProjectById);
router.patch('/:id/tasks', verifyToken, controller.updateProjectTasks);
router.patch('/:id/toggle-status', controller.toggleProjectStatus);




module.exports = router;
