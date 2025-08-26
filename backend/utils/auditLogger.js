// utils/auditLogger.js
const AuditLog = require('../models/AuditLog');
const Project = require('../models/Project');
const MaterialRequest = require('../models/MaterialRequest');
const ManpowerRequest = require('../models/ManpowerRequest');

// Lightweight in‑memory cache (clears on process restart)
const nameCache = {
  project: new Map(), // id -> projectName
  materialRequest: new Map(), // id -> requestNumber
  manpowerRequest: new Map(), // id -> derived summary
};

async function enrichMeta(meta = {}) {
  const enriched = { ...meta };
  try {
    // Project name
    if (enriched.projectId && !enriched.projectName) {
      let name = nameCache.project.get(String(enriched.projectId));
      if (!name) {
        const proj = await Project.findById(enriched.projectId).select('projectName');
        name = proj?.projectName;
        if (name) nameCache.project.set(String(enriched.projectId), name);
      }
      if (name) enriched.projectName = name;
    }
    // Material request number
    if (enriched.requestId && enriched.context === 'material' && !enriched.requestNumber) {
      let reqNum = nameCache.materialRequest.get(String(enriched.requestId));
      if (!reqNum) {
        const mr = await MaterialRequest.findById(enriched.requestId).select('requestNumber');
        reqNum = mr?.requestNumber;
        if (reqNum) nameCache.materialRequest.set(String(enriched.requestId), reqNum);
      }
      if (reqNum != null) enriched.requestNumber = reqNum;
    }
    // Manpower request short summary
    if (enriched.requestId && enriched.context === 'manpower' && !enriched.requestSummary) {
      let summary = nameCache.manpowerRequest.get(String(enriched.requestId));
      if (!summary) {
        const mp = await ManpowerRequest.findById(enriched.requestId).select('manpowers');
        if (mp) {
          const first = mp.manpowers?.[0];
          summary = first ? `${first.quantity} ${first.type}${mp.manpowers.length > 1 ? ' +…' : ''}` : 'Request';
          nameCache.manpowerRequest.set(String(enriched.requestId), summary);
        }
      }
      if (summary) enriched.requestSummary = summary;
    }
  } catch (e) {
    // Fail silently; original meta still logged
  }
  return enriched;
}

async function logAction({ action, performedBy, performedByRole, description, meta }) {
  try {
    const enrichedMeta = await enrichMeta(meta);
    await AuditLog.create({ action, performedBy, performedByRole, description, meta: enrichedMeta });
  } catch (err) {
    console.error('Failed to log audit event:', err);
  }
}

module.exports = { logAction };
