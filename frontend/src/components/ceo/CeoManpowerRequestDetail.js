import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../../api/axiosInstance';
import AppHeader from '../layout/AppHeader';
import {
  FaTachometerAlt,
  FaComments,
  FaBoxes,
  FaProjectDiagram,
  FaClipboardList,
  FaChartBar,
  FaArrowLeft,
  FaUsers,
  FaFileAlt,
  FaClock,
  FaUserTie,
  FaCheckCircle,
  FaExclamationTriangle,
  FaHourglassHalf
} from 'react-icons/fa';
import '../style/hr_style/Hr_ManpowerRequestDetail.css'; // reuse existing detail styles

const CeoManpowerRequestDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const userRef = useRef(null);
  if (userRef.current === null) {
    const stored = localStorage.getItem('user');
    userRef.current = stored ? JSON.parse(stored) : null;
  }
  const user = userRef.current;
  const token = localStorage.getItem('token');

  // Header handled by AppHeader
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Hooks must always run; gate logic inside
  // (Profile dropdown logic removed)

  useEffect(() => {
    if (!user || user.role !== 'CEO') return;
    let active = true;
    const load = async () => {
      setLoading(true); setError('');
      try {
        const { data } = await api.get(`/manpower-requests/${id}`, { headers: { Authorization: `Bearer ${token}` }});
        if (!active) return;
        setRequest(data);
      } catch (err) {
        if (!active) return;
        console.error('Failed to load request', err);
        setError('Failed to load request details');
      } finally { if (active) setLoading(false); }
    };
    load();
    return () => { active = false; };
  }, [id, token]);

  // (Logout handled by AppHeader)

  const getStatusIcon = (status) => {
    switch(status?.toLowerCase()) {
      case 'approved': return <FaCheckCircle className="status-icon approved" />;
      case 'rejected': return <FaExclamationTriangle className="status-icon rejected" />;
      case 'pending': return <FaHourglassHalf className="status-icon pending" />;
      case 'completed': return <FaCheckCircle className="status-icon approved" />;
      default: return <FaHourglassHalf className="status-icon pending" />;
    }
  };

  const getStatusBadge = () => {
    const s = (request?.status || 'Pending').toLowerCase();
    const isOverdue = s === 'pending' && request.acquisitionDate && new Date(request.acquisitionDate) < new Date();
    if (isOverdue) return { label:'Overdue', color:'#d97706' };
    if (s.includes('completed')) return { label:'Completed', color:'#059669' };
    if (s.includes('approved')) return { label:'Approved', color:'#10b981' };
    if (s.includes('pending')) return { label:'Pending', color:'#f59e0b' };
    if (s.includes('reject') || s.includes('denied') || s.includes('cancel')) return { label:'Rejected', color:'#ef4444' };
    if (s.includes('overdue')) return { label:'Overdue', color:'#d97706' };
    return { label:'Unknown', color:'#6b7280' };
  };

  if (!user || user.role !== 'CEO') {
    return <div style={{ padding:24 }}><h2>Forbidden</h2><p>CEO access only.</p></div>;
  }
  if (loading) return (<div className="dashboard-container"><div className="loading-container"><div className="loading-spinner" /><p>Loading manpower request...</p></div></div>);
  if (error || !request) return (<div className="dashboard-container"><div className="error-container"><FaExclamationTriangle className="error-icon" /><p>{error || 'Request not found.'}</p></div></div>);

  return (
    <div className="dashboard-container">
      <AppHeader roleSegment="ceo" />

      <main className="dashboard-main">
        <div className="content-wrapper">
          <div className="page-header">
            <div className="page-header-content">
              <button onClick={() => navigate(-1)} className="back-button"><FaArrowLeft /><span>Back</span></button>
              <div className="page-title-section">
                <h1 className="page-title">Manpower Request Details</h1>
                <p className="page-subtitle">Executive overview for request #{request.requestNumber || id?.slice(-3)}</p>
              </div>
            </div>
          </div>

          <div className={`status-banner ${request.status?.toLowerCase()}`}> 
            {request.status?.toLowerCase() === 'pending' && request.acquisitionDate && new Date(request.acquisitionDate) < new Date() && (
              <div className="overdue-ribbon"><span>OVERDUE</span></div>
            )}
            <div className="status-content">
              {getStatusIcon(request.status)}
              <div className="status-info">
                <h3 className="status-title">{request.status || 'Pending'} Request</h3>
                <p className="status-description">{request.description || 'No description provided'}</p>
              </div>
            </div>
          </div>

          {/* Executive Key Metrics */}
          <div style={{ display:'flex', flexWrap:'wrap', gap:'12px', marginBottom:'22px' }}>
            {(() => {
              const badge = getStatusBadge();
              const manpowerTotal = Array.isArray(request.manpowers) ? request.manpowers.reduce((acc,m)=>acc + (Number(m.quantity)||0),0) : 0;
              const cards = [
                { label:'Status', value:badge.label, color:badge.color },
                { label:'Total Types', value: Array.isArray(request.manpowers) ? request.manpowers.length : 0, color:'#6366f1' },
                { label:'Total Quantity', value: manpowerTotal, color:'#0ea5e9' },
                { label:'Duration (days)', value: request.duration || 0, color:'#f59e0b' },
                { label:'Has Return Date', value: request.returnDate ? 'Yes' : 'No', color: request.returnDate ? '#059669' : '#6b7280' }
              ];
              return cards.map(c => (
                <div key={c.label} style={{
                  flex:'1 1 140px',
                  minWidth:'120px',
                  background:'#ffffff',
                  border:'1px solid #e2e8f0',
                  borderRadius:'8px',
                  padding:'12px 14px',
                  display:'flex',
                  flexDirection:'column',
                  gap:'4px'
                }}>
                  <span style={{ fontSize:'11px', letterSpacing:'.5px', fontWeight:600, color:'#64748b', textTransform:'uppercase' }}>{c.label}</span>
                  <span style={{ fontSize:'20px', fontWeight:700, color:c.color }}>{c.value}</span>
                  <div style={{ height:'4px', background:c.color, borderRadius:'2px', opacity:.85 }} />
                </div>
              ));
            })()}
          </div>

          <div className="info-grid">
            <div className="info-card">
              <div className="card-header"><FaFileAlt className="card-icon" /><h3>Request Information</h3></div>
              <div className="card-content">
                <div className="info-row"><span className="info-label">Request Number:</span><span className="info-value">#{request.requestNumber || id?.slice(-3)}</span></div>
                <div className="info-row"><span className="info-label">Created By:</span><span className="info-value"><FaUserTie className="inline-icon" />{request.createdBy?.name || 'Unknown'}</span></div>
                <div className="info-row"><span className="info-label">Project:</span><span className="info-value"><FaProjectDiagram className="inline-icon" />{request.project?.projectName || 'Unknown Project'}</span></div>
              </div>
            </div>
            <div className="info-card">
              <div className="card-header"><FaClock className="card-icon" /><h3>Timeline</h3></div>
              <div className="card-content">
                <div className="info-row"><span className="info-label">Target Date:</span><span className="info-value">{request.acquisitionDate ? new Date(request.acquisitionDate).toLocaleDateString() : 'Not set'}</span></div>
                <div className="info-row"><span className="info-label">Duration:</span><span className="info-value">{request.duration} days</span></div>
                {request.returnDate && <div className="info-row"><span className="info-label">Return Date:</span><span className="info-value">{new Date(request.returnDate).toLocaleDateString()}</span></div>}
              </div>
            </div>
          </div>

          <div className="requirements-card">
            <div className="card-header"><FaUsers className="card-icon" /><h3>Manpower Requirements</h3></div>
            <div className="card-content">
              {Array.isArray(request.manpowers) && request.manpowers.length > 0 ? (
                <div className="manpower-grid">
                  {request.manpowers.map((mp,i)=>(
                    <div key={i} className="manpower-item">
                      <div className="manpower-quantity">{mp.quantity}</div>
                      <div className="manpower-type">{mp.type}</div>
                    </div>
                  ))}
                </div>
              ) : <div className="no-manpower"><p>No manpower types listed</p></div>}
            </div>
          </div>

          <div className="description-card">
            <div className="card-header"><FaFileAlt className="card-icon" /><h3>Request Description</h3></div>
            <div className="card-content"><div className="description-text">{request.description || 'No description provided'}</div></div>
          </div>

          <div className="bottom-actions">
            <button onClick={() => navigate(-1)} className="back-btn"><FaArrowLeft /><span>Go Back</span></button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default CeoManpowerRequestDetail;
