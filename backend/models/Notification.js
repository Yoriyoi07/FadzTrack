const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  type: { // category / event type
    type: String,
    required: true,
    enum: [
      'discussion','reply','mention','manpower','task','system','general',
      'nudge','material_request_created','pending_approval','approved','denied',
      // project lifecycle
      'project_created',
      // manpower specific
  'manpower_request_approved',
  // content moderation
  'discussion_profanity_alert'
    ],
  },
  title: { type: String }, // short heading e.g. "Material Request Approved"
  message: { type: String, required: true }, // human readable body
  severity: { type: String, enum: ['info','success','warning','error'], default: 'info' },
  icon: { type: String }, // optional icon key for frontend mapping
  actionUrl: { type: String }, // deep-link to relevant page
  groupingKey: { type: String, index: true }, // for collapsing similar events
  toUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  requestId: { type: mongoose.Schema.Types.ObjectId, ref: 'MaterialRequest' },
  referenceId: { type: mongoose.Schema.Types.ObjectId, refPath: 'type' },
  status: { type: String, enum: ['unread', 'read'], default: 'unread' },
  readAt: { type: Date },
  expiresAt: { type: Date },
  meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now }
});

// Indexes for performance improvement
NotificationSchema.index({ toUserId: 1, status: 1 });
NotificationSchema.index({ fromUserId: 1, status: 1 });
NotificationSchema.index({ createdAt: -1 });
NotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, partialFilterExpression: { expiresAt: { $exists: true } } });

// Export model named 'Notification' using the 'notifications' collection
module.exports = mongoose.model('Notification', NotificationSchema, 'notifications');

