// Unified PiC contribution percentage formula (RAW ONLY)
// Linear 0–100 scaling based purely on completed vs summary items (rounded to nearest integer).
function computeContribution(completedCount, summaryCount, { minimumFloor = 0 } = {}) {
  const denom = Math.max(1, summaryCount || 0);
  const ratio = Math.min(1, Math.max(0, (completedCount || 0) / denom));
  let pct = Math.round(ratio * 100);
  if (pct < minimumFloor) pct = minimumFloor;
  if (pct > 100) pct = 100;
  return pct;
}

module.exports = { computeContribution };
