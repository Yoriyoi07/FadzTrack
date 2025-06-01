const mongoose = require('mongoose');

const dailyReportSchema = new mongoose.Schema({
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, required: true },
  siteAttendance: [{
    manpower: { type: mongoose.Schema.Types.ObjectId, ref: 'Manpower' },
    status: { type: String, enum: ['Present', 'Absent', 'Late'], required: true }
  }],
  materialDeliveries: [{
    delivery: { type: mongoose.Schema.Types.ObjectId, ref: 'MaterialRequest' },
    status: { type: String, enum: ['Received', 'Pending', 'Rejected'], required: true }
  }],
  workPerformed: [{
    task: { type: String, required: true },
    status: { type: String, enum: ['Completed', 'In Progress', 'Not Started'], required: true },
    remarks: String
  }],
  weatherCondition: { type: String, required: true },
  remarks: String
}, {
  timestamps: true
});

module.exports = mongoose.model('DailyReport', dailyReportSchema); 