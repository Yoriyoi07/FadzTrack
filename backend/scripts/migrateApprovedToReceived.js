require('dotenv').config();
const mongoose = require('mongoose');
const MaterialRequest = require('../models/MaterialRequest');

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to MongoDB');

    const result = await MaterialRequest.updateMany(
      { status: 'Approved', receivedByPIC: true },
      { $set: { status: 'Received' } }
    );
    console.log('Migration complete:', result.modifiedCount, 'documents updated.');
  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    await mongoose.disconnect();
  }
}

run();