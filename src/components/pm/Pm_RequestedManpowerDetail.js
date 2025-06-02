import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../../api/axiosInstance'; // Adjust the path if needed!

const Pm_RequestedManpowerDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [request, setRequest] = useState(null);
  const [markReceived, setMarkReceived] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [error, setError] = useState('');

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

  // Mark as received logic
  const handleToggleReceived = () => {
    setMarkReceived(!markReceived);
    // Optionally send to backend if you want to persist this state
  };

  // Schedule for return logic
  const handleScheduleReturn = () => setShowCalendar(true);

  const handleDateConfirm = async () => {
    if (!selectedDate) return;
    try {
      await api.put(`/manpower-requests/${id}/return`, { returnDate: selectedDate });
      setShowCalendar(false);
      const refreshed = await api.get(`/manpower-requests/${id}`);
      setRequest(refreshed.data);
      alert(`Return scheduled for ${selectedDate}`);
    } catch (e) {
      alert("Failed to set return date");
    }
  };

  const handleEdit = () => navigate(`/pm/request-manpower/edit/${id}`);

  const handleCancel = () => {
    if (window.confirm('Are you sure you want to cancel this request?')) {
      api.delete(`/manpower-requests/${id}`).then(() => navigate('/pm/manpower-list'));
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error || !request) return <div style={{ color: 'red' }}>{error || "Request not found."}</div>;

  const isApproved = request.status?.toLowerCase() === 'approved';
  const manpowerSummary = (Array.isArray(request.manpowers) && request.manpowers.length > 0)
    ? request.manpowers.map((mp, i) =>
        <div key={i}>{mp.quantity} {mp.type}</div>
      )
    : <div>No manpower types listed</div>;

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header">
        <div className="logo-container">
          <div className="logo">
            <div className="logo-building"></div>
            <div className="logo-flag"></div>
          </div>
          <h1 className="brand-name">FadzTrack</h1>
        </div>
        <nav className="nav-menu">
          <Link to="/pm" className="nav-link">Dashboard</Link>
          <Link to="/pm/request/:id" className="nav-link">Material</Link>
          <Link to="/pm/manpower-list" className="nav-link">Manpower</Link>
          <Link to="/ceo/proj" className="nav-link">Projects</Link>
          <Link to="/chat" className="nav-link">Chat</Link>
          <Link to="/logs" className="nav-link">Logs</Link>
          <Link to="/reports" className="nav-link">Reports</Link>
        </nav>
        <div className="search-profile">
          <div className="search-container">
            <input type="text" placeholder="Search in site" className="search-input" />
            <button className="search-button">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </button>
          </div>
          <div className="profile-menu-container">
            <div
              className="profile-circle"
              onClick={() => setProfileMenuOpen(!profileMenuOpen)}
            >
              Z
            </div>
            {profileMenuOpen && (
              <div className="profile-menu">
                <button onClick={handleLogout}>Logout</button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content" style={{ position: 'relative' }}>
        <div className="form-container" style={{ minWidth: 550, marginTop: 30, marginBottom: 40 }}>
          {/* TOP RIGHT Toggle if status is approved */}
          {isApproved && (
            <div style={{ position: 'absolute', right: 40, top: 25, zIndex: 2 }}>
              <label style={{ fontWeight: 600, marginRight: 12 }}>
                Mark as Received
              </label>
              <input
                type="checkbox"
                checked={markReceived}
                onChange={handleToggleReceived}
                style={{ transform: 'scale(1.5)' }}
              />
            </div>
          )}

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
              <b>Approved By:</b> {request.approvedBy || "N/A"}
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

            {isApproved && request.returnDate && (
              <div style={{
                margin: '32px 0 12px 0',
                textAlign: 'center',
                fontWeight: 'bold',
                color: '#189d38'
              }}>
                Manpower lent set to return on: <span style={{ color: '#2079c4' }}>{new Date(request.returnDate).toLocaleDateString('en-CA')}</span>
              </div>
            )}
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
            {/* Show Schedule for Return button only if received is toggled */}
            {isApproved && !request.returnDate && (
              <button
                className="schedule-btn"
                style={{
                  width: 220, height: 40,
                  background: markReceived ? '#3a539b' : '#aaa',
                  color: '#fff',
                  border: 'none', borderRadius: 6, fontSize: 18,
                  cursor: markReceived ? 'pointer' : 'not-allowed'
                }}
                disabled={!markReceived}
                onClick={handleScheduleReturn}
              >
                Schedule for Return
              </button>
            )}
            {/* For not approved, show edit/cancel */}
            {!isApproved && (
              <>
                <button
                  className="edit-btn"
                  style={{ width: 180, height: 40, background: '#3a539b', color: '#fff', border: 'none', borderRadius: 6, fontSize: 18 }}
                  onClick={handleEdit}
                >
                  Edit Request
                </button>
                <button
                  className="cancel-btn"
                  style={{ width: 200, height: 40, background: '#c0392b', color: '#fff', border: 'none', borderRadius: 6, fontSize: 18 }}
                  onClick={handleCancel}
                >
                  Cancel Request
                </button>
              </>
            )}
          </div>
        </div>

        {/* --- Calendar Popup Dialog --- */}
        {showCalendar && (
          <div style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            background: 'rgba(0,0,0,0.25)', zIndex: 999, display: 'flex', justifyContent: 'center', alignItems: 'center'
          }}>
            <div style={{
              background: '#fff', borderRadius: 10, boxShadow: '0 2px 8px #0002',
              padding: 32, width: 360, display: 'flex', flexDirection: 'column', alignItems: 'center'
            }}>
              <h3>Schedule Return Date</h3>
              <input
                type="date"
                value={selectedDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={e => setSelectedDate(e.target.value)}
                style={{ fontSize: 18, padding: 8, margin: '20px 0', width: '100%' }}
              />
              <div style={{ display: 'flex', gap: 24 }}>
                <button
                  style={{ padding: '8px 24px', borderRadius: 6, background: '#3a539b', color: '#fff', fontSize: 16 }}
                  disabled={!selectedDate}
                  onClick={handleDateConfirm}
                >
                  Confirm
                </button>
                <button
                  style={{ padding: '8px 24px', borderRadius: 6, background: '#c0392b', color: '#fff', fontSize: 16 }}
                  onClick={() => setShowCalendar(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Pm_RequestedManpowerDetail;
