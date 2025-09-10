const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const rememberedDeviceSchema = new mongoose.Schema({
  tokenHash: { type: String, required: true }, // sha256 of raw token
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  userAgent: String,
  ip: String,
});

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  role: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  // Legacy combined status (kept for backward compatibility). Avoid using directly in new code.
  status: { type: String, default: 'Active' },
  // New: split account vs presence status
  accountStatus: { type: String, enum: ['Active','Inactive'], default: 'Active' },
  presenceStatus: { type: String, enum: ['online','offline'], default: 'offline' },
  locations: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Location' }],
  tokenVersion: { type: Number, default: 0 },
  rememberedDevices: [rememberedDeviceSchema],
}, {
  timestamps: true  
}); 

// Valid roles: 'Admin', 'CEO', 'IT', 'HR', 'HR - Site', 'PIC', 'Person in Charge', 'Project Manager', 'Area Manager', 'Staff'
module.exports = mongoose.model('User', userSchema);
