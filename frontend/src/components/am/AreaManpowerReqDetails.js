import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useParams } from 'react-router-dom';
import '../style/am_style/Area_Manpower_ReqDetails.css';
import api from '../../api/axiosInstance';
import NotificationBell from '../NotificationBell';
import { FaTachometerAlt, FaComments, FaBoxes, FaUsers, FaProjectDiagram, FaClipboardList, FaChartBar } from 'react-icons/fa';

export default function AreaManpowerReqDetails() {
  const navigate = useNavigate();
  const { id } = useParams();

  // ⚠️ Declare user BEFORE using it anywhere
  const stored = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
  const user = stored ? JSON.parse(stored) : null;

  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [reqData, setReqData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reviewMode, setReviewMode] = useState(false);
  const [approveLoading, setApproveLoading] = useState(false);

  const [selectedManpowers, setSelectedManpowers] = useState([]);
  const [availableManpowers, setAvailableManpowers] = useState([]);

  // Lazy init so we read user once at mount
  const [userName, setUserName] = useState(() => (user?.name ? user.name : 'ALECK'));

  const [selectedArea, setSelectedArea] = useState(user?.area || '');
  const [selectedProject, setSelectedProject] = useState('');

  useEffect(() => {
    fetchRequest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchRequest = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/manpower-requests/${id}`);
      setReqData(data || null);
      setSelectedProject(data?.project?._id || '');
      // If user area exists, keep it; otherwise default empty
      setSelectedArea(prev => prev || user?.area || '');
    } catch (error) {
      console.error('Failed to fetch request:', error);
      setReqData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!reqData) return;
    const fetchAvailable = async () => {
      try {
        const { data } = await api.get('/manpower-requests/inactive');
        const arr = Array.isArray(data) ? data : [];
        
        // Get the requested manpower types from the request
        const requestedTypes = (reqData.manpowers || []).map(mp => mp.type);
        
        // Filter manpower to only show those whose position matches the requested types
        const filtered = arr.filter(mp => requestedTypes.includes(mp.position));
        
        setAvailableManpowers(filtered);
      } catch (error) {
        console.error('❌ Error fetching inactive manpowers:', error);
        setAvailableManpowers([]);
      }
    };
    fetchAvailable();
  }, [reqData]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.profile-menu-container')) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  const handleAddManpower = (mpId) => {
    const selected = availableManpowers.find(mp => mp._id === mpId);
    if (!selected) return;
    if (selectedManpowers.some(m => m._id === mpId)) return;
    setSelectedManpowers(prev => [...prev, selected]);
  };

  const handleRemoveManpower = (mpId) => {
    setSelectedManpowers(prev => prev.filter(mp => mp._id !== mpId));
  };

  const handleProvideManpower = async () => {
    if (!selectedArea || !selectedProject || selectedManpowers.length === 0) {
      alert('Fill all required fields.');
      return;
    }
    setApproveLoading(true);
    try {
      await api.put(`/manpower-requests/${id}/approve`, {
        approvedBy: user?.name || '',
        status: 'Approved',
        area: selectedArea,
        project: selectedProject,
        manpowerProvided: selectedManpowers.map(mp => mp._id),
      });
      alert('✅ Request Approved!');
      setReviewMode(false);
      fetchRequest();
    } catch (error) {
      console.error(error);
      alert(error?.response?.data?.message || '❌ Failed to approve request.');
    } finally {
      setApproveLoading(false);
    }
  };

  const handleDeny = async () => {
    const confirmed = window.confirm(
      'Confirm Rejection?\n\nRejecting this request will remove this from your list of Other\'s Request.'
    );
    
    if (!confirmed) return;
    
    setApproveLoading(true);
    try {
      await api.put(`/manpower-requests/${id}`, { status: 'Rejected' });
      alert('Request rejected successfully. It has been removed from your list.');
      navigate('/am/manpower-requests');
    } catch (error) {
      console.error(error);
      alert(error?.response?.data?.message || 'Failed to reject request.');
    } finally {
      setApproveLoading(false);
    }
  };

  const handleBack = () => {
    if (reviewMode) setReviewMode(false);
    else navigate('/am/manpower-requests');
  };

  const handleReviewRequest = () => setReviewMode(true);

  if (loading) {
    return (
      <div className="fadztrack-main">
        <div className="fadztrack-card">Loading...</div>
      </div>
    );
  }

  if (!reqData) {
    return (
      <div className="fadztrack-main">
        <div className="fadztrack-card">Request not found or failed to load.</div>
      </div>
    );
  }

  return (
    <div className="fadztrack-app">
      {/* Header */}
      <header className="header">
        <div className="logo-container">
          <img
            src={require('../../assets/images/FadzLogo1.png')}
            alt="FadzTrack Logo"
            className="logo-img"
          />
          <h1 className="brand-name">FadzTrack</h1>
        </div>
        <nav className="nav-menu">
          <Link to="/am" className="nav-link"><FaTachometerAlt /> Dashboard</Link>
          <Link to="/am/chat" className="nav-link"><FaComments /> Chat</Link>
          <Link to="/am/matreq" className="nav-link"><FaBoxes /> Material</Link>
          <Link to="/am/manpower-requests" className="nav-link"><FaUsers /> Manpower</Link>
          <Link to="/am/viewproj" className="nav-link"><FaProjectDiagram /> Projects</Link>
          <Link to="/logs" className="nav-link"><FaClipboardList /> Logs</Link>
          <Link to="/reports" className="nav-link"><FaChartBar /> Reports</Link>
        </nav>
        <div className="profile-menu-container" style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <NotificationBell />
          <div className="profile-circle" onClick={() => setProfileMenuOpen(!profileMenuOpen)}>
            {userName ? userName.charAt(0).toUpperCase() : 'Z'}
          </div>
          {profileMenuOpen && (
            <div className="profile-menu">
              <button onClick={handleLogout}>Logout</button>
            </div>
          )}
        </div>
      </header>

      {/* Body */}
      <div className="fadztrack-main">
        <div className="fadztrack-card details-card">
          <div style={{ textAlign: 'center' }}>
            <h1 className="fadztrack-title" style={{ textAlign: 'center' }}>
              Request for {reqData.manpowers.map(mp => `${mp.quantity} ${mp.type}`).join(', ')}
            </h1>
          </div>
          <p className="fadztrack-subtitle">
            {reqData.project?.projectName} | Engr. {reqData.createdBy?.name}
          </p>

          <div className="fadztrack-form-row center-row">
            <div className="fadztrack-form-group">
              <label><b>Target Acquisition Date:</b></label>
              <div>{new Date(reqData.acquisitionDate).toLocaleDateString()}</div>
            </div>
            <div className="fadztrack-form-group">
              <label><b>Duration:</b></label>
              <div>{reqData.duration} day(s)</div>
            </div>
          </div>

          <div className="fadztrack-summary-section">
            <label><b>Request Summary</b></label>
            <div className="fadztrack-summary-box">
              {(reqData.manpowers || []).map((mp, i) => (
                <div key={i}>{mp.quantity} {mp.type}</div>
              ))}
            </div>
          </div>

          {reviewMode && reqData.status !== 'Approved' ? (
            <>
              <div className="fadztrack-form-row">
                <div className="fadztrack-form-group">
                  <label>Select Area</label>
                  <select
                    className="fadztrack-select"
                    value={selectedArea}
                    onChange={e => setSelectedArea(e.target.value)}
                  >
                    <option value="">Select Area</option>
                    <option value="Batangas">Batangas</option>
                    <option value="Laguna">Laguna</option>
                    <option value="Makati">Makati</option>
                  </select>
                </div>
                <div className="fadztrack-form-group">
                  <label>Project</label>
                  <input className="fadztrack-select" value={reqData.project?.projectName || ''} readOnly />
                </div>
              </div>

              <div className="fadztrack-form-group">
                <label>Select Manpower</label>
                {reqData?.manpowers && reqData.manpowers.length > 0 && (
                  <div style={{ marginBottom: '8px', fontSize: '0.9rem', color: '#666' }}>
                    Requested types: {reqData.manpowers.map(mp => `${mp.type} (${mp.quantity})`).join(', ')}
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <select
                    defaultValue=""
                    onChange={e => handleAddManpower(e.target.value)}
                    className="fadztrack-select"
                    style={{ flex: 1 }}
                  >
                    <option value="">
                      {availableManpowers.length === 0 ? 'No matching manpower available' : 'Select Manpower'}
                    </option>
                    {availableManpowers
                      .filter(mp => !selectedManpowers.some(sel => sel._id === mp._id))
                      .map(mp => (
                        <option key={mp._id} value={mp._id}>
                          {mp.name} ({mp.position})
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    className="fadztrack-button"
                    style={{ padding: '8px 14px', fontSize: 14 }}
                    onClick={() => alert('Use dropdown to select manpower.\nRepeat for additional manpower.')}
                  >
                    +
                  </button>
                </div>
              </div>

              {selectedManpowers.length > 0 && (
                <div className="fadztrack-form-group">
                  <label>Manpower to Lend</label>
                  <div className="fadztrack-select" style={{ minHeight: 50, padding: 10, display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {selectedManpowers.map(mp => (
                      <span key={mp._id} style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        background: '#dceafe',
                        color: '#1d4ed8',
                        padding: '6px 12px',
                        borderRadius: '20px',
                        fontSize: '0.95rem'
                      }}>
                        {mp.name} ({mp.position})
                        <button
                          onClick={() => handleRemoveManpower(mp._id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            marginLeft: 8,
                            color: '#1e3a8a',
                            fontWeight: 'bold',
                            fontSize: '1rem',
                            cursor: 'pointer',
                            lineHeight: '1'
                          }}
                          title="Remove"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="fadztrack-buttons" style={{ marginTop: 32 }}>
                <button className="fadztrack-button" onClick={handleBack} disabled={approveLoading}>Back</button>
                <button className="fadztrack-button review-btn" onClick={handleProvideManpower} disabled={approveLoading}>
                  {approveLoading ? 'Processing...' : 'Provide Manpower'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="fadztrack-summary-section">
                <label className="fadztrack-summary-label"><b>Request Description</b></label>
                <div className="fadztrack-summary-description">
                  {reqData.description}
                </div>
              </div>
              {reqData.status !== 'Approved' && (
                                 <div style={{ display: 'flex', marginTop: 32, gap: 24, justifyContent: 'center' }}>
                   <button className="fadztrack-button" style={{ background: '#c0392b' }} onClick={handleDeny} disabled={approveLoading}>Reject Request</button>
                   <button className="fadztrack-button review-btn" onClick={handleReviewRequest}>Review Request</button>
                 </div>
              )}
              {reqData.status === 'Approved' && (
                <div style={{ marginTop: 32, textAlign: 'center', fontWeight: 'bold', color: '#189d38' }}>
                  {reqData.returnDate
                    ? <>Request fulfilled, manpower set to return on:
                        <span style={{ color: '#2079c4', marginLeft: 6 }}>
                          {new Date(reqData.returnDate).toLocaleDateString('en-CA')}
                        </span>
                      </>
                    : 'Manpower Request Approved'}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
