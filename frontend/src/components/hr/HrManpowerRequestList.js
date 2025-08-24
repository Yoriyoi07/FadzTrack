import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../api/axiosInstance';
import NotificationBell from '../NotificationBell';
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
  FaEllipsisV,
  FaComments,
  FaPlus
} from 'react-icons/fa';

const ITEMS_PER_PAGE = 8;

export default function HrManpowerRequestList() {
  const navigate = useNavigate();

  // Read the user before any state depends on it (avoid TDZ)
  const token = localStorage.getItem('token');
  const stored = localStorage.getItem('user');
  const user = stored ? JSON.parse(stored) : null;
  const userId = user?._id || user?.id || null;

  const [userName, setUserName] = useState(user?.name || 'HR');
  const [userRole, setUserRole] = useState(user?.role || '');
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);

  // View mode: 'mine' | 'others'
  const [viewMode, setViewMode] = useState('mine');

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [layoutView, setLayoutView] = useState('cards'); // 'cards' or 'table'

  // Fetch list depending on viewMode
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        if (viewMode === 'mine') {
          const { data } = await api.get('/manpower-requests/mine');
          setRequests(Array.isArray(data) ? data : []);
        } else {
          const { data } = await api.get('/manpower-requests/hr');
          const arr = Array.isArray(data) ? data : [];
          // For HR users, filter out completed requests from "Others' Requests"
          const othersOnly = arr.filter(r => {
            const creatorId = r.createdBy?._id || r.createdBy?.id || r.createdBy;
            const isCompleted = r.status?.toLowerCase() === 'completed';
            const isOverdue = r.status?.toLowerCase() === 'pending' && r.acquisitionDate && new Date(r.acquisitionDate) < new Date();
            // Show overdue requests to other HR users, but hide completed ones
            return !userId || (creatorId && creatorId !== userId && !isCompleted);
          });
          setRequests(othersOnly);
        }
      } catch (err) {
        console.error('Load error:', err);
        if (err.response && (err.response.status === 403 || err.response.status === 401)) {
          setError('Session expired or unauthorized. Please login.');
        } else {
          setError('Failed to load manpower requests');
        }
        setRequests([]);
      } finally {
        setLoading(false);
        setCurrentPage(1);
      }
    };
    fetchData();
  }, [viewMode]);

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
    document.addEventListener('click', handleClickOutside);
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

  // Filter and search logic
  const filteredRequests = useMemo(() => {
    let items = requests;

    if (status && status !== 'All') {
      items = items.filter((r) => (r.status || 'Pending') === status);
    }
    
    if (searchTerm) {
      const text = searchTerm.toLowerCase();
      items = items.filter((r) => {
        const proj = r.project?.projectName || '';
        const by = r.createdBy?.name || '';
        const reqSummary = (r.manpowers || []).map((m) => `${m.quantity} ${m.type}`).join(', ');
        return (
          proj.toLowerCase().includes(text) ||
          by.toLowerCase().includes(text) ||
          reqSummary.toLowerCase().includes(text) ||
          (r.description || '').toLowerCase().includes(text)
        );
      });
    }
    
    return items;
  }, [requests, status, searchTerm]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / ITEMS_PER_PAGE));
  const pageRows = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredRequests.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredRequests, currentPage]);

  const getStatusColor = (status) => {
    const statusLower = status?.toLowerCase() || '';
    if (statusLower.includes('completed')) return '#059669';
    if (statusLower.includes('approved')) return '#10b981';
    if (statusLower.includes('pending')) return '#f59e0b';
    if (statusLower.includes('rejected')) return '#ef4444';
    return '#6b7280';
  };

  const getStatusBadge = (status) => {
    const statusLower = status?.toLowerCase() || '';
    if (statusLower.includes('completed')) return 'Completed';
    if (statusLower.includes('approved')) return 'Approved';
    if (statusLower.includes('pending')) return 'Pending';
    if (statusLower.includes('rejected')) return 'Rejected';
    return 'Unknown';
  };

  const getRequestBackgroundColor = (request) => {
    const statusLower = request.status?.toLowerCase() || '';
    if (statusLower.includes('pending') && request.acquisitionDate && new Date(request.acquisitionDate) < new Date()) {
      return '#fef3c7'; // Light yellow for overdue pending requests
    }
    if (statusLower.includes('pending')) {
      return '#ffffff'; // White for pending requests
    }
    if (statusLower.includes('approved')) {
      return '#fef3c7'; // Light yellow for approved requests
    }
    if (statusLower.includes('rejected')) {
      return '#fef2f2'; // Light red for rejected requests
    }
    if (statusLower.includes('completed')) {
      return '#ecfdf5'; // Light green for completed requests
    }
    return '#f9fafb'; // Default light gray background
  };

  if (!user || user.role !== 'HR') {
    return (
      <div style={{ padding: 24 }}>
        <h2>Forbidden</h2>
        <p>You must be an HR user to view this page.</p>
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
              {userName ? userName.charAt(0).toUpperCase() : 'H'}
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
            <Link to="/hr" className="nav-item">
              <FaTachometerAlt />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Dashboard</span>
            </Link>
            <Link to="/hr/chat" className="nav-item">
              <FaComments />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Chat</span>
            </Link>
            <Link to="/hr/manpower-list" className="nav-item">
              <FaUsers />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Manpower</span>
            </Link>
            <Link to="/hr/manpower-requests" className="nav-item active">
              <FaClipboardList />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Requests</span>
            </Link>
            <Link to="/hr/projects" className="nav-item">
              <FaProjectDiagram />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Projects</span>
            </Link>
          </nav>
          <NotificationBell />
        </div>
      </header>

      <main className="dashboard-main">
        <div className="page-container">
          <div className="page-header">
            <div className="page-title-section">
              <h1 className="page-title">Manpower Requests</h1>
              <p className="page-subtitle">Manage and track manpower requests across all projects</p>
            </div>
          </div>

          {/* Controls Bar */}
          <div className="controls-bar">
            {/* Filter Tabs - Now includes 'Complete' status */}
            <div className="filter-tabs">
              {['All', 'Pending', 'Approved', 'Rejected', 'Complete'].map(tab => (
                <button
                  key={tab}
                  className={`filter-tab ${status === tab ? 'active' : ''}`}
                  onClick={() => setStatus(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Request Type Filter */}
            <div className="request-type-filter">
              <button
                className={`type-filter-btn ${viewMode === 'mine' ? 'active' : ''}`}
                onClick={() => setViewMode('mine')}
              >
                My Requests
              </button>
              <button
                className={`type-filter-btn ${viewMode === 'others' ? 'active' : ''}`}
                onClick={() => setViewMode('others')}
              >
                Others' Requests
              </button>
            </div>

            {/* Search and Actions */}
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
                onClick={() => navigate('/hr/request-manpower')}
                className="btn-primary"
              >
                <FaPlus />
                <span>Request Manpower</span>
              </button>
            </div>
          </div>

          {/* Requests Grid */}
          <div className={`requests-grid ${layoutView === 'table' ? 'table-view' : ''}`}>
            {loading ? (
              <div className="loading-state">
                <div className="loading-spinner"></div>
                <p>Loading manpower requests...</p>
              </div>
            ) : error ? (
              <div className="error-state">
                <p>{error}</p>
              </div>
            ) : pageRows.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">👥</div>
                <h3>No manpower requests found</h3>
                <p>No requests match your current filters. Try adjusting your search criteria.</p>
              </div>
            ) : (
              <>
                {pageRows.map(request => {
                  const summary = (request.manpowers || [])
                    .map((m) => `${m.quantity} ${m.type}`)
                    .join(', ');

                  if (layoutView === 'table') {
                    // Table View Layout
                    return (
                      <div className={`request-card status-${(request.status || 'pending').toLowerCase()}`} key={request._id} style={{
                        backgroundColor: getRequestBackgroundColor(request)
                      }}>
                        {/* Overdue Ribbon for Pending Requests */}
                        {request.status?.toLowerCase() === 'pending' && 
                         request.acquisitionDate && 
                         new Date(request.acquisitionDate) < new Date() && (
                          <div className="overdue-ribbon">
                            <span>OVERDUE</span>
                          </div>
                        )}
                        <div className="card-header">
                          <h3 className="request-title">
                            {request.project?.projectName || '(No Project Name)'}
                          </h3>
                        </div>
                        
                        <div className="card-body">
                          <div className="requester-info">
                            {request.createdBy?.name || 'Unknown'}
                          </div>
                        </div>
                        
                        <div className="request-details">
                          <div className="details-info">
                            {request.description || 'No description'}
                          </div>
                        </div>
                        
                        <div className="request-meta">
                          <div className="manpower-info">
                            {summary || '—'}
                          </div>
                        </div>
                        
                        <div className="target-date-info">
                          {request.acquisitionDate ? new Date(request.acquisitionDate).toLocaleDateString() : '—'}
                        </div>
                        
                        <div className="duration-info">
                          {request.duration || '—'} day(s)
                        </div>
                        
                        <div className="date-posted-info">
                          {request.createdAt ? new Date(request.createdAt).toLocaleDateString() : '—'}
                        </div>
                        
                        <div className="card-footer">
                          <Link
                            to={`/hr/manpower-request/${request._id}`}
                            className="view-details-btn"
                          >
                            View Request
                          </Link>
                        </div>
                      </div>
                    );
                  } else {
                    // Card View Layout (Original)
                    return (
                      <div className={`request-card status-${(request.status || 'pending').toLowerCase()}`} key={request._id} style={{
                        backgroundColor: getRequestBackgroundColor(request)
                      }}>
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
                                {request.createdAt ? new Date(request.createdAt).toLocaleDateString() : '—'}
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
                          <Link
                            to={`/hr/manpower-request/${request._id}`}
                            className="view-details-btn"
                          >
                            View Details
                          </Link>
                        </div>
                      </div>
                    );
                  }
                })}
              </>
            )}
          </div>

          {/* Pagination */}
          {filteredRequests.length > 0 && (
            <div className="pagination-section">
              <div className="pagination-info">
                Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredRequests.length)} of {filteredRequests.length} entries
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
}
