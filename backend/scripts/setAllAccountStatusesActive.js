require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

(async function main() {
  if (!process.env.MONGO_URI) {
    console.error('Missing MONGO_URI in environment. Create a .env with MONGO_URI.');
    process.exit(1);
  }
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const res = await User.updateMany({}, { $set: { accountStatus: 'Active' } });
    console.log('Set accountStatus to Active for all users:', res);
  } catch (err) {
    console.error('Error setting accountStatus:', err?.message || err);
    process.exit(2);
  } finally {
    try { await mongoose.disconnect(); } catch {}
  }
})();
