import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api/axiosInstance';
import AppHeader from '../layout/AppHeader';
import {
  FaTachometerAlt, 
  FaComments, 
  FaBoxes, 
  FaUsers, 
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

  // profile menu logic removed (handled by AppHeader)

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
  
  // Confirmation modal states
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [archiveReason, setArchiveReason] = useState('');

  // manpower selection (from THIS PM's project)
  const [availableManpowers, setAvailableManpowers] = useState([]);
  const [selectedManpowerIds, setSelectedManpowerIds] = useState([]);

  const isPM = userRole === 'Project Manager';

  // logout handled by AppHeader

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

  // fetch manpower ONLY from this PM's project that matches the requested types
  useEffect(() => {
    if (!request || isMine || !isPM || !pmProject?._id) return;

    const fetchManpowerFromPmProject = async () => {
      try {
        const { data } = await api.get('/manpower'); // backend does NOT filter by project yet
        const arr = Array.isArray(data) ? data : [];
        
        // Get the requested manpower types from the request
        const requestedTypes = (request.manpowers || []).map(mp => mp.type);
        
        const filtered = arr.filter(m => {
          const ap = m.assignedProject?._id || m.assignedProject || m.project || m.homeProject;
          const projectMatch = ap && String(ap) === String(pmProject._id);
          
          // Only include manpower whose position matches the requested types
          const typeMatch = requestedTypes.includes(m.position);
          
          return projectMatch && typeMatch;
        });
        setAvailableManpowers(filtered);
      } catch (e) {
        console.error('Manpower fetch failed', e);
        setAvailableManpowers([]);
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
    
    const reason = prompt('Please provide a reason for rejection (optional):');
    if (reason === null) return; // User cancelled
    
    const confirmed = window.confirm(
      'Confirm Rejection?\n\nRejecting this request will remove this from your list of Other\'s Request.'
    );
    
    if (!confirmed) return;
    
    setBusy(true);
    try {
      const response = await api.put(`/manpower-requests/${id}/reject`, { reason });
      alert(response.data.message);
      // Navigate back to the manpower list since the request is now hidden
      navigate('/pm/manpower-list');
    } catch (e) {
      alert(e?.response?.data?.message || 'Failed to reject request.');
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
  
  const handleCancel = () => {
    setShowCancelConfirm(true);
  };

  const confirmCancel = async () => {
    setBusy(true);
    try {
      await api.delete(`/manpower-requests/${id}`);
      navigate('/pm/manpower-list');
    } catch {
      alert('Cancel failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleArchive = () => {
    setShowArchiveConfirm(true);
  };

  const confirmArchive = async () => {
    setBusy(true);
    try {
      await api.put(`/manpower-requests/${id}/archive`, { reason: archiveReason });
      alert('Request archived successfully.');
      const { data } = await api.get(`/manpower-requests/${id}`);
      setRequest(data);
      setShowArchiveConfirm(false);
      setArchiveReason('');
    } catch (e) {
      alert(e?.response?.data?.message || 'Failed to archive request.');
    } finally {
      setBusy(false);
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
      case 'archived':
        return <FaFileAlt className="status-icon archived" />;
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
      <AppHeader roleSegment="pm" />

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
              <button onClick={()=>navigate('/pm/manpower-list')} style={btn('secondary')}>Back</button>
              {isMine && !isApproved && (
                <button onClick={()=>navigate(`/pm/manpower-request/${id}?edit=1`)} style={btn('primary')}><FaEdit/> Edit</button>
              )}
              {isMine && (
                <button disabled={busy} onClick={handleCancel} style={btn('danger')}>{busy? 'Deleting...' : 'Delete'}</button>
              )}
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

          {/* PM-specific functionality */}
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

            {/* Rejection Information */}
            {request.rejectedBy && request.rejectedBy.length > 0 && (
              <div className="rejection-card">
                <div className="card-header">
                  <FaTimes className="card-icon rejected" />
                  <h3>Rejection Information</h3>
                </div>
                <div className="card-content">
                  <div className="rejection-details">
                    <div className="rejection-reason">
                      <strong>Reason:</strong> {request.rejectionReason || 'No reason provided'}
                    </div>
                    <div className="rejection-list">
                      <strong>Rejected by:</strong>
                      <ul>
                        {request.rejectedBy.map((rejection, index) => (
                          <li key={index}>
                            {rejection.userName || rejection.userId?.name || 'Unknown PM'} 
                            <span className="rejection-date">
                              ({new Date(rejection.rejectedAt).toLocaleDateString()})
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Approval Panel (Others' request only) */}
            {!isMine && isPM && !isApproved && request?.status !== 'Archived' && (
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
                  {request?.manpowers && request.manpowers.length > 0 && (
                    <div className="requested-types">
                      <small>
                        Requested types: {request.manpowers.map(mp => `${mp.type} (${mp.quantity})`).join(', ')}
                      </small>
                    </div>
                  )}
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
                        {!pmProject ? 'No PM project found' : 
                         availableManpowers.length === 0 ? 'No matching manpower available' :
                         'Pick manpower…'}
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
                    <span>Reject Request</span>
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
            {isMine && !isApproved && request?.status !== 'Archived' && (
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

            {/* Archive Actions */}
            {request?.status === 'Archived' && (
              <div className="archived-notice">
                <div className="archived-badge">
                  <FaFileAlt />
                  <span>Archived - Project Completed</span>
                </div>
                {request.archivedReason && (
                  <p className="archive-reason">Reason: {request.archivedReason}</p>
                )}
                {request.originalProjectName && (
                  <div className="original-project-info">
                    <h4>Original Project Information</h4>
                    <p><strong>Project Name:</strong> {request.originalProjectName}</p>
                    {request.originalProjectEndDate && (
                      <p><strong>Project End Date:</strong> {new Date(request.originalProjectEndDate).toLocaleDateString()}</p>
                    )}
                  </div>
                )}
                {request.originalRequestDetails && (
                  <div className="original-request-details">
                    <h4>Original Request Information</h4>
                    <p><strong>Original Status:</strong> {request.originalRequestStatus}</p>
                    <p><strong>Description:</strong> {request.originalRequestDetails.description}</p>
                    <p><strong>Acquisition Date:</strong> {new Date(request.originalRequestDetails.acquisitionDate).toLocaleDateString()}</p>
                    <p><strong>Duration:</strong> {request.originalRequestDetails.duration} days</p>
                    <p><strong>Manpower Needed:</strong> {request.originalRequestDetails.manpowers?.map(m => `${m.type} (${m.quantity})`).join(', ')}</p>
                    {request.originalRequestDetails.approvedBy && (
                      <p><strong>Approved By:</strong> {request.originalRequestDetails.approvedBy}</p>
                    )}
                    {request.originalRequestDetails.area && (
                      <p><strong>Area:</strong> {request.originalRequestDetails.area}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Manual Archive Action */}
            {!isMine && isPM && request?.status !== 'Archived' && (
              <div className="archive-actions">
                <button onClick={handleArchive} className="archive-btn" disabled={busy}>
                  <FaFileAlt />
                  <span>{busy ? 'Processing…' : 'Archive Request'}</span>
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

          <AuditTrail requestId={request._id} />
        </div>
      </main>
      
      {/* Cancel Confirmation Modal */}
      {showCancelConfirm && (
        <div className="modal-overlay">
          <div className="modal small">
            <h3>Confirm Request Cancellation</h3>
            
            <div style={{
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '16px'
            }}>
              <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px'}}>
                <span style={{fontSize: '20px'}}>⚠️</span>
                <strong style={{color: '#dc2626'}}>Cancellation Warning</strong>
              </div>
              <p style={{color: '#dc2626', margin: 0, fontSize: '14px'}}>
                This will permanently cancel the manpower request. This action cannot be undone.
              </p>
            </div>

            <div style={{marginBottom: '16px'}}>
              <p style={{marginBottom: '8px', fontWeight: '600'}}>Request Details:</p>
              <div style={{backgroundColor: '#f9fafb', padding: '12px', borderRadius: '6px', fontSize: '14px'}}>
                <p style={{margin: '0 0 4px 0'}}><strong>Project:</strong> {request?.project?.projectName || 'Unknown'}</p>
                <p style={{margin: '0 0 4px 0'}}><strong>Manpower Requested:</strong> {request?.manpowers?.map(m => `${m.quantity} ${m.type}`).join(', ') || 'Unknown'}</p>
                <p style={{margin: '0 0 4px 0'}}><strong>Status:</strong> {request?.status || 'Unknown'}</p>
                <p style={{margin: '0'}}><strong>Created:</strong> {request?.createdAt ? new Date(request.createdAt).toLocaleDateString() : 'Unknown'}</p>
              </div>
            </div>

            <p style={{marginBottom: '16px', fontSize: '14px', lineHeight: '1.5'}}>
              Are you sure you want to <strong>cancel</strong> this manpower request?
            </p>

            <div className="modal-actions" style={{display:'flex',gap:'0.5rem',justifyContent:'flex-end'}}>
              <button 
                className="btn" 
                onClick={() => setShowCancelConfirm(false)}
              >
                Keep Request
              </button>
              <button 
                className="btn primary" 
                disabled={busy}
                onClick={confirmCancel}
                style={{backgroundColor: '#dc2626'}}
              >
                {busy ? 'Cancelling...' : 'Yes, Cancel Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Archive Confirmation Modal */}
      {showArchiveConfirm && (
        <div className="modal-overlay">
          <div className="modal small">
            <h3>Archive Manpower Request</h3>
            
            <div style={{
              backgroundColor: '#fffbeb',
              border: '1px solid #fed7aa',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '16px'
            }}>
              <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px'}}>
                <span style={{fontSize: '20px'}}>📁</span>
                <strong style={{color: '#ea580c'}}>Archive Request</strong>
              </div>
              <p style={{color: '#ea580c', margin: 0, fontSize: '14px'}}>
                This will archive the request for record-keeping purposes. The request will be marked as archived but preserved in the system.
              </p>
            </div>

            <div style={{marginBottom: '16px'}}>
              <p style={{marginBottom: '8px', fontWeight: '600'}}>Request Details:</p>
              <div style={{backgroundColor: '#f9fafb', padding: '12px', borderRadius: '6px', fontSize: '14px'}}>
                <p style={{margin: '0 0 4px 0'}}><strong>Project:</strong> {request?.project?.projectName || 'Unknown'}</p>
                <p style={{margin: '0 0 4px 0'}}><strong>Manpower Requested:</strong> {request?.manpowers?.map(m => `${m.quantity} ${m.type}`).join(', ') || 'Unknown'}</p>
                <p style={{margin: '0 0 4px 0'}}><strong>Status:</strong> {request?.status || 'Unknown'}</p>
                <p style={{margin: '0'}}><strong>Created:</strong> {request?.createdAt ? new Date(request.createdAt).toLocaleDateString() : 'Unknown'}</p>
              </div>
            </div>

            <div style={{marginBottom: '16px'}}>
              <label style={{display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '14px'}}>
                Archive Reason (Optional):
              </label>
              <textarea
                value={archiveReason}
                onChange={(e) => setArchiveReason(e.target.value)}
                placeholder="Enter reason for archiving this request..."
                style={{
                  width: '100%',
                  minHeight: '80px',
                  padding: '8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  resize: 'vertical'
                }}
              />
            </div>

            <div className="modal-actions" style={{display:'flex',gap:'0.5rem',justifyContent:'flex-end'}}>
              <button 
                className="btn" 
                onClick={() => {
                  setShowArchiveConfirm(false);
                  setArchiveReason('');
                }}
              >
                Cancel
              </button>
              <button 
                className="btn primary" 
                disabled={busy}
                onClick={confirmArchive}
                style={{backgroundColor: '#ea580c'}}
              >
                {busy ? 'Archiving...' : 'Archive Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

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
