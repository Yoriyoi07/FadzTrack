// models/TrustedDevice.js
const mongoose = require('mongoose');

const trustedDeviceSchema = new mongoose.Schema(
  {
    userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, required: true },
    tokenHash:{ type: String, required: true, index: true }, // sha256(rawToken)
    uaHash:   { type: String, required: true },               // sha256(user-agent)
    ipPrefix: { type: String },                                // first 2 octets for soft pinning
    expiresAt:{ type: Date, required: true, index: true },
  },
  { timestamps: true }
);

// optional TTL index (Mongo will clean up expired docs automatically)
trustedDeviceSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('TrustedDevice', trustedDeviceSchema);
