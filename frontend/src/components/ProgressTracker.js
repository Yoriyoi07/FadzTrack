import React from 'react';
import './style/ProgressTracker.css';

const steps = [
  { label: "Placed", emoji: "📝", key: "placed" },
  { label: "Project Manager", emoji: "👤", key: "project manager" },
  { label: "Area Manager", emoji: "🏢", key: "area manager" },
  { label: "CEO", emoji: "👑", key: "ceo" },
  { label: "Received", emoji: "✅", key: "received" }
];

// Always returns a date string (even for pending)
function formatDate(date, isPending = false) {
  if (isPending) {
    // Always show today's date for pending
    return new Date().toLocaleDateString();
  }
  if (!date) return "—";
  try {
    return new Date(date).toLocaleDateString();
  } catch {
    return "—";
  }
}

function getStepInfo(request) {
  if (!request) {
    // All steps pending fallback
    return steps.map(() => ({
      status: "Pending",
      date: formatDate(undefined, true),
      decision: "pending"
    }));
  }

  const info = [];
  // 1. Placed
  info.push({
    status: "Completed",
    date: formatDate(request.createdAt),
    decision: "placed"
  });

  // 2. PM approval
  const pm = (request.approvals || []).find(a =>
    (a.role || '').toLowerCase().includes("project manager")
  );
  if (pm) {
    info.push({
      status: pm.decision === "approved" ? "Approved" : "Denied",
      date: formatDate(pm.timestamp),
      decision: pm.decision === "approved" ? "approved" : "denied"
    });
  } else {
    info.push({ status: "Pending", date: formatDate(undefined, true), decision: "pending" });
  }

  // 3. AM approval
  const am = (request.approvals || []).find(a =>
    (a.role || '').toLowerCase().includes("area manager")
  );
  if (am) {
    info.push({
      status: am.decision === "approved" ? "Approved" : "Denied",
      date: formatDate(am.timestamp),
      decision: am.decision === "approved" ? "approved" : "denied"
    });
  } else {
    info.push({ status: "Pending", date: formatDate(undefined, true), decision: "pending" });
  }

  // 4. CEO approval
  const ceo = (request.approvals || []).find(a =>
    (a.role || '').toLowerCase() === "ceo"
  );
  if (ceo) {
    info.push({
      status: ceo.decision === "approved" ? "Approved" : "Denied",
      date: formatDate(ceo.timestamp),
      decision: ceo.decision === "approved" ? "approved" : "denied"
    });
  } else {
    info.push({ status: "Pending", date: formatDate(undefined, true), decision: "pending" });
  }

  // 5. Received
  if ((request.status || '').toLowerCase() === "received") {
    info.push({
      status: "Received",
      date: formatDate(request.receivedDate),
      decision: "received"
    });
  } else if ((request.status || '').toLowerCase().includes("denied")) {
    info.push({ status: "Denied", date: formatDate(Date.now()), decision: "denied" });
  } else {
    info.push({ status: "Pending", date: formatDate(undefined, true), decision: "pending" });
  }

  return info;
}

export default function ProgressTracker({ request }) {
  const stepInfo = getStepInfo(request);

  return (
    <div className="progress-tracker">
      {steps.map((step, idx) => {
        const info = stepInfo[idx];
        // Color/Status Logic
        let cls = "step-circle";
        if (info.decision === "approved" || info.decision === "placed" || info.decision === "received") cls += " completed";
        else if (info.decision === "denied") cls += " denied";
        else if (info.status === "Pending" && !stepInfo.slice(idx+1).some(s => s.status === "Approved")) cls += " active";

        return (
          <React.Fragment key={idx}>
            <div className="step-vertical">
              <div className={cls}>
                <span style={{ fontSize: 18 }}>{step.emoji}</span>
              </div>
              <div className="step-label">{step.label}</div>
              <div className={`step-status step-status-${info.decision}`}>{info.status}</div>
              <div className="step-date">{info.date}</div>
            </div>
            {idx < steps.length - 1 && (
              <div className={`step-line ${
                info.decision === "approved" || info.decision === "placed" || info.decision === "received"
                  ? "completed"
                  : info.decision === "denied"
                  ? "denied"
                  : ""
              }`}></div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
