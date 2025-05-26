const mongoose = require('mongoose');

const manpowerSchema = new mongoose.Schema({
  name: String,
  position: String,
  status: String,
  project: String,
  avatar: String
}, { timestamps: true });

module.exports = mongoose.model('Manpower', manpowerSchema);
