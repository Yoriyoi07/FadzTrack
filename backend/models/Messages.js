// models/Message.js
const mongoose = require('mongoose');

const ReactionSchema = new mongoose.Schema({
  userId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  emoji:   { type: String, required: true }
});

const SeenSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  timestamp: { type: Date, default: Date.now }
});

const MessageSchema = new mongoose.Schema({
  sender:        { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  conversation:  { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation' },
  content:       String,
  type:          { type: String, default: 'text' },
  reactions:     [ReactionSchema],
  seen:          [SeenSchema],          // ← NEW
  timestamp:     { type: Date, default: Date.now }
});

module.exports = mongoose.model('Message', MessageSchema);
