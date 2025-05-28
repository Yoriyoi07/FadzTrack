const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  role: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  status: { type: String, default: 'Active' },
  locations: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Location' }],
}, {
  timestamps: true  
});
const hash = "$2b$10$2HcyTAvLyvLcQKMbKpHlMuNrT0uQo9C5WuM5s7Wh2JJJW4J9JwgPi";

async function testPassword(inputPassword) {
  const match = await bcrypt.compare(inputPassword, hash);
  console.log("Does it match?", match);
}

testPassword("admin123");

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

module.exports = mongoose.model('User', userSchema);
