// controllers/authController.js
const User = require('../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const { logAction } = require('../utils/auditLogger');

const JWT_SECRET     = process.env.JWT_SECRET     || 'your_jwt_secret';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'your_refresh_secret';
const isProd = process.env.NODE_ENV === 'production';

// ⏱️ lifetimes (override in .env while testing)
const ACCESS_TTL_SEC  = Number(process.env.ACCESS_TTL_SEC  || (isProd ? 900 : 900));           // 15m prod, 15m dev
const REFRESH_TTL_SEC = Number(process.env.REFRESH_TTL_SEC || (isProd ? 7*24*60*60 : 7*24*60*60));     // 7d prod, 7d dev

// dev-only in-memory store
const twoFACodes = {};

// ───────────────── helpers ─────────────────
function makeTransport() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
  });
}

async function sendEmailLink(to, subject, linkText, linkURL, buttonText = 'Activate Account') {
  const t = makeTransport();
  const html = `
    <div style="font-family: Arial,sans-serif;">
      <h2>${subject}</h2>
      <p>${linkText}</p>
      <p><a href="${linkURL}" style="background:#007bff;color:#fff;padding:10px 18px;border-radius:4px;text-decoration:none;">${buttonText}</a></p>
      <p>If the button doesn't work, open: <a href="${linkURL}">${linkURL}</a></p>
    </div>`;
  await t.sendMail({ from: '"FadzTrack" <no-reply@fadztrack.com>', to, subject, html });
}

async function sendTwoFACode(email, code) {
  if (!isProd) console.log(`[2FA DEV] (mailer) ${email}: ${code}`);
  const t = makeTransport();
  const html = `<p>Your FadzTrack 2FA code:</p><p style="font-size:20px;letter-spacing:3px;"><b>${code}</b></p><p>Valid for 5 minutes.</p>`;
  await t.sendMail({ from: '"FadzTrack" <no-reply@fadztrack.com>', to: email, subject: 'Your FadzTrack 2FA Code', html });
}

function setRefreshCookie(res, token) {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: isProd,                       // false in dev, true in prod
    sameSite: isProd ? 'none' : 'lax',    // 'lax' in dev proxy, 'none' in prod
    path: '/api/auth/refresh-token',
    maxAge: REFRESH_TTL_SEC * 1000,
  });
}
function clearRefreshCookie(res) {
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    path: '/api/auth/refresh-token',
  });
}

// ───────────────── Users CRUD ─────────────────
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}, 'name role phone email status');
    res.json(users);
  } catch (err) {
    res.status(500).json({ msg: 'Failed to get users', err });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const userId = req.params.id;
    const updateData = { ...req.body };

    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 10);
    } else {
      delete updateData.password;
    }

    const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
      new: true, runValidators: true, timestamps: true
    });

    if (!updatedUser) return res.status(404).json({ msg: 'User not found' });
    res.json({ msg: 'User updated successfully', user: updatedUser });
  } catch (err) {
    res.status(500).json({ msg: 'Failed to update user', err });
  }
};

exports.updateUserStatus = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
    if (!user) return res.status(404).json({ msg: 'User not found' });
    res.json({ msg: 'Status updated', user });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ msg: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ msg: 'Failed to delete user', err });
  }
};

// ───────────────── Register / Activate / Reset ─────────────────
exports.registerUser = async (req, res) => {
  try {
    const { name, email, phone, role } = req.body;

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(400).json({ msg: 'User already exists' });

    const tempPassword = crypto.randomBytes(8).toString('hex');
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    const user = await User.create({
      name, email: email.toLowerCase(), phone, role, password: hashedPassword, status: 'Inactive'
    });

    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
    const activationToken = jwt.sign({ email: user.email }, JWT_SECRET, { expiresIn: '1h' });
    const activationLink = `${FRONTEND_URL}/activate-account?token=${activationToken}`;

    await sendEmailLink(
      user.email,
      'Activate Your FadzTrack Account',
      'Click below to set your password and activate your account:',
      activationLink,
      'Activate Account'
    );

    res.status(201).json({ msg: 'Activation link sent to email', user: { name, email, role, phone } });
  } catch (err) {
    res.status(500).json({ msg: 'Registration failed', err });
  }
};

exports.activateAccount = async (req, res) => {
  try {
    const { token, password } = req.body;
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findOne({ email: decoded.email });
    if (!user) return res.status(404).json({ msg: 'User not found' });
    if (user.status === 'Active') return res.status(400).json({ msg: 'Account already activated' });

    user.password = await bcrypt.hash(password, 10);
    user.status = 'Active';
    await user.save();

    res.json({ msg: 'Account activated successfully' });
  } catch (err) {
    res.status(400).json({ msg: 'Invalid or expired token' });
  }
};

