const mongoose = require('mongoose');
const AutoIncrement = require('mongoose-sequence')(mongoose);

const MaterialSchema = new mongoose.Schema({
  materialName: { type: String, required: true },
  quantity: { type: String, required: true },
  unit: { type: String, required: true },
});

const materialRequestSchema = new mongoose.Schema({
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  materials: [MaterialSchema],
  description: { type: String, required: true },
  attachments: [String],
  status: {
    type: String,
    enum: [
      'Pending Project Manager', 'Denied by Project Manager', 'Pending Area Manager',
      'Denied by Area Manager', 'Approved'
    ],
    default: 'Pending Project Manager'
  },
  approvals: [
    {
      role: { type: String, enum: ['Project Manager', 'Area Manager'] },
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      decision: { type: String, enum: ['approved', 'denied'] },
      reason: String,
      timestamp: { type: Date, default: Date.now }
    }
  ],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  receivedByPIC: { type: Boolean, default: false },
  // CEO fields removed from workflow; keep optional legacy fields if existing docs have them
  purchaseOrder: { type: String },
  totalValue: { type: Number },
  receivedDate: { type: Date },
  receivedAt: { type: Date },
  receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // ADD THIS FIELD FOR NUDGE COOLDOWN!
  lastNudges: [
  {
    pic: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    to: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, 
    role: { type: String },
    timestamp: { type: Date }
  }
]


}, {
  timestamps: true
});



// Attach the plugin here (AFTER schema, BEFORE model export)
materialRequestSchema.plugin(AutoIncrement, { inc_field: 'requestNumber' });

// Export the model
module.exports = mongoose.model('MaterialRequest', materialRequestSchema);
