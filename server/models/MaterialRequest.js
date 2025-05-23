const mongoose = require('mongoose');

const MaterialRequestSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User',
  },
  requestTitle: {
    type: String,
    required: true,
  },
  materials: {
    type: String,
    required: true,
  },
  description: {
    type: String,
  },
  attachmentURLs: {
    type: [String],
    default: [],
  },
  picUsername: {
    type: String,
    required: true,
  },
  projectManagerStatus: {
    type: String,
    enum: ['pending', 'approved', 'denied'],
    default: 'pending',
  },
  areaManagerStatus: {
    type: String,
    enum: ['pending', 'approved', 'denied'],
    default: 'pending',
  },
  ceoStatus: {
    type: String,
    enum: ['pending', 'approved', 'denied'],
    default: 'pending',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('MaterialRequest', MaterialRequestSchema);