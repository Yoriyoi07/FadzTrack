const mongoose = require('mongoose');

const manpowerRequestSchema = new mongoose.Schema({
  requestTitle: { type: String, required: true },
  projectLocation: { type: String, required: true },
  manpowerType: { type: String, required: true },
  manpowerQuantity: { type: String, required: true },
  description: { type: String, required: true },
  attachments: [String] // Store filenames if you're using file upload
}, { timestamps: true });

module.exports = mongoose.model('ManpowerRequest', manpowerRequestSchema);
