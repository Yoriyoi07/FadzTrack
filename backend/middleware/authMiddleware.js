const jwt = require('jsonwebtoken');
const User = require('../models/User');
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

exports.verifyToken = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token, auth denied' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id).select('name role');
    if (!user) return res.status(401).json({ message: 'User not found' });
    req.user = { id: user._id, name: user.name, role: user.role };
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Token not valid' });
  }
};

