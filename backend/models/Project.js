// models/Project.js
const mongoose = require('mongoose');

/* ---------------- Shared subdocs ---------------- */
const attachmentSchema = new mongoose.Schema({
  path: String,   // Supabase storage path
  name: String    // Original filename
}, { _id: false });

const replySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userName: String,
  text: String,
  timestamp: Date,
  attachments: [attachmentSchema]
}, { _id: true });

const discussionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userName: String,
  text: String,
  timestamp: Date,
  attachments: [attachmentSchema],
  replies: [replySchema],
  label: { 
    type: String, 
    enum: ['', 'Important', 'Announcement', 'Update', 'Reminder', 'Urgent'], 
    default: '' 
  }
}, { _id: true });

/* ---------------- AI (reports) schemas ---------------- */
// ONE CPA row with all AI fields you generate/store
const cpaSchema = new mongoose.Schema({
  path_type: { type: String, enum: ['optimistic', 'realistic', 'pessimistic'] }, // <-- keep
  name: { type: String, default: '' },
  estimated_days: { type: Number },                                              // <-- keep
  assumptions: [{ type: String }],                                               // <-- keep
  blockers: [{ type: String }],
  risk: { type: String, default: '' },
  next: [{ type: String }]
}, { _id: false });

const aiSchema = new mongoose.Schema({
  summary_of_work_done: [{ type: String }],
  completed_tasks: [{ type: String }],
  critical_path_analysis: { type: [cpaSchema], default: [] },                    // <-- typed CPA rows
  pic_performance_evaluation: {
    text: { type: String, default: '' },
    score: { type: Number }
  },
  pic_contribution_percent: { type: Number },
  confidence: { type: Number }
}, { _id: false });

/** Reports kept separate from documents */
// models/Project.js  (only the reportSchema 'ai' line changed)
const reportSchema = new mongoose.Schema({
  name: String,
  path: String,
  jsonPath: String,
  pdfPath: String,
  status: { type: String, enum: ['pending', 'ready', 'failed'], default: 'pending' },
  error: String,

  // HOTFIX: allow any AI shape, so old reports won't 500 on read
  ai: { type: mongoose.Schema.Types.Mixed },

  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  uploadedByName: String,
  uploadedAt: Date
}, { _id: true });

/* ---------------- Project ---------------- */
const projectSchema = new mongoose.Schema({
  projectName: { type: String, required: true },
  pic: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  staff: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  hrsite: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  projectmanager: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  areamanager: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  contractor: String,
  budget: Number,
  photos: [String],

  // Files tab (legacy + new style)
  documents: [{ type: mongoose.Schema.Types.Mixed }],

  // Reports tab (AI)
  reports: [reportSchema],
  // Attendance generated Excel outputs
  attendanceReports: [{
    originalName: String,
    inputPath: String,     // stored raw uploaded schedule file path
    outputPath: String,    // generated attendance workbook path
    generatedAt: Date,
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    uploadedByName: String,  // name of user who uploaded the attendance file
    ai: mongoose.Schema.Types.Mixed
  }],

  location: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  manpower: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Manpower' }],
  tasks: [{ name: { type: String, required: true }, percent: { type: Number, required: true } }],
  status: { type: String, enum: ['Ongoing', 'Completed', 'Archived', 'Cancelled'], default: 'Ongoing' },
  
  // Soft delete fields
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  deletionReason: { type: String, default: '' },

  discussions: [discussionSchema]
}, { timestamps: true });

projectSchema.index({ status: 1 });
projectSchema.index({ pic: 1 });
projectSchema.index({ staff: 1 });
projectSchema.index({ hrsite: 1 });
projectSchema.index({ projectmanager: 1 });
projectSchema.index({ areamanager: 1 });

module.exports = mongoose.model('Project', projectSchema);
