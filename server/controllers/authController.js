const User = require('../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';
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

    console.log("Registering with password:", password);
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


// exports.loginUser = async (req, res) => {
//   try {
//     const { email, password } = req.body;
//     console.log('Login attempt:', email, password);

//     const user = await User.findOne({ email });
//     if (!user) {
//       console.log('User not found');
//       return res.status(400).json({ msg: 'Invalid credentials' });
//     }

//     console.log('User found:', user);

//     if (user.password !== password) {
//       console.log('Password mismatch', user.password, password);
//       return res.status(400).json({ msg: 'Invalid credentials' });
//     }

//     const twoFACode = Math.floor(100000 + Math.random() * 900000).toString();
//     twoFACodes[email] = { code: twoFACode, expires: Date.now() + 5 * 60 * 1000 };

//     await sendTwoFACode(email, twoFACode);

//     res.json({ msg: '2FA code sent to email', requires2FA: true, user: { id: user._id, email: user.email, role: user.role } });
//   } catch (err) {
//     console.error('Login error', err);
//     res.status(500).json({ msg: 'Login error', err });
//   }
// };

exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('Login attempt:', email, password);

    const user = await User.findOne({ email });

    if (!user) {
      console.log('User not found');
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    console.log('User from DB:', user);
    console.log('Stored hash:', user.password);
    console.log('Password entered:', password);

    const isMatch = await bcrypt.compare(password, user.password);
    console.log('Password match:', isMatch);

    if (!isMatch) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

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

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '1h' });

    delete twoFACodes[email];

    res.json({ token, user: { id: user._id, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ msg: 'Verification error', err });
  }
};

// Send 2FA code via email
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

  await transporter.sendMail(mailOptions);
}
