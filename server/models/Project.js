const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
    projectName: { type: String, required: true },
    pic: String,
    projectmanager: String,
    contractor: String,
    budget: Number,
    location: String,
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    manpower: String},{
    timestamps: true
  });
  

module.exports = mongoose.model('Project', projectSchema);
