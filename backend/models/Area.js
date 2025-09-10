const mongoose = require('mongoose');

// Simple Area model: name (required, unique-ish), optional description, areaManager ref
const areaSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  areaManager: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  // Soft delete flags (future‑proof)
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

areaSchema.index({ name: 1 }, { unique: false });
areaSchema.index({ areaManager: 1 });

module.exports = mongoose.model('Area', areaSchema);