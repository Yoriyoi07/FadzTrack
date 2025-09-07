// controllers/authController.js
const User = require('../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const { logAction } = require('../utils/auditLogger');
const TrustedDevice = require('../models/TrustedDevice');
const { createHash } = require('crypto');

const JWT_SECRET     = process.env.JWT_SECRET     || 'your_jwt_secret';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'your_refresh_secret';
const isProd = process.env.NODE_ENV === 'production';
const TRUST_COOKIE = 'mfa_trust';

// lifetimes
const ACCESS_TTL_SEC  = Number(process.env.ACCESS_TTL_SEC  || 900);                    // 15m
// Default refresh to 30 days; we’ll optionally shorten this when “remember device” is OFF.
const REFRESH_TTL_SEC = Number(process.env.REFRESH_TTL_SEC || 30 * 24 * 60 * 60);      // 30d
const TRUST_TTL_SEC   = Number(process.env.TRUST_TTL_SEC   || 30 * 24 * 60 * 60);      // 30d

// Frontend base URL (production domain default, overridable via env)
const PROD_DOMAIN = 'https://fadztrack.online';
const FRONTEND_BASE_URL = (process.env.FORCE_PROD_LINKS === 'true')
  ? PROD_DOMAIN
  : (process.env.FRONTEND_URL || PROD_DOMAIN);
// Short refresh lifetime (when user does NOT remember device)
const SHORT_REFRESH = Number(process.env.SHORT_REFRESH_TTL_SEC || 7 * 24 * 60 * 60); // 7d

// in-memory 2FA codes
const twoFACodes = {};

// ───────────── helpers ─────────────
function makeTransport() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
  });
}

function sha256(x) {
  return createHash('sha256').update(String(x)).digest('hex');
}

function clientIpPrefix(req) {
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString();
  const m = ip.match(/(\d+\.\d+)\./); // v4 best-effort
  return m ? m[1] : '';
}

function ipFirstOctet(req) {
  return (clientIpPrefix(req) || '').split('.').slice(0, 1).join('.');
}

// Normalize UA to resist minor version bumps
function stableUA(ua = '') {
  return ua
    .replace(/Chrome\/\d+\.\d+\.\d+\.\d+/, 'Chrome/*')
    .replace(/Edg\/\d+\.\d+\.\d+\.\d+/, 'Edg/*')
    .replace(/Safari\/\d+\.\d+/, 'Safari/*')
    .replace(/Firefox\/\d+\.\d+/, 'Firefox/*');
}

// Choose cookie attributes that work on localhost (HTTP) and prod (HTTPS)
function cookieAttrs(req, { path = '/', maxAge } = {}) {
  const host  = (req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'http').split(',')[0].trim();

  const isLocal = host.startsWith('localhost') || host.startsWith('127.0.0.1');
 const secure   = !isLocal;
  const sameSite = isLocal ? 'lax' : 'none';

  return {
    httpOnly: true,
    secure,
    sameSite,
    path,
    ...(maxAge != null ? { maxAge } : {}),
  };
}

function setTrustCookie(req, res, rawToken) {
  res.cookie(TRUST_COOKIE, rawToken, cookieAttrs(req, { path: '/', maxAge: TRUST_TTL_SEC * 1000 }));
}
function clearTrustCookie(req, res) {
  res.clearCookie(TRUST_COOKIE, cookieAttrs(req, { path: '/' }));
}

function setRefreshCookie(req, res, token, maxAgeSec = REFRESH_TTL_SEC) {
  res.cookie(
    'refreshToken',
    token,
    cookieAttrs(req, { path: '/api/auth/refresh-token', maxAge: maxAgeSec * 1000 })
 );}
function clearRefreshCookie(req, res) {
  res.clearCookie('refreshToken', cookieAttrs(req, { path: '/api/auth/refresh-token' }));
}

