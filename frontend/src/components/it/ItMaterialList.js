import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import '../style/pm_style/PmMatRequest.css';
import '../style/pm_style/Pm_Dash.css';
import NotificationBell from '../NotificationBell';
import api from '../../api/axiosInstance';
// Nav icons
import { FaTachometerAlt, FaComments, FaBoxes, FaUsers, FaClipboardList } from 'react-icons/fa';
import { exportMaterialRequestsPdf } from '../../utils/materialRequestsPdf';

const ITEMS_PER_PAGE = 5;

const ItMaterialList = () => {
  const navigate = useNavigate();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const stored = localStorage.getItem('user');
  const currentUser = stored ? JSON.parse(stored) : {};
  const [userName, setUserName] = useState(currentUser?.name || '');
  const [userRole, setUserRole] = useState(currentUser?.role || '');
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFilters, setExportFilters] = useState({ status: 'All', requester: 'All', project: 'All', dateFrom: '', dateTo: '' });

  // GET user role from localStorage
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isIT = user.role === 'IT';

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Session expired. Please log in.');
      setLoading(false);
      return;
    }

    // IT: fetch all material requests
    if (isIT) {
      api.get('/requests/all')
        .then(res => {
          setRequests(Array.isArray(res.data) ? res.data : []);
          setLoading(false);
          setError('');
        })
        .catch(err => {
          if (err.response && (err.response.status === 403 || err.response.status === 401)) {
            setError('Session expired or unauthorized. Please login.');
          } else {
            setError('Failed to load requests');
          }
          setRequests([]);
          setLoading(false);
        });
    } else {
      setError('Forbidden: IT only.');
      setLoading(false);
    }
  }, [isIT]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest(".user-profile")) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const shouldCollapse = scrollTop > 50;
      setIsHeaderCollapsed(shouldCollapse);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  const getIconForType = (request) => {
    if (!request.materials || request.materials.length === 0) return '📄';
    const name = request.materials[0].materialName?.toLowerCase() || '';
    if (name.includes('steel')) return '🔧';
    if (name.includes('brick')) return '🧱';
    if (name.includes('cement')) return '🪨';
    if (name.includes('sand')) return '🏖️';
    return '📦';
  };

  const truncateWords = (text = '', maxWords = 16) => {
    if (!text || typeof text !== 'string') return '';
    const words = text.trim().split(/\s+/);
    if (words.length <= maxWords) return text;
    return words.slice(0, maxWords).join(' ') + '...';
  };

  const filteredRequests = requests.filter(request => {
    const status = (request.status || '').toLowerCase();
    const isCompleted = !!request.receivedByPIC;
    const matchesFilter =
      filter === 'All' ||
      (filter === 'Pending' && status.includes('pending')) ||
      (filter === 'Approved' && status.includes('approved')) ||
      (filter === 'Cancelled' && (status.includes('denied') || status.includes('cancel'))) ||
      (filter === 'Completed' && isCompleted);
    const searchTarget = [
      request.materials && request.materials.map(m => m.materialName).join(', '),
      request.description,
      request.createdBy?.name,
      request.project?.projectName,
    ].join(' ').toLowerCase();
    const matchesSearch = searchTarget.includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  // Sort: when viewing All, push Completed to the end; otherwise newest first
  const sortedRequests = [...filteredRequests].sort((a, b) => {
    if (filter === 'All') {
      const aCompleted = a.receivedByPIC ? 1 : 0;
      const bCompleted = b.receivedByPIC ? 1 : 0;
      if (aCompleted !== bCompleted) return aCompleted - bCompleted; // non-completed first
    }
    const ad = new Date(a.createdAt || 0).getTime();
    const bd = new Date(b.createdAt || 0).getTime();
    return bd - ad; // newest first
  });
  const totalPages = Math.ceil(sortedRequests.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedRequests = sortedRequests.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const getStatusColor = (status, receivedByPIC) => {
    const s = (status || '').toLowerCase();
    if (receivedByPIC) return '#0ea5e9'; // Completed (cyan-ish)
    if (s.includes('approved')) return '#10b981';
    if (s.includes('pending')) return '#f59e0b';
    if (s.includes('denied') || s.includes('cancel')) return '#ef4444';
    return '#6b7280';
  };

  const getStatusBadge = (status, receivedByPIC) => {
    if (receivedByPIC) return 'Completed';
    const s = (status || '').toLowerCase();
    if (s.includes('approved')) return 'Approved';
    if (s.includes('pending')) return 'Pending';
    if (s.includes('denied') || s.includes('cancel')) return 'Rejected';
    return 'Unknown';
  };

  const openEdit = (request) => {
    // Navigate to the comprehensive edit form
    navigate(`/it/material-request/edit/${request._id}`);
  };

  const deleteRequest = async (id) => {
    if (!window.confirm('Delete this material request? This action cannot be undone.')) return;
    try {
      await api.delete(`/requests/${id}`);
      setRequests(prev => prev.filter(r => r._id !== id));
    } catch (e) {
      alert('Failed to delete request');
    }
  };

  const uniqueRequesters = Array.from(new Set((requests || []).map(r => r.createdBy?.name).filter(Boolean)));
  const uniqueProjects = Array.from(new Set((requests || []).map(r => r.project?.projectName).filter(Boolean)));

  const handleExport = async () => {
    try {
      const userObj = JSON.parse(localStorage.getItem('user') || '{}');
      const companyName = 'FadzTrack';
      const logoPath = `${process.env.PUBLIC_URL || ''}/images/Fadz-logo.png`;

      // Apply filters to current full dataset for export
      const rows = requests.filter(r => {
        const completed = !!r.receivedByPIC;
        const statusLabel = completed ? 'Completed' : (r.status || '');
        const statusOk = exportFilters.status === 'All' ||
          (exportFilters.status === 'Completed' && completed) ||
          (exportFilters.status !== 'Completed' && String(statusLabel).toLowerCase().includes(exportFilters.status.toLowerCase()))
        ;
        const requesterOk = exportFilters.requester === 'All' || (r.createdBy?.name === exportFilters.requester);
        const projectOk = exportFilters.project === 'All' || (r.project?.projectName === exportFilters.project);
        // Date checks (createdAt within range if provided)
        let dateOk = true;
        const createdTime = r.createdAt ? new Date(r.createdAt).getTime() : NaN;
        if (exportFilters.dateFrom) {
          const fromTime = new Date(exportFilters.dateFrom).setHours(0,0,0,0);
          if (!isNaN(createdTime)) {
            dateOk = dateOk && createdTime >= fromTime;
          }
        }
        if (exportFilters.dateTo) {
          const toTime = new Date(exportFilters.dateTo).setHours(23,59,59,999);
          if (!isNaN(createdTime)) {
            dateOk = dateOk && createdTime <= toTime;
          }
        }
        return statusOk && requesterOk && projectOk && dateOk;
      });

      await exportMaterialRequestsPdf(rows, {
        companyName,
        logoPath,
        exporterName: userObj?.name || 'Unknown',
        exporterRole: userObj?.role || '',
        filters: {
          Status: exportFilters.status,
          Requester: exportFilters.requester,
          Project: exportFilters.project,
          From: exportFilters.dateFrom || '—',
          To: exportFilters.dateTo || '—',
        },
      });
      setExportOpen(false);
    } catch (e) {
      alert('Failed to export PDF');
    }
  };

  return (
    <div>
      <header className={`dashboard-header ${isHeaderCollapsed ? 'collapsed' : ''}`}>
        <div className="header-top">
          <div className="logo-section">
            <img src={require('../../assets/images/FadzLogo1.png')} alt="FadzTrack Logo" className="header-logo" />
            <h1 className="header-brand">FadzTrack</h1>
          </div>
          <div className="user-profile" onClick={() => setProfileMenuOpen(!profileMenuOpen)}>
            <div className="profile-avatar">{userName ? userName.charAt(0).toUpperCase() : 'I'}</div>
            <div className={`profile-info ${isHeaderCollapsed ? 'hidden' : ''}`}>
              <span className="profile-name">{userName}</span>
              <span className="profile-role">{userRole}</span>
            </div>
            {profileMenuOpen && (
              <div className="profile-dropdown" onClick={(e) => e.stopPropagation()}>
                <button onClick={(e) => { e.stopPropagation(); handleLogout(); }} className="logout-btn"><span>Logout</span></button>
              </div>
            )}
          </div>
        </div>
        <div className="header-bottom">
          <nav className="header-nav">
            <Link to="/it" className="nav-item">
              <FaTachometerAlt />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Dashboard</span>
            </Link>
            <Link to="/it/chat" className="nav-item">
              <FaComments />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Chat</span>
            </Link>
            <Link to="/it/material-list" className="nav-item active">
              <FaBoxes />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Material</span>
            </Link>
            <Link to="/it/manpower-list" className="nav-item">
              <FaUsers />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Manpower</span>
            </Link>
            <Link to="/it/auditlogs" className="nav-item">
              <FaClipboardList />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Logs</span>
            </Link>
          </nav>
          <NotificationBell />
        </div>
      </header>


      <main className="dashboard-main">
        <div className="page-container">
          <div className="controls-bar">
            <div className="filter-tabs">
              {['All', 'Pending', 'Approved', 'Cancelled', 'Completed'].map(tab => (
                <button
                  key={tab}
                  className={`filter-tab ${filter === tab ? 'active' : ''}`}
                  onClick={() => setFilter(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>
            <div className="search-sort-section">
              <div className="search-wrapper">
                <input
                  type="text"
                  placeholder="Search requests..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input"
                />
              </div>
              <button className="view-details-btn" onClick={() => setExportOpen(true)} style={{ background:'#2563eb' }}>Export PDF</button>
            </div>
          </div>

          <div className="requests-grid">
            {loading ? (
              <div className="loading-state"><div className="loading-spinner"></div><p>Loading material requests...</p></div>
            ) : error ? (
              <div className="error-state"><p>{error}</p></div>
            ) : paginatedRequests.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📦</div>
                <h3>No material requests found</h3>
                <p>No requests match your current filters. Try adjusting your search criteria.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {paginatedRequests.map(request => (
                  <div key={request._id} style={{ 
                    background: '#f8fafc', 
                    border: '1px solid #e2e8f0', 
                    borderRadius: '6px', 
                    padding: '12px',
                    fontSize: '13px'
                  }}>
                    {/* Request Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div style={{ flex: 1 }}>
                        <h3 style={{ 
                          margin: '0 0 4px 0', 
                          fontSize: '15px', 
                          fontWeight: '600', 
                          color: '#1f2937' 
                        }}>
                          {request.materials?.length
                            ? request.materials.map(m => `${m.materialName} (${m.quantity} ${m.unit || ''})`).join(', ')
                            : 'Material Request'}
                        </h3>
                        <p style={{ 
                          margin: '0 0 6px 0', 
                          color: '#6b7280', 
                          fontSize: '13px',
                          lineHeight: '1.3'
                        }}>
                          {request.description || 'No description provided'}
                        </p>
                      </div>
                      <span style={{ 
                        background: getStatusColor(request.status, request.receivedByPIC),
                        color: '#ffffff',
                        padding: '3px 10px',
                        borderRadius: '10px',
                        fontSize: '11px',
                        fontWeight: '600',
                        marginLeft: '10px'
                      }}>
                        {getStatusBadge(request.status, request.receivedByPIC)}
                      </span>
                    </div>
                    
                    {/* Tracking Progress */}
                    <div style={{ marginBottom: '8px' }}>
                      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px', fontWeight: '500' }}>
                        Tracking Progress:
                      </div>
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0px',
                        background: '#ffffff',
                        padding: '8px',
                        borderRadius: '6px',
                        border: '1px solid #e2e8f0'
                      }}>
                        {/* Placed Stage */}
                        <div style={{ 
                          display: 'flex', 
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '3px',
                          minWidth: '75px'
                        }}>
                          <div style={{ 
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontSize: '12px',
                            fontWeight: 'bold'
                          }}>
                            ✓
                          </div>
                          <span style={{ 
                            fontSize: '10px', 
                            fontWeight: '600',
                            color: '#1f2937',
                            textAlign: 'center'
                          }}>
                            Placed
                          </span>
                          <span style={{ 
                            fontSize: '9px', 
                            color: '#10b981',
                            fontWeight: '500'
                          }}>
                            Done
                          </span>
                          <span style={{ 
                            fontSize: '8px', 
                            color: '#6b7280'
                          }}>
                            {new Date(request.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        
                        {/* Connector 1 */}
                        <div style={{ 
                          width: '16px',
                          height: '2px',
                          background: 'linear-gradient(90deg, #10b981 0%, #d1fae5 100%)',
                          margin: '0 3px'
                        }}></div>
                        
                        {/* PM Stage */}
                        <div style={{ 
                          display: 'flex', 
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '3px',
                          minWidth: '75px'
                        }}>
                          <div style={{ 
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            background: (request.status?.includes('pm') || request.status?.includes('project manager')) ? 
                                          (request.status?.includes('denied') ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)') : 
                                          'linear-gradient(135deg, #e5e7eb 0%, #d1d5db 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontSize: '12px',
                            fontWeight: 'bold'
                          }}>
                            {(request.status?.includes('pm') || request.status?.includes('project manager')) ? 
                              (request.status?.includes('denied') ? '✗' : '✓') : '○'}
                          </div>
                          <span style={{ 
                            fontSize: '10px', 
                            fontWeight: '600',
                            color: '#1f2937',
                            textAlign: 'center'
                          }}>
                            Project Manager
                          </span>
                          <span style={{ 
                            fontSize: '9px', 
                            color: (request.status?.includes('pm') || request.status?.includes('project manager')) ? 
                                   (request.status?.includes('denied') ? '#ef4444' : '#10b981') : '#6b7280',
                            fontWeight: '500'
                          }}>
                            {(request.status?.includes('pm') || request.status?.includes('project manager')) ? 
                              (request.status?.includes('denied') ? 'Rejected' : 'Approved') : 'Pending'}
                          </span>
                          <span style={{ 
                            fontSize: '8px', 
                            color: '#6b7280'
                          }}>
                            {request.pmApprovedAt ? new Date(request.pmApprovedAt).toLocaleDateString() : 'N/A'}
                          </span>
                        </div>
                        
                        {/* Connector 2 */}
                        <div style={{ 
                          width: '16px',
                          height: '2px',
                          background: (request.status?.includes('pm') || request.status?.includes('project manager')) && !request.status?.includes('denied') ? 
                                        'linear-gradient(90deg, #10b981 0%, #d1fae5 100%)' : 
                                        'linear-gradient(90deg, #e5e7eb 0%, #f3f4f6 100%)',
                          margin: '0 3px'
                        }}></div>
                        
                        {/* AM Stage */}
                        <div style={{ 
                          display: 'flex', 
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '3px',
                          minWidth: '75px'
                        }}>
                          <div style={{ 
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            background: (request.status?.includes('am') || request.status?.includes('area manager')) ? 
                                          (request.status?.includes('denied') ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)') : 
                                          'linear-gradient(135deg, #e5e7eb 0%, #d1d5db 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontSize: '12px',
                            fontWeight: 'bold'
                          }}>
                            {(request.status?.includes('am') || request.status?.includes('area manager')) ? 
                              (request.status?.includes('denied') ? '✗' : '✓') : '○'}
                          </div>
                          <span style={{ 
                            fontSize: '10px', 
                            fontWeight: '600',
                            color: '#1f2937',
                            textAlign: 'center'
                          }}>
                            Area Manager
                          </span>
                          <span style={{ 
                            fontSize: '9px', 
                            color: (request.status?.includes('am') || request.status?.includes('area manager')) ? 
                                   (request.status?.includes('denied') ? '#ef4444' : '#10b981') : '#6b7280',
                            fontWeight: '500'
                          }}>
                            {(request.status?.includes('am') || request.status?.includes('area manager')) ? 
                              (request.status?.includes('denied') ? 'Rejected' : 'Approved') : 'Pending'}
                          </span>
                          <span style={{ 
                            fontSize: '8px', 
                            color: '#6b7280'
                          }}>
                            {request.amApprovedAt ? new Date(request.amApprovedAt).toLocaleDateString() : 'N/A'}
                          </span>
                        </div>
                        
                        {/* Connector 3 */}
                        <div style={{ 
                          width: '16px',
                          height: '2px',
                          background: (request.status?.includes('am') || request.status?.includes('area manager')) && !request.status?.includes('denied') ? 
                                        'linear-gradient(90deg, #10b981 0%, #d1fae5 100%)' : 
                                        'linear-gradient(90deg, #e5e7eb 0%, #f3f4f6 100%)',
                          margin: '0 3px'
                        }}></div>
                        
                        {/* Received Stage */}
                        <div style={{ 
                          display: 'flex', 
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '3px',
                          minWidth: '75px'
                        }}>
                          <div style={{ 
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            background: request.receivedByPIC ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'linear-gradient(135deg, #e5e7eb 0%, #d1d5db 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontSize: '12px',
                            fontWeight: 'bold'
                          }}>
                            {request.receivedByPIC ? '✓' : '○'}
                          </div>
                          <span style={{ 
                            fontSize: '10px', 
                            fontWeight: '600',
                            color: '#1f2937',
                            textAlign: 'center'
                          }}>
                            Received
                          </span>
                          <span style={{ 
                            fontSize: '9px', 
                            color: request.receivedByPIC ? '#10b981' : '#6b7280',
                            fontWeight: '500'
                          }}>
                            {request.receivedByPIC ? 'Received' : 'Pending'}
                          </span>
                          <span style={{ 
                            fontSize: '8px', 
                            color: '#6b7280'
                          }}>
                            {request.receivedByPIC ? new Date(request.receivedByPIC).toLocaleDateString() : 'N/A'}
                          </span>
                        </div>
                    </div>
                  </div>
                    
                    {/* Request Details */}
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      marginBottom: '8px'
                    }}>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>
                        <span style={{ fontWeight: '500' }}>{request.createdBy?.name || 'Unknown'}</span> • {new Date(request.createdAt).toLocaleDateString()}
                        {request.project?.projectName && (
                          <span> • Project: {request.project.projectName}</span>
                        )}
                    </div>
                  </div>
                    
                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <Link to={`/it/material-request/${request._id}`} className="view-details-btn">View Details</Link>
                      <button className="view-details-btn" onClick={() => openEdit(request)} style={{ background:'#eab308' }}>Edit</button>
                      <button className="view-details-btn" onClick={() => deleteRequest(request._id)} style={{ background:'#ef4444' }}>Delete</button>
                    </div>
                  </div>
                ))}
                </div>
            )}
          </div>

          {filteredRequests.length > 0 && (
            <div className="pagination-section">
              <div className="pagination-info">
                Showing {startIndex + 1} to {Math.min(startIndex + ITEMS_PER_PAGE, filteredRequests.length)} of {filteredRequests.length} entries
              </div>
              <div className="pagination-controls">
                <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="pagination-btn">Previous</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button key={page} className={`pagination-btn ${page === currentPage ? 'active' : ''}`} onClick={() => setCurrentPage(page)}>{page}</button>
                ))}
                <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} className="pagination-btn">Next</button>
              </div>
            </div>
          )}
        </div>
      </main>
      {exportOpen && (
        <div className="modal-overlay" style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
          <div className="modal" style={{ background:'#fff', borderRadius:12, padding:20, width:520, maxWidth:'94%' }}>
            <h3 style={{ marginTop:0, marginBottom:10 }}>Export Material Requests</h3>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div>
                <label style={{ display:'block', fontWeight:600, marginBottom:6 }}>Status</label>
                <select value={exportFilters.status} onChange={(e)=>setExportFilters(s=>({ ...s, status:e.target.value }))} style={{ width:'100%', padding:8, border:'1px solid #e5e7eb', borderRadius:8 }}>
                  {['All','Pending','Approved','Cancelled','Completed'].map(v => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display:'block', fontWeight:600, marginBottom:6 }}>Requester</label>
                <select value={exportFilters.requester} onChange={(e)=>setExportFilters(s=>({ ...s, requester:e.target.value }))} style={{ width:'100%', padding:8, border:'1px solid #e5e7eb', borderRadius:8 }}>
                  <option value="All">All</option>
                  {uniqueRequesters.map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display:'block', fontWeight:600, marginBottom:6 }}>Project</label>
                <select value={exportFilters.project} onChange={(e)=>setExportFilters(s=>({ ...s, project:e.target.value }))} style={{ width:'100%', padding:8, border:'1px solid #e5e7eb', borderRadius:8 }}>
                  <option value="All">All</option>
                  {uniqueProjects.map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display:'block', fontWeight:600, marginBottom:6 }}>From (Date)</label>
                <input type="date" value={exportFilters.dateFrom} onChange={(e)=>setExportFilters(s=>({ ...s, dateFrom:e.target.value }))} style={{ width:'100%', padding:8, border:'1px solid #e5e7eb', borderRadius:8 }} />
              </div>
              <div>
                <label style={{ display:'block', fontWeight:600, marginBottom:6 }}>To (Date)</label>
                <input type="date" value={exportFilters.dateTo} onChange={(e)=>setExportFilters(s=>({ ...s, dateTo:e.target.value }))} style={{ width:'100%', padding:8, border:'1px solid #e5e7eb', borderRadius:8 }} />
              </div>
            </div>
            <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:16 }}>
              <button className="btn-cancel" onClick={() => setExportOpen(false)}>Cancel</button>
              <button className="btn-create" onClick={handleExport} style={{ background:'#2563eb' }}>Export PDF</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ItMaterialList;
