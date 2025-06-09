const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken } = require('../middleware/authMiddleware');

router.post('/register', authController.registerUser);
router.post('/activate-account', authController.activateAccount);
router.post('/reset-password-request', authController.resetPasswordRequest);
router.post('/reset-password', authController.resetPassword);
router.post('/login', authController.loginUser);
router.get('/users', authController.getAllUsers);
router.post('/verify-2fa', authController.verify2FACode);
router.post('/refresh-token', authController.refreshToken);
router.post('/logout', verifyToken, authController.logoutUser);
router.put('/users/:id', authController.updateUser);
router.delete('/users/:id', authController.deleteUser);
router.post('/resend-2fa', authController.resend2FACode);
router.put('/users/:id/status', authController.updateUserStatus);

module.exports = router;
