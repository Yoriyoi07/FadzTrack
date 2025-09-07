import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../../api/axiosInstance';
import AppHeader from '../layout/AppHeader';
import {
  FaTachometerAlt,
  FaComments,
  FaUsers,
  FaExchangeAlt,
  FaProjectDiagram,
  FaClipboardList,
  FaChartBar,
  FaArrowLeft,
  FaTrash,
  FaCalendarPlus,
  FaCalendarAlt,
  FaUserTie,
  FaClock,
  FaFileAlt,
  FaCheckCircle,
  FaExclamationTriangle,
  FaHourglassHalf
} from 'react-icons/fa';
import '../style/hr_style/Hr_ManpowerRequestDetail.css';

// IT-style helper functions and styles
const inputStyle = { width:'100%', padding:'10px 12px', border:'1px solid #d1d5db', borderRadius:6, fontSize:14 };
const pill = (bg, color='#111827') => ({ background:bg, color, padding:'4px 10px', borderRadius:20, fontSize:12, fontWeight:600, display:'inline-flex', alignItems:'center', gap:6 });
const labelStyle = { display:'block', fontWeight:600, marginBottom:6, fontSize:13, letterSpacing:'.25px', color:'#374151' };
const valueBox = { padding:'12px 14px', border:'1px solid #e5e7eb', borderRadius:8, background:'#fff', fontSize:14, minHeight:44, display:'flex', alignItems:'center' };
const btn = (variant) => {
  const base = { display:'inline-flex', alignItems:'center', gap:8, padding:'10px 18px', fontSize:14, fontWeight:600, borderRadius:8, border:'none', cursor:'pointer' };
  switch(variant){
    case 'primary': return { ...base, background:'#2563eb', color:'#fff' };
    case 'danger': return { ...base, background:'#dc2626', color:'#fff' };
    case 'neutral': return { ...base, background:'#6b7280', color:'#fff' };
    default: return { ...base, background:'#e5e7eb', color:'#111827' };
  }
};

const getStatusBadgeStyle = (status) => {
  const statusColors = {
    Pending: pill('#fef3c7', '#92400e'),
    Approved: pill('#dcfce7', '#065f46'),
    Overdue: pill('#fee2e2', '#991b1b'),
    Completed: pill('#e0f2fe', '#075985'),
    Rejected: pill('#fee2e2', '#991b1b')
  };
  return statusColors[status] || pill('#e5e7eb');
};

const HrManpowerRequestDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  // User data
  const token = localStorage.getItem('token');
  const stored = localStorage.getItem('user');
  const user = stored ? JSON.parse(stored) : null;
  const userId = user?._id || user?.id || null;
  const userRole = user?.role;
  const [userName] = useState(() => user?.name || 'HR Manager');

  // Profile dropdown handled by AppHeader

  // Request data
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // UI state
  const [markReceived, setMarkReceived] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');

  // Removed outside click listener (unified header)

  const handleLogout = () => {
    api.post('/auth/logout', {}, {
      headers: { Authorization: `Bearer ${token}` }
    }).finally(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      navigate('/');
    });
  };

  // Load request data
  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await api.get(`/manpower-requests/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setRequest(data);
        
        // Mark as viewed
        if (!data.isViewed) {
          try {
            await api.put(`/manpower-requests/${id}`, {
              isViewed: true
            }, {
              headers: { Authorization: `Bearer ${token}` }
            });
          } catch (err) {
            console.error('Failed to mark as viewed:', err);
          }
        }
      } catch (err) {
        setError('Failed to load request details');
        console.error('Error fetching request:', err);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [id, token]);

  const handleBack = () => navigate('/hr/movement');



  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this request? This action cannot be undone.')) return;
    
    setBusy(true);
    try {
      await api.delete(`/manpower-requests/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      alert('🗑️ Request deleted successfully');
      navigate('/hr/dash');
    } catch (err) {
      console.error('Error deleting request:', err);
      alert('❌ Failed to delete request');
    } finally {
      setBusy(false);
    }
  };

  const handleToggleReceived = async () => {
    const next = !markReceived;
    setMarkReceived(next);
  };

  const handleScheduleReturn = () => setShowCalendar(true);
  const handleDateConfirm = async () => {
    if (!selectedDate) return;
    try {
      await api.put(`/manpower-requests/${id}/return`, { returnDate: selectedDate });
      setShowCalendar(false);
      const { data } = await api.get(`/manpower-requests/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRequest(data);
      alert(`Return scheduled for ${selectedDate}`);
    } catch {
      alert('Failed to set return date');
    }
  };

  const isApproved = (request?.status || '').toLowerCase() === 'approved';

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'approved':
        return <FaCheckCircle className="status-icon approved" />;
      case 'rejected':
        return <FaExclamationTriangle className="status-icon rejected" />;
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
      <AppHeader
        roleSegment="hr"
        onLogout={handleLogout}
        overrideNav={[
          { to:'/hr/dash', label:'Dashboard', icon:<FaTachometerAlt/>, match:'/hr/dash' },
          { to:'/hr/chat', label:'Chat', icon:<FaComments/>, match:'/hr/chat' },
          { to:'/hr/mlist', label:'Manpower', icon:<FaUsers/>, match:'/hr/mlist' },
          { to:'/hr/movement', label:'Movement', icon:<FaExchangeAlt/>, match:'/hr/movement' },
          { to:'/hr/project-records', label:'Projects', icon:<FaProjectDiagram/>, match:'/hr/project-records' },
          { to:'/hr/attendance', label:'Attendance', icon:<FaCalendarAlt/>, match:'/hr/attendance' }
        ]}
      />

      <main className="dashboard-main">
        <div className="form-container" style={{ maxWidth:900, margin:'40px auto', background:'#fff', borderRadius:16, padding:'32px 40px', boxShadow:'0 4px 16px rgba(0,0,0,0.06)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:24 }}>
            <div>
              <h2 style={{ margin:0, fontSize:30, fontWeight:700 }}>Manpower Request #{(request._id || '').slice(-5)}</h2>
              <div style={{ marginTop:8, fontSize:14, color:'#4b5563' }}>
                Project: <strong>{request.project?.projectName || 'N/A'}</strong> &nbsp;•&nbsp; Requested by {request.createdBy?.name}
              </div>
              <div style={{ marginTop:12 }}>
                <span style={getStatusBadgeStyle(request.status)}>{request.status}</span>
              </div>
            </div>
            <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
              <button onClick={handleBack} style={btn('secondary')}>Back</button>
              <button disabled={busy} onClick={handleDelete} style={btn('danger')}>{busy? 'Deleting...' : 'Delete'}</button>
            </div>
          </div>

          {/* Content Sections */}
          <div style={{ marginTop:32, display:'grid', gap:32, gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))' }}>
            <div>
              <label style={labelStyle}>Target Acquisition Date</label>
              <div style={valueBox}>{request.acquisitionDate ? new Date(request.acquisitionDate).toLocaleDateString() : '—'}</div>
            </div>
            <div>
              <label style={labelStyle}>Duration (days)</label>
              <div style={valueBox}>{request.duration} days</div>
            </div>
            <div>
              <label style={labelStyle}>Project</label>
              <div style={{ ...valueBox, background:'#f3f4f6' }}>{request.project?.projectName || '—'}</div>
            </div>
          </div>

          <div style={{ marginTop:40 }}>
            <label style={labelStyle}>Manpower Needed</label>
            <div style={{ display:'flex', flexWrap:'wrap', gap:12 }}>
              {request.manpowers?.length ? request.manpowers.map((m,i)=>(
                <span key={i} style={pill('#eef2ff', '#3730a3')}>{m.quantity} {m.type}</span>
              )) : <span style={{ color:'#6b7280' }}>No manpower entries</span>}
            </div>
          </div>

          <div style={{ marginTop:40 }}>
            <label style={labelStyle}>Description / Purpose</label>
            <div style={{ ...valueBox, minHeight:80 }}>{request.description || 'No description provided'}</div>
          </div>

          {/* HR-specific functionality */}
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
                      : 'Waiting for HR approval'
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



            {/* Management Actions */}
            <div className="creator-actions">
              <button onClick={handleDelete} className="cancel-btn">
                <FaTrash />
                <span>Delete Request</span>
              </button>
            </div>

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

          <AuditTrail requestId={request._id} />
        </div>
      </main>
    </div>
  );
};

// Audit trail component (inline fetch)
const AuditTrail = ({ requestId }) => {
  const [logs, setLogs] = React.useState([]);
  const [open, setOpen] = React.useState(false);
  const token = localStorage.getItem('token');
  useEffect(() => {
    if (!open) return;
    const fetchLogs = async () => {
      try {
        const { data } = await api.get('/audit-logs', { headers:{ Authorization:`Bearer ${token}` } });
        // Filter to those referencing this request
        const filtered = data.filter(l => l.meta?.requestId === requestId);
        setLogs(filtered);
      } catch(e){ console.error('Audit fetch failed', e); }
    };
    fetchLogs();
  }, [open, requestId, token]);

  return (
    <div style={{ marginTop:48 }}>
      <button onClick={()=>setOpen(o=>!o)} style={{ ...btn('neutral'), background:'#f3f4f6', color:'#111827' }}>{open? 'Hide' : 'Show'} Audit Log</button>
      {open && (
        <div style={{ marginTop:16, maxHeight:260, overflowY:'auto', border:'1px solid #e5e7eb', borderRadius:12, padding:16, background:'#fafafa' }}>
          {logs.length === 0 && <div style={{ fontSize:13, color:'#6b7280' }}>No audit entries for this request.</div>}
          {logs.map(l => (
            <div key={l._id || l.timestamp} style={{ padding:'10px 12px', borderBottom:'1px solid #e5e7eb', fontSize:13, lineHeight:1.4 }}>
              <div style={{ fontWeight:600 }}>{l.action}</div>
              <div style={{ color:'#374151' }}>{l.description}</div>
              <div style={{ color:'#6b7280', fontSize:12, marginTop:4 }}>{new Date(l.timestamp).toLocaleString()} • {l.performedBy?.name} ({l.performedByRole})</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default HrManpowerRequestDetail;
