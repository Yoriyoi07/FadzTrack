// models/MaterialRequest.js
const mongoose = require('mongoose');

const materialRequestSchema = new mongoose.Schema({
  material: { type: String, required: true },
  quantity: { type: String, required: true },
  description: { type: String, required: true },
  attachments: [{ type: String }]
}, { timestamps: true });

module.exports = mongoose.model('MaterialRequest', materialRequestSchema);
