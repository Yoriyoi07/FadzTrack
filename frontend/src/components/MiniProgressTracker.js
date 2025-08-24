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

  return (
    <div className="mini-progress">
      <div className={cls('placed')} title="Placed by PIC">PiC</div>
      <div className="mini-sep" />
      <div className={cls(pm)} title="Project Manager">PM</div>
      <div className="mini-sep" />
      <div className={cls(am)} title="Area Manager">AM</div>
      <div className="mini-sep" />
      <div className={cls(received ? 'received' : anyDenied ? 'denied' : 'pending')} title="Received">✓</div>
    </div>
  );
}


