const User = require('../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

// Temporary in-memory store for 2FA codes
const twoFACodes = {};

exports.getAllUsers = async (req, res) => {
  try { 
    const users = await User.find();
    res.json(users);
  } catch (err) {
    res.status(500).json({ msg: 'Failed to get users', err });
  }
};

exports.registerUser = async (req, res) => {
  try {
    const { name, email, phone, role, password } = req.body;

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ msg: 'User already exists' });

    const newUser = new User({
      name,
      email,
      phone,
      role,
      password 
    });

    await newUser.save();
    res.status(201).json({ msg: 'User registered!' });
  } catch (err) {
    res.status(500).json({ msg: 'Error registering user', err });
  }
};

exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ msg: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ msg: 'Invalid credentials' });

    // Generate a 6-digit 2FA code, valid for 5 minutes
    const twoFACode = Math.floor(100000 + Math.random() * 900000).toString();
    twoFACodes[email] = { code: twoFACode, expires: Date.now() + 5 * 60 * 1000 };

    await sendTwoFACode(email, twoFACode);

    res.json({
      msg: '2FA code sent to email',
      requires2FA: true,
      user: { id: user._id, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error('Login error', err);
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
    if (record.code !== code) {
      return res.status(400).json({ msg: 'Invalid 2FA code' });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ msg: 'User not found' });

    const accessToken = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' });

    delete twoFACodes[email];

    res
      .cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000
      })
      .json({ accessToken, user: { id: user._id, email: user.email, role: user.role } });

  } catch (err) {
    res.status(500).json({ msg: '2FA verification error', err });
  }
};


exports.refreshToken = (req, res) => {
  const token = req.cookies.refreshToken;
  if (!token) return res.status(401).json({ msg: 'No refresh token' });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ msg: 'Invalid refresh token' });

    const accessToken = jwt.sign({ id: decoded.id }, JWT_SECRET, { expiresIn: '15m' });
    res.json({ accessToken });
  });
};

exports.logoutUser = (req, res) => {
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/'
  });
  res.json({ msg: 'Logged out successfully' });
};

// Sends the 2FA code to user's email using nodemailer
async function sendTwoFACode(email, code) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  const mailOptions = {
    from: '"FadzTrack" <no-reply@fadztrack.com>',
    to: email,
    subject: 'Your FadzTrack 2FA Code',
    text: `Your 2FA code is: ${code}`
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('2FA email sent:', info.response);
  } catch (error) {
    console.error('Error sending 2FA email:', error);
  }
}