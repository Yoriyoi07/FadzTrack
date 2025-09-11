import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api/axiosInstance';
import AppHeader from '../layout/AppHeader';
import {
  FaArrowLeft,
  FaEdit,
  FaTimes,
  FaCalendarPlus,
  FaUserTie,
  FaProjectDiagram,
  FaFileAlt,
  FaCheckCircle,
  FaExclamationTriangle,
  FaHourglassHalf,
  FaUsers,
  FaCheck
} from 'react-icons/fa';
import '../style/pm_style/Pm_ManpowerRequestDetail.css';

// Simple status meta (used for badge / icon mapping)
const STATUS_META = {
  approved: { label: 'Approved', icon: <FaCheckCircle />, tone: 'approved' },
  rejected: { label: 'Rejected', icon: <FaTimes />, tone: 'rejected' },
  pending: { label: 'Pending', icon: <FaHourglassHalf />, tone: 'pending' },
  archived: { label: 'Archived', icon: <FaFileAlt />, tone: 'archived' }
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
  const [userName] = useState(() => user?.name || 'User');

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
  // unified modal (info/success/error)
  const [modal, setModal] = useState({ open:false, title:'', message:'', type:'info', actions:[] });
  const openModal = (cfg) => setModal({ open:true, ...cfg, actions: (cfg.actions||[]) });
  const closeModal = () => setModal(m => ({ ...m, open:false }));
  // rejection dialog
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  // received confirmation modal
  const [showReceiveConfirm, setShowReceiveConfirm] = useState(false);
  // completion (return) confirmation modal
  const [showReturnConfirm, setShowReturnConfirm] = useState(false);

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
  setMarkReceived(!!data.received);
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
  const returnDateReached = useMemo(()=>{
    if (!request?.returnDate) return false;
    try { return new Date() >= new Date(request.returnDate); } catch { return false; }
  }, [request?.returnDate]);
  const donorIds = useMemo(()=>{
    return (request?.originalAssignments||[])
      .map(o=> o.donorProjectManager?._id || o.donorProjectManager)
      .filter(Boolean);
  }, [request]);
  const isDonorPM = isPM && !isMine && donorIds.includes(userId);

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
      openModal({ title:'Missing Data', type:'error', message:'Destination project id not found.' });
      return;
    }
    if (selectedManpowerIds.length === 0) {
      openModal({ title:'Selection Required', type:'warning', message:'Please select at least one manpower to assign before approving.' });
      return;
    }
    setBusy(true);
    try {
      await api.put(`/manpower-requests/${id}/approve`, {
        manpowerProvided: selectedManpowerIds,
        project: request.project._id,
      });
      const { data } = await api.get(`/manpower-requests/${id}`);
      setRequest(data);
      setSelectedManpowerIds([]);
      openModal({
        title:'Request Approved',
        type:'success',
        message:'Manpower successfully transferred to the requesting project.',
        actions:[{ label:'Close', primary:true, onClick:()=>closeModal() }]
      });
    } catch (e) {
      openModal({ title:'Approval Failed', type:'error', message: e?.response?.data?.message || 'Could not approve request.' });
    } finally {
      setBusy(false);
    }
  };

  const handleDeny = () => {
    if (!isPM || isMine) return;
    setShowRejectModal(true);
  };

  const confirmReject = async () => {
    setBusy(true);
    try {
  const response = await api.put(`/manpower-requests/${id}/reject`, { reason: rejectReason });
      setShowRejectModal(false);
      setRejectReason('');
      openModal({
        title:'Request Rejected',
        type:'success',
        message: response.data?.message || 'The request was rejected.',
        actions:[{ label:'Back to List', primary:true, onClick:()=>{ closeModal(); navigate('/pm/manpower-list'); } }]
      });
    } catch (e) {
      openModal({ title:'Rejection Failed', type:'error', message: e?.response?.data?.message || 'Could not reject request.' });
    } finally {
      setBusy(false);
    }
  };

  // Step 1: user clicks button -> open confirmation modal
  const handleOpenReceiveConfirm = () => {
    if (markReceived) return; // already confirmed
    setShowReceiveConfirm(true);
  };

  // Step 2: user confirms reception
  const confirmReceived = async () => {
    setBusy(true);
    try {
      await api.put(`/manpower-requests/${id}/received`, { received: true });
      setMarkReceived(true);
      // refresh request to reflect any backend changes
      const { data } = await api.get(`/manpower-requests/${id}`);
      setRequest(data);
      setShowReceiveConfirm(false);
      openModal({ title:'Received Confirmed', type:'success', message:'Manpower arrival confirmed. You can now schedule a return date.', actions:[{ label:'Close', primary:true, onClick:()=>closeModal() }] });
    } catch (e) {
      openModal({ title:'Failed', type:'error', message: e?.response?.data?.message || 'Could not confirm reception.' });
    } finally {
      setBusy(false);
    }
  };

  const handleScheduleReturn = () => setShowCalendar(true);
  const handleDateConfirm = async () => {
    if (!selectedDate) return;
    try {
      await api.put(`/manpower-requests/${id}/return`, { returnDate: selectedDate });
      setShowCalendar(false);
      const { data } = await api.get(`/manpower-requests/${id}`);
      setRequest(data);
      openModal({ title:'Return Scheduled', type:'success', message:`Return scheduled for ${selectedDate}.`, actions:[{ label:'Close', primary:true, onClick:()=>closeModal() }] });
    } catch {
      openModal({ title:'Failed', type:'error', message:'Failed to set return date.' });
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
      openModal({ title:'Cancel Failed', type:'error', message:'Could not cancel request.' });
    } finally {
      setBusy(false);
    }
  };

  const handleArchive = () => {
    setShowArchiveConfirm(true);
  };

  // Complete (return) flow – visible to donor PM when return date reached OR (no returnDate & window expired)
  const handleOpenReturnConfirm = () => {
    setShowReturnConfirm(true);
  };
  const confirmReturned = async () => {
    setBusy(true);
    try {
      await api.put(`/manpower-requests/${id}/complete`);
      const { data } = await api.get(`/manpower-requests/${id}`);
      setRequest(data);
      setShowReturnConfirm(false);
      openModal({ title:'Request Completed', type:'success', message:'Manpower returned and request marked completed.', actions:[{ label:'Close', primary:true, onClick:()=>closeModal() }] });
    } catch (e) {
      openModal({ title:'Completion Failed', type:'error', message: e?.response?.data?.message || 'Could not complete request.' });
    } finally { setBusy(false); }
  };

  const confirmArchive = async () => {
    setBusy(true);
    try {
      await api.put(`/manpower-requests/${id}/archive`, { reason: archiveReason });
      const { data } = await api.get(`/manpower-requests/${id}`);
      setRequest(data);
      setShowArchiveConfirm(false);
      setArchiveReason('');
      openModal({ title:'Archived', type:'success', message:'Request archived successfully.', actions:[{ label:'Close', primary:true, onClick:()=>closeModal() }] });
    } catch (e) {
      openModal({ title:'Archive Failed', type:'error', message: e?.response?.data?.message || 'Failed to archive request.' });
    } finally {
      setBusy(false);
    }
  };

  // helpers
  const sourceProjectName = pmProject?.projectName || 'your project';
  const destProjectName = request?.project?.projectName || 'this project';

  const renderStatusBadge = () => {
    const key = (request?.status || 'pending').toLowerCase();
    const meta = STATUS_META[key] || STATUS_META.pending;
    return (
      <span className={`revamp-status revamp-status--${meta.tone}`}>{meta.icon}<span>{meta.label}</span></span>
    );
  };

  if (loading) {
    return (
      <div className="dashboard-container">
        <AppHeader roleSegment="pm" />
        <main className="dashboard-main">
          <div className="loading-container modern">
            <div className="loading-spinner modern"></div>
            <h3>Loading Request Details</h3>
            <p>Please wait while we fetch the manpower request information...</p>
          </div>
        </main>
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="dashboard-container">
        <AppHeader roleSegment="pm" />
        <main className="dashboard-main">
          <div className="error-container modern">
            <FaExclamationTriangle className="error-icon modern" />
            <h3>Unable to Load Request</h3>
            <p>{error || 'The requested manpower request could not be found.'}</p>
            <button 
              className="revamp-btn revamp-btn--primary" 
              onClick={() => navigate('/pm/manpower-list')}
            >
              <FaArrowLeft />
              <span>Back to Manpower List</span>
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <AppHeader roleSegment="pm" />
      <main className="dashboard-main revamp-detail">
        <div className="revamp-header">
          <div className="revamp-header__left">
            <button className="revamp-btn revamp-btn--ghost" onClick={()=>navigate('/pm/manpower-list')}><FaArrowLeft/><span>Back</span></button>
            <h1>Manpower Request {renderStatusBadge()}</h1>
            <ul className="revamp-meta">
              <li><FaProjectDiagram/> {request.project?.projectName || 'N/A'}</li>
              <li><FaUserTie/> {request.createdBy?.name || 'Unknown'}</li>
              <li>#{request.requestNumber || id?.slice(-4)}</li>
            </ul>
          </div>
          <div className="revamp-header__actions">
            {isMine && !isApproved && (
              <button className="revamp-btn revamp-btn--outline" onClick={handleEdit}><FaEdit/> Edit</button>
            )}
            {isMine && (
              <button className="revamp-btn revamp-btn--danger-outline" disabled={busy} onClick={handleCancel}>{busy? 'Deleting…':'Delete'}</button>
            )}
          </div>
        </div>

        {/* Top summary cards */}
        <section className="revamp-cards-grid">
          <div className="revamp-card mini">
            <span className="label">Target Date</span>
            <strong>{request.acquisitionDate ? new Date(request.acquisitionDate).toLocaleDateString() : '—'}</strong>
          </div>
          <div className="revamp-card mini">
            <span className="label">Duration</span>
            <strong>{request.duration} {request.duration>1?'days':'day'}</strong>
          </div>
          {request.returnDate && (
            <div className="revamp-card mini">
              <span className="label">Return Date</span>
              <strong>{new Date(request.returnDate).toLocaleDateString()}</strong>
            </div>) }
          {!request.returnDate && request.returnWindow?.maxReturnDate && (
            <div className="revamp-card mini">
              <span className="label">Latest Return</span>
              <strong>{new Date(request.returnWindow.maxReturnDate).toLocaleDateString()}</strong>
            </div>
          )}
          <div className="revamp-card mini">
            <span className="label">Project</span>
            <strong>{request.project?.projectName || '—'}</strong>
          </div>
          <div className="revamp-card mini">
            <span className="label">Status</span>
            {renderStatusBadge()}
            {isApproved && isMine && !markReceived && (
              <button
                type="button"
                className={`revamp-btn revamp-btn--xs revamp-btn--pending`}
                onClick={handleOpenReceiveConfirm}
                title="Confirm that the manpower has arrived"
              >
                Mark Received
              </button>
            )}
            {isApproved && isMine && markReceived && (
              <span className="revamp-badge revamp-badge--received" title="Manpower arrival confirmed">Received</span>
            )}
          </div>
        </section>

        <div className="revamp-sections-grid">
        {/* Manpower requirements */}
        <section className="revamp-section">
          <header><FaUsers/><h2>Requested Manpower</h2></header>
          {request.manpowers?.length ? (
            <ul className="revamp-manpower-list">
              {request.manpowers.map((m,i)=>(
                <li key={i}><span className="qty">{m.quantity}</span><span className="type">{m.type}</span></li>
              ))}
            </ul>
          ) : <div className="revamp-empty">No manpower entries</div>}
        </section>

        {/* Description */}
        <section className="revamp-section">
          <header><FaFileAlt/><h2>Description</h2></header>
          <p className="revamp-description">{request.description || 'No description provided.'}</p>
        </section>

        {/* Approval & Assign */}
  {!isMine && isPM && !isApproved && request?.status !== 'Archived' && request?.status !== 'Completed' && (
          <section className="revamp-section emphasize span-2">
            <header><FaCheck/><h2>Approve & Assign</h2></header>
            <p className="hint">Provide manpower from <strong>{sourceProjectName}</strong> to <strong>{destProjectName}</strong></p>
            <div className="hint requested">Requested: {request.manpowers.map(mp=>`${mp.type} (${mp.quantity})`).join(', ')}</div>
            <div className="assign-row revamp">
              <select
                defaultValue=""
                onChange={(e)=>{ const val=e.target.value; if(!val) return; setSelectedManpowerIds(p=>p.includes(val)?p:[...p,val]); }}
              >
                <option value="">{!pmProject? 'No PM project found': availableManpowers.length? 'Select manpower…':'No matching manpower'}</option>
                {availableManpowers.filter(m=>!selectedManpowerIds.includes(m._id)).map(m=> (<option key={m._id} value={m._id}>{m.name} ({m.position})</option>))}
              </select>
              <button type="button" className="revamp-btn revamp-btn--ghost" onClick={()=>setSelectedManpowerIds([])}>Clear</button>
            </div>
            {selectedManpowerIds.length>0 && (
              <div className="revamp-selected">
                {selectedManpowerIds.map(idv=>{ const mp=availableManpowers.find(m=>m._id===idv); return (
                  <span key={idv} className="pill">{mp? `${mp.name} (${mp.position})`: idv}<button onClick={()=>setSelectedManpowerIds(prev=>prev.filter(x=>x!==idv))}>×</button></span>
                );})}
              </div>
            )}
            <div className="revamp-actions">
              <button className="revamp-btn revamp-btn--danger-outline" disabled={busy} onClick={handleDeny}><FaTimes/> Reject</button>
              <button className="revamp-btn revamp-btn--primary" disabled={busy || selectedManpowerIds.length===0} onClick={handleApprove}>{busy? 'Processing…':'Approve & Assign'}</button>
            </div>
          </section>
        )}

        {/* Rejected details */}
        {request.rejectedBy && request.rejectedBy.length>0 && (
          <section className="revamp-section danger span-2">
            <header><FaTimes/><h2>Rejection Details</h2></header>
            <p className="hint"><strong>Reason:</strong> {request.rejectionReason || 'No reason provided'}</p>
            <ul className="revamp-rejections">
              {request.rejectedBy.map((r,i)=>(<li key={i}>{r.userName || r.userId?.name || 'Unknown PM'} <time>{new Date(r.rejectedAt).toLocaleDateString()}</time></li>))}
            </ul>
          </section>
        )}

        {/* Archived details */}
        {request?.status === 'Archived' && (
          <section className="revamp-section archived span-2">
            <header><FaFileAlt/><h2>Archived</h2></header>
            {request.archivedReason && <p className="hint"><strong>Reason:</strong> {request.archivedReason}</p>}
            {request.originalRequestDetails && (
              <div className="revamp-orig">
                <p><strong>Original Acquisition:</strong> {new Date(request.originalRequestDetails.acquisitionDate).toLocaleDateString()}</p>
                <p><strong>Original Duration:</strong> {request.originalRequestDetails.duration} days</p>
              </div>
            )}
          </section>
        )}

        {/* Archive action */}
        {!isMine && isPM && request?.status !== 'Archived' && (
          <section className="revamp-section subtle span-2">
            <div className="revamp-actions end">
              <button onClick={handleArchive} className="revamp-btn revamp-btn--outline purple" disabled={busy}><FaFileAlt/> {busy? 'Processing…':'Archive Request'}</button>
            </div>
          </section>
        )}
        </div>

        {/* Footer */}
        <div className="revamp-footer">
          {isApproved && isMine && markReceived && !request.returnDate && (
            <button className="revamp-btn revamp-btn--primary" disabled={!markReceived} onClick={handleScheduleReturn}><FaCalendarPlus/> Schedule Return</button>
          )}
          {isApproved && isDonorPM && markReceived && request.status === 'Approved' && (
            <button className="revamp-btn revamp-btn--primary" disabled={busy} onClick={handleOpenReturnConfirm} title="Return manpower and complete request">Mark Manpower Returned</button>
          )}
          {isApproved && isDonorPM && !markReceived && (
            <span style={{fontSize:'.7rem',color:'#64748b'}}>Waiting for requester to mark received…</span>
          )}
      {/* Receive Confirmation Modal */}
      {showReceiveConfirm && (
        <div className="center-modal-overlay" role="dialog" aria-modal="true">
          <div className="center-modal">
            <div className="center-modal-header"><h2>Confirm Manpower Received</h2></div>
            <div className="center-modal-body">
              <p style={{marginBottom:12}}>Please confirm that the manpower provided for this request has physically arrived and the duration is acceptable.</p>
              <div className="modal-warning-box info" style={{marginBottom:16}}>
                <div className="warning-header">
                  <FaCheckCircle className="warning-icon" />
                  <strong>Request Summary</strong>
                </div>
                <p><strong>Requested:</strong> {request.manpowers.map(mp=>`${mp.quantity} ${mp.type}`).join(', ')}</p>
                <p><strong>Duration:</strong> {request.duration} {request.duration>1?'days':'day'}</p>
                <p><strong>Target Date:</strong> {request.acquisitionDate ? new Date(request.acquisitionDate).toLocaleDateString() : '—'}</p>
                {request.returnWindow?.maxReturnDate && (
                  <p><strong>Latest Return:</strong> {new Date(request.returnWindow.maxReturnDate).toLocaleDateString()}</p>
                )}
              </div>
              <p style={{fontSize:13,color:'#334155'}}>After confirming, you'll be able to schedule the return date.</p>
            </div>
            <div className="center-modal-actions">
              <button type="button" className="modal-btn" onClick={()=>setShowReceiveConfirm(false)}>Cancel</button>
              <button type="button" className="modal-btn primary" disabled={busy} onClick={confirmReceived}>{busy? 'Saving…':'Confirm Received'}</button>
            </div>
          </div>
        </div>
      )}
      {showReturnConfirm && (
        <div className="center-modal-overlay" role="dialog" aria-modal="true">
          <div className="center-modal">
            <div className="center-modal-header"><h2>Confirm Manpower Returned</h2></div>
            <div className="center-modal-body">
              <p style={{marginBottom:12}}>This will reclaim all manpower provided back to their original project assignments and complete the request.</p>
              <div className="modal-warning-box info" style={{marginBottom:16}}>
                <div className="warning-header">
                  <FaCheckCircle className="warning-icon" />
                  <strong>Return Summary</strong>
                </div>
                {request.returnDate && <p><strong>Scheduled Return:</strong> {new Date(request.returnDate).toLocaleDateString()}</p>}
                <p><strong>Resources Provided:</strong> {Array.isArray(request.manpowerProvided) ? request.manpowerProvided.length : 0}</p>
                <p style={{fontSize:13,color:'#334155'}}>You are identified as a donor Project Manager.</p>
              </div>
            </div>
            <div className="center-modal-actions">
              <button type="button" className="modal-btn" onClick={()=>setShowReturnConfirm(false)}>Cancel</button>
              <button type="button" className="modal-btn primary" disabled={busy} onClick={confirmReturned}>{busy? 'Completing…':'Confirm Returned'}</button>
            </div>
          </div>
        </div>
      )}
        </div>

        {/* Calendar Modal */}
        {showCalendar && (
          <div className="center-modal-overlay" role="dialog" aria-modal="true">
            <div className="center-modal">
              <div className="center-modal-header">
                <h2>Schedule Return Date</h2>
              </div>
              <div className="center-modal-body">
                <div className="form-group">
                  <label className="form-label">Select Return Date:</label>
                  <input
                    type="date"
                    value={selectedDate}
                    min={(request.returnWindow?.earliestReturnDate ? request.returnWindow.earliestReturnDate.split('T')[0] : new Date().toISOString().split('T')[0])}
                    max={(request.returnWindow?.maxReturnDate ? request.returnWindow.maxReturnDate.split('T')[0] : undefined)}
                    onChange={e => setSelectedDate(e.target.value)}
                    className="form-input date-input"
                  />
                  {request.returnWindow?.maxReturnDate && (
                    <p className="small muted" style={{marginTop:'.4rem'}}>
                      Latest allowed return: {new Date(request.returnWindow.maxReturnDate).toLocaleDateString()} ({request.returnWindow.daysRemainingInWindow ?? ''} days remaining)
                    </p>
                  )}
                </div>
              </div>
              <div className="center-modal-actions">
                <button 
                  type="button"
                  className="modal-btn" 
                  onClick={() => setShowCalendar(false)}
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  className="modal-btn primary" 
                  disabled={!selectedDate} 
                  onClick={handleDateConfirm}
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}

        <AuditTrail requestId={request._id} />
      </main>
      
      {/* Cancel Confirmation Modal */}
      {showCancelConfirm && (
        <div className="center-modal-overlay error" role="dialog" aria-modal="true">
          <div className="center-modal">
            <div className="center-modal-header">
              <h2>Confirm Request Cancellation</h2>
            </div>
            <div className="center-modal-body">
              <div className="modal-warning-box error">
                <div className="warning-header">
                  <FaExclamationTriangle className="warning-icon" />
                  <strong>Cancellation Warning</strong>
                </div>
                <p>This will permanently cancel the manpower request. This action cannot be undone.</p>
              </div>

              <div className="request-details-summary">
                <h4>Request Details:</h4>
                <div className="details-grid">
                  <div className="detail-item">
                    <span className="label">Project:</span>
                    <span className="value">{request?.project?.projectName || 'Unknown'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Manpower Requested:</span>
                    <span className="value">{request?.manpowers?.map(m => `${m.quantity} ${m.type}`).join(', ') || 'Unknown'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Status:</span>
                    <span className="value">{request?.status || 'Unknown'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Created:</span>
                    <span className="value">{request?.createdAt ? new Date(request.createdAt).toLocaleDateString() : 'Unknown'}</span>
                  </div>
                </div>
              </div>

              <p className="confirmation-text">
                Are you sure you want to <strong>cancel</strong> this manpower request?
              </p>
            </div>
            <div className="center-modal-actions">
              <button 
                type="button"
                className="modal-btn" 
                onClick={() => setShowCancelConfirm(false)}
              >
                Keep Request
              </button>
              <button 
                type="button"
                className="modal-btn primary danger" 
                disabled={busy}
                onClick={confirmCancel}
              >
                {busy ? 'Cancelling...' : 'Yes, Cancel Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Archive Confirmation Modal */}
      {showArchiveConfirm && (
        <div className="center-modal-overlay warning" role="dialog" aria-modal="true">
          <div className="center-modal">
            <div className="center-modal-header">
              <h2>Archive Manpower Request</h2>
            </div>
            <div className="center-modal-body">
              <div className="modal-warning-box warning">
                <div className="warning-header">
                  <FaFileAlt className="warning-icon" />
                  <strong>Archive Request</strong>
                </div>
                <p>This will archive the request for record-keeping purposes. The request will be marked as archived but preserved in the system.</p>
              </div>

              <div className="request-details-summary">
                <h4>Request Details:</h4>
                <div className="details-grid">
                  <div className="detail-item">
                    <span className="label">Project:</span>
                    <span className="value">{request?.project?.projectName || 'Unknown'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Manpower Requested:</span>
                    <span className="value">{request?.manpowers?.map(m => `${m.quantity} ${m.type}`).join(', ') || 'Unknown'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Status:</span>
                    <span className="value">{request?.status || 'Unknown'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Created:</span>
                    <span className="value">{request?.createdAt ? new Date(request.createdAt).toLocaleDateString() : 'Unknown'}</span>
                  </div>
                </div>
              </div>

              <div className="archive-reason-section">
                <label className="form-label">
                  Archive Reason (Optional):
                </label>
                <textarea
                  value={archiveReason}
                  onChange={(e) => setArchiveReason(e.target.value)}
                  placeholder="Enter reason for archiving this request..."
                  className="form-textarea"
                />
              </div>
            </div>
            <div className="center-modal-actions">
              <button 
                type="button"
                className="modal-btn" 
                onClick={() => {
                  setShowArchiveConfirm(false);
                  setArchiveReason('');
                }}
              >
                Cancel
              </button>
              <button 
                type="button"
                className="modal-btn primary warning" 
                disabled={busy}
                onClick={confirmArchive}
              >
                {busy ? 'Archiving...' : 'Archive Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="center-modal-overlay warning" role="dialog" aria-modal="true">
          <div className="center-modal">
            <div className="center-modal-header"><h2>Reject Request</h2></div>
            <div className="center-modal-body">
              <p style={{marginBottom:12}}>You can optionally provide a reason for rejecting this request.</p>
              <textarea
                value={rejectReason}
                onChange={e=>setRejectReason(e.target.value)}
                placeholder="Reason (optional)"
                style={{width:'100%',minHeight:90,padding:10,border:'1px solid #d1d5db',borderRadius:8,fontSize:14}}
              />
            </div>
            <div className="center-modal-actions">
              <button type="button" className="modal-btn" onClick={()=>{ setShowRejectModal(false); setRejectReason(''); }}>Cancel</button>
              <button type="button" className="modal-btn primary" disabled={busy} onClick={confirmReject}>{busy? 'Processing…':'Reject Request'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Unified Feedback Modal */}
      {modal.open && (
        <div className={`center-modal-overlay ${modal.type}`} role="dialog" aria-modal="true">
          <div className="center-modal">
            <div className="center-modal-header"><h2>{modal.title}</h2></div>
            <div className="center-modal-body"><p>{modal.message}</p></div>
            <div className="center-modal-actions">
              {modal.actions.length === 0 && (
                <button className="modal-btn primary" onClick={closeModal}>Close</button>
              )}
              {modal.actions.map((a,i)=>(
                <button key={i} className={a.primary? 'modal-btn primary':'modal-btn'} onClick={a.onClick}>{a.label}</button>
              ))}
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
  const [loading, setLoading] = React.useState(false);
  const token = localStorage.getItem('token');
  
  useEffect(() => {
    if (!open) return;
    const fetchLogs = async () => {
      setLoading(true);
      try {
        const { data } = await api.get('/audit-logs', { headers:{ Authorization:`Bearer ${token}` } });
        // Filter to those referencing this request
        const filtered = data.filter(l => l.meta?.requestId === requestId);
        setLogs(filtered);
      } catch(e){ 
        console.error('Audit fetch failed', e); 
        setLogs([]);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, [open, requestId, token]);

  return (
    <div className="revamp-audit">
      <button 
        className="revamp-btn revamp-btn--ghost" 
        onClick={() => setOpen(!open)}
        style={{ marginBottom: '1rem' }}
      >
        <FaFileAlt />
        <span>{open ? 'Hide' : 'Show'} Audit Trail</span>
      </button>
      {open && (
        <div className="revamp-audit__panel">
          {loading && <div className="revamp-empty small">Loading audit entries...</div>}
          {!loading && logs.length === 0 && <div className="revamp-empty small">No audit entries for this request.</div>}
          {!loading && logs.map(l => (
            <div key={l._id || l.timestamp} className="revamp-audit__row">
              <div className="act">{l.action}</div>
              <div className="desc">{l.description}</div>
              <div className="meta">{new Date(l.timestamp).toLocaleString()} • {l.performedBy?.name} ({l.performedByRole})</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
