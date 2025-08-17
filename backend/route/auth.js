// route/auth.js
const express = require('express');
const router  = express.Router();
const authController = require('../controllers/authController');
const { verifyToken } = require('../middleware/authMiddleware');

router.post('/register',              authController.registerUser);
router.post('/activate-account',      authController.activateAccount);
router.post('/reset-password-request',authController.resetPasswordRequest);
router.post('/reset-password',        authController.resetPassword);

router.post('/login',       authController.loginUser);
router.post('/verify-2fa',  authController.verify2FACode);
router.post('/resend-2fa',  authController.resend2FACode);

router.post('/refresh-token', authController.refreshToken);
router.post('/logout',        authController.logoutUser); // no verifyToken required

// Optional admin/IT endpoints you already had
router.get('/users',           authController.getAllUsers);
router.put('/users/:id',       authController.updateUser);
router.put('/users/:id/status',authController.updateUserStatus);
router.delete('/users/:id',    authController.deleteUser);

router.get('/trusted-devices', verifyToken, authController.listTrustedDevices);
router.post('/trusted-devices/revoke', verifyToken, authController.revokeTrustedDevices);

module.exports = router;
