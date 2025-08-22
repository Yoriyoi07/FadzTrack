import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../api/axiosInstance';
import NotificationBell from '../NotificationBell';
import ProgressTracker from '../ProgressTracker';
import '../style/pm_style/PmMatRequest.css';
// Nav icons
import { 
  FaTachometerAlt, 
  FaComments, 
  FaBoxes, 
  FaUsers, 
  FaProjectDiagram, 
  FaClipboardList, 
  FaChartBar, 
  FaCalendarAlt,
  FaSearch,
  FaFilter,
  FaEllipsisV
} from 'react-icons/fa';

const PmMatRequestList = () => {
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
  const [filter, setFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('date');

  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 8;

  // Filter and search logic
  const filteredRequests = requests.filter(request => {
    const status = (request.status || '').toLowerCase();
    const matchesFilter =
      filter === 'All' ||
      (filter === 'Pending' && status.includes('pending')) ||
      (filter === 'Approved' && status.includes('approved')) ||
      (filter === 'Cancelled' && (status.includes('denied') || status.includes('cancel')));
    
    const searchTarget = [
      request.materials?.map(m => m.materialName).join(', ') || '',
      request.description || '',
      request.createdBy?.name || '',
      request.project?.projectName || '',
    ].join(' ').toLowerCase();
    
    return matchesFilter && searchTarget.includes(searchTerm.toLowerCase());
  });

  // Sorting logic
  const sortedRequests = [...filteredRequests].sort((a, b) => {
    switch (sortBy) {
      case 'date':
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      case 'priority':
        return (b.priority || 0) - (a.priority || 0);
      case 'status':
        return (a.status || '').localeCompare(b.status || '');
      default:
        return 0;
    }
  });

  const totalPages = Math.ceil(sortedRequests.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedRequests = sortedRequests.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  useEffect(() => {
    api.get('/requests/mine')
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
        console.error(err);
      });
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

  const getIconForType = (request) => {
    if (!request.materials || request.materials.length === 0) return '📄';
    const name = request.materials[0].materialName?.toLowerCase() || '';
    if (name.includes('steel')) return '🔧';
    if (name.includes('brick')) return '🧱';
    if (name.includes('cement')) return '🪨';
    if (name.includes('sand')) return '🏖️';
    return '📦';
  };

  const getStatusColor = (status) => {
    const statusLower = status?.toLowerCase() || '';
    if (statusLower.includes('approved')) return '#10b981';
    if (statusLower.includes('pending')) return '#f59e0b';
    if (statusLower.includes('denied') || statusLower.includes('cancel')) return '#ef4444';
    return '#6b7280';
  };

  const getStatusBadge = (status) => {
    const statusLower = status?.toLowerCase() || '';
    if (statusLower.includes('approved')) return 'Approved';
    if (statusLower.includes('pending')) return 'Pending';
    if (statusLower.includes('denied') || statusLower.includes('cancel')) return 'Rejected';
    return 'Unknown';
  };

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
              {userName ? userName.charAt(0).toUpperCase() : 'P'}
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
            <Link to="/pm/chat" className="nav-item">
              <FaComments />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Chat</span>
            </Link>
            <Link to="/pm/request/:id" className="nav-item active">
              <FaBoxes />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Material</span>
            </Link>
            <Link to="/pm/manpower-list" className="nav-item">
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
              <p className="page-subtitle">Manage and track material requests for your project</p>
            </div>
          </div>

          {/* Controls Bar */}
          <div className="controls-bar">
            {/* Filter Tabs */}
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
              
              <div className="sort-wrapper">
                <FaFilter className="sort-icon" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="sort-select"
                >
                  <option value="date">Sort by Date</option>
                  <option value="priority">Sort by Priority</option>
                  <option value="status">Sort by Status</option>
                </select>
              </div>
            </div>
          </div>

          {/* Requests Grid */}
          <div className="requests-grid">
            {loading ? (
              <div className="loading-state">
                <div className="loading-spinner"></div>
                <p>Loading material requests...</p>
              </div>
            ) : error ? (
              <div className="error-state">
                <p>{error}</p>
              </div>
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
                      {request.materials && request.materials.length > 0
                        ? request.materials.map(m => `${m.materialName} (${m.quantity})`).join(', ')
                        : 'Material Request'}
                    </h3>
                    <p className="request-description">{request.description}</p>
                    
                    <div className="request-meta">
                      <div className="meta-item">
                        <span className="meta-label">Requested by:</span>
                        <span className="meta-value">{request.createdBy?.name || 'Unknown'}</span>
                      </div>
                      <div className="meta-item">
                        <span className="meta-label">Project:</span>
                        <span className="meta-value">{request.project?.projectName || '-'}</span>
                      </div>
                      <div className="meta-item">
                        <span className="meta-label">Date:</span>
                        <span className="meta-value">
                          {request.createdAt ? new Date(request.createdAt).toLocaleDateString() : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="card-footer">
                    <ProgressTracker request={request} />
                    <Link
                      to={`/pm/material-request/${request._id}`}
                      className="view-details-btn"
                    >
                      View Details
                    </Link>
                  </div>
                </div>
              ))
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

export default PmMatRequestList;
