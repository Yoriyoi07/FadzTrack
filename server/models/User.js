const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  role: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  status: { type: String, default: 'Active' },
  locations: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Location' }],
}, {
  timestamps: true  
});


module.exports = mongoose.model('User', userSchema);
