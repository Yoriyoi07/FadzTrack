const AuditLog = require('../models/AuditLog');

async function logAction({ action, performedBy, performedByRole, description, meta }) {
  try {
    await AuditLog.create({
      action,
      performedBy,
      performedByRole,
      description,
      meta
    });
  } catch (err) {
    console.error("Failed to log audit event:", err);
  }
}

module.exports = { logAction };
