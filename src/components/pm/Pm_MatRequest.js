import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import '../style/pm_style/Pm_MatRequest.css';

const Pm_MaterialRequestDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [requestData, setRequestData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  // For deny reason dialog
  const [showDenyReason, setShowDenyReason] = useState(false);
  const [denyReason, setDenyReason] = useState('');

  // Fetch request data
  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch(`http://localhost:5000/api/requests/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        setRequestData(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest(".profile-menu-container")) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };
  const handleBack = () => navigate(-1);

  // --- Attachments helpers ---
  const getAttachmentUrl = (file) =>
    file.startsWith('http') ? file : `http://localhost:5000/uploads/${file}`;

  // --- Approve Handler ---
  const handleApprove = async () => {
    if (!window.confirm('Are you sure you want to APPROVE this request?')) return;
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`http://localhost:5000/api/requests/${id}/approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ decision: 'approved' })
      });
      if (!res.ok) throw new Error('Approval failed');
      alert('Request approved.');
      navigate(-1);
    } catch (err) {
      alert('Failed to approve request.');
      console.error(err);
    }
  };

  // --- Deny Handler (show modal, then submit reason) ---
  const handleDeny = () => {
    setShowDenyReason(true);
  };
  const submitDeny = async () => {
    if (!denyReason.trim()) {
      alert("Please provide a reason for denial.");
      return;
    }
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`http://localhost:5000/api/requests/${id}/approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ decision: 'denied', reason: denyReason })
      });
      if (!res.ok) throw new Error('Denial failed');
      alert('Request denied.');
      setShowDenyReason(false);
      setDenyReason('');
      navigate(-1);
    } catch (err) {
      alert('Failed to deny request.');
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading request details...</p>
      </div>
    );
  }
  if (!requestData) {
    return (
      <div className="error-container">
        <p>Request not found</p>
        <button onClick={handleBack} className="back-button">Go Back</button>
      </div>
    );
  }

  return (
    <div className="app-container">
      <main className="main-content-picmatreq">
        <div className="request-materials-container-picmatreq">
          <h1 className="page-title-picmatreq">
            Material Request #{requestData.requestNumber}
          </h1>
          <div className="project-details-box" style={{ marginBottom: '20px' }}>
            <h2 style={{ margin: 0 }}>{requestData.project?.projectName || '-'}</h2>
            <p style={{ margin: 0, fontStyle: 'italic' }}>{requestData.project?.location || '-'}</p>
            <p style={{ margin: 0, color: '#555' }}>{requestData.project?.targetDate || ''}</p>
          </div>
          {/* --- VIEW MODE --- */}
          <>
            {/* Materials */}
            <div className="materials-section">
              <h2 className="section-title">Material to be Requested</h2>
              <div className="materials-list">
                {requestData.materials.map((mat, idx) => (
                  <div key={idx} className="material-item">
                    <span className="material-name">{mat.materialName}</span>
                    {mat.quantity && <span className="material-quantity"> ({mat.quantity})</span>}
                  </div>
                ))}
              </div>
            </div>
            {/* Attachments */}
            <div className="attachments-section">
              <h2 className="section-title">Attachment Proof</h2>
              <div className="attachments-grid">
                {requestData.attachments?.length
                  ? requestData.attachments.map((file, idx) => (
                    <div key={idx} className="attachment-item">
                      <img src={getAttachmentUrl(file)} alt={`Attachment ${idx + 1}`} className="attachment-image" />
                    </div>
                  ))
                  : <div>No attachments</div>
                }
              </div>
            </div>
            {/* Description */}
            <div className="description-section">
              <h2 className="section-title">Request Description</h2>
              <div className="description-content">
                <p>{requestData.description}</p>
              </div>
            </div>
            {/* Action Buttons */}
            <div className="action-buttons">
              <button onClick={handleBack} className="back-btn">Back</button>
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
                style={{ marginLeft: '1rem', background: '#dc3545', color: '#fff', minWidth: 120 }}
              >
                Deny
              </button>
            </div>
          </>

          {/* DENY MODAL */}
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
        </div>
      </main>
      {/* Simple Modal Styling */}
      <style>{`
        .modal-overlay {
          position: fixed;
          z-index: 20;
          top: 0; left: 0; right: 0; bottom: 0;
          display: flex;
          align-items: center; justify-content: center;
        }
        .modal-content {
          background: #fff;
          border-radius: 10px;
          box-shadow: 0 4px 24px rgba(0,0,0,0.14);
          padding: 2rem;
          min-width: 320px;
          z-index: 22;
        }
        .modal-backdrop {
          position: fixed;
          z-index: 21;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.15);
        }
      `}</style>
    </div>
  );
};

export default Pm_MaterialRequestDetail;
