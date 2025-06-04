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
  status: { type: String, default: 'Pending' },
  approvedBy: { type: String, default: '' }, 
  received: { type: Boolean, default: false },
  returnDate: { type: Date },
  manpowerProvided: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Manpower' }],
}, { timestamps: true });

module.exports = mongoose.model('ManpowerRequest', manpowerRequestSchema);