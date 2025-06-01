import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useParams } from 'react-router-dom';
import '../style/am_style/Area_Manpower_ReqDetails.css';
import api from '../../api/axiosInstance'; // ✅ Import axios instance

export default function Area_Manpower_ReqDetails() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [reqData, setReqData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reviewMode, setReviewMode] = useState(false);
  const [approveLoading, setApproveLoading] = useState(false);

  // For the review form
  const [selectedArea, setSelectedArea] = useState('');
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedManpower, setSelectedManpower] = useState('');
  const [manpowerToLend, setManpowerToLend] = useState('');

  const stored = localStorage.getItem('user');
  const user = stored ? JSON.parse(stored) : null;

  // Dummy options (replace with real ones if you have)
  const areaList = [
    { id: 'area1', name: 'Batangas' },
    { id: 'area2', name: 'Laguna' }
  ];
  const projectsList = [
    { id: reqData?.project?._id, name: reqData?.project?.projectName || "Project A" }
  ];
  const manpowerList = [
    { id: 'mp1', name: 'Mason' },
    { id: 'mp2', name: 'Painter' },
    { id: 'mp3', name: 'Electrician' }
  ];

  function getShortId(data) {
    return data && data._id ? data._id.slice(-5).toUpperCase() : '';
  }

  // Fetch data
  const fetchRequest = async () => {
    try {
      const res = await api.get(`/manpower-requests/${id}`);
      setReqData(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequest();
    // eslint-disable-next-line
  }, [id]);

  // Profile menu
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

  // DENY request
  const handleDeny = async () => {
    if (!window.confirm("Are you sure you want to deny this request?")) return;
    setApproveLoading(true);
    try {
      await api.put(`/manpower-requests/${id}`, { status: "Rejected" });
      alert("Request Denied!");
      navigate('/am/manpower-requests');
    } catch {
      alert("Failed to deny.");
    } finally {
      setApproveLoading(false);
    }
  };

  // APPROVE/PROVIDE MANPOWER
  const handleProvideManpower = async () => {
    if (!selectedArea || !selectedProject || !selectedManpower || !manpowerToLend) {
      alert('Select all fields.');
      return;
    }
    setApproveLoading(true);
    try {
      await api.put(`/manpower-requests/${id}/approve`, {
        approvedBy: user?.name || '',
        status: "Approved",
        area: selectedArea,
        project: selectedProject,
        manpowerProvided: manpowerToLend
      });
      alert("Request Approved!");
      setReviewMode(false);
      fetchRequest(); // Refetch the data to get updated status
    } catch {
      alert("Failed to approve.");
    } finally {
      setApproveLoading(false);
    }
  };

  // BUTTON: Review
  const handleReviewRequest = () => setReviewMode(true);

  // BUTTON: Back
  const handleBack = () => {
    if (reviewMode) setReviewMode(false);
    else navigate('/am/manpower-requests');
  };

  if (loading) return <div className="fadztrack-main"><div className="fadztrack-card">Loading...</div></div>;
  if (!reqData) return <div className="fadztrack-main"><div className="fadztrack-card">Request not found.</div></div>;

  // ----- Main Render -----
  // If in reviewMode and NOT yet approved
  if (reviewMode && reqData.status !== 'Approved') {
    return (
      <div className="fadztrack-app">
        {/* --- Header --- */}
        <header className="header">
          <div className="logo-container">
            <div className="logo">
              <div className="logo-building"></div>
              <div className="logo-flag"></div>
            </div>
            <h1 className="brand-name">FadzTrack</h1>
          </div>
          <nav className="nav-menu">
            <Link to="/am" className="nav-link">Dashboard</Link>
            <Link to="/am/matreq" className="nav-link">Material</Link>
            <Link to="/am/manpower-requests" className="nav-link">Manpower</Link>
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
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              {profileMenuOpen && (
                <div className="profile-menu">
                  <button onClick={handleLogout}>Logout</button>
                </div>
              )}
            </div>
          </div>
        </header>
        {/* --- Main Review Card --- */}
        <div className="fadztrack-main">
          <div className="fadztrack-card details-card">
            <h1 className="fadztrack-title">
              Manpower Req. <span className="highlight-id">
                #{getShortId(reqData)}
              </span>
            </h1>
            <p className="fadztrack-subtitle">{reqData.project?.location} | {reqData.project?.projectName} | Engr. {reqData.createdBy?.name}</p>
            <div className="fadztrack-form-row center-row">
              <div className="fadztrack-form-group">
                <label><b>Target Acquisition Date:</b></label>
                <div>{reqData.acquisitionDate ? new Date(reqData.acquisitionDate).toLocaleDateString() : ''}</div>
              </div>
              <div className="fadztrack-form-group">
                <label><b>Duration</b></label>
                <div>{reqData.duration} day(s)</div>
              </div>
            </div>
            <div className="fadztrack-summary-section">
              <label><b>Request Summary</b></label>
              <div className="fadztrack-summary-box">
                {(reqData.manpowers || []).map((mp, i) =>
                  <div key={i}>{mp.quantity} {mp.type}</div>
                )}
              </div>
            </div>
            <div className="fadztrack-form-row">
              <div className="fadztrack-form-group">
                <label>Select Area</label>
                <select value={selectedArea} onChange={e => setSelectedArea(e.target.value)} className="fadztrack-select">
                  <option value="">Select Area</option>
                  {areaList.map(area => <option key={area.id} value={area.name}>{area.name}</option>)}
                </select>
              </div>
              <div className="fadztrack-form-group">
                <label>Select Project</label>
                <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)} className="fadztrack-select">
                  <option value="">Select Project</option>
                  {projectsList.map(proj => <option key={proj.id} value={proj.id}>{proj.name}</option>)}
                </select>
              </div>
            </div>
            <div className="fadztrack-form-row">
              <div className="fadztrack-form-group">
                <label>Select Manpower</label>
                <select value={selectedManpower} onChange={e => setSelectedManpower(e.target.value)} className="fadztrack-select">
                  <option value="">Select Manpower</option>
                  {manpowerList.map(mp => <option key={mp.id} value={mp.name}>{mp.name}</option>)}
                </select>
              </div>
              <div className="fadztrack-form-group">
                <label>Manpower to lend:</label>
                <input value={manpowerToLend} onChange={e => setManpowerToLend(e.target.value)} placeholder="Mga Selected" className="fadztrack-select" />
              </div>
            </div>
            {/* Buttons */}
            <div className="fadztrack-buttons" style={{ marginTop: 32 }}>
              <button className="fadztrack-button" onClick={handleBack} disabled={approveLoading}>Back</button>
              <button className="fadztrack-button review-btn" onClick={handleProvideManpower} disabled={approveLoading}>
                {approveLoading ? "Processing..." : "Provide Manpower"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --------- Main read-only details view (also shown when approved) -----------
  return (
    <div className="fadztrack-app">
      <header className="header">
        <div className="logo-container">
          <div className="logo">
            <div className="logo-building"></div>
            <div className="logo-flag"></div>
          </div>
          <h1 className="brand-name">FadzTrack</h1>
        </div>
        <nav className="nav-menu">
          <Link to="/am" className="nav-link">Dashboard</Link>
          <Link to="/am/matreq" className="nav-link">Material</Link>
          <Link to="/am/manpower-requests" className="nav-link">Manpower</Link>
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
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            {profileMenuOpen && (
              <div className="profile-menu">
                <button onClick={handleLogout}>Logout</button>
              </div>
            )}
          </div>
        </div>
      </header>
      <div className="fadztrack-main">
        <div className="fadztrack-card details-card">
          <h1 className="fadztrack-title">
            Manpower Req. <span className="highlight-id">#{getShortId(reqData)}</span>
          </h1>
          <p className="fadztrack-subtitle">{reqData.project?.location} | {reqData.project?.projectName} | Engr. {reqData.createdBy?.name}</p>
          <div className="fadztrack-form-row center-row">
            <div className="fadztrack-form-group">
              <label><b>Target Acquisition Date:</b></label>
              <div>{reqData.acquisitionDate ? new Date(reqData.acquisitionDate).toLocaleDateString() : ''}</div>
            </div>
            <div className="fadztrack-form-group">
              <label><b>Duration</b></label>
              <div>{reqData.duration} day(s)</div>
            </div>
          </div>
          <div className="fadztrack-summary-section">
            <label><b>Request Summary</b></label>
            <div className="fadztrack-summary-box">
              {(reqData.manpowers || []).map((mp, i) =>
                <div key={i}>{mp.quantity} {mp.type}</div>
              )}
            </div>
          </div>
          <div style={{ marginTop: 24 }}>
            <label><b>Request Description</b></label>
            <textarea readOnly value={reqData.description} className="fadztrack-desc-textarea" />
          </div>
          {/* Buttons */}
          <div style={{ display: 'flex', marginTop: 32, gap: 24, justifyContent: 'center' }}>
            {/* Only show buttons if not approved */}
            {reqData.status !== 'Approved' && (
              <>
                <button className="fadztrack-button" style={{ background: '#c0392b' }} onClick={handleDeny} disabled={approveLoading}>Deny Request</button>
                <button className="fadztrack-button review-btn" onClick={handleReviewRequest}>Review Request</button>
              </>
            )}
          </div>
          {/* Approved message */}
          {reqData.status === 'Approved' && (
              <div style={{
                margin: '32px 0 12px 0',
                textAlign: 'center',
                fontWeight: 'bold',
                color: '#189d38'
              }}>
                {reqData.returnDate
                  ? <>
                      Request has been fulfilled, Manpower lent set to return on:
                      <span style={{ color: '#2079c4', marginLeft: 6 }}>
                        {new Date(reqData.returnDate).toLocaleDateString('en-CA')}
                      </span>
                    </>
                  : "Manpower Request Approved"}
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
