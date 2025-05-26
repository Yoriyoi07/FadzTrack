const mongoose = require('mongoose');
const AutoIncrement = require('mongoose-sequence')(mongoose);

const MaterialSchema = new mongoose.Schema({
  materialName: { type: String, required: true },
  quantity: { type: String, required: true }
});

const materialRequestSchema = new mongoose.Schema({
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  materials: [MaterialSchema],
  description: { type: String, required: true },
  attachments: [String],
  status: {
    type: String,
    enum: ['Pending PM', 'Denied by PM', 'Pending AM', 'Denied by AM', 'Pending CEO', 'Denied by CEO', 'Approved'],
    default: 'Pending PM'
  },
  approvals: [
    {
      role: { type: String, enum: ['PM', 'AM', 'CEO'] },
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      decision: { type: String, enum: ['approved', 'denied'] },
      reason: String,
      timestamp: { type: Date, default: Date.now }
    }
  ],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps: true
});

// Attach the plugin here (AFTER schema, BEFORE model export)
materialRequestSchema.plugin(AutoIncrement, { inc_field: 'requestNumber' });

// Export the model
module.exports = mongoose.model('MaterialRequest', materialRequestSchema);
