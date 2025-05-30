// middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

exports.verifyToken = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token, auth denied' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // Option 1: Attach id directly from JWT (if your payload contains user id)
    req.user = { id: decoded.id, name: decoded.name, role: decoded.role };
    // Option 2: Or fetch user from DB if needed
    // req.user = await User.findById(decoded.id);
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Token not valid' });
  }
};
