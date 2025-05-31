import React, { useState } from 'react';

// Helper: Get display date from a date string
const formatDateTime = (dateVal) => {
  if (!dateVal) return '';
  const date = new Date(dateVal);
  return (
    date.toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' }) +
    " " +
    date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  );
};

const ApproveDenyActions = ({
  requestData,
  userId,
  userRole,
  onBack,
  onActionComplete
}) => {
  // Map roles to approval keys
  const roleKey =
    userRole === 'Project Manager' ? 'PM'
    : userRole === 'Area Manager' ? 'AM'
    : userRole === 'CEO' ? 'CEO'
    : userRole;

  const status = requestData?.status;
  const isPendingForMe =
    (status === 'Pending Project Manager' && roleKey === 'PM') ||
    (status === 'Pending Area Manager' && roleKey === 'AM') ||
    (status === 'Pending CEO' && roleKey === 'CEO');

  const hasActed = requestData?.approvals?.some(
    (a) => a.role === roleKey && String(a.user?._id || a.user) === String(userId)
  );

  const showApproveDeny = isPendingForMe && !hasActed;

  // Modal state
  const [showDenyReason, setShowDenyReason] = useState(false);
  const [denyReason, setDenyReason] = useState('');

  // Approve
  const handleApprove = async () => {
    if (!window.confirm('Are you sure you want to APPROVE this request?')) return;
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(
        `http://localhost:5000/api/requests/${requestData._id}/approve`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ decision: 'approved' })
        }
      );
      if (!res.ok) throw new Error('Approval failed');
      alert('Request approved.');
      if (onActionComplete) onActionComplete();
      else onBack();
    } catch (err) {
      alert('Failed to approve request.');
      console.error(err);
    }
  };

  // Deny
  const handleDeny = () => setShowDenyReason(true);
  const submitDeny = async () => {
    if (!denyReason.trim()) {
      alert('Please provide a reason for denial.');
      return;
    }
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(
        `http://localhost:5000/api/requests/${requestData._id}/approve`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ decision: 'denied', reason: denyReason })
        }
      );
      if (!res.ok) throw new Error('Denial failed');
      alert('Request denied.');
      setShowDenyReason(false);
      setDenyReason('');
      if (onActionComplete) onActionComplete();
      else onBack();
    } catch (err) {
      alert('Failed to deny request.');
      console.error(err);
    }
  };

  // --- RECEIVED BY PIC INFO ---
  const isReceived = !!requestData?.receivedDate;
  const receivedDate = requestData?.receivedDate
    ? formatDateTime(requestData.receivedDate)
    : null;

  // --- DENIAL INFO ---
  const deniedStatuses = ['Denied by Project Manager', 'Denied by Area Manager', 'Denied by CEO'];
  const isDenied = deniedStatuses.includes(requestData?.status);
  let deniedApproval = null;
  if (isDenied) {
    deniedApproval = [...(requestData?.approvals || [])]
      .reverse()
      .find(app => app.decision === 'denied');
  }

  // Helper: Get Denier Display
  const getDenierDisplay = (approval) => {
    if (!approval) return '';
    let role =
      approval.role === 'Project Manager'
        ? 'Project Manager'
        : approval.role === 'Area Manager'
        ? 'Area Manager'
        : approval.role === 'CEO'
        ? 'CEO'
        : approval.role;
    if (approval.user && typeof approval.user === 'object' && approval.user.name) {
      return `${approval.user.name} (${role})`;
    }
    return `${role}`;
  };

  return (
    <>
      {/* Denied Banner Styled to Match Main Detail */}
      {isDenied && deniedApproval && (
        <div style={{ marginBottom: 24 }}>
          <div style={{
            fontWeight: 600,
            textAlign: 'center',
            marginBottom: 4
          }}>
            Request Denied By: {getDenierDisplay(deniedApproval)}
          </div>
          <div style={{
            background: '#faeaea',
            color: '#a12d2d',
            borderRadius: 8,
            padding: '12px 16px',
            fontSize: 15,
            maxWidth: 800,
            margin: '0 auto',
            border: '1px solid #eedcdc',
            textAlign: 'left'
          }}>
            <div style={{ fontWeight: 500, marginBottom: 6 }}>Reason:</div>
            {deniedApproval.reason}
          </div>
        </div>
      )}

      {/* Delivered Banner */}
      {isReceived && (
        <div style={{
          margin: '40px 0 0',
          textAlign: 'center',
          color: '#15a563',
          fontWeight: 600
        }}>
          This Request has been Closed and Items were Successfully Delivered On: {receivedDate}
        </div>
      )}

      {/* Action Buttons */}
      <div className="action-buttons">
        <button onClick={onBack} className="back-btn">Back</button>
        {showApproveDeny && (
          <>
            <button
              onClick={handleApprove}
              className="publish-button-picmatreq"
              style={{ background: '#28a745', minWidth: 120 }}
            >
              Approve
            </button>
            <button
              onClick={handleDeny}
              className="cancel-btn"
              style={{
                marginLeft: '1rem',
                background: '#dc3545',
                color: '#fff',
                minWidth: 120
              }}
            >
              Deny
            </button>
          </>
        )}
      </div>

      {showDenyReason && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Deny Request</h3>
            <p>Please provide a reason for denial:</p>
            <textarea
              value={denyReason}
              onChange={e => setDenyReason(e.target.value)}
              rows={4}
              style={{
                width: '100%',
                borderRadius: '6px',
                border: '1px solid #ddd',
                padding: '0.75rem'
              }}
              placeholder="Enter reason for denial"
            />
            <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowDenyReason(false)} style={{
                padding: '0.6rem 1.5rem',
                background: '#ddd', border: 'none', borderRadius: 6
              }}>Cancel</button>
              <button onClick={submitDeny} style={{
                padding: '0.6rem 1.5rem',
                background: '#dc3545', color: '#fff', border: 'none', borderRadius: 6
              }}>Submit</button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setShowDenyReason(false)} />
        </div>
      )}
    </>
  );
};

export default ApproveDenyActions;
