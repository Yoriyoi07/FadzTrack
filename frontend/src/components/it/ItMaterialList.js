import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import '../style/pm_style/PmMatRequest.css';
import '../style/pm_style/Pm_Dash.css';
import NotificationBell from '../NotificationBell';
import MiniProgressTracker from '../MiniProgressTracker';
import api from '../../api/axiosInstance';
// Nav icons
import { FaTachometerAlt, FaComments, FaBoxes, FaUsers, FaClipboardList } from 'react-icons/fa';

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
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState(null);
  const [editDescription, setEditDescription] = useState('');

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
      if (!event.target.closest(".profile-menu-container")) {
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
    const matchesFilter =
      filter === 'All' ||
      (filter === 'Pending' && status.includes('pending')) ||
      (filter === 'Approved' && status.includes('approved')) ||
      (filter === 'Cancelled' && (status.includes('denied') || status.includes('cancel')));
    const searchTarget = [
      request.materials && request.materials.map(m => m.materialName).join(', '),
      request.description,
      request.createdBy?.name,
      request.project?.projectName,
    ].join(' ').toLowerCase();
    const matchesSearch = searchTarget.includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const totalPages = Math.ceil(filteredRequests.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedRequests = filteredRequests.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const getStatusColor = (status) => {
    const s = (status || '').toLowerCase();
    if (s.includes('approved')) return '#10b981';
    if (s.includes('pending')) return '#f59e0b';
    if (s.includes('denied') || s.includes('cancel')) return '#ef4444';
    return '#6b7280';
  };

  const getStatusBadge = (status) => {
    const s = (status || '').toLowerCase();
    if (s.includes('approved')) return 'Approved';
    if (s.includes('pending')) return 'Pending';
    if (s.includes('denied') || s.includes('cancel')) return 'Rejected';
    return 'Unknown';
  };

  const openEdit = (req) => {
    setEditingRequest(req);
    setEditDescription(req.description || '');
    setEditModalOpen(true);
  };

  const saveEdit = async () => {
    if (!editingRequest) return;
    try {
      await api.put(`/requests/${editingRequest._id}`, {
        materials: JSON.stringify(editingRequest.materials || []),
        description: editDescription,
        attachments: JSON.stringify(editingRequest.attachments || [])
      });
      setRequests(prev => prev.map(r => r._id === editingRequest._id ? { ...r, description: editDescription } : r));
      setEditModalOpen(false);
      setEditingRequest(null);
    } catch (e) {
      alert('Failed to save changes');
    }
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
              <div className="profile-dropdown">
                <button onClick={handleLogout} className="logout-btn"><span>Logout</span></button>
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
              {['All', 'Pending', 'Approved', 'Cancelled'].map(tab => (
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
              paginatedRequests.map(request => (
                <div className="request-card" key={request._id}>
                  <div className="card-header">
                    <div className="request-icon">{getIconForType(request)}</div>
                    <div className="request-status">
                      <span className="status-badge" style={{ backgroundColor: getStatusColor(request.status) }}>
                        {getStatusBadge(request.status)}
                      </span>
                    </div>
                  </div>
                  <div className="card-body">
                    <h3 className="request-title">
                      {request.materials?.length
                        ? request.materials.map(m => `${m.materialName} (${m.quantity})`).join(', ')
                        : 'Material Request'}
                    </h3>
                    <p className="request-description">{truncateWords(request.description, 10)}</p>
                    <div className="request-meta">
                      <div className="meta-item"><span className="meta-label">Requested by:</span><span className="meta-value">{request.createdBy?.name || 'Unknown'}</span></div>
                      <div className="meta-item"><span className="meta-label">Project:</span><span className="meta-value">{request.project?.projectName || '-'}</span></div>
                      <div className="meta-item"><span className="meta-label">Date:</span><span className="meta-value">{request.createdAt ? new Date(request.createdAt).toLocaleDateString() : ''}</span></div>
                    </div>
                  </div>
                  <div className="card-footer" style={{ display:'flex', gap:8, justifyContent:'space-between', alignItems:'center' }}>
                    <MiniProgressTracker request={request} />
                    <div style={{ display:'flex', gap:8 }}>
                      <Link to={`/it/material-request/${request._id}`} className="view-details-btn">View</Link>
                      <button className="view-details-btn" onClick={() => openEdit(request)} style={{ background:'#eab308' }}>Edit</button>
                      <button className="view-details-btn" onClick={() => deleteRequest(request._id)} style={{ background:'#ef4444' }}>Delete</button>
                    </div>
                  </div>
                </div>
              ))
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
      {editModalOpen && (
        <div className="modal-overlay" style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
          <div className="modal" style={{ background:'#fff', borderRadius:12, padding:20, width:420, maxWidth:'90%' }}>
            <h3 style={{ marginTop:0 }}>Edit Request</h3>
            <label style={{ display:'block', fontWeight:600, marginBottom:6 }}>Description</label>
            <textarea value={editDescription} onChange={(e)=>setEditDescription(e.target.value)} style={{ width:'100%', minHeight:100, padding:8, border:'1px solid #e5e7eb', borderRadius:8 }} />
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:12 }}>
              <button className="btn-cancel" onClick={() => { setEditModalOpen(false); setEditingRequest(null); }}>Cancel</button>
              <button className="btn-create" onClick={saveEdit}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ItMaterialList;
