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
  attachments: [String],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('ManpowerRequest', manpowerRequestSchema);