async function sendEmailLink(to, subject, linkText, linkURL, buttonText = 'Activate Account') {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.error('[MAIL] Missing EMAIL_USER/EMAIL_PASS env vars. Cannot send email. Intended link:', linkURL);
    return { sent:false, skipped:true };
  }
  const t = makeTransport();
  const html = `
    <div style="font-family: Arial,sans-serif;">
      <h2>${subject}</h2>
      <p>${linkText}</p>
      <p><a href="${linkURL}" style="background:#007bff;color:#fff;padding:10px 18px;border-radius:4px;text-decoration:none;">${buttonText}</a></p>
      <p>If the button doesn't work, open: <a href="${linkURL}">${linkURL}</a></p>
      <hr style="margin:24px 0;opacity:.25" />
      <small style="color:#666">If you did not request this, you can ignore this email.</small>
    </div>`;
  try {
    const info = await t.sendMail({ from: '"FadzTrack" <no-reply@fadztrack.com>', to, subject, html });
    if (!isProd) console.log(`[MAIL DEBUG] Sent ${subject} to ${to}. Link: ${linkURL} (msgId=${info.messageId})`);
    return { sent:true };
  } catch (err) {
    console.error('[MAIL ERROR] Failed to send email:', err.message, 'Link:', linkURL);
    return { sent:false, error:err };
  }
}

async function sendTwoFACode(email, code) {
  if (!isProd) console.log(`[2FA DEV] (mailer) ${email}: ${code}`);
  const t = makeTransport();
  const html = `<p>Your FadzTrack 2FA code:</p><p style="font-size:20px;letter-spacing:3px;"><b>${code}</b></p><p>Valid for 5 minutes.</p>`;
  await t.sendMail({ from: '"FadzTrack" <no-reply@fadztrack.com>', to: email, subject: 'Your FadzTrack 2FA Code', html });
}

// ───────────── Users CRUD ─────────────
async function getAllUsers(req, res) {
  try {
    const users = await User.find({}, 'name role phone email status');
    res.json(users);
  } catch (err) {
    res.status(500).json({ msg: 'Failed to get users', err });
  }
}

async function updateUser(req, res) {
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
}

async function updateUserStatus(req, res) {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
    if (!user) return res.status(404).json({ msg: 'User not found' });
    res.json({ msg: 'Status updated', user });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
}

async function deleteUser(req, res) {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ msg: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ msg: 'Failed to delete user', err });
  }
}

// ───────────── Register / Activate / Reset ─────────────
function passwordMeetsPolicy(pw = '') {
  // At least one uppercase letter and one digit (existing min length handled by client or can extend here)
  return /[A-Z]/.test(pw) && /\d/.test(pw) && pw.length >= 6;
}
async function registerUser(req, res) {
  try {
    const { name, email, phone, role } = req.body;

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(400).json({ msg: 'User already exists' });

    const tempPassword = crypto.randomBytes(8).toString('hex');
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    const user = await User.create({
      name, email: email.toLowerCase(), phone, role, password: hashedPassword, status: 'Inactive'
    });

    const activationToken = jwt.sign({ email: user.email }, JWT_SECRET, { expiresIn: '1h' });
  const activationLink = `${FRONTEND_BASE_URL}/activate-account?token=${activationToken}`;

    const mailResult = await sendEmailLink(
      user.email,
      'Activate Your FadzTrack Account',
      'Click below to set your password and activate your account:',
      activationLink,
      'Activate Account'
    );
    if (!isProd) console.log('[ACTIVATION LINK DEBUG]', activationLink);
  res.status(201).json({ msg: mailResult?.sent ? 'Activation link sent to email' : 'Activation link generated', activationLink, emailSent: !!mailResult?.sent, user: { name, email, role, phone } });
  } catch (err) {
    res.status(500).json({ msg: 'Registration failed', err });
  }
}

async function activateAccount(req, res) {
  try {
    const { token, password } = req.body;
    if (!passwordMeetsPolicy(password)) {
      return res.status(400).json({ msg: 'Password must be at least 6 chars and include at least one uppercase letter and one number.' });
    }
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
}

async function resetPasswordRequest(req, res) {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json({ msg: 'Email not found' });

    const resetToken = jwt.sign({ email: user.email }, JWT_SECRET, { expiresIn: '15m' });
  const resetLink = `${FRONTEND_BASE_URL}/reset-password?token=${resetToken}`;

    const mailResult = await sendEmailLink(
      user.email,
      'Reset Your Password',
      'Click below to reset your password:',
      resetLink,
      'Reset Password'
    );
    if (!isProd) console.log('[RESET LINK DEBUG]', resetLink);
  res.json({ msg: mailResult?.sent ? 'Password reset link sent to email' : 'Password reset link generated', resetLink, emailSent: !!mailResult?.sent });
  } catch (err) {
    res.status(500).json({ msg: 'Failed to send reset email' });
  }
}

