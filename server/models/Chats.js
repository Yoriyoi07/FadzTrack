const mongoose = require('mongoose');

const ChatSchema = new mongoose.Schema({
  name: String,
  participants: [String], 
});

module.exports = mongoose.model('Chat', ChatSchema);
