import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import '../style/ceo_style/Ceo_Dash.css';
import '../style/pm_style/PmManpowerRequest.css'; // reuse existing request styles
import api from '../../api/axiosInstance';
import NotificationBell from '../NotificationBell';
import { FaTachometerAlt, FaComments, FaBoxes, FaProjectDiagram, FaClipboardList, FaChartBar, FaSearch } from 'react-icons/fa';

const ITEMS_PER_PAGE = 8;

// CEO view: read-only list of every manpower request in the system with filtering/search
const CeoManpowerRequestList = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  // Stabilize user object so effects don't re-run every render
  const userRef = useRef(null);
  if (userRef.current === null) {
    const stored = localStorage.getItem('user');
    userRef.current = stored ? JSON.parse(stored) : null;
  }
  const user = userRef.current;

  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [layoutView, setLayoutView] = useState('cards');

  // Note: Do NOT early-return before hooks (react-hooks/rules-of-hooks). We'll gate content later.

  useEffect(() => {
    if (!user || user.role !== 'CEO') return;
    const handleScroll = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      setIsHeaderCollapsed(scrollTop > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!user || user.role !== 'CEO') return;
    const handleClickOutside = (e) => {
      if (!e.target.closest('.user-profile')) setProfileMenuOpen(false);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!user || user.role !== 'CEO') return;
    let active = true;
    const fetchAll = async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await api.get('/manpower-requests');
        if (!active) return;
        setRequests(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!active) return;
        console.error('Failed to load manpower requests:', err);
        if (err.response && (err.response.status === 401 || err.response.status === 403)) {
          setError('Session expired or unauthorized. Please login.');
        } else {
          setError('Failed to load manpower requests');
        }
      } finally {
        if (active) {
          setLoading(false);
          setCurrentPage(1);
        }
      }
    };
    fetchAll();
    return () => { active = false; };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  const filteredRequests = useMemo(() => {
    let items = requests;
    if (status !== 'All') {
      items = items.filter(r => (r.status || 'Pending').toLowerCase().includes(status.toLowerCase()));
    }
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      items = items.filter(r => {
        const proj = r.project?.projectName || '';
        const by = r.createdBy?.name || '';
        const summary = (r.manpowers || []).map(m => `${m.quantity} ${m.type}`).join(', ');
        return proj.toLowerCase().includes(s) || by.toLowerCase().includes(s) || summary.toLowerCase().includes(s) || (r.description || '').toLowerCase().includes(s);
      });
    }
    return items;
  }, [requests, status, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / ITEMS_PER_PAGE));
  const pageRows = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredRequests.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredRequests, currentPage]);

  const getRequestBackgroundColor = (request) => {
    const statusLower = request.status?.toLowerCase() || '';
    if (statusLower.includes('pending') && request.acquisitionDate && new Date(request.acquisitionDate) < new Date()) {
      return '#fef3c7'; // overdue pending
    }
    if (statusLower.includes('pending')) return '#ffffff';
    if (statusLower.includes('approved')) return '#fef3c7';
    if (statusLower.includes('rejected') || statusLower.includes('cancel') || statusLower.includes('denied')) return '#fef2f2';
    if (statusLower.includes('completed')) return '#ecfdf5';
    return '#f9fafb';
  };

  const getStatusBadge = (request) => {
    const s = (request.status || 'Pending').toLowerCase();
    const isOverdue = s === 'pending' && request.acquisitionDate && new Date(request.acquisitionDate) < new Date();
    if (isOverdue) return 'Overdue';
    if (s.includes('completed')) return 'Completed';
    if (s.includes('approved')) return 'Approved';
    if (s.includes('pending')) return 'Pending';
    if (s.includes('reject') || s.includes('denied') || s.includes('cancel')) return 'Rejected';
    if (s.includes('overdue')) return 'Overdue';
    return 'Unknown';
  };

  const getStatusColor = (request) => {
    const s = (request.status || 'Pending').toLowerCase();
    const isOverdue = s === 'pending' && request.acquisitionDate && new Date(request.acquisitionDate) < new Date();
    if (isOverdue) return '#d97706';
    if (s.includes('completed')) return '#059669';
    if (s.includes('approved')) return '#10b981';
    if (s.includes('pending')) return '#f59e0b';
    if (s.includes('reject') || s.includes('denied') || s.includes('cancel')) return '#ef4444';
    if (s.includes('overdue')) return '#d97706';
    return '#6b7280';
  };

  // Executive summary counts
  const summaryCounts = useMemo(() => {
    let pending = 0, approved = 0, completed = 0, rejected = 0, overdue = 0;
    requests.forEach(r => {
      const s = (r.status || 'Pending').toLowerCase();
      const isOver = s === 'pending' && r.acquisitionDate && new Date(r.acquisitionDate) < new Date();
      if (s.includes('completed')) completed++; else if (s.includes('approved')) approved++; else if (s.includes('reject') || s.includes('denied') || s.includes('cancel')) rejected++; else if (isOver || s.includes('overdue')) overdue++; else pending++;
    });
    return { total: requests.length, pending, approved, rejected, overdue, completed };
  }, [requests]);

  if (!user || user.role !== 'CEO') {
    return (
      <div style={{ padding: 24 }}>
        <h2>Forbidden</h2>
        <p>You must be a CEO user to view this page.</p>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <header className={`dashboard-header ${isHeaderCollapsed ? 'collapsed' : ''}`}>
        <div className="header-top">
          <div className="logo-section">
            <img src={require('../../assets/images/FadzLogo1.png')} alt="FadzTrack Logo" className="header-logo" />
            <h1 className="header-brand">FadzTrack</h1>
          </div>
          <div className="user-profile" onClick={() => setProfileMenuOpen(!profileMenuOpen)}>
            <div className="profile-avatar">{user?.name ? user.name.charAt(0).toUpperCase() : 'C'}</div>
            <div className={`profile-info ${isHeaderCollapsed ? 'hidden' : ''}`}>
              <span className="profile-name">{user?.name}</span>
              <span className="profile-role">{user?.role}</span>
            </div>
            {profileMenuOpen && (
              <div className="profile-dropdown">
                <button onClick={handleLogout} className="logout-btn"><span>Logout</span></button>
              </div>
            )}
          </div>
        </div>
        <div className="header-bottom">
          <nav className="header-nav">
            <Link to="/ceo/dash" className="nav-item"><FaTachometerAlt /><span className={isHeaderCollapsed ? 'hidden' : ''}>Dashboard</span></Link>
            <Link to="/ceo/chat" className="nav-item"><FaComments /><span className={isHeaderCollapsed ? 'hidden' : ''}>Chat</span></Link>
            <Link to="/ceo/material-list" className="nav-item"><FaBoxes /><span className={isHeaderCollapsed ? 'hidden' : ''}>Material</span></Link>
            <Link to="/ceo/proj" className="nav-item"><FaProjectDiagram /><span className={isHeaderCollapsed ? 'hidden' : ''}>Projects</span></Link>
            <Link to="/ceo/manpower-requests" className="nav-item active"><FaClipboardList /><span className={isHeaderCollapsed ? 'hidden' : ''}>Manpower</span></Link>
            <Link to="/ceo/audit-logs" className="nav-item"><FaClipboardList /><span className={isHeaderCollapsed ? 'hidden' : ''}>Audit Logs</span></Link>
            <Link to="/reports" className="nav-item"><FaChartBar /><span className={isHeaderCollapsed ? 'hidden' : ''}>Reports</span></Link>
          </nav>
          <NotificationBell />
        </div>
      </header>

      <main className="dashboard-main">
        <div className="page-container">
          <div className="page-header">
            <div className="page-title-section">
              <h1 className="page-title">Manpower Requests</h1>
              <p className="page-subtitle">Organization-wide manpower requests overview</p>
            </div>
          </div>

          {/* Executive Summary */}
          <div style={{ display:'flex', flexWrap:'wrap', gap:'12px', marginBottom:'20px' }}>
            {[
              { label:'Total', value: summaryCounts.total, color:'#334155' },
              { label:'Pending', value: summaryCounts.pending, color:'#f59e0b' },
              { label:'Overdue', value: summaryCounts.overdue, color:'#d97706' },
              { label:'Approved', value: summaryCounts.approved, color:'#10b981' },
              { label:'Completed', value: summaryCounts.completed, color:'#059669' },
              { label:'Rejected', value: summaryCounts.rejected, color:'#ef4444' }
            ].map(c => (
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
                <span style={{ fontSize:'12px', letterSpacing:'.5px', fontWeight:600, color:'#64748b', textTransform:'uppercase' }}>{c.label}</span>
                <span style={{ fontSize:'22px', fontWeight:700, color:c.color }}>{c.value}</span>
                <div style={{ height:'4px', background:c.color, borderRadius:'2px', opacity:.8 }} />
              </div>
            ))}
          </div>

          <div className="controls-bar">
            <div className="filter-tabs">
              {['All','Pending','Approved','Overdue','Completed'].map(tab => (
                <button key={tab} className={`filter-tab ${status === tab ? 'active' : ''}`} onClick={() => setStatus(tab)}>{tab}</button>
              ))}
            </div>
            <div className="search-sort-section">
              <div className="search-wrapper">
                <FaSearch className="search-icon" />
                <input type="text" placeholder="Search requests..." value={searchTerm} onChange={(e)=>setSearchTerm(e.target.value)} className="search-input" />
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={()=>setLayoutView(v=> v==='cards' ? 'table' : 'cards')} className="btn-secondary">
                  {layoutView === 'cards' ? 'Table View' : 'Card View'}
                </button>
              </div>
            </div>
          </div>

          <div className={`requests-grid ${layoutView === 'table' ? 'table-view' : ''}`}>
            {loading ? (
              <div className="loading-state"><div className="loading-spinner"></div><p>Loading manpower requests...</p></div>
            ) : error ? (
              <div className="error-state"><p>{error}</p></div>
            ) : pageRows.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">👥</div>
                <h3>No manpower requests found</h3>
                <p>No requests match your current filters. Try adjusting your search criteria.</p>
              </div>
            ) : (
              <>
                {pageRows.map(request => {
                  const summary = (request.manpowers || []).map(m=>`${m.quantity} ${m.type}`).join(', ');
                  const badgeLabel = getStatusBadge(request);
                  const badgeColor = getStatusColor(request);
                  if (layoutView === 'table') {
                    return (
                      <div className={`request-card status-${(request.status || 'pending').toLowerCase()}`} key={request._id} style={{ backgroundColor: getRequestBackgroundColor(request) }}>
                        <div className="card-header" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                          <h3 className="request-title">{request.project?.projectName || '(No Project Name)'}</h3>
                          <span style={{ background:badgeColor, color:'#fff', padding:'2px 8px', borderRadius:'12px', fontSize:'11px', fontWeight:600 }}>{badgeLabel}</span>
                        </div>
                        <div className="card-body"><div className="requester-info">{request.createdBy?.name || 'Unknown'}</div></div>
                        <div className="request-details"><div className="details-info">{request.description || 'No description'}</div></div>
                        <div className="request-meta"><div className="manpower-info">{summary || '—'}</div></div>
                        <div className="target-date-info">{request.acquisitionDate ? new Date(request.acquisitionDate).toLocaleDateString() : '—'}</div>
                        <div className="duration-info">{request.duration || '—'} day(s)</div>
                        <div className="date-posted-info">{request.createdAt ? new Date(request.createdAt).toLocaleDateString() : '—'}</div>
                        <div className="card-footer">
                          <Link to={`/ceo/manpower-request/${request._id}`} className="view-details-btn">View Request</Link>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div className={`request-card status-${(request.status || 'pending').toLowerCase()}`} key={request._id} style={{ backgroundColor: getRequestBackgroundColor(request) }}>
                      <div className="card-body">
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'8px' }}>
                          <h3 className="request-title">{request.project?.projectName || '(No Project Name)'}</h3>
                          <span style={{ background:badgeColor, color:'#fff', padding:'4px 10px', borderRadius:'14px', fontSize:'11px', fontWeight:600, whiteSpace:'nowrap' }}>{badgeLabel}</span>
                        </div>
                        <p className="request-description">{request.description || 'No description provided'}</p>
                        <div className="request-meta">
                          <div className="meta-item"><span className="meta-label">Requested by:</span><span className="meta-value">{request.createdBy?.name || 'Unknown'}</span></div>
                          <div className="meta-item"><span className="meta-label">Manpower needed:</span><span className="meta-value">{summary || '—'}</span></div>
                          <div className="meta-item"><span className="meta-label">Date:</span><span className="meta-value">{request.createdAt ? new Date(request.createdAt).toLocaleDateString() : '—'}</span></div>
                          <div className="meta-item"><span className="meta-label">Target Date:</span><span className="meta-value">{request.acquisitionDate ? new Date(request.acquisitionDate).toLocaleDateString() : '—'}</span></div>
                          <div className="meta-item"><span className="meta-label">Duration:</span><span className="meta-value">{request.duration || '—'} day(s)</span></div>
                        </div>
                      </div>
                      <div className="card-footer">
                        <Link to={`/ceo/manpower-request/${request._id}`} className="view-details-btn">View Details</Link>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>

          {filteredRequests.length > 0 && (
            <div className="pagination-section">
              <div className="pagination-info">Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredRequests.length)} of {filteredRequests.length} entries</div>
              <div className="pagination-controls">
                <button onClick={()=>setCurrentPage(p=>Math.max(p-1,1))} disabled={currentPage===1} className="pagination-btn">Previous</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button key={page} className={`pagination-btn ${page === currentPage ? 'active' : ''}`} onClick={()=>setCurrentPage(page)}>{page}</button>
                ))}
                <button onClick={()=>setCurrentPage(p=>Math.min(p+1,totalPages))} disabled={currentPage===totalPages} className="pagination-btn">Next</button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default CeoManpowerRequestList;