async function resetPassword(req, res) {
  try {
    const { token, newPassword } = req.body;
    if (!passwordMeetsPolicy(newPassword)) {
      return res.status(400).json({ msg: 'Password must be at least 6 chars and include at least one uppercase letter and one number.' });
    }
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findOne({ email: decoded.email });
    if (!user) return res.status(404).json({ msg: 'User not found' });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.json({ msg: 'Password reset successful' });
  } catch (err) {
    res.status(400).json({ msg: 'Invalid or expired token' });
  }
}

// ───────────── Login / 2FA / Refresh / Logout ─────────────
async function loginUser(req, res) {
  try {
    const { email, password } = req.body || {};
    const user = await User.findOne({ email: (email || '').toLowerCase() });
    if (!user) return res.status(400).json({ msg: 'Invalid credentials' });
    if (user.status !== 'Active') return res.status(403).json({ msg: 'Your account is inactive. Please contact support.' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ msg: 'Invalid credentials' });

    // ✅ Check trusted-device cookie
    const rawTrust = req.cookies?.[TRUST_COOKIE];
    if (rawTrust) {
      const uaHashNow = sha256(stableUA(req.headers['user-agent'] || ''));
      const ipNow     = ipFirstOctet(req);

      const rec = await TrustedDevice.findOne({
        tokenHash: sha256(rawTrust),
        userId: user._id,
      });

      const ok =
        rec &&
        rec.expiresAt > new Date() &&
        rec.uaHash === uaHashNow &&
        (!rec.ipPrefix || rec.ipPrefix === ipNow);

      if (ok) {
        // sliding window
        rec.expiresAt = new Date(Date.now() + TRUST_TTL_SEC * 1000);
        await rec.save();
        setTrustCookie(req, res, rawTrust);

        // Issue tokens now — no 2FA
        const accessToken  = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET,  { expiresIn: `${ACCESS_TTL_SEC}s` });
        const refreshToken = jwt.sign(
  { id: user._id, role: user.role, tv: user.tokenVersion, long: 1 },
  REFRESH_SECRET,
  { expiresIn: `${REFRESH_TTL_SEC}s` }
);
setRefreshCookie(req, res, refreshToken, REFRESH_TTL_SEC);

        await logAction({
          action: 'login_trusted',
          performedBy: user._id,
          performedByRole: user.role,
          description: `${user.name} (${user.email}) logged in (trusted device).`,
          meta: { ip: req.ip, userAgent: req.headers['user-agent'] }
        });

        return res.json({
          requires2FA: false,
          accessToken,
          user: { id: user._id, email: user.email, name: user.name, role: user.role, status: user.status }
        });
      }
    }

    // ❗ Not trusted → send 2FA
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
}

async function verify2FACode(req, res) {
  try {
    const { email, code, rememberDevice } = req.body;

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

    // ✅ Issue tokens
const accessToken  = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: `${ACCESS_TTL_SEC}s` });
    // If user clicked “remember”, give 30d; otherwise a shorter baseline (7d).
    const SHORT_REFRESH = 7 * 24 * 60 * 60; // 7d
   const refreshTtlSec = rememberDevice ? REFRESH_TTL_SEC : SHORT_REFRESH;
