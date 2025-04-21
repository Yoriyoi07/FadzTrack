const User = require('../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

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
    const { email, password } = req.body;

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ msg: 'User already exists' });

    const newUser = new User({ email, password });
    await newUser.save();

    res.status(201).json({ msg: 'User registered!' });
  } catch (err) {
    res.status(500).json({ msg: 'Error registering user', err });
  }
};

/* exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ msg: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ msg: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ token, user: { id: user._id, email: user.email ,role: user.role} });
  } catch (err) {
    res.status(500).json({ msg: 'Login error', err });
  }
};
 */

exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('➡️ Incoming login request:', { email, password });

    const user = await User.findOne({ email });

    if (!user) {
      console.log('❌ User not found');
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    console.log('🧾 Found user in DB:', user);

    if (password !== user.password) {
      console.log('❌ Password does not match');
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ token, user: { id: user._id, email: user.email, role: user.role } });

  } catch (err) {
    console.error('🔥 Login error:', err);
    res.status(500).json({ msg: 'Login error', err });
  }
};

