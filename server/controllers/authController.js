const User = require('../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const crypto = require('crypto');


const plainPassword = '12345678'; // The password you're testing
const storedHash = '$2b$10$dBb6f9.sopXKgwhynOHXSOG9OHIyTROgwGESeibpcJUvbZyTSxPrm';  // The stored hashed password from your database

const testPassword = async () => {
  const match = await bcrypt.compare(plainPassword, storedHash);
};

testPassword();

// Load JWT secret from environment 
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';
const twoFACodes = {};


// Get all users
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}, 'name role phone email status'); 
    res.json(users);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ msg: 'Failed to get users', err });
  }
};


// UPDATE user
exports.updateUser = async (req, res) => {
  try {
    const userId = req.params.id;
    const updateData = { ...req.body };

    // If a password is provided, hash it before updating
    if (updateData.password) {
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(updateData.password, salt);
    } else {
      // Prevent overwriting the password with an empty string
      delete updateData.password;
    }

    const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
      new: true,            // Return the updated document
      runValidators: true,  // Validate the data
      timestamps: true      // Update createdAt and updatedAt
    });

    if (!updatedUser) {
      return res.status(404).json({ msg: 'User not found' });
    }

    res.json({ msg: 'User updated successfully', user: updatedUser });
  } catch (err) {
    console.error('Error updating user:', err);
    res.status(500).json({ msg: 'Failed to update user', err });
  }
};

exports.updateUserStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    const user = await User.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!user) return res.status(404).json({ msg: 'User not found' });

    res.json({ msg: 'Status updated', user });
  } catch (error) {
    console.error('Error updating user status:', error);
    res.status(500).json({ msg: 'Server error' });
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
    const { name, email, phone, role } = req.body;

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ msg: 'User already exists' });

    // Generate random temp password and hash it
    const tempPassword = crypto.randomBytes(8).toString('hex');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(tempPassword, salt);

    const user = new User({
      name,
      email,
      phone,
      role,
      password: hashedPassword,
      status: 'Inactive'
    });

    await user.save();

    const activationToken = jwt.sign({ email }, JWT_SECRET, { expiresIn: '1h' });
    const activationLink = `http://localhost:3000/activate-account?token=${activationToken}`;

    await sendEmailLink(email, 'Activate Your FadzTrack Account', 'Click below to set your password and activate your account:', activationLink);

    res.status(201).json({ msg: 'Activation link sent to email', user: { name, email, role, phone } });
  } catch (err) {
    console.error('Error registering user:', err);
    res.status(500).json({ msg: 'Registration failed', err });
  }
};


exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    if (user.status !== 'Active') {
      console.log('User inactive');
      return res.status(403).json({ msg: 'Your account is inactive. Please contact support.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    // Generate a random 6-digit 2FA code
    const twoFACode = Math.floor(100000 + Math.random() * 900000).toString();

    // Store 2FA code with 5-minute expiration
    twoFACodes[email] = {
      code: twoFACode,
      expires: Date.now() + 5 * 60 * 1000
    };

    // Send 2FA code to user's email
    await sendTwoFACode(email, twoFACode);
    console.log(twoFACode)
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

async function sendEmailLink(to, subject, linkText, linkURL) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  const mailOptions = {
    from: '"FadzTrack" <no-reply@fadztrack.com>',
    to,
    subject,
    html: `<p>${linkText}</p><a href="${linkURL}">${linkURL}</a>`
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`${subject} email sent to`, to);
  } catch (err) {
    console.error('Error sending email:', err);
  }
}

exports.activateAccount = async (req, res) => {
  try {
    const { token, password } = req.body;

    // Decode the token to get the email
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findOne({ email: decoded.email });

    if (!user) return res.status(404).json({ msg: 'User not found' });

    // Check if the user is already active
    if (user.status === 'Active') {
      return res.status(400).json({ msg: 'Account already activated' });
    }

    // Hash the entered password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);


    // Replace the original hash with the new user-entered password
    user.password = hashedPassword;
    user.status = 'Active';
    await user.save();

    res.json({ msg: 'Account activated successfully' });
  } catch (err) {
    console.error('Activation error:', err);
    res.status(400).json({ msg: 'Invalid or expired token' });
  }
};



exports.resetPasswordRequest = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ msg: 'Email not found' });

    const resetToken = jwt.sign({ email }, JWT_SECRET, { expiresIn: '15m' });
    const resetLink = `http://localhost:3000/reset-password?token=${resetToken}`;

    await sendEmailLink(email, 'Reset Your Password', 'Click below to reset your password:', resetLink);

    res.json({ msg: 'Password reset link sent to email' });
  } catch (err) {
    console.error('Reset request error:', err);
    res.status(500).json({ msg: 'Failed to send reset email' });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    const decoded = jwt.verify(token, JWT_SECRET);

    const user = await User.findOne({ email: decoded.email });
    if (!user) return res.status(404).json({ msg: 'User not found' });

    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(newPassword, salt);
    user.password = hashed;
    await user.save();

    res.json({ msg: 'Password reset successful' });
  } catch (err) {
    console.error('Reset error:', err);
    res.status(400).json({ msg: 'Invalid or expired token' });
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
    const accessToken = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    // Clear used 2FA code
    delete twoFACodes[email];

    // Send tokens to client, set refresh token as HTTP-only cookie
    res
      .cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      })
      .json({
        accessToken,
        user: { id: user._id, email: user.email,  name: user.name,role: user.role ,status: user.status }
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
    const accessToken = jwt.sign({ id: decoded.id, role: decoded.role }, JWT_SECRET, { expiresIn: '15m' });
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
console.log(code);
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('2FA email sent:', info.response);
  } catch (error) {
    console.error('Error sending 2FA email:', error);
  }
}

exports.resend2FACode = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ msg: 'User not found' });

    const twoFACode = Math.floor(100000 + Math.random() * 900000).toString();
    console.log(`Resent 2FA Code for ${email}: ${twoFACode}`);

    twoFACodes[email] = {
      code: twoFACode,
      expires: Date.now() + 5 * 60 * 1000
    };

    // ✅ Reuse email function
    await sendTwoFACode(email, twoFACode);

    res.status(200).json({ msg: '2FA code resent' });
  } catch (error) {
    console.error('Error resending 2FA code:', error);
    res.status(500).json({ msg: 'Error resending 2FA code' });
  }
};
