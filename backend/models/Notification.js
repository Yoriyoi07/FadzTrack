const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: [
      'discussion',   // A new discussion was posted
      'reply',        // A new reply was posted
      'mention',      // User was mentioned
      'manpower',     // Manpower request notification
      'task',         // Task assignment or status change
      'system',       // System notifications (like reminders, updates, etc.)
      'general',      // General type of notifications
      // additional types used in the codebase
      'nudge',
      'material_request_created',
      'pending_approval',
      'approved',
      'denied'
    ],
  },
  toUserId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  fromUserId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  projectId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Project' 
  },
  requestId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'MaterialRequest' 
  },
  message: { 
    type: String, 
    required: true 
  },
  status: { 
    type: String, 
    enum: ['unread', 'read'], 
    default: 'unread' 
  },
  meta: { 
    type: mongoose.Schema.Types.Mixed, 
    default: {} 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  referenceId: { 
    type: mongoose.Schema.Types.ObjectId, 
    refPath: 'type'  // This helps link the notification to its respective object
  },
});

// Indexes for performance improvement
NotificationSchema.index({ toUserId: 1, status: 1 });
NotificationSchema.index({ fromUserId: 1, status: 1 });

// Export model named 'Notification' using the 'notifications' collection
module.exports = mongoose.model('Notification', NotificationSchema, 'notifications');

