const mongoose = require('mongoose');

const manpowerRequestSchema = new mongoose.Schema({
  acquisitionDate: { type: Date, required: true },
  duration: { type: Number, required: true },
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  manpowers: [{
    type: { type: String, required: true },
    quantity: { type: Number, required: true }
  }],
  description: { type: String, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { 
    type: String, 
    enum: ['Pending', 'Approved', 'Overdue', 'Completed', 'Archived'], 
    default: 'Pending' 
  },
  isArchived: { type: Boolean, default: false },
  archivedReason: { type: String, default: '' },
  approvedBy: { type: String, default: '' }, 
  received: { type: Boolean, default: false },
  returnDate: { type: Date },
  manpowerProvided: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Manpower' }],
  area: { type: String, default: '' },
  
  // Fields to preserve original information when archived
  originalProjectName: { type: String, default: '' },
  originalProjectEndDate: { type: Date },
  originalRequestStatus: { type: String, default: '' },
  originalRequestDetails: {
    description: { type: String, default: '' },
    acquisitionDate: { type: Date },
    duration: { type: Number },
    manpowers: [{
      type: { type: String },
      quantity: { type: Number }
    }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedBy: { type: String, default: '' },
    received: { type: Boolean, default: false },
    returnDate: { type: Date },
    manpowerProvided: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Manpower' }],
    area: { type: String, default: '' }
  }
}, { timestamps: true });

module.exports = mongoose.model('ManpowerRequest', manpowerRequestSchema);