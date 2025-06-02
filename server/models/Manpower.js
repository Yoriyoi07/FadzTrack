const mongoose = require('mongoose');

const manpowerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  position: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Inactive'
  },
  avatar: {
    type: String,
    default: ''
  },
  assignedProject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    default: null
  }
}, { timestamps: true });

module.exports = mongoose.model('Manpower', manpowerSchema);