exports.resetPasswordRequest = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json({ msg: 'Email not found' });

    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetToken = jwt.sign({ email: user.email }, JWT_SECRET, { expiresIn: '15m' });
    const resetLink = `${FRONTEND_URL}/reset-password?token=${resetToken}`;

    await sendEmailLink(
      user.email,
      'Reset Your Password',
      'Click below to reset your password:',
      resetLink,
      'Reset Password'
    );

    res.json({ msg: 'Password reset link sent to email' });
  } catch (err) {
    res.status(500).json({ msg: 'Failed to send reset email' });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findOne({ email: decoded.email });
    if (!user) return res.status(404).json({ msg: 'User not found' });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.json({ msg: 'Password reset successful' });
  } catch (err) {
    res.status(400).json({ msg: 'Invalid or expired token' });
  }
};

// ───────────────── Login / 2FA / Refresh / Logout ─────────────────
exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const user = await User.findOne({ email: (email || '').toLowerCase() });
    if (!user) return res.status(400).json({ msg: 'Invalid credentials' });

    if (user.status !== 'Active') {
      return res.status(403).json({ msg: 'Your account is inactive. Please contact support.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ msg: 'Invalid credentials' });

    const twoFACode = Math.floor(100000 + Math.random() * 900000).toString();
    twoFACodes[user.email] = { code: twoFACode, expires: Date.now() + 5 * 60 * 1000 };
    if (!isProd) console.log(`[2FA DEV] Code for ${user.email}: ${twoFACode}`);
    await sendTwoFACode(user.email, twoFACode);

    res.json({
      msg: '2FA code sent to email',
      requires2FA: true,
      user: { id: user._id, email: user.email, role: user.role }
    });
  } catch (err) {
    res.status(500).json({ msg: 'Login error', err });
  }
};

exports.verify2FACode = async (req, res) => {
  try {
    const { email, code } = req.body;
    const record = twoFACodes[email];
    if (!record) return res.status(400).json({ msg: 'No 2FA code requested' });

    if (Date.now() > record.expires) {
      delete twoFACodes[email];
      return res.status(400).json({ msg: '2FA code expired' });
    }
    if (record.code !== code) return res.status(400).json({ msg: 'Invalid 2FA code' });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(400).json({ msg: 'User not found' });

    delete twoFACodes[email];

    const accessToken  = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: `${ACCESS_TTL_SEC}s` });
    const refreshToken = jwt.sign({ id: user._id, role: user.role, tv: user.tokenVersion }, REFRESH_SECRET, { expiresIn: `${REFRESH_TTL_SEC}s` });

    setRefreshCookie(res, refreshToken);

    await logAction({
      action: 'login',
      performedBy: user._id,
      performedByRole: user.role,
      description: `${user.name} (${user.email}) logged in.`,
      meta: { ip: req.ip, userAgent: req.headers['user-agent'] }
    });

    return res.json({
      accessToken,
      user: { id: user._id, email: user.email, name: user.name, role: user.role, status: user.status }
    });
  } catch (err) {
    res.status(500).json({ msg: '2FA verification error', err });
  }
};

exports.resend2FACode = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: (email || '').toLowerCase() });
    if (!user) return res.status(404).json({ msg: 'User not found' });

    const twoFACode = Math.floor(100000 + Math.random() * 900000).toString();
    twoFACodes[email] = { code: twoFACode, expires: Date.now() + 5 * 60 * 1000 };
    if (!isProd) console.log(`[2FA DEV] Resent code for ${email}: ${twoFACode}`);

    await sendTwoFACode(email, twoFACode);
    res.status(200).json({ msg: '2FA code resent' });
  } catch (error) {
    res.status(500).json({ msg: 'Error resending 2FA code' });
  }
};

exports.refreshToken = async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (!token) return res.status(401).json({ msg: 'No refresh token' });

  try {
    const decoded = jwt.verify(token, REFRESH_SECRET); // { id, role, tv }
    const user = await User.findById(decoded.id).select('role tokenVersion');
    if (!user) return res.status(401).json({ msg: 'User not found' });
    if (decoded.tv !== user.tokenVersion) return res.status(401).json({ msg: 'Refresh revoked' });

    // rotate refresh
    const newRefresh = jwt.sign({ id: user._id, role: user.role, tv: user.tokenVersion }, REFRESH_SECRET, { expiresIn: `${REFRESH_TTL_SEC}s` });
    setRefreshCookie(res, newRefresh);

    const accessToken = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: `${ACCESS_TTL_SEC}s` });
    return res.json({ accessToken });
  } catch (err) {
    return res.status(401).json({ msg: 'Invalid refresh token' });
  }
};

exports.logoutUser = async (req, res) => {
  try {
    if (req.user) {
      await logAction({
        action: 'logout',
        performedBy: req.user.id,
        performedByRole: req.user.role,
        description: `${req.user.name || req.user.id} logged out.`,
        meta: { ip: req.ip, userAgent: req.headers['user-agent'] }
      });
    }
  } catch {}
  clearRefreshCookie(res);
  res.json({ msg: 'Logged out successfully' });
};
