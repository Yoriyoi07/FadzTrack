const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  isGroup:     { type: Boolean, default: false },
  name:        { type: String },                         // only for groups
  users:       [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  lastMessage: {
    content:   String,
    timestamp: Date
  },
}, { timestamps: true });

module.exports = mongoose.model('Conversation', conversationSchema);
