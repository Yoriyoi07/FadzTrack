const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  projectName: { type: String, required: true },
  pic: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  projectmanager: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  areamanager: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  contractor: String,
  budget: Number,
  location: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  manpower: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Manpower' }],
  tasks: [
    {
      name: { type: String, required: true },
      percent: { type: Number, required: true }
    }
  ]
}, {
  timestamps: true
});

module.exports = mongoose.model('Project', projectSchema);
