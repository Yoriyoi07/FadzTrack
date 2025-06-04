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

// Method to calculate progress data
dailyReportSchema.methods.calculateProgress = function() {
  const totalTasks = this.workPerformed.length;
  if (totalTasks === 0) return null;

  const progress = {
    completed: 0,
    inProgress: 0,
    notStarted: 0
  };

  this.workPerformed.forEach(work => {
    switch (work.status) {
      case 'Completed':
        progress.completed++;
        break;
      case 'In Progress':
        progress.inProgress++;
        break;
      case 'Not Started':
        progress.notStarted++;
        break;
    }
  });

  return {
    name: 'Project Progress',
    progress: [
      { name: 'Completed', value: (progress.completed / totalTasks) * 100, color: '#4CAF50' },
      { name: 'In Progress', value: (progress.inProgress / totalTasks) * 100, color: '#5E4FDB' },
      { name: 'Not Started', value: (progress.notStarted / totalTasks) * 100, color: '#FF6B6B' }
    ]
  };
};

module.exports = mongoose.model('DailyReport', dailyReportSchema); 