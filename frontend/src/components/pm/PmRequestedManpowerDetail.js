import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../../api/axiosInstance';
import NotificationBell from '../NotificationBell';
import {
  FaTachometerAlt, FaComments, FaBoxes, FaUsers, FaEye,
  FaClipboardList, FaChartBar, FaCalendarAlt
} from 'react-icons/fa';

const chats = [
  { id: 1, name: 'Rychea Miralles', initial: 'R', message: 'Hello Good Morning po! As...', color: '#4A6AA5' },
  { id: 2, name: 'Third Castellar', initial: 'T', message: 'Hello Good Morning po! As...', color: '#2E7D32' },
  { id: 3, name: 'Zenarose Miranda', initial: 'Z', message: 'Hello Good Morning po! As...', color: '#9C27B0' }
];

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
      if (!e.target.closest('.profile-menu-container')) setProfileMenuOpen(false);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
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
        // NOTE: we’re NOT sending "area" anymore to avoid the ObjectId confusion
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

  if (loading) return <div style={{ padding: 24 }}>Loading...</div>;
  if (error || !request) return <div style={{ color: 'red', padding: 24 }}>{error || 'Request not found.'}</div>;

  return (
    <div>
      {/* HEADER / NAV like the PM pages */}
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
          <Link to="/pm" className="nav-link"><FaTachometerAlt /> Dashboard</Link>
          <Link to="/pm/chat" className="nav-link"><FaComments /> Chat</Link>
          <Link to="/pm/request/:id" className="nav-link"><FaBoxes /> Material</Link>
          <Link to="/pm/manpower-list" className="nav-link"><FaUsers /> Manpower</Link>
          {pmProject && (
            <Link to={`/pm/viewprojects/${pmProject._id || pmProject.id}`} className="nav-link">
              <FaEye /> View Project
            </Link>
          )}
          <Link to="/pm/daily-logs" className="nav-link"><FaClipboardList /> Logs</Link>
          {pmProject && (
            <Link to={`/pm/progress-report/${pmProject._id}`} className="nav-link">
              <FaChartBar /> Reports
            </Link>
          )}
          <Link to="/pm/daily-logs-list" className="nav-link"><FaCalendarAlt /> Daily Logs</Link>
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

      <div className="dashboard-layout">
        {/* Sidebar (optional) */}
        <div className="sidebar">
          <div className="chats-section">
            <h3 className="chats-title">Chats</h3>
            <div className="chats-list">
              {chats.map(chat => (
                <div key={chat.id} className="chat-item">
                  <div className="chat-avatar" style={{ backgroundColor: chat.color }}>{chat.initial}</div>
                  <div className="chat-info">
                    <div className="chat-name">{chat.name}</div>
                    <div className="chat-message">{chat.message}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main */}
        <main className="main-content" style={{ position: 'relative' }}>
          <div className="form-container" style={{ minWidth: 550, marginTop: 30, marginBottom: 40 }}>
            {/* received toggle once approved */}
            {isApproved && (
              <div style={{ position: 'absolute', right: 40, top: 25, zIndex: 2 }}>
                <label style={{ fontWeight: 600, marginRight: 12 }}>Mark as Received</label>
                <input type="checkbox" checked={markReceived} onChange={handleToggleReceived} style={{ transform: 'scale(1.5)' }} />
              </div>
            )}

            {/* Title */}
            <h2 style={{ textAlign: 'center', fontSize: 32, fontWeight: 700 }}>
              Manpower Req. {request.requestNumber || id?.slice(-3)}
            </h2>
            <div style={{ textAlign: 'center', fontSize: 16, fontWeight: 500, marginBottom: 15 }}>
              {request.project?.projectName} | Engr. {request.createdBy?.name}
            </div>

            {/* Meta */}
            <div style={{ display: 'flex', flexDirection: 'row', gap: 40, justifyContent: 'center', marginBottom: 12 }}>
              <div><b>Target Acquisition Date:</b><br />{request.acquisitionDate ? new Date(request.acquisitionDate).toLocaleDateString() : ''}</div>
              <div><b>Duration:</b><br />{request.duration} days</div>
            </div>

            {/* Summary */}
            <div style={{ margin: '0 auto', width: 320, marginBottom: 24 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Request Summary</div>
              <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12, minHeight: 60, background: '#fafbfd', fontSize: 16 }}>
                {Array.isArray(request?.manpowers) && request.manpowers.length > 0
                  ? request.manpowers.map((mp, i) => <div key={i}>{mp.quantity} {mp.type}</div>)
                  : <div>No manpower types listed</div>}
              </div>
            </div>

            {/* Description */}
            <div style={{ margin: '0 auto', width: 480, marginBottom: 24 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Request Description</div>
              <textarea
                value={request.description || ''}
                readOnly
                style={{ width: '100%', minHeight: 70, border: '1px solid #ddd', borderRadius: 8, padding: 10, background: '#fafbfd', resize: 'none' }}
              />
            </div>

            {/* ===== APPROVAL PANEL (Others' request only) ===== */}
            {!isMine && isPM && !isApproved && (
              <div style={{
                margin: '0 auto', width: 520, padding: 16, borderRadius: 12,
                border: '1px solid #e5e7eb', background: '#ffffff', boxShadow: '0 2px 10px rgba(0,0,0,.04)'
              }}>
                <div style={{ fontWeight: 800, marginBottom: 10 }}>
                  Approve & assign <span style={{ color: '#1d4ed8' }}>from {sourceProjectName}</span> →{' '}
                  <span style={{ color: '#16a34a' }}>{destProjectName}</span>
                </div>

                {/* Manpower from THIS PM's project */}
                <div>
                  <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>
                    Select manpower from your project
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <select
                      defaultValue=""
                      onChange={(e) => {
                        const val = e.target.value;
                        if (!val) return;
                        setSelectedManpowerIds(prev => (prev.includes(val) ? prev : [...prev, val]));
                      }}
                      style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid #e5e7eb' }}
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
                      style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff', fontWeight: 700 }}
                      title="Clear selection"
                    >
                      Clear
                    </button>
                  </div>

                  {selectedManpowerIds.length > 0 && (
                    <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8, border: '1px dashed #e5e7eb', borderRadius: 10, padding: 10 }}>
                      {selectedManpowerIds.map(idv => {
                        const mp = availableManpowers.find(m => m._id === idv);
                        return (
                          <span key={idv} style={{
                            display: 'inline-flex', alignItems: 'center',
                            padding: '6px 10px', borderRadius: 999, background: '#eef2ff', color: '#4338ca', fontWeight: 700
                          }}>
                            {mp ? `${mp.name} (${mp.position})` : idv}
                            <button
                              onClick={() => setSelectedManpowerIds(prev => prev.filter(x => x !== idv))}
                              style={{ marginLeft: 8, border: 'none', background: 'transparent', cursor: 'pointer', color: '#3730a3', fontWeight: 900 }}
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

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 14 }}>
                  <button
                    onClick={handleDeny}
                    disabled={busy}
                    style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff', fontWeight: 800, color: '#991b1b' }}
                  >
                    Deny
                  </button>
                  <button
                    onClick={handleApprove}
                    disabled={busy || selectedManpowerIds.length === 0}
                    style={{ padding: '10px 14px', border: 'none', borderRadius: 10, fontWeight: 800, color: '#fff', background: '#2e7d32' }}
                  >
                    {busy ? 'Processing…' : 'Approve & Assign'}
                  </button>
                </div>
              </div>
            )}

            {/* CREATOR ACTIONS */}
            {isMine && !isApproved && (
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 18 }}>
                <button
                  onClick={handleEdit}
                  style={{ width: 180, height: 40, background: '#3a539b', color: '#fff', border: 'none', borderRadius: 6, fontSize: 16, fontWeight: 700 }}
                >
                  Edit Request
                </button>
                <button
                  onClick={handleCancel}
                  style={{ width: 200, height: 40, background: '#c0392b', color: '#fff', border: 'none', borderRadius: 6, fontSize: 16, fontWeight: 700 }}
                >
                  Cancel Request
                </button>
              </div>
            )}

            {/* RETURN SCHEDULING */}
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 18 }}>
              <button
                onClick={() => navigate(-1)}
                style={{ width: 160, height: 40, background: '#6b7280', color: '#fff', border: 'none', borderRadius: 6, fontSize: 16, fontWeight: 700 }}
              >
                Back
              </button>

              {isApproved && !request.returnDate && (
                <button
                  onClick={handleScheduleReturn}
                  disabled={!markReceived}
                  style={{
                    width: 220, height: 40,
                    background: markReceived ? '#3a539b' : '#aaa',
                    color: '#fff', border: 'none', borderRadius: 6, fontSize: 16, fontWeight: 700,
                    cursor: markReceived ? 'pointer' : 'not-allowed'
                  }}
                >
                  Schedule for Return
                </button>
              )}
            </div>
          </div>

          {/* Calendar Modal */}
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
    </div>
  );
}
