// models/Chat.js
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const { Schema } = mongoose;

const ChatSchema = new Schema({
  isGroup: {
    type: Boolean,
    default: false
  },
  name: {
    type: String,
    default: ''
  },
  users: [{
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  creator: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  joinCode: {
    type: String,
    unique: true,
    sparse: true,
    default: function () {
      // only generate join code for group chats
      return this.isGroup ? uuidv4() : undefined;
    }
  },
  lastMessage: {
    content: { type: String },
    timestamp: { type: Date }
  }
}, {
  timestamps: true
});

ChatSchema.index({ users: 1, 'lastMessage.timestamp': -1 });

module.exports = mongoose.model('Chat', ChatSchema);