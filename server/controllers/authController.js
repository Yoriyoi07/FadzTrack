const User = require('../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

// Load JWT secret from environment 
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';
const twoFACodes = {};


// Get all users
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}, 'name role phone email'); 
    res.json(users);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ msg: 'Failed to get users', err });
  }
};


// UPDATE user
exports.updateUser = async (req, res) => {
  try {
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(updatedUser);
  } catch (err) {
    res.status(500).json({ msg: 'Failed to update user', err });
  }
};

// DELETE user
exports.deleteUser = async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ msg: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ msg: 'Failed to delete user', err });
  }
};


exports.registerUser = async (req, res) => {
  try {
    const { name, email, phone, role, password } = req.body;

    // Check if email already exists
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ msg: 'User already exists' });

    // Hash the password before saving
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create a new user document with Active status
    const newUser = new User({
      name,
      email,
      phone,
      role,
      password: hashedPassword,
      status: 'Active' // Automatically set status to Active
    });

    // Save the user to the database
    await newUser.save();

    res.status(201).json({ msg: 'User registered successfully', user: newUser });
  } catch (err) {
    console.error('Error registering user', err);
    res.status(500).json({ msg: 'Error registering user', err });
  }
};

exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ msg: 'Invalid credentials' });

    // Compare hashed passwords
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ msg: 'Invalid credentials' });

    // Generate a random 6-digit 2FA code
    const twoFACode = Math.floor(100000 + Math.random() * 900000).toString();

    // Store 2FA code with 5-minute expiration
    twoFACodes[email] = {
      code: twoFACode,
      expires: Date.now() + 5 * 60 * 1000
    };

    // Send 2FA code to user's email
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


//Verify the submitted 2FA code and generate tokens

exports.verify2FACode = async (req, res) => {
  try {
    const { email, code } = req.body;
    const record = twoFACodes[email];

    // Ensure a code was requested and not expired
    if (!record) return res.status(400).json({ msg: 'No 2FA code requested' });
    if (Date.now() > record.expires) {
      delete twoFACodes[email];
      return res.status(400).json({ msg: '2FA code expired' });
    }

    // Validate the submitted 2FA code
    if (record.code !== code) {
      return res.status(400).json({ msg: 'Invalid 2FA code' });
    }

    // Fetch user to create tokens
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ msg: 'User not found' });

    // Generate access and refresh tokens
    const accessToken = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' });

    // Clear used 2FA code
    delete twoFACodes[email];

    // Send tokens to client, set refresh token as HTTP-only cookie
    res
      .cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      })
      .json({
        accessToken,
        user: { id: user._id, email: user.email, role: user.role }
      });
  } catch (err) {
    res.status(500).json({ msg: '2FA verification error', err });
  }
};


  //Issue a new access token using a valid refresh token

exports.refreshToken = (req, res) => {
  const token = req.cookies.refreshToken;

  if (!token) return res.status(401).json({ msg: 'No refresh token' });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ msg: 'Invalid refresh token' });

    // Generate new short-lived access token
    const accessToken = jwt.sign({ id: decoded.id }, JWT_SECRET, { expiresIn: '15m' });
    res.json({ accessToken });
  });
};


 //Clears the refresh token cookie and logs the user out
 
exports.logoutUser = (req, res) => {
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/'
  });
  res.json({ msg: 'Logged out successfully' });
};


 //Sends a 2FA code via email using Nodemailer
 
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
