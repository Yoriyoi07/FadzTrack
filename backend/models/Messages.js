// models/Messages.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const ReactionSchema = new Schema({
  userId:   { type: Schema.Types.ObjectId, ref: 'User', required: true },
  emoji:    { type: String, required: true },
}, { _id: false });

const SeenSchema = new Schema({
  userId:   { type: Schema.Types.ObjectId, ref: 'User', required: true },
  timestamp:{ type: Date, default: Date.now },
}, { _id: false });

const AttachmentSchema = new Schema({
  url:        { type: String, required: true },       // e.g. signed url or /uploads/chat/uuid-filename.png
  path:       { type: String },                       // optional storage path (e.g. messages/<chatId>/file)
  name:       { type: String, required: true },       // original filename
  size:       { type: Number },                       // bytes
  mime:       { type: String },                       // image/png, video/mp4, application/pdf, etc
  width:      { type: Number },                       // optional (images)
  height:     { type: Number },                       // optional (images)
  duration:   { type: Number },                       // optional (audio/video sec)
}, { _id: false });

const MessageSchema = new Schema({
  conversation: { type: Schema.Types.ObjectId, ref: 'Chat', required: true },
  senderId:     { type: Schema.Types.ObjectId, ref: 'User', required: true },

  // text content (optional when sending files only)
  message:      { type: String, default: '' },

  // reply threading
  replyTo:      { type: Schema.Types.ObjectId, ref: 'Message' },
  // forwarding reference
  forwardOf:    { type: Schema.Types.ObjectId, ref: 'Message' },

  // array of files/media
  attachments:  { type: [AttachmentSchema], default: [] },

  // lightweight helpers
  reactions:    { type: [ReactionSchema], default: [] },
  seen:         { type: [SeenSchema], default: [] },
  // soft delete support
  deleted:      { type: Boolean, default: false },
  deletedAt:    { type: Date },
  deletedBy:    { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('Message', MessageSchema);
