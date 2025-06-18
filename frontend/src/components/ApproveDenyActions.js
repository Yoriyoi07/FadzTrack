import React, { useState } from 'react';
import api from '../api/axiosInstance';



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

  // CEO Inputs
  const isCEOApproval = status === 'Pending CEO' && roleKey === 'CEO';
  const [purchaseOrder, setPurchaseOrder] = useState('');
  const [totalValue, setTotalValue] = useState('');
  const [ceoFieldError, setCeoFieldError] = useState('');

  // Modal state
  const [showDenyReason, setShowDenyReason] = useState(false);
  const [denyReason, setDenyReason] = useState('');
const [ceoPDF, setCeoPDF] = useState(null);
  // Approve
const handleApprove = async () => {
  if (isCEOApproval) {
    if (!purchaseOrder.trim() || !totalValue.trim()) {
      setCeoFieldError('Purchase Order and Total Value are required.');
      return;
    }
    if (!ceoPDF) {
      setCeoFieldError('Please upload the approval PDF.');
      return;
    }
  }
  if (!window.confirm('Are you sure you want to APPROVE this request?')) return;
  const token = localStorage.getItem('token');
  try {
    let payload, headers;
    if (isCEOApproval) {
      payload = new FormData();
      payload.append('decision', 'approved');
      payload.append('purchaseOrder', purchaseOrder);
      payload.append('totalValue', totalValue);
      payload.append('ceoApprovalPDF', ceoPDF); // match multer field!
      headers = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'multipart/form-data'
      };
    } else {
      payload = { decision: 'approved' };
      headers = { Authorization: `Bearer ${token}` };
    }
    await api.post(
      `/requests/${requestData._id}/approve`,
      payload,
      { headers }
    );
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
      await api.post(
        `/requests/${requestData._id}/approve`,
        { decision: 'denied', reason: denyReason },
        { headers: { Authorization: `Bearer ${token}` } }
      );
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

  // ---- Approve Button Label logic ----
  let approveLabel = 'Approve';
  if (
    (status === 'Pending Project Manager' && roleKey === 'PM') ||
    (status === 'Pending Area Manager' && roleKey === 'AM')
  ) {
    approveLabel = 'Validate';
  }

  // Find CEO approval data if exists
  const ceoApproval = (requestData?.approvals || []).find(
    (a) => a.role === 'CEO' && a.decision === 'approved'
  );
  const ceoPONum = ceoApproval?.purchaseOrder || requestData?.purchaseOrder;
  const ceoPOValue = ceoApproval?.totalValue || requestData?.totalValue;

  return (
    <>
      {/* Denied Banner */}
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

      {/* CEO FINAL APPROVAL (Always show if approved by CEO) */}
      {ceoApproval && (
        <div className="ceo-approved-details" style={{ marginBottom: 18, background: "#f6fafd", borderRadius: 8, padding: "12px 18px" }}>
          <h3 style={{ color: "#1f4e79", margin: 0, fontWeight: 600 }}>CEO Final Approval</h3>
          <div style={{ marginTop: 6, marginBottom: 4 }}>
            <strong>Purchase Order #:</strong> {ceoPONum}
          </div>
          <div>
            <strong>Total Value (₱):</strong> {ceoPOValue}
          </div>
        </div>
      )}

      {/* CEO INPUTS ONLY WHEN PENDING CEO */}
      {showApproveDeny && isCEOApproval && (
        <div className="ceo-approval-fields" style={{ marginBottom: 18 }}>
          <h3 style={{ marginBottom: 8, color: '#1f4e79' }}>CEO Final Approval</h3>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontWeight: 500, marginRight: 10 }}>
              Purchase Order #
              <input
                type="text"
                value={purchaseOrder}
                onChange={e => setPurchaseOrder(e.target.value)}
                placeholder="Enter Purchase Order Number"
                style={{ marginLeft: 10, padding: 6, borderRadius: 4, border: '1px solid #ccc' }}
              />
            </label>
          </div>
          <div style={{ marginBottom: 8 }}>
            <label style={{ fontWeight: 500, marginRight: 10 }}>
              Total Value (₱)
              <input
                type="number"
                min={0}
                value={totalValue}
                onChange={e => setTotalValue(e.target.value)}
                placeholder="Enter Total Value"
                style={{ marginLeft: 10, padding: 6, borderRadius: 4, border: '1px solid #ccc' }}
              />
            </label>
          </div>
          <input
  type="file"
  accept="application/pdf"
  onChange={e => setCeoPDF(e.target.files[0])}
/>
          {ceoFieldError && <div style={{ color: "red", marginTop: 3 }}>{ceoFieldError}</div>}
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
              {approveLabel}
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
