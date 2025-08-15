const mongoose = require('mongoose');

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
  replies: [replySchema]
}, { _id: true });

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
  // Accept both legacy strings and new metadata objects
  documents: [{ type: mongoose.Schema.Types.Mixed }],
  location: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  manpower: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Manpower' }],
  tasks: [
    {
      name: { type: String, required: true },
      percent: { type: Number, required: true }
    }
  ],
  status: {
    type: String,
    enum: ['Ongoing', 'Completed'],
    default: 'Ongoing'
  },
  discussions: [discussionSchema]
}, {
  timestamps: true
});

projectSchema.index({ status: 1 });
projectSchema.index({ pic: 1 });
projectSchema.index({ staff: 1 });
projectSchema.index({ hrsite: 1 });
projectSchema.index({ projectmanager: 1 });
projectSchema.index({ areamanager: 1 });

module.exports = mongoose.model('Project', projectSchema);
