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
  FaSearch,
  FaFilter,
  FaPlus,
  FaList,
  FaComments
} from 'react-icons/fa';

const ITEMS_PER_PAGE = 5;

export default function PmManpowerList() {
  const navigate = useNavigate();

  // Read the user before any state depends on it (avoid TDZ)
  const token = localStorage.getItem('token');
  const stored = localStorage.getItem('user');
  const user = stored ? JSON.parse(stored) : null;
  const userId = user?._id || user?.id || null;

  const [userName, setUserName] = useState(user?.name || 'ALECK');
  const [userRole, setUserRole] = useState(user?.role || '');
  const [project, setProject] = useState(null);
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
          // Fetch ALL requests then filter out those created by this user so we also see Approved/Completed/Overdue
            const { data } = await api.get('/manpower-requests');
            const arr = Array.isArray(data) ? data : [];
            const othersOnly = arr.filter(r => {
              const creatorId = r.createdBy?._id || r.createdBy?.id || r.createdBy;
              return creatorId && creatorId !== userId; // exclude my own only
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
  }, [viewMode, userId]);

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

  // Fetch assigned project
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

  // Filter and search logic
  const filteredRequests = useMemo(() => {
    let items = requests;

    if (status && status !== 'All') {
      const target = status === 'Complete' ? 'Completed' : status; // map UI label to stored status
      items = items.filter((r) => (r.status || 'Pending') === target);
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
      return '#f59e0b'; // Overdue pending requests
    }
    if (statusLower.includes('pending')) {
      return '#f59e0b'; // Pending requests
    }
    if (statusLower.includes('approved')) {
      return '#10b981'; // Approved requests
    }
    if (statusLower.includes('rejected')) {
      return '#ef4444'; // Rejected requests
    }
    if (statusLower.includes('completed')) {
      return '#059669'; // Completed requests
    }
    return '#e0e0e0'; // Default background
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
             <div className="layout-toggle">
               <button
                 className={`layout-btn ${layoutView === 'cards' ? 'active' : ''}`}
                 onClick={() => setLayoutView('cards')}
                 title="Cards View"
               >
                 <FaBoxes />
               </button>
               <button
                 className={`layout-btn ${layoutView === 'table' ? 'active' : ''}`}
                 onClick={() => setLayoutView('table')}
                 title="Table View"
               >
                 <FaList />
               </button>
             </div>
           </div>

                     {/* Controls Bar */}
           <div className="controls-bar">
             {/* Filter Tabs */}
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
                 onClick={() => navigate('/pm/request-manpower')}
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
                {/* Table Header - REMOVED */}
                
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
                            to={`/pm/manpower-request/${request._id}`}
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
                            to={`/pm/manpower-request/${request._id}`}
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
