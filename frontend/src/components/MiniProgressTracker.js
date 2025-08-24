import React from 'react';
import './style/ProgressTracker.css';

function decisionForRole(request, roleKey) {
  const entry = (request?.approvals || []).find(a => (a.role || '').toLowerCase().includes(roleKey));
  if (!entry) return 'pending';
  return entry.decision === 'approved' ? 'approved' : entry.decision === 'denied' ? 'denied' : 'pending';
}

export default function MiniProgressTracker({ request }) {
  const pm = decisionForRole(request, 'project manager');
  const am = decisionForRole(request, 'area manager');
  const anyDenied = pm === 'denied' || am === 'denied';
  const received = !!request?.receivedByPIC;

  const cls = (decision, base = 'mini-step') => {
    if (decision === 'approved' || decision === 'placed' || decision === 'received') return base + ' completed';
    if (decision === 'denied') return base + ' denied';
    return base;
  };

  const arrowCls = (decision) => {
    if (decision === 'approved' || decision === 'placed' || decision === 'received') return 'mini-arrow completed';
    if (decision === 'denied') return 'mini-arrow denied';
    return 'mini-arrow';
  };

  // Determine completed chain for highlighting arrows up to the last completed stage
  const picState = 'placed';
  const pmState = pm;
  const amState = am;
  const lastState = received ? 'received' : (anyDenied ? 'denied' : 'pending');
  const picCompleted = true; // placed is always completed
  const pmCompleted = pmState === 'approved';
  const amCompleted = amState === 'approved';

  return (
    <div className="mini-progress">
      <div className={cls(picState)} title="Placed by PIC">PIC</div>
      <div className={arrowCls(picCompleted ? 'approved' : 'pending')} aria-hidden>→</div>
      <div className={cls(pmState)} title="Project Manager">PM</div>
      <div className={arrowCls(pmCompleted ? 'approved' : pmState)} aria-hidden>→</div>
      <div className={cls(amState)} title="Area Manager">AM</div>
      <div className={arrowCls(amCompleted ? 'approved' : amState)} aria-hidden>→</div>
      <div className={cls(received ? 'received' : anyDenied ? 'denied' : 'pending')} title="Received">✓</div>
    </div>
  );
}


