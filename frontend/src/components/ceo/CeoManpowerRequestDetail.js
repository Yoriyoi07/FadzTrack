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
import '../style/ceo_style/Ceo_ManpowerRequestDetail.css';

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
    <div className="dashboard-container ceo-mr-detail">
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

          <div className={`status-metrics-card ${request.status?.toLowerCase()}`}>
            <div className="smc-header">
              <div className="smc-status-icon">{getStatusIcon(request.status)}</div>
              <div className="smc-texts">
                <h3>{(request.status || 'Pending')} Request</h3>
                <p>{request.description || 'No description provided'}</p>
              </div>
              {request.status?.toLowerCase() === 'pending' && request.acquisitionDate && new Date(request.acquisitionDate) < new Date() && (
                <span className="badge-overdue">Overdue</span>
              )}
            </div>
            <div className="smc-metrics">
              {(() => {
                const badge = getStatusBadge();
                const manpowerTotal = Array.isArray(request.manpowers) ? request.manpowers.reduce((acc,m)=>acc + (Number(m.quantity)||0),0) : 0;
                const metrics = [
                  { label:'Status', value:badge.label },
                  { label:'Types', value: Array.isArray(request.manpowers) ? request.manpowers.length : 0 },
                  { label:'Quantity', value: manpowerTotal },
                  { label:'Duration', value: `${request.duration || 0}d` },
                  { label:'Return', value: request.returnDate ? 'Yes' : 'No' }
                ];
                return metrics.map(m => (
                  <div key={m.label} className="smc-metric">
                    <span className="m-label">{m.label}</span>
                    <span className="m-value">{m.value}</span>
                  </div>
                ));
              })()}
            </div>
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
