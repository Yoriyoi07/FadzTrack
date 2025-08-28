// Shared utilities for Material Request views
export const truncateWords = (text = '', maxWords = 10) => {
  if (!text || typeof text !== 'string') return '';
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(' ') + '...';
};

export const getStatusBadge = (status, receivedFlag) => {
  const s = (status || '').toLowerCase();
  if (s === 'received' || receivedFlag) return 'Completed';
  if (s.includes('approved')) return 'Approved';
  if (s.includes('pending')) return 'Pending';
  if (s.includes('denied') || s.includes('cancel')) return 'Rejected';
  return 'Unknown';
};

export const computeApprovalSteps = (request) => {
  const approvalsArr = Array.isArray(request.approvals) ? request.approvals : [];
  const pmApproval = approvalsArr.filter(a => a.role === 'Project Manager').slice(-1)[0];
  const amApproval = approvalsArr.filter(a => a.role === 'Area Manager').slice(-1)[0];
  const pmDecision = pmApproval?.decision; // approved | denied
  const amDecision = amApproval?.decision;
  const pmDenied = pmDecision === 'denied';
  const amDenied = amDecision === 'denied';
  const pmApproved = pmDecision === 'approved';
  const amApproved = amDecision === 'approved';
  const statusLower = (request.status || '').toLowerCase();
  const isReceived = statusLower === 'received' || request.receivedByPIC;
  const receivedDate = request.receivedAt || request.receivedDate || null;
  const anyDenied = pmDenied || amDenied || statusLower.includes('denied');

  const pmState = pmDenied ? 'denied' : pmApproved ? 'completed' : 'pending';
  let amState;
  if (pmDenied) amState = 'denied';
  else if (!pmApproved) amState = 'blocked';
  else amState = amDenied ? 'denied' : amApproved ? 'completed' : 'pending';

  let receivedState;
  if (anyDenied) receivedState = 'denied';
  else if (!(pmApproved && amApproved)) receivedState = 'blocked';
  else receivedState = isReceived ? 'completed' : 'pending';

  const steps = [
    { key:'placed', label:'Placed', date:request.createdAt, state:'completed' },
    { key:'pm', label:'PM', date: pmApproval?.timestamp || null, state: pmState },
    { key:'am', label:'AM', date: amApproval?.timestamp || null, state: amState },
    { key:'received', label:'Received', date: isReceived ? (receivedDate || amApproval?.timestamp) : null, state: receivedState }
  ];
  return { steps, meta:{ pmApproval, amApproval, pmApproved, pmDenied, amApproved, amDenied, isReceived, anyDenied } };
};

export const canUserActOnRequest = (request, userRole) => {
  const role = (userRole||'').toLowerCase();
  const status = (request?.status||'').toLowerCase();
  if (!request) return false;
  if (status.includes('denied') || status === 'received') return false;
  if (status === 'pending project manager') return ['project manager','pm','admin'].includes(role);
  if (status === 'pending area manager') return ['area manager','am','admin'].includes(role);
  return false;
};
