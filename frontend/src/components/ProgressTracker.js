import React from 'react';
import './style/ProgressTracker.css';

const steps = [
  { label: "Placed", emoji: "📝", key: "placed" },
  { label: "Project Manager", emoji: "👤", key: "project manager" },
  { label: "Area Manager", emoji: "🏢", key: "area manager" },
  { label: "Received", emoji: "✅", key: "received" }
];

// Format date and time in local format (show — if no date)
function formatDateTime(date) {
  if (!date) return "—";
  try {
    const d = new Date(date);
    return d.toLocaleDateString() + ', ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return "—";
  }
}

function getStepInfo(request) {
  if (!request) {
    // All steps pending fallback
    return steps.map(() => ({
      status: "Pending",
      date: "—",
      decision: "pending"
    }));
  }

  const info = [];
  let denied = false;

  // 1. Placed
  info.push({
    status: "Completed",
    date: formatDateTime(request.createdAt),
    decision: "placed"
  });

  // 2. Project Manager approval
  const pm = (request.approvals || []).find(a =>
    (a.role || '').toLowerCase().includes("project manager")
  );
  if (denied) {
    info.push({ status: "—", date: "—", decision: "inactive" });
  } else if (pm) {
    if (pm.decision === "approved") {
      info.push({
        status: "Approved",
        date: formatDateTime(pm.timestamp),
        decision: "approved"
      });
    } else if (pm.decision === "denied") {
      denied = true;
      info.push({
        status: "Denied",
        date: formatDateTime(pm.timestamp),
        decision: "denied"
      });
    }
  } else {
    info.push({ status: "Pending", date: "—", decision: "pending" });
  }

  // 3. Area Manager approval
  const am = (request.approvals || []).find(a =>
    (a.role || '').toLowerCase().includes("area manager")
  );
  if (denied) {
    info.push({ status: "—", date: "—", decision: "inactive" });
  } else if (am) {
    if (am.decision === "approved") {
      info.push({
        status: "Approved",
        date: formatDateTime(am.timestamp),
        decision: "approved"
      });
    } else if (am.decision === "denied") {
      denied = true;
      info.push({
        status: "Denied",
        date: formatDateTime(am.timestamp),
        decision: "denied"
      });
    }
  } else {
    info.push({ status: "Pending", date: "—", decision: "pending" });
  }

  // 4. Received (only if not denied)
  if (denied) {
    info.push({ status: "—", date: "—", decision: "inactive" });
  } else if (request.receivedByPIC) {
    info.push({
      status: "Received",
      date: formatDateTime(request.receivedDate),
      decision: "received"
    });
  } else {
    info.push({ status: "Pending", date: "—", decision: "pending" });
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
        if (
          info.decision === "approved" ||
          info.decision === "placed" ||
          info.decision === "received"
        ) {
          cls += " completed";
        } else if (info.decision === "denied") {
          cls += " denied";
        } else if (info.decision === "inactive") {
          cls += " inactive";
        } else if (
          info.status === "Pending" &&
          !stepInfo.slice(idx + 1).some(s => s.status === "Approved")
        ) {
          cls += " active";
        }

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
              <div
                className={`step-line ${
                  info.decision === "approved" ||
                  info.decision === "placed" ||
                  info.decision === "received"
                    ? "completed"
                    : info.decision === "denied"
                    ? "denied"
                    : info.decision === "inactive"
                    ? "inactive"
                    : ""
                }`}
              ></div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
