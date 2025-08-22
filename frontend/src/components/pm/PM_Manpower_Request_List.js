import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../api/axiosInstance';
import NotificationBell from '../NotificationBell';
import ProgressTracker from '../ProgressTracker';
import '../style/pm_style/PmManpowerRequest.css';
// Nav icons
import { 
  FaTachometerAlt, 
  FaBoxes, 
  FaUsers, 
  FaProjectDiagram, 
  FaClipboardList, 
  FaChartBar, 
  FaCalendarAlt,
  FaUserCircle,
  FaSearch,
  FaFilter,
  FaSortAmountDown,
  FaSortAmountUp,
  FaCheck,
  FaTimes,
  FaEllipsisV
} from 'react-icons/fa';

const PmManpowerRequestList = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const stored = localStorage.getItem('user');
  const user = stored ? JSON.parse(stored) : null;
  const userId = user?._id;

  const [userName, setUserName] = useState(user?.name || 'ALECK');
  const [userRole, setUserRole] = useState(user?.role || '');
  const [project, setProject] = useState(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('Pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortDesc, setSortDesc] = useState(true);

  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 8;

  // Inline approval
  const [manpowerInput, setManpowerInput] = useState({});
  const [busyId, setBusyId] = useState(null);

  // Filter and search logic
  const filteredRequests = requests.filter(request => {
    const status = (request.status || 'Pending').toLowerCase();
    const matchesFilter =
      filter === 'All' ||
      (filter === 'Pending' && status.includes('pending')) ||
      (filter === 'Approved' && status.includes('approved')) ||
      (filter === 'Rejected' && status.includes('rejected'));
    
    const searchTarget = [
      request.project?.projectName || '',
      request.createdBy?.name || '',
      request.description || '',
      (request.manpowers || []).map(m => `${m.quantity} ${m.type}`).join(', ') || '',
    ].join(' ').toLowerCase();
    
    return matchesFilter && searchTarget.includes(searchTerm.toLowerCase());
  });

  // Sorting logic
  const sortedRequests = [...filteredRequests].sort((a, b) => {
    const aTime = new Date(a.createdAt || 0).getTime();
    const bTime = new Date(b.createdAt || 0).getTime();
    return sortDesc ? bTime - aTime : aTime - bTime;
  });

  const totalPages = Math.ceil(sortedRequests.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedRequests = sortedRequests.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  useEffect(() => {
    fetchRequests();
  }, []);

  // Scroll handler for header collapse
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const shouldCollapse = scrollTop > 50;
      setIsHeaderCollapsed(shouldCollapse);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest(".user-profile")) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const fetchRequests = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/manpower-requests/pm');
      setRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      if (err.response && (err.response.status === 403 || err.response.status === 401)) {
        setError('Session expired or unauthorized. Please login.');
      } else {
        setError('Failed to load requests');
      }
      setRequests([]);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    api.post('/auth/logout', {}, {
      headers: { Authorization: `Bearer ${token}` }
    }).finally(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      navigate('/');
    });
  };

  useEffect(() => {
    if (!token || !userId) return;
    const fetchAssignedPMProject = async () => {
      try {
        const { data } = await api.get(`/projects/assigned/projectmanager/${userId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setProject(data);
      } catch (err) {
        setProject(null);
      }
    };
    fetchAssignedPMProject();
  }, [token, userId]);

  const getStatusColor = (status) => {
    const statusLower = status?.toLowerCase() || '';
    if (statusLower.includes('approved')) return '#10b981';
    if (statusLower.includes('pending')) return '#f59e0b';
    if (statusLower.includes('rejected')) return '#ef4444';
    return '#6b7280';
  };

  const getStatusBadge = (status) => {
    const statusLower = status?.toLowerCase() || '';
    if (statusLower.includes('approved')) return 'Approved';
    if (statusLower.includes('pending')) return 'Pending';
    if (statusLower.includes('rejected')) return 'Rejected';
    return 'Unknown';
  };

  const onApprove = async (item) => {
    const raw = manpowerInput[item._id] || '';
    const ids = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (ids.length === 0) {
      alert('Please enter at least one manpower ID to assign.');
      return;
    }
    setBusyId(item._id);
    try {
      await api.put(`/manpower-requests/${item._id}/approve`, {
        manpowerProvided: ids,
        project: item.project?._id,
        area: item.project?.location,
      });
      alert('✅ Approved');
      await fetchRequests();
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.message || 'Approval failed.');
    } finally {
      setBusyId(null);
    }
  };

  const onDeny = async (item) => {
    if (!window.confirm('Deny this request?')) return;
    setBusyId(item._id);
    try {
      await api.put(`/manpower-requests/${item._id}`, { status: 'Rejected' });
      alert('Request denied.');
      await fetchRequests();
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.message || 'Failed to deny.');
    } finally {
      setBusyId(null);
    }
  };

  if (!user || user.role !== 'Project Manager') {
    return (
      <div style={{ padding: 24 }}>
        <h2>Forbidden</h2>
        <p>You must be a Project Manager to view this page.</p>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* Modern Header */}
      <header className={`dashboard-header ${isHeaderCollapsed ? 'collapsed' : ''}`}>
        {/* Top Row: Logo and Profile */}
        <div className="header-top">
          <div className="logo-section">
            <img
              src={require('../../assets/images/FadzLogo1.png')}
              alt="FadzTrack Logo"
              className="header-logo"
            />
            <h1 className="header-brand">FadzTrack</h1>
          </div>
          
          <div className="user-profile" onClick={() => setProfileMenuOpen(!profileMenuOpen)}>
            <div className="profile-avatar">
              <FaUserCircle />
            </div>
            <div className={`profile-info ${isHeaderCollapsed ? 'hidden' : ''}`}>
              <span className="profile-name">{userName}</span>
              <span className="profile-role">{userRole}</span>
            </div>
            {profileMenuOpen && (
              <div className="profile-dropdown">
                <button onClick={handleLogout} className="logout-btn">
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Row: Navigation and Notifications */}
        <div className="header-bottom">
          <nav className="header-nav">
            <Link to="/pm" className="nav-item">
              <FaTachometerAlt />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Dashboard</span>
            </Link>
            <Link to="/pm/request/:id" className="nav-item">
              <FaBoxes />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Material</span>
            </Link>
            <Link to="/pm/manpower-list" className="nav-item active">
              <FaUsers />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Manpower</span>
            </Link>
            {project && (
                          <Link to={`/pm/viewprojects/${project._id || project.id}`} className="nav-item">
              <FaProjectDiagram />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>View Project</span>
            </Link>
            )}
            <Link to="/pm/daily-logs" className="nav-item">
              <FaClipboardList />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Logs</span>
            </Link>
            {project && (
              <Link to={`/pm/progress-report/${project._id}`} className="nav-item">
                <FaChartBar />
                <span className={isHeaderCollapsed ? 'hidden' : ''}>Reports</span>
              </Link>
            )}
            <Link to="/pm/daily-logs-list" className="nav-item">
              <FaCalendarAlt />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Daily Logs</span>
            </Link>
          </nav>
          
          <NotificationBell />
        </div>
      </header>

      {/* Main Content */}
      <main className="dashboard-main">
        <div className="page-container">
          {/* Page Header */}
          <div className="page-header">
            <div className="page-title-section">
              <p className="page-subtitle">Manage and track manpower requests for your project</p>
            </div>
          </div>

          {/* Controls Bar */}
          <div className="controls-bar">
            {/* Filter Tabs */}
            <div className="filter-tabs">
              {['Pending', 'Approved', 'Rejected', 'All'].map(tab => (
                <button
                  key={tab}
                  className={`filter-tab ${filter === tab ? 'active' : ''}`}
                  onClick={() => setFilter(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Search and Sort */}
            <div className="search-sort-section">
              <div className="search-wrapper">
                <FaSearch className="search-icon" />
                <input
                  type="text"
                  placeholder="Search requests..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input"
                />
              </div>
              
              <button
                onClick={() => setSortDesc(!sortDesc)}
                className="sort-btn"
                title="Toggle sort by Created date"
              >
                {sortDesc ? <FaSortAmountDown /> : <FaSortAmountUp />}
                <span>Sort</span>
              </button>
            </div>
          </div>

          {/* Requests Grid */}
          <div className="requests-grid">
            {loading ? (
              <div className="loading-state">
                <div className="loading-spinner"></div>
                <p>Loading manpower requests...</p>
              </div>
            ) : error ? (
              <div className="error-state">
                <p>{error}</p>
              </div>
            ) : paginatedRequests.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">👥</div>
                <h3>No manpower requests found</h3>
                <p>No requests match your current filters. Try adjusting your search criteria.</p>
              </div>
            ) : (
              paginatedRequests.map(request => {
                const summary = (request.manpowers || [])
                  .map((m) => `${m.quantity} ${m.type}`)
                  .join(', ');

                return (
                  <div className="request-card" key={request._id}>
                    <div className="card-header">
                      <div className="request-icon">👥</div>
                      <div className="request-status">
                        <span 
                          className="status-badge"
                          style={{ backgroundColor: getStatusColor(request.status) }}
                        >
                          {getStatusBadge(request.status)}
                        </span>
                      </div>
                    </div>
                    
                    <div className="card-body">
                      <h3 className="request-title">
                        {request.project?.projectName || '(No Project Name)'}
                      </h3>
                      <p className="request-description">{request.description || 'No description provided'}</p>
                      
                      <div className="request-meta">
                        <div className="meta-item">
                          <span className="meta-label">Requested by:</span>
                          <span className="meta-value">{request.createdBy?.name || 'Unknown'}</span>
                        </div>
                        <div className="meta-item">
                          <span className="meta-label">Manpower needed:</span>
                          <span className="meta-value">{summary || '—'}</span>
                        </div>
                        <div className="meta-item">
                          <span className="meta-label">Date:</span>
                          <span className="meta-value">
                            {request.createdAt ? new Date(request.createdAt).toLocaleDateString() : ''}
                          </span>
                        </div>
                        <div className="meta-item">
                          <span className="meta-label">Target Date:</span>
                          <span className="meta-value">
                            {request.acquisitionDate ? new Date(request.acquisitionDate).toLocaleDateString() : '—'}
                          </span>
                        </div>
                        <div className="meta-item">
                          <span className="meta-label">Duration:</span>
                          <span className="meta-value">{request.duration || '—'} day(s)</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="card-footer">
                      {request.status === 'Pending' ? (
                        <div className="approval-section">
                          <div className="manpower-input-section">
                            <label className="manpower-label">Manpower IDs to assign:</label>
                            <input
                              type="text"
                              value={manpowerInput[request._id] || ''}
                              onChange={(e) =>
                                setManpowerInput((p) => ({ ...p, [request._id]: e.target.value }))
                              }
                              placeholder="e.g. 668f0..., 668f1..."
                              className="manpower-input"
                            />
                          </div>
                          <div className="action-buttons">
                            <button
                              onClick={() => onApprove(request)}
                              disabled={busyId === request._id}
                              className="approve-btn"
                            >
                              <FaCheck />
                              <span>{busyId === request._id ? 'Processing…' : 'Approve'}</span>
                            </button>
                            <button
                              onClick={() => onDeny(request)}
                              disabled={busyId === request._id}
                              className="deny-btn"
                            >
                              <FaTimes />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="status-display">
                          <span className="final-status">
                            {getStatusBadge(request.status)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Pagination */}
          {sortedRequests.length > 0 && (
            <div className="pagination-section">
              <div className="pagination-info">
                Showing {startIndex + 1} to {Math.min(startIndex + ITEMS_PER_PAGE, sortedRequests.length)} of {sortedRequests.length} entries
              </div>
              <div className="pagination-controls">
                <button 
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} 
                  disabled={currentPage === 1}
                  className="pagination-btn"
                >
                  Previous
                </button>
                
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    className={`pagination-btn ${page === currentPage ? 'active' : ''}`}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </button>
                ))}
                
                <button 
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} 
                  disabled={currentPage === totalPages}
                  className="pagination-btn"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default PmManpowerRequestList;
