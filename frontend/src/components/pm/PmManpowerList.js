import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../style/ceo_style/Ceo_Dash.css';
import '../style/ceo_style/Ceo_ManpowerRequest.css';
import '../style/pm_style/Pm_ViewRequest.css';
import api from '../../api/axiosInstance';
import { FaSearch, FaTh, FaList } from 'react-icons/fa';
import AppHeader from '../layout/AppHeader';

const ITEMS_PER_PAGE = 8;

const PmManpowerList = () => {
  const navigate = useNavigate();
  const userRef = useRef(null);
  if (userRef.current === null) {
    const stored = localStorage.getItem('user');
    userRef.current = stored ? JSON.parse(stored) : null;
  }
  const user = userRef.current;

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [layoutView, setLayoutView] = useState('cards');
  const [sortDesc, setSortDesc] = useState(true);

  // PM-specific functionality
  const [viewMode, setViewMode] = useState('mine'); // 'mine' or 'others'

  useEffect(() => {
    if (!user || user.role !== 'Project Manager') return;
    let active = true;
    const fetchAll = async () => {
      setLoading(true);
      setError('');
      try {
        if (viewMode === 'mine') {
          const { data } = await api.get('/manpower-requests/mine');
          if (!active) return;
          setRequests(Array.isArray(data) ? data : []);
        } else {
          // Fetch ALL requests then filter out those created by this user
          const { data } = await api.get('/manpower-requests');
          if (!active) return;
          const arr = Array.isArray(data) ? data : [];
          const othersOnly = arr.filter(r => {
            const creatorId = r.createdBy?._id || r.createdBy?.id || r.createdBy;
            return creatorId && creatorId !== user._id; // exclude my own only
          });
          setRequests(othersOnly);
        }
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
  }, [user, viewMode]);

  const filteredRequests = useMemo(() => {
    let items = requests;
    if (status !== 'All') {
      if (status === 'Archived') {
        items = items.filter(r => (r.status || 'Pending').toLowerCase().includes('archived'));
      } else {
        items = items.filter(r => (r.status || 'Pending').toLowerCase().includes(status.toLowerCase()));
      }
    } else {
      // For 'All' filter, exclude archived items by default
      items = items.filter(r => !(r.status || 'Pending').toLowerCase().includes('archived'));
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

  // Sorting logic
  const sortedRequests = useMemo(() => {
    return [...filteredRequests].sort((a, b) => {
      const aTime = new Date(a.createdAt || 0).getTime();
      const bTime = new Date(b.createdAt || 0).getTime();
      return sortDesc ? bTime - aTime : aTime - bTime;
    });
  }, [filteredRequests, sortDesc]);

  const totalPages = Math.max(1, Math.ceil(sortedRequests.length / ITEMS_PER_PAGE));
  const pageRows = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return sortedRequests.slice(start, start + ITEMS_PER_PAGE);
  }, [sortedRequests, currentPage]);

  const getRequestBackgroundColor = (request) => {
    const statusLower = request.status?.toLowerCase() || '';
    if (statusLower.includes('pending') && request.acquisitionDate && new Date(request.acquisitionDate) < new Date()) {
      return '#fef3c7';
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
    if (s.includes('archived')) return 'Archived';
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
    if (s.includes('archived')) return '#8b5cf6';
    if (s.includes('completed')) return '#059669';
    if (s.includes('approved')) return '#10b981';
    if (s.includes('pending')) return '#f59e0b';
    if (s.includes('reject') || s.includes('denied') || s.includes('cancel')) return '#ef4444';
    if (s.includes('overdue')) return '#d97706';
    return '#6b7280';
  };

  const summaryCounts = useMemo(() => {
    let pending = 0, approved = 0, completed = 0, rejected = 0, overdue = 0, archived = 0;
    requests.forEach(r => {
      const s = (r.status || 'Pending').toLowerCase();
      const isOver = s === 'pending' && r.acquisitionDate && new Date(r.acquisitionDate) < new Date();
      if (s.includes('archived')) archived++; else if (s.includes('completed')) completed++; else if (s.includes('approved')) approved++; else if (s.includes('reject') || s.includes('denied') || s.includes('cancel')) rejected++; else if (isOver || s.includes('overdue')) overdue++; else pending++;
    });
    return { total: requests.length, pending, approved, rejected, overdue, completed, archived };
  }, [requests]);

  const statusCounts = useMemo(() => ({
    All: summaryCounts.total - summaryCounts.archived, // Exclude archived from All count
    Pending: summaryCounts.pending,
    Overdue: summaryCounts.overdue,
    Approved: summaryCounts.approved,
    Completed: summaryCounts.completed,
    Rejected: summaryCounts.rejected,
    Archived: summaryCounts.archived
  }), [summaryCounts]);

  if (!user || user.role !== 'Project Manager') {
    return (
      <div style={{ padding: 24 }}>
        <h2>Forbidden</h2>
        <p>You must be a Project Manager to view this page.</p>
      </div>
    );
  }

  return (
    <div className="dashboard-container ceo-manpower-requests-page">
      <AppHeader roleSegment="pm" />
      <main className="dashboard-main">
        <div className="page-container">
          <div className="dashboard-card ceo-mr-header-card">
            <div className="card-header mr-header-row">
              <div className="mr-header-texts">
                <h1 className="card-title">Manpower Requests</h1>
                <p className="card-subtitle">Manage and track manpower requests for your project</p>
              </div>
              <div className="layout-toggle-wrapper">
                <button
                  type="button"
                  className="btn-primary request-manpower-btn"
                  onClick={()=> navigate('/pm/request-manpower')}
                  style={{marginRight:12}}
                >
                  + Request Manpower
                </button>
                <button
                  onClick={() => setSortDesc(!sortDesc)}
                  className="btn-secondary sort-btn"
                  title="Toggle sort by Created date"
                >
                  {sortDesc ? '↓ Newest' : '↑ Oldest'}
                </button>
              </div>
            </div>
            <div className="card-body mr-filters-row">
              <div className="horizontal-controls">
                <div className="filter-tabs compact">
                  {['All','Pending','Overdue','Approved','Completed','Rejected','Archived'].map(tab => (
                    <button key={tab} className={`filter-tab ${status === tab ? 'active' : ''}`} onClick={() => {setStatus(tab); setCurrentPage(1);}}>
                      <span>{tab}</span>
                      <span className="count">{statusCounts[tab] ?? 0}</span>
                    </button>
                  ))}
                </div>
                <div className="search-wrapper">
                  <FaSearch className="search-icon" />
                  <input type="text" placeholder="Search requests..." value={searchTerm} onChange={(e)=>{setSearchTerm(e.target.value); setCurrentPage(1);}} className="search-input" />
                </div>
                <div className="view-mode-toggle small">
                  <button
                    onClick={() => setViewMode('mine')}
                    className={`view-mode-btn ${viewMode === 'mine' ? 'active' : ''}`}
                    title="My Requests"
                  >
                    Mine
                  </button>
                  <button
                    onClick={() => setViewMode('others')}
                    className={`view-mode-btn ${viewMode === 'others' ? 'active' : ''}`}
                    title="Others' Requests"
                  >
                    Others
                  </button>
                </div>
                <div className="layout-toggle small">
                  <button
                    onClick={() => setLayoutView('cards')}
                    className={`layout-btn ${layoutView === 'cards' ? 'active' : ''}`}
                    title="Card View"
                  >
                    <FaTh />
                  </button>
                  <button
                    onClick={() => setLayoutView('table')}
                    className={`layout-btn ${layoutView === 'table' ? 'active' : ''}`}
                    title="Table View"
                  >
                    <FaList />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="dashboard-card ceo-mr-list-card">
            <div className="card-header list-header"><h3 className="card-title-sm">Requests <span className="muted">({sortedRequests.length})</span></h3></div>
            <div className={`requests-grid ceo-mr-grid ${layoutView === 'table' ? 'table-view' : ''}`}>            
              {loading ? (
                <div className="loading-state"><div className="loading-spinner"></div><p>Loading manpower requests...</p></div>
              ) : error ? (
                <div className="error-state"><p>{error}</p></div>
              ) : pageRows.length === 0 ? (
                <div className="empty-state" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', textAlign: 'center' }}>
                  <div className="empty-icon" style={{ fontSize: '48px', marginBottom: '16px' }}>👥</div>
                  <h3 style={{ marginBottom: '8px', color: '#374151' }}>No manpower requests found</h3>
                  <p style={{ color: '#6b7280', margin: 0 }}>No requests match your current filters. Try adjusting your search criteria.</p>
                </div>
              ) : (
                <>
                  {layoutView === 'table' && (
                    <div className="mr-table-header" role="row" aria-label="Table Header">
                      <div>Project</div>
                      <div>Requester</div>
                      <div>Description</div>
                      <div>Manpower</div>
                      <div>Target</div>
                      <div>Dur</div>
                      <div>Created</div>
                      <div>Status</div>
                      <div>Actions</div>
                    </div>
                  )}
                  {pageRows.map(request => {
                    const summary = (request.manpowers || []).map(m=>`${m.quantity} ${m.type}`).join(', ');
                    const badgeLabel = getStatusBadge(request);
                    const badgeColor = getStatusColor(request);
                    if (layoutView === 'table') {
                      return (
                        <div
                          key={request._id}
                          className="mr-table-row"
                          role="row"
                          title="View details"
                        >
                          <div className="rt-title" title={request.project?.projectName || '(No Project Name)'}>{request.project?.projectName || '(No Project Name)'}</div>
                          <div className="rt-req" title={request.createdBy?.name || 'Unknown'}>{request.createdBy?.name || 'Unknown'}</div>
                          <div className="rt-desc" title={request.description || 'No description'}>{request.description || 'No description'}</div>
                          <div className="rt-man" title={summary || '—'}>{summary || '—'}</div>
                          <div className="rt-date" title="Target Date">{request.acquisitionDate ? new Date(request.acquisitionDate).toLocaleDateString() : '—'}</div>
                          <div className="rt-date" title="Duration">{request.duration || '—'}d</div>
                          <div className="rt-date" title="Created">{request.createdAt ? new Date(request.createdAt).toLocaleDateString() : '—'}</div>
                          <div className="rt-btn"><span className={`status-chip ${badgeLabel.toLowerCase()}`}>{badgeLabel}</span></div>
                          <div className="rt-actions">
                            <Link to={`/pm/manpower-request/${request._id}`} className="view-details-btn">View Details</Link>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div className={`request-card ceo-mr-card`} key={request._id}>
                        <div className="card-body">
                          <div className="mr-card-top-row">
                            <h3 className="request-title" title={request.project?.projectName || '(No Project Name)'}>{request.project?.projectName || '(No Project Name)'}</h3>
                            <span className={`status-chip ${badgeLabel.toLowerCase()}`}>{badgeLabel}</span>
                          </div>
                          <p className="request-description" title={request.description || 'No description provided'}>{request.description || 'No description provided'}</p>
                          <div className="request-meta">
                            <div className="meta-item"><span className="meta-label">Requested by:</span><span className="meta-value" title={request.createdBy?.name || 'Unknown'}>{request.createdBy?.name || 'Unknown'}</span></div>
                            <div className="meta-item"><span className="meta-label">Manpower:</span><span className="meta-value" title={summary || '—'}>{summary || '—'}</span></div>
                            <div className="meta-item"><span className="meta-label">Date:</span><span className="meta-value">{request.createdAt ? new Date(request.createdAt).toLocaleDateString() : '—'}</span></div>
                            <div className="meta-item"><span className="meta-label">Target:</span><span className="meta-value">{request.acquisitionDate ? new Date(request.acquisitionDate).toLocaleDateString() : '—'}</span></div>
                            <div className="meta-item"><span className="meta-label">Duration:</span><span className="meta-value">{request.duration || '—'} d</span></div>
                          </div>
                          
                          {/* Rejection Information */}
                          {request.rejectedBy && request.rejectedBy.length > 0 && (
                            <div className="rejection-info">
                              <div className="meta-item">
                                <span className="meta-label">Rejected by:</span>
                                <span className="meta-value rejection-list">
                                  {request.rejectedBy.map((rejection, index) => (
                                    <span key={index} className="rejection-item">
                                      {rejection.userName || rejection.userId?.name || 'Unknown PM'}
                                      {index < request.rejectedBy.length - 1 ? ', ' : ''}
                                    </span>
                                  ))}
                                </span>
                              </div>
                              {request.rejectionReason && (
                                <div className="meta-item">
                                  <span className="meta-label">Reason:</span>
                                  <span className="meta-value rejection-reason">{request.rejectionReason}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="card-footer">
                          <Link to={`/pm/manpower-request/${request._id}`} className="view-details-btn">View Details</Link>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
            {sortedRequests.length > 0 && (
              <div className="pagination-section inside-card">
                <div className="pagination-info">Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, sortedRequests.length)} of {sortedRequests.length} entries</div>
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
        </div>
      </main>
    </div>
  );
};

export default PmManpowerList;
