const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/register', authController.registerUser);
router.post('/login', authController.loginUser);
router.get('/users', authController.getAllUsers);
router.post('/verify-2fa', authController.verify2FACode);
router.post('/refresh-token', authController.refreshToken);
router.post('/logout', authController.logoutUser);
module.exports = router;
