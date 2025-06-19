const mongoose = require('mongoose');

const materialSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  unit: String,
});

module.exports = mongoose.model('Material', materialSchema);
