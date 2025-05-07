const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
    projectName: { type: String, required: true },
    designStyle: String,
    contractor: String,
    architectDesigner: String,
    location: String,
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    manpower: String
  });
  

module.exports = mongoose.model('Project', projectSchema);
