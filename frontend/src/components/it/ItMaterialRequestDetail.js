import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import api from '../../api/axiosInstance';
import '../style/pm_style/Pm_MatRequest.css'; // reuse style for layout!

const ItMaterialRequestDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [requestData, setRequestData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const user = JSON.parse(localStorage.getItem('user'));

  useEffect(() => {
    api.get(`/requests/${id}`)
      .then(res => {
        setRequestData(res.data);
        setError('');
      })
      .catch(() => setError('Failed to load request details.'))
      .finally(() => setLoading(false));
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

  const handleEdit = () => {
    navigate(`/it/material-request/edit/${id}`);
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to DELETE this request? This cannot be undone.')) return;
    setDeleting(true);
    try {
      await api.delete(`/requests/${id}`);
      alert('Request deleted.');
      navigate('/it/material-list');
    } catch {
      alert('Failed to delete request.');
    }
    setDeleting(false);
  };

  // --- Attachments helpers ---
  const getAttachmentUrl = (file) =>
    file.startsWith('http') ? file : `http://localhost:5000/uploads/${file}`;

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
        <p>{error || 'Request not found.'}</p>
        <button onClick={handleBack} className="back-button">Go Back</button>
      </div>
    );
  }

  return (
    <div>
        <header className="header">
            <div className="logo-container">
                <img src={require('../../assets/images/FadzLogo1.png')} alt="FadzTrack Logo" className="logo-img" />
                <h1 className="brand-name">FadzTrack</h1>
            </div>
            <nav className="nav-menu">
                <Link to="/it" className="nav-link">Dashboard</Link>
                <Link to="/chat" className="nav-link">Chat</Link>
                <Link to='/it/material-list' className="nav-link">Materials</Link>
                <Link to='/it/manpower-list' className="nav-link">Manpower</Link>
                <Link to="/it/auditlogs" className="nav-link">Audit Logs</Link>
            </nav>
            <div className="profile-menu-container">
                <div
                className="profile-circle"
                onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                >
                {user.name ? user.name[0] : 'I'}
                </div>
                {profileMenuOpen && (
                <div className="profile-menu">
                    <button onClick={handleLogout}>Logout</button>
                </div>
                )}
            </div>
        </header>

      <main className="main-content-picmatreq">
        <div className="request-materials-container-picmatreq">
          <h1 className="page-title-picmatreq">
            Material Request #{requestData.requestNumber || id?.slice(-4)}
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
              <h2 className="section-title">Materials Requested</h2>
              <div className="materials-list">
                {requestData.materials.map((mat, idx) => (
                  <div key={idx} className="material-item">
                    <span className="material-name">
                      <strong>Material:</strong> {mat.materialName}
                    </span>
                    <span className="material-quantity">
                      <strong>Quantity:</strong> {mat.quantity}
                    </span>
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

            {/* Status & Meta */}
            <div className="meta-section">
              <div><b>Status:</b> {requestData.status}</div>
              <div><b>Requested by:</b> {requestData.createdBy?.name}</div>
              <div>
                <b>Date Created:</b>{' '}
                {requestData.createdAt ? new Date(requestData.createdAt).toLocaleDateString() : '-'}
              </div>
              <div>
                <b>Project:</b> {requestData.project?.projectName || '-'}
              </div>
            </div>

            {/* IT CRUD Buttons */}
            <div style={{ display: 'flex', gap: 24, justifyContent: 'center', marginTop: 28 }}>
              <button
                onClick={handleBack}
                className="back-button"
                style={{ minWidth: 120, background: '#3a539b', color: '#fff', border: 'none', borderRadius: 6, fontSize: 16, height: 40 }}
              >
                Back
              </button>
              <button
                onClick={handleEdit}
                className="edit-btn"
                style={{ minWidth: 120, background: '#3a539b', color: '#fff', border: 'none', borderRadius: 6, fontSize: 16, height: 40 }}
              >
                Edit
              </button>
              <button
                onClick={handleDelete}
                className="delete-btn"
                style={{ minWidth: 120, background: '#c0392b', color: '#fff', border: 'none', borderRadius: 6, fontSize: 16, height: 40 }}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </>
        </div>
      </main>
    </div>
  );
};

export default ItMaterialRequestDetail;
