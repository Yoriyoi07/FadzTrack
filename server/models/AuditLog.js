const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  action: { type: String, required: true }, 
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  performedByRole: { type: String, required: true }, 
  description: { type: String }, 
  meta: { type: Object },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AuditLog', auditLogSchema);
