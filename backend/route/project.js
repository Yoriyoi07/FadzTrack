const express = require('express');
const router = express.Router();
const controller = require('../controllers/projectController');
const { verifyToken } = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');
const supabase = require('../utils/supabaseClient');

/* ---------- Signed URL: return JSON { signedUrl } ---------- */
router.get('/photo-signed-url', async (req, res) => {
  try {
    const path = req.query.path;
    if (!path) return res.status(400).json({ message: 'Missing path' });

    const { data, error } = await supabase
      .storage
      .from('documents')
      .createSignedUrl(path, 60 * 10); // 10 minutes

    if (error || !data?.signedUrl) {
      return res.status(500).json({ message: 'Failed to create signed URL' });
    }

    return res.json({ signedUrl: data.signedUrl });
  } catch (e) {
    return res.status(500).json({ message: 'Server error' });
  }
});

/* ---------- "assigned" routes ---------- */
router.get('/assigned/:userId', controller.getAssignedProjectsPIC);
router.get('/assigned/allroles/:userId', controller.getAssignedProjectsAllRoles);
router.get('/assigned/projectmanager/:userId', controller.getAssignedProjectManager);
router.get('/role/:role', controller.getUsersByRole);
router.get('/by-user-status', controller.getProjectsByUserAndStatus);

/* ---------- unassigned ---------- */
router.get('/unassigned-pics', controller.getUnassignedPICs);
router.get('/unassigned-staff', controller.getUnassignedStaff);
router.get('/unassigned-hrsite', controller.getUnassignedHR);

/* ---------- CRUD ---------- */
router.post(
  '/',
  verifyToken,
  upload.fields([{ name: 'photos', maxCount: 10 }, { name: 'documents', maxCount: 10 }]),
  controller.addProject
);
router.get('/', controller.getAllProjects);

/* ---------- Files tab ---------- */
router.post('/:id/documents', verifyToken, upload.array('files', 20), controller.uploadProjectDocuments);
router.delete('/:id/documents', verifyToken, controller.deleteProjectDocument);

/* ---------- project by id and others ---------- */
router.get('/:id', controller.getProjectById);
router.patch('/:id/tasks', verifyToken, controller.updateProjectTasks);
router.patch('/:id/toggle-status', controller.toggleProjectStatus);

/* ---------- Discussions — accept ANY attachment field ---------- */
router.get('/:id/discussions', verifyToken, controller.getProjectDiscussions);
router.post('/:id/discussions', verifyToken, upload.any(), controller.addProjectDiscussion);
router.post('/:id/discussions/:msgId/reply', verifyToken, upload.any(), controller.replyToProjectDiscussion);

module.exports = router;
