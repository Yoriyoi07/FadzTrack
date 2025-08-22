import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../../api/axiosInstance';
import NotificationBell from '../NotificationBell';
import {
  FaTachometerAlt, 
  FaComments, 
  FaBoxes, 
  FaUsers, 
  FaEye,
  FaClipboardList, 
  FaChartBar, 
  FaCalendarAlt,
  FaArrowLeft,
  FaEdit,
  FaTrash,
  FaCheck,
  FaTimes,
  FaCalendarPlus,
  FaUserTie,
  FaProjectDiagram,
  FaClock,
  FaFileAlt,
  FaCheckCircle,
  FaExclamationTriangle,
  FaHourglassHalf
} from 'react-icons/fa';
import '../style/pm_style/Pm_ManpowerRequestDetail.css';

export default function PmRequestedManpowerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  // read user first (avoid TDZ)
  const token = localStorage.getItem('token');
  const stored = localStorage.getItem('user');
  const user = stored ? JSON.parse(stored) : null;
  const userId = user?._id || user?.id || null;
  const userRole = user?.role;
  const [userName] = useState(() => user?.name || 'ALECK');

  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  // request + PM project
  const [request, setRequest] = useState(null);
  const [pmProject, setPmProject] = useState(null);

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [markReceived, setMarkReceived] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [busy, setBusy] = useState(false);

  // manpower selection (from THIS PM's project)
  const [availableManpowers, setAvailableManpowers] = useState([]);
  const [selectedManpowerIds, setSelectedManpowerIds] = useState([]);

  const isPM = userRole === 'Project Manager';

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.user-profile')) setProfileMenuOpen(false);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleLogout = () => {
    api.post('/auth/logout', {}, {
      headers: { Authorization: `Bearer ${token}` }
    }).finally(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      navigate('/');
    });
  };

  // load request
  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await api.get(`/manpower-requests/${id}`);
        setRequest(data);
      } catch {
        setError('Failed to load request');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [id]);

  // am I the creator?
  const isMine = useMemo(() => {
    const creatorId = request?.createdBy?._id || request?.createdBy?.id || request?.createdBy;
    return creatorId && userId && creatorId === userId;
  }, [request, userId]);

  const isApproved = (request?.status || '').toLowerCase() === 'approved';

  // load THIS PM's assigned project (source of manpower)
  useEffect(() => {
    if (!token || !userId || !isPM) return;
    const loadPmProject = async () => {
      try {
        const { data } = await api.get(`/projects/assigned/projectmanager/${userId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setPmProject(data && data._id ? data : null);
      } catch {
        setPmProject(null);
      }
    };
    loadPmProject();
  }, [token, userId, isPM]);

  // fetch manpower ONLY from this PM's project
  useEffect(() => {
    if (!request || isMine || !isPM || !pmProject?._id) return;

    const fetchManpowerFromPmProject = async () => {
      try {
        // preferred: server filters by project
        const { data } = await api.get('/manpower', { params: { project: pmProject._id } });
        setAvailableManpowers(Array.isArray(data) ? data : []);
      } catch {
        // fallback: try inactive list, then filter if any project association exists
        try {
          const { data } = await api.get('/manpower-requests/inactive');
          const filtered = Array.isArray(data)
            ? data.filter(m => {
                const ap = m.assignedProject?._id || m.assignedProject || m.project || m.homeProject;
                return ap ? String(ap) === String(pmProject._id) : false;
              })
            : [];
          setAvailableManpowers(filtered);
        } catch {
          setAvailableManpowers([]);
        }
      }
    };

    fetchManpowerFromPmProject();
  }, [request, isMine, isPM, pmProject]);

  // actions
  const handleApprove = async () => {
    if (!isPM || isMine) return;
    if (!request?.project?._id) {
      alert('Missing destination project id.');
      return;
    }
    if (selectedManpowerIds.length === 0) {
      alert('Please select at least one manpower to assign.');
      return;
    }
    setBusy(true);
    try {
      await api.put(`/manpower-requests/${id}/approve`, {
        manpowerProvided: selectedManpowerIds,
        project: request.project._id,       // destination
        // NOTE: we're NOT sending "area" anymore to avoid the ObjectId confusion
      });
      alert('✅ Approved');
      const { data } = await api.get(`/manpower-requests/${id}`);
      setRequest(data);
      setSelectedManpowerIds([]);
    } catch (e) {
      alert(e?.response?.data?.message || 'Approval failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleDeny = async () => {
    if (!isPM || isMine) return;
    if (!window.confirm('Deny this request?')) return;
    setBusy(true);
    try {
      await api.put(`/manpower-requests/${id}`, { status: 'Rejected' });
      alert('Request denied.');
      const { data } = await api.get(`/manpower-requests/${id}`);
      setRequest(data);
    } catch (e) {
      alert(e?.response?.data?.message || 'Failed to deny.');
    } finally {
      setBusy(false);
    }
  };

  const handleToggleReceived = async () => {
    const next = !markReceived;
    setMarkReceived(next);
    // Optionally persist:
    // await api.put(`/manpower-requests/${id}/received`, { received: next });
  };

  const handleScheduleReturn = () => setShowCalendar(true);
  const handleDateConfirm = async () => {
    if (!selectedDate) return;
    try {
      await api.put(`/manpower-requests/${id}/return`, { returnDate: selectedDate });
      setShowCalendar(false);
      const { data } = await api.get(`/manpower-requests/${id}`);
      setRequest(data);
      alert(`Return scheduled for ${selectedDate}`);
    } catch {
      alert('Failed to set return date');
    }
  };

  const handleEdit = () => navigate(`/pm/request-manpower/edit/${id}`);
  const handleCancel = async () => {
    if (!window.confirm('Are you sure you want to cancel this request?')) return;
    try {
      await api.delete(`/manpower-requests/${id}`);
      navigate('/pm/manpower-list');
    } catch {
      alert('Cancel failed.');
    }
  };

  // helpers
  const sourceProjectName = pmProject?.projectName || 'your project';
  const destProjectName = request?.project?.projectName || 'this project';

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'approved':
        return <FaCheckCircle className="status-icon approved" />;
      case 'rejected':
        return <FaTimes className="status-icon rejected" />;
      case 'pending':
        return <FaHourglassHalf className="status-icon pending" />;
      default:
        return <FaHourglassHalf className="status-icon pending" />;
    }
  };

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading manpower request details...</p>
        </div>
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="dashboard-container">
        <div className="error-container">
          <FaExclamationTriangle className="error-icon" />
          <p>{error || 'Request not found.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* Modern Header - Same as PM Dashboard */}
      <header className="dashboard-header">
        {/* Top Row: Logo and Profile */}
        <div className="header-top">
          <div className="logo-section">
            <img
              src={require('../../assets/images/FadzLogo1.png')}
              alt="FadzTrack Logo"
              className="header-logo"
            />
            <h1 className="header-brand">FadzTrack</h1>
          </div>
          
          <div className="user-profile" onClick={() => setProfileMenuOpen(!profileMenuOpen)}>
            <div className="profile-avatar">
              {userName ? userName.charAt(0).toUpperCase() : 'P'}
            </div>
            <div className="profile-info">
              <span className="profile-name">{userName}</span>
              <span className="profile-role">{userRole}</span>
            </div>
            {profileMenuOpen && (
              <div className="profile-dropdown">
                <button onClick={handleLogout} className="logout-btn">
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Row: Navigation and Notifications */}
        <div className="header-bottom">
          <nav className="header-nav">
            <Link to="/pm" className="nav-item">
              <FaTachometerAlt />
              <span>Dashboard</span>
            </Link>
            <Link to="/pm/chat" className="nav-item">
              <FaComments />
              <span>Chat</span>
            </Link>
            <Link to="/pm/request/:id" className="nav-item">
              <FaBoxes />
              <span>Material</span>
            </Link>
            <Link to="/pm/manpower-list" className="nav-item active">
              <FaUsers />
              <span>Manpower</span>
            </Link>
            {pmProject && (
              <Link to={`/pm/viewprojects/${pmProject._id || pmProject.id}`} className="nav-item">
                <FaEye />
                <span>View Project</span>
              </Link>
            )}
            <Link to="/pm/daily-logs" className="nav-item">
              <FaClipboardList />
              <span>Logs</span>
            </Link>
            {pmProject && (
              <Link to={`/pm/progress-report/${pmProject._id}`} className="nav-item">
                <FaChartBar />
                <span>Reports</span>
              </Link>
            )}
            <Link to="/pm/daily-logs-list" className="nav-item">
              <FaCalendarAlt />
              <span>Daily Logs</span>
            </Link>
          </nav>
          
          <NotificationBell />
        </div>
      </header>

      {/* Main Content Area */}
      <main className="dashboard-main">
        <div className="content-wrapper">
          {/* Page Header */}
          <div className="page-header">
            <div className="page-header-content">
              <button 
                onClick={() => navigate('/pm/manpower-list')} 
                className="back-button"
              >
                <FaArrowLeft />
                <span>Back to Manpower List</span>
              </button>
              <div className="page-title-section">
                <h1 className="page-title">
                  Manpower Request Details
                </h1>
                <p className="page-subtitle">
                  Review and manage manpower request #{request.requestNumber || id?.slice(-3)}
                </p>
              </div>
            </div>
          </div>

          {/* Request Details Container */}
          <div className="request-details-container">
                         {/* Status Banner */}
             <div className={`status-banner ${request.status?.toLowerCase()}`}>
               {/* Overdue Ribbon for Pending Requests */}
               {request.status?.toLowerCase() === 'pending' && 
                request.acquisitionDate && 
                new Date(request.acquisitionDate) < new Date() && (
                 <div className="overdue-ribbon">
                   <span>OVERDUE</span>
                 </div>
               )}
               
               <div className="status-content">
                 {getStatusIcon(request.status)}
                 <div className="status-info">
                   <h3 className="status-title">
                     {request.status || 'Pending'} Request
                   </h3>
                   <p className="status-description">
                     {request.status?.toLowerCase() === 'approved' 
                       ? 'This request has been approved and manpower assigned'
                       : request.status?.toLowerCase() === 'rejected'
                       ? 'This request has been rejected'
                       : isMine 
                         ? 'Awaiting approval from another project manager'
                         : 'Waiting for approval'
                     }
                   </p>
                 </div>
               </div>
               
               {/* Received Toggle for Approved Requests */}
               {isApproved && (
                 <div className="received-toggle">
                   <label className="toggle-label">
                     <input 
                       type="checkbox" 
                       checked={markReceived} 
                       onChange={handleToggleReceived}
                       className="toggle-input"
                     />
                     <span className="toggle-text">Mark as Received</span>
                   </label>
                 </div>
               )}
             </div>

            {/* Request Information Cards */}
            <div className="info-grid">
              {/* Basic Info Card */}
              <div className="info-card">
                <div className="card-header">
                  <FaFileAlt className="card-icon" />
                  <h3>Request Information</h3>
                </div>
                <div className="card-content">
                  <div className="info-row">
                    <span className="info-label">Request Number:</span>
                    <span className="info-value">#{request.requestNumber || id?.slice(-3)}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Created By:</span>
                    <span className="info-value">
                      <FaUserTie className="inline-icon" />
                      {request.createdBy?.name || 'Unknown'}
                    </span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Project:</span>
                    <span className="info-value">
                      <FaProjectDiagram className="inline-icon" />
                      {request.project?.projectName || 'Unknown Project'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Timeline Card */}
              <div className="info-card">
                <div className="card-header">
                  <FaClock className="card-icon" />
                  <h3>Timeline</h3>
                </div>
                <div className="card-content">
                  <div className="info-row">
                    <span className="info-label">Target Date:</span>
                    <span className="info-value">
                      {request.acquisitionDate ? new Date(request.acquisitionDate).toLocaleDateString() : 'Not set'}
                    </span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Duration:</span>
                    <span className="info-value">{request.duration} days</span>
                  </div>
                  {request.returnDate && (
                    <div className="info-row">
                      <span className="info-label">Return Date:</span>
                      <span className="info-value">
                        {new Date(request.returnDate).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Manpower Requirements */}
            <div className="requirements-card">
              <div className="card-header">
                <FaUsers className="card-icon" />
                <h3>Manpower Requirements</h3>
              </div>
              <div className="card-content">
                {Array.isArray(request?.manpowers) && request.manpowers.length > 0 ? (
                  <div className="manpower-grid">
                    {request.manpowers.map((mp, i) => (
                      <div key={i} className="manpower-item">
                        <div className="manpower-quantity">{mp.quantity}</div>
                        <div className="manpower-type">{mp.type}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="no-manpower">
                    <p>No manpower types listed</p>
                  </div>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="description-card">
              <div className="card-header">
                <FaFileAlt className="card-icon" />
                <h3>Request Description</h3>
              </div>
              <div className="card-content">
                <div className="description-text">
                  {request.description || 'No description provided'}
                </div>
              </div>
            </div>

            {/* Approval Panel (Others' request only) */}
            {!isMine && isPM && !isApproved && (
              <div className="approval-panel">
                <div className="panel-header">
                  <h3>Approve & Assign Manpower</h3>
                  <p className="panel-description">
                    Transfer manpower from <span className="source-project">{sourceProjectName}</span> to{' '}
                    <span className="dest-project">{destProjectName}</span>
                  </p>
                </div>

                <div className="manpower-selection">
                  <label className="selection-label">
                    Select manpower from your project
                  </label>
                  <div className="selection-controls">
                    <select
                      defaultValue=""
                      onChange={(e) => {
                        const val = e.target.value;
                        if (!val) return;
                        setSelectedManpowerIds(prev => (prev.includes(val) ? prev : [...prev, val]));
                      }}
                      className="manpower-select"
                    >
                      <option value="">
                        {pmProject ? 'Pick manpower…' : 'No PM project found'}
                      </option>
                      {availableManpowers
                        .filter(mp => !selectedManpowerIds.includes(mp._id))
                        .map(mp => (
                          <option key={mp._id} value={mp._id}>
                            {mp.name} ({mp.position})
                          </option>
                        ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setSelectedManpowerIds([])}
                      className="clear-btn"
                      title="Clear selection"
                    >
                      Clear
                    </button>
                  </div>

                  {selectedManpowerIds.length > 0 && (
                    <div className="selected-manpower">
                      {selectedManpowerIds.map(idv => {
                        const mp = availableManpowers.find(m => m._id === idv);
                        return (
                          <span key={idv} className="manpower-tag">
                            {mp ? `${mp.name} (${mp.position})` : idv}
                            <button
                              onClick={() => setSelectedManpowerIds(prev => prev.filter(x => x !== idv))}
                              className="remove-tag-btn"
                              title="Remove"
                            >
                              ×
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="approval-actions">
                  <button
                    onClick={handleDeny}
                    disabled={busy}
                    className="deny-btn"
                  >
                    <FaTimes />
                    <span>Deny Request</span>
                  </button>
                  <button
                    onClick={handleApprove}
                    disabled={busy || selectedManpowerIds.length === 0}
                    className="approve-btn"
                  >
                    <FaCheck />
                    <span>{busy ? 'Processing…' : 'Approve & Assign'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Creator Actions */}
            {isMine && !isApproved && (
              <div className="creator-actions">
                <button onClick={handleEdit} className="edit-btn">
                  <FaEdit />
                  <span>Edit Request</span>
                </button>
                <button onClick={handleCancel} className="cancel-btn">
                  <FaTrash />
                  <span>Cancel Request</span>
                </button>
              </div>
            )}

            {/* Return Scheduling & Navigation */}
            <div className="bottom-actions">
              <button
                onClick={() => navigate(-1)}
                className="back-btn"
              >
                <FaArrowLeft />
                <span>Go Back</span>
              </button>

              {isApproved && !request.returnDate && (
                <button
                  onClick={handleScheduleReturn}
                  disabled={!markReceived}
                  className={`schedule-btn ${!markReceived ? 'disabled' : ''}`}
                >
                  <FaCalendarPlus />
                  <span>Schedule Return</span>
                </button>
              )}
            </div>
          </div>

          {/* Calendar Modal */}
          {showCalendar && (
            <div className="modal-overlay">
              <div className="calendar-modal">
                <div className="modal-header">
                  <h3>Schedule Return Date</h3>
                </div>
                <div className="modal-content">
                  <input
                    type="date"
                    value={selectedDate}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={e => setSelectedDate(e.target.value)}
                    className="date-input"
                  />
                </div>
                <div className="modal-actions">
                  <button
                    className="confirm-btn"
                    disabled={!selectedDate}
                    onClick={handleDateConfirm}
                  >
                    Confirm
                  </button>
                  <button
                    className="cancel-modal-btn"
                    onClick={() => setShowCalendar(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
