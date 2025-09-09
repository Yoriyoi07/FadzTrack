import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../style/ceo_style/Ceo_Dash.css';
import '../style/ceo_style/Ceo_ManpowerRequest.css';
import api from '../../api/axiosInstance';
import { FaSearch, FaDownload } from 'react-icons/fa';
import AppHeader from '../layout/AppHeader';
import { exportManpowerRequestsPdf } from '../../utils/manpowerRequestsPdf';

const ITEMS_PER_PAGE = 8;

const HrManpowerRequestList = () => {
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
  const [viewMode, setViewMode] = useState('mine'); // 'mine' or 'others'
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!user || user.role !== 'HR') return;
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
          const { data } = await api.get('/manpower-requests/hr');
          if (!active) return;
          const arr = Array.isArray(data) ? data : [];
          // For HR users, filter out completed requests from "Others' Requests"
          const othersOnly = arr.filter(r => {
            const creatorId = r.createdBy?._id || r.createdBy?.id || r.createdBy;
            const isCompleted = r.status?.toLowerCase() === 'completed';
            const isOverdue = r.status?.toLowerCase() === 'pending' && r.acquisitionDate && new Date(r.acquisitionDate) < new Date();
            // Show overdue requests to other HR users, but hide completed ones
            return !user._id || (creatorId && creatorId !== user._id && !isCompleted);
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

  // Export function
  const handleExportPdf = async () => {
    try {
      setExporting(true);
      await exportManpowerRequestsPdf(filteredRequests, {
        companyName: 'FadzTrack',
        logoPath: `${process.env.PUBLIC_URL || ''}/images/Fadz-logo.png`,
        exporterName: user?.name || 'Unknown',
        exporterRole: user?.role || '',
        filters: { status, searchTerm },
      });
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export PDF');
    } finally {
      setExporting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / ITEMS_PER_PAGE));
  const pageRows = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredRequests.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredRequests, currentPage]);

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

  if (!user || user.role !== 'HR') {
    return (
      <div style={{ padding: 24 }}>
        <h2>Forbidden</h2>
        <p>You must be an HR user to view this page.</p>
      </div>
    );
  }

  return (
    <div className="dashboard-container ceo-manpower-requests-page">
      <AppHeader roleSegment="hr" />
      <main className="dashboard-main">
        <div className="page-container">
          <div className="dashboard-card ceo-mr-header-card">
            <div className="card-header mr-header-row">
              <div className="mr-header-texts">
                <h1 className="card-title">Manpower Movement</h1>
                <p className="card-subtitle">Manage and track manpower requests across all projects</p>
              </div>
              <div className="layout-toggle-wrapper">
                <button onClick={()=>setLayoutView(v=> v==='cards' ? 'table' : 'cards')} className="btn-secondary toggle-layout-btn">
                  {layoutView === 'cards' ? 'Table View' : 'Card View'}
                </button>
              </div>
            </div>
            <div className="card-body mr-filters-row">
              <div className="filter-tabs compact">
                {['All','Pending','Overdue','Approved','Completed','Rejected','Archived'].map(tab => (
                  <button key={tab} className={`filter-tab ${status === tab ? 'active' : ''}`} onClick={() => {setStatus(tab); setCurrentPage(1);}}>
                    <span>{tab}</span>
                    <span className="count">{statusCounts[tab] ?? 0}</span>
                  </button>
                ))}
              </div>
              <div className="search-wrapper stretch">
                <FaSearch className="search-icon" />
                <input type="text" placeholder="Search requests..." value={searchTerm} onChange={(e)=>{setSearchTerm(e.target.value); setCurrentPage(1);}} className="search-input" />
              </div>
              <button 
                onClick={handleExportPdf} 
                disabled={exporting || filteredRequests.length === 0}
                className="btn-primary export-btn"
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  padding: '8px 16px',
                  minWidth: 'auto'
                }}
              >
                <FaDownload />
                {exporting ? 'Exporting...' : 'Export PDF'}
              </button>
            </div>
          </div>

          {/* Request Type Filter */}
          <div className="dashboard-card ceo-mr-header-card" style={{ marginTop: '1rem' }}>
            <div className="card-body">
              <div className="request-type-filter" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <span style={{ fontWeight: '500', color: '#374151' }}>View:</span>
                <button
                  className={`type-filter-btn ${viewMode === 'mine' ? 'active' : ''}`}
                  onClick={() => setViewMode('mine')}
                  style={{
                    padding: '8px 16px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    background: viewMode === 'mine' ? '#3b82f6' : '#ffffff',
                    color: viewMode === 'mine' ? '#ffffff' : '#374151',
                    cursor: 'pointer',
                    fontWeight: '500'
                  }}
                >
                  My Requests
                </button>
                <button
                  className={`type-filter-btn ${viewMode === 'others' ? 'active' : ''}`}
                  onClick={() => setViewMode('others')}
                  style={{
                    padding: '8px 16px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    background: viewMode === 'others' ? '#3b82f6' : '#ffffff',
                    color: viewMode === 'others' ? '#ffffff' : '#374151',
                    cursor: 'pointer',
                    fontWeight: '500'
                  }}
                >
                  Others' Requests
                </button>
                <button
                  onClick={() => navigate('/hr/request-manpower')}
                  className="btn-primary"
                  style={{
                    marginLeft: 'auto',
                    padding: '8px 16px',
                    background: '#10b981',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: '500',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <span>+</span>
                  <span>Request Manpower</span>
                </button>
              </div>
            </div>
          </div>

          <div className="dashboard-card ceo-mr-summary-card">
            <div className="card-header"><h3 className="card-title-sm">Summary</h3></div>
            <div className="mr-summary-grid">
              {[{ label:'Total', value: summaryCounts.total, color:'#334155' },
                { label:'Pending', value: summaryCounts.pending, color:'#f59e0b' },
                { label:'Overdue', value: summaryCounts.overdue, color:'#d97706' },
                { label:'Approved', value: summaryCounts.approved, color:'#10b981' },
                { label:'Completed', value: summaryCounts.completed, color:'#059669' },
                { label:'Rejected', value: summaryCounts.rejected, color:'#ef4444' },
                { label:'Archived', value: summaryCounts.archived, color:'#8b5cf6' }
              ].map(c => (
                <div key={c.label} className="mr-summary-item">
                  <span className="mr-summary-label">{c.label}</span>
                  <span className="mr-summary-value" style={{ color:c.color }}>{c.value}</span>
                  <div className="mr-summary-bar" style={{ background:c.color }} />
                </div>
              ))}
            </div>
          </div>

          <div className="dashboard-card ceo-mr-list-card">
            <div className="card-header list-header"><h3 className="card-title-sm">Requests <span className="muted">({filteredRequests.length})</span></h3></div>
            <div className={`requests-grid ceo-mr-grid ${layoutView === 'table' ? 'table-view' : ''}`}>            
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
                          onClick={() => navigate(`/hr/manpower-request/${request._id}`)}
                          style={{ cursor: 'pointer' }}
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
                        </div>
                        <div className="card-footer">
                          <Link to={`/hr/manpower-request/${request._id}`} className="view-details-btn">View Details</Link>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
            {filteredRequests.length > 0 && (
              <div className="pagination-section inside-card">
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
        </div>
      </main>
    </div>
  );
};

export default HrManpowerRequestList;
