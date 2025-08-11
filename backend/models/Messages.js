// models/Message.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const ReactionSchema = new Schema({
  userId:  { type: Schema.Types.ObjectId, ref: 'User', required: true },
  emoji:   { type: String, required: true }
}, { _id: false });

const SeenSchema = new Schema({
  userId:    { type: Schema.Types.ObjectId, ref: 'User', required: true },
  timestamp: { type: Date, default: Date.now }
}, { _id: false });

const MessageSchema = new Schema({
  sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  conversation: { type: Schema.Types.ObjectId, ref: 'Chat', required: true },
  content: { type: String },
  fileUrl: { type: String },
  type: { type: String, enum: ['text', 'image', 'file'], default: 'text' },
  reactions: { type: [ReactionSchema], default: [] },
  seen: { type: [SeenSchema], default: [] }
}, { timestamps: true });

MessageSchema.index({ conversation: 1, createdAt: 1 });

module.exports = mongoose.model('Message', MessageSchema);