const refreshToken  = jwt.sign(
  { id: user._id, role: user.role, tv: user.tokenVersion, long: rememberDevice ? 1 : 0 },
      REFRESH_SECRET,
      { expiresIn: `${refreshTtlSec}s` }
    );
    setRefreshCookie(req, res, refreshToken, refreshTtlSec);

    // ✅ Create trusted device + cookie if requested
    if (rememberDevice) {
      const rawToken = crypto.randomBytes(48).toString('hex'); // only hash is stored
      await TrustedDevice.create({
        userId:    user._id,
        tokenHash: sha256(rawToken),
        uaHash:    sha256(stableUA(req.headers['user-agent'] || '')),
        ipPrefix:  ipFirstOctet(req), // consider '' to disable IP pinning if mobility is common
        expiresAt: new Date(Date.now() + TRUST_TTL_SEC * 1000),
      });
      setTrustCookie(req, res, rawToken);
    }

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
}

async function resend2FACode(req, res) {
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
}

async function refreshToken(req, res) {
  const token = req.cookies?.refreshToken;
  if (!token) return res.status(401).json({ msg: 'No refresh token' });

  try {
    const decoded = jwt.verify(token, REFRESH_SECRET); // { id, role, tv }
    const user = await User.findById(decoded.id).select('role tokenVersion');
    if (!user) return res.status(401).json({ msg: 'User not found' });
    if (decoded.tv !== user.tokenVersion) return res.status(401).json({ msg: 'Refresh revoked' });

   
   // rotate refresh; keep original lifetime type (short vs long)
const isLong = !!decoded.long;
const baseTtl = isLong ? REFRESH_TTL_SEC : SHORT_REFRESH;
const newRefresh = jwt.sign(
  { id: user._id, role: user.role, tv: user.tokenVersion, long: isLong ? 1 : 0 },
  REFRESH_SECRET,
  { expiresIn: `${baseTtl}s` }
);
setRefreshCookie(req, res, newRefresh, baseTtl);

    const accessToken = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: `${ACCESS_TTL_SEC}s` });
    return res.json({ accessToken });
  } catch (err) {
    return res.status(401).json({ msg: 'Invalid refresh token' });
  }
}

async function logoutUser(req, res) {
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
  clearRefreshCookie(req, res);
  res.json({ msg: 'Logged out successfully' });
}

// ───────────── Trusted devices endpoints ─────────────
async function listTrustedDevices(req, res) {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) return res.status(401).json({ msg: 'Unauthorized' });

    const items = await TrustedDevice.find({ userId }).sort({ createdAt: -1 }).select('-tokenHash');
    res.json(items);
  } catch (err) {
    res.status(500).json({ msg: 'Failed to list trusted devices' });
  }
}

async function revokeTrustedDevices(req, res) {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) return res.status(401).json({ msg: 'Unauthorized' });

    const { all, ids } = req.body || {};
    if (all) {
      await TrustedDevice.deleteMany({ userId });
      clearTrustCookie(req, res);
      return res.json({ msg: 'All trusted devices revoked' });
    }

    if (Array.isArray(ids) && ids.length) {
      await TrustedDevice.deleteMany({ userId, _id: { $in: ids } });
      clearTrustCookie(req, res);
      return res.json({ msg: 'Selected trusted devices revoked' });
    }

    return res.status(400).json({ msg: 'Specify { all: true } or { ids: [...] }' });
  } catch (err) {
    res.status(500).json({ msg: 'Failed to revoke trusted devices' });
  }
}

// ───────────── Email check endpoint ─────────────
async function checkEmailExists(req, res) {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ msg: 'Email is required' });
    }

    // Check if user exists with this email
    const user = await User.findOne({ email: email.toLowerCase() });
    
    // Return whether the email exists (without revealing if it's a valid account)
    res.json({ exists: !!user });
  } catch (err) {
    console.error('Error checking email existence:', err);
    res.status(500).json({ msg: 'Failed to check email' });
  }
}

// ───────────── Export ─────────────
module.exports = {
  // Users CRUD
  getAllUsers,
  updateUser,
  updateUserStatus,
  deleteUser,

  // Register / Activate / Reset
  registerUser,
  activateAccount,
  resetPasswordRequest,
  resetPassword,

  // Login / 2FA / Refresh / Logout
  loginUser,
  verify2FACode,
  resend2FACode,
  refreshToken,
  logoutUser,

  // Trusted devices
  listTrustedDevices,
  revokeTrustedDevices,
  checkEmailExists,
};
