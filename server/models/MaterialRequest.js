const mongoose = require('mongoose');

const MaterialSchema = new mongoose.Schema({
  materialName: { type: String, required: true },
  quantity: { type: String, required: true }
});

const MaterialRequestSchema = new mongoose.Schema({
  materials: [MaterialSchema],
  description: { type: String, required: true },
  attachments: [String], // Array of file names
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('MaterialRequest', MaterialRequestSchema);
