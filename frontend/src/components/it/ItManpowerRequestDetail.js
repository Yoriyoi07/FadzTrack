import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../../api/axiosInstance';

const ItManpowerRequestDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [request, setRequest] = useState(null);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Fetch the specific manpower request
  useEffect(() => {
    const fetchRequest = async () => {
      try {
        const res = await api.get(`/manpower-requests/${id}`);
        setRequest(res.data);
      } catch (err) {
        setError('Failed to load request');
      }
      setLoading(false);
    };
    fetchRequest();
  }, [id]);

  // Profile dropdown logic
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

  const handleEdit = () => {
    navigate(`/it/manpower-request/edit/${id}`);
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to DELETE this request? This action cannot be undone.')) return;
    setDeleting(true);
    try {
      await api.delete(`/manpower-requests/${id}`);
      alert('Request deleted.');
      navigate('/it/manpower-list');
    } catch (e) {
      alert('Failed to delete request.');
    }
    setDeleting(false);
  };

  if (loading) return <div>Loading...</div>;
  if (error || !request) return <div style={{ color: 'red' }}>{error || "Request not found."}</div>;

  const manpowerSummary = (Array.isArray(request.manpowers) && request.manpowers.length > 0)
    ? request.manpowers.map((mp, i) =>
        <div key={i}>{mp.quantity} {mp.type}</div>
      )
    : <div>No manpower types listed</div>;

  return (
    <div>
      {/* Header */}
      <header className="header">
        <div className="logo-container">
          <img src={require('../../assets/images/FadzLogo1.png')} alt="FadzTrack Logo" className="logo-img" />
          <h1 className="brand-name">FadzTrack</h1>
        </div>
        <nav className="nav-menu">
          <Link to="/it" className="nav-link">Dashboard</Link>
          <Link to="/it/chat" className="nav-link">Chat</Link>
          <Link to='/it/material-list' className="nav-link">Materials</Link>
          <Link to='/it/manpower-list' className="nav-link">Manpower</Link>
          <Link to="/it/auditlogs" className="nav-link">Audit Logs</Link>
        </nav>
        <div className="profile-menu-container">
          <div
            className="profile-circle"
            onClick={() => setProfileMenuOpen(!profileMenuOpen)}
          >
            {request.createdBy?.name ? request.createdBy.name[0] : 'I'}
          </div>
          {profileMenuOpen && (
            <div className="profile-menu">
              <button onClick={handleLogout}>Logout</button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content" style={{ position: 'relative' }}>
        <div className="form-container" style={{ minWidth: 550, marginTop: 30, marginBottom: 40 }}>
          <h2 style={{ textAlign: 'center', fontSize: 32, fontWeight: 700 }}>
            Manpower Req. {request.requestNumber || id?.slice(-3)}
          </h2>
          <div style={{ textAlign: 'center', fontSize: 16, fontWeight: 500, marginBottom: 15 }}>
            {request.project?.projectName} | Engr. {request.createdBy?.name}
          </div>

          <div style={{ display: 'flex', flexDirection: 'row', gap: 40, justifyContent: 'center', marginBottom: 12 }}>
            <div>
              <b>Target Acquisition Date:</b><br />
              {request.acquisitionDate ? new Date(request.acquisitionDate).toLocaleDateString() : ''}
            </div>
            <div>
              <b>Duration:</b><br />
              {request.duration} days
            </div>
          </div>

          <div style={{ margin: '0 auto', width: 320, marginBottom: 24 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Request Summary</div>
            <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12, minHeight: 60, background: '#fafbfd', fontSize: 16 }}>
              {manpowerSummary}
            </div>
          </div>

          <div style={{ margin: '0 auto', width: 480, marginBottom: 24 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Request Description</div>
            <textarea
              value={request.description}
              readOnly
              style={{
                width: '100%',
                minHeight: 70,
                border: '1px solid #ddd',
                borderRadius: 8,
                padding: 10,
                background: '#fafbfd',
                resize: 'none'
              }}
            />
          </div>

          {/* --- Additional details at the bottom --- */}
          <div style={{ margin: '0 auto', width: 480, marginBottom: 28 }}>
            <div style={{ marginBottom: 6 }}>
              <b>Status:</b> <span style={{ fontWeight: 600 }}>{request.status}</span>
            </div>
            <div style={{ marginBottom: 6 }}>
              <b>Project:</b> {request.project?.projectName || "N/A"}
            </div>
            <div>
              <b>Assigned Manpower:</b>
              <ul style={{ margin: 0, paddingLeft: 16 }}>
                {Array.isArray(request.manpowers) && request.manpowers.length > 0
                  ? request.manpowers.map((mp, i) =>
                      <li key={i}>{mp.quantity} {mp.type}</li>)
                  : <li>No manpowers</li>
                }
              </ul>
            </div>
          </div>

          {/* --- Buttons --- */}
          <div style={{ display: 'flex', gap: 40, justifyContent: 'center' }}>
            <button
              onClick={() => navigate(-1)}
              className="back-btn"
              style={{ width: 160, height: 40, background: '#3a539b', color: '#fff', border: 'none', borderRadius: 6, fontSize: 18 }}
            >
              Back
            </button>
            <button
              className="edit-btn"
              style={{ width: 180, height: 40, background: '#3a539b', color: '#fff', border: 'none', borderRadius: 6, fontSize: 18 }}
              onClick={handleEdit}
              disabled={deleting}
            >
              Edit Request
            </button>
            <button
              className="cancel-btn"
              style={{ width: 200, height: 40, background: '#c0392b', color: '#fff', border: 'none', borderRadius: 6, fontSize: 18 }}
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Delete Request'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ItManpowerRequestDetail;
