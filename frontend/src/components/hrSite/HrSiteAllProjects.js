import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../api/axiosInstance';
import NotificationBell from '../NotificationBell';
import '../style/hr_style/HrSite_Dash.css';
import '../style/am_style/Area_Projects.css';

// React Icons
import { 
  FaTachometerAlt, 
  FaComments, 
  FaProjectDiagram, 
  FaClipboardList,
  FaMapMarkerAlt,
  FaUserTie,
  FaBuilding,
  FaCalendarAlt,
  FaUsers as FaUsersIcon,
  FaMoneyBillWave,
  FaCheckCircle,
  FaClock,
  FaFilter,
  FaTh,
  FaList,
  FaSearch,
  FaChevronDown,
  FaChevronUp
} from 'react-icons/fa';

const HrSiteAllProjects = () => {
  const [filter, setFilter] = useState('all');
  const [viewMode, setViewMode] = useState('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const navigate = useNavigate();
  const stored = localStorage.getItem('user');
  const user = stored ? JSON.parse(stored) : null;
  const userName = user?.name || 'HR-Site';
  const userRole = user?.role || 'HR-Site';
  const hrSiteId = user?._id;

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
      if (!event.target.closest('.profile-menu-container')) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  // Fetch projects assigned to this HR-Site user
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setLoading(true);
        // Get projects where this HR-Site user is assigned
        const response = await api.get(`/projects/by-user/${hrSiteId}`);
        setProjects(response.data || []);
        setError(null);
      } catch (error) {
        console.error('Failed to fetch projects:', error);
        setError('Failed to load projects. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    
    if (hrSiteId) {
      fetchProjects();
    }
  }, [hrSiteId]);

  // Apply filters and search
  const displayedProjects = projects
    .filter(project => {
      // Status filter
      if (filter === 'completed') {
        return project.status === 'Completed';
      }
      if (filter === 'ongoing') {
        return project.status === 'Ongoing' || project.status === 'On Going';
      }
      if (filter === 'pending') {
        return project.status === 'Pending' || project.status === 'Not Started';
      }
      
      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        return (
          project.projectName?.toLowerCase().includes(searchLower) ||
          project.location?.name?.toLowerCase().includes(searchLower) ||
          project.projectManager?.name?.toLowerCase().includes(searchLower) ||
          project.contractor?.toLowerCase().includes(searchLower)
        );
      }
      
      return true;
    })
    .sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'name':
          aValue = a.projectName || '';
          bValue = b.projectName || '';
          break;
        case 'location':
          aValue = a.location?.name || '';
          bValue = b.location?.name || '';
          break;
        case 'manager':
          aValue = a.projectManager?.name || '';
          bValue = b.projectManager?.name || '';
          break;
        case 'status':
          aValue = a.status || '';
          bValue = b.status || '';
          break;
        case 'startDate':
          aValue = new Date(a.startDate || 0);
          bValue = new Date(b.startDate || 0);
          break;
        default:
          aValue = a.projectName || '';
          bValue = b.projectName || '';
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return '#10B981';
      case 'ongoing':
      case 'on going':
        return '#3B82F6';
      case 'pending':
      case 'not started':
        return '#F59E0B';
      default:
        return '#6B7280';
    }
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return <FaCheckCircle />;
      case 'ongoing':
      case 'on going':
        return <FaClock />;
      case 'pending':
      case 'not started':
        return <FaClock />;
      default:
        return <FaClock />;
    }
  };

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading projects...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* Modern Header - PM Style */}
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

          <div className="user-profile profile-menu-container" onClick={() => setProfileMenuOpen(!profileMenuOpen)}>
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
            <Link to="/hr-site" className="nav-item">
              <FaProjectDiagram />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Project</span>
            </Link>
            <Link to="/hr-site/chat" className="nav-item">
              <FaComments />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Chat</span>
            </Link>
            <Link to="/hr-site/projects" className="nav-item active">
              <FaClipboardList />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>My Projects</span>
            </Link>
          </nav>

          <NotificationBell />
        </div>
      </header>

      {/* Main Content */}
      <main className="dashboard-main">
        <div className="projects-container">
          {/* Page Header */}
          <div className="page-header">
            <div className="page-title-section">
              <h1 className="page-title">My Projects</h1>
              <p className="page-subtitle">View all projects you are assigned to</p>
            </div>
          </div>

          {/* Filters and Controls */}
          <div className="projects-controls">
            <div className="controls-left">
              {/* Search */}
              <div className="search-container">
                <FaSearch className="search-icon" />
                <input
                  type="text"
                  placeholder="Search projects..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input"
                />
              </div>

              {/* Status Filter */}
              <div className="filter-group">
                <button
                  className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
                  onClick={() => setFilter('all')}
                >
                  All ({projects.length})
                </button>
                <button
                  className={`filter-btn ${filter === 'ongoing' ? 'active' : ''}`}
                  onClick={() => setFilter('ongoing')}
                >
                  Ongoing ({projects.filter(p => p.status === 'Ongoing' || p.status === 'On Going').length})
                </button>
                <button
                  className={`filter-btn ${filter === 'completed' ? 'active' : ''}`}
                  onClick={() => setFilter('completed')}
                >
                  Completed ({projects.filter(p => p.status === 'Completed').length})
                </button>
                <button
                  className={`filter-btn ${filter === 'pending' ? 'active' : ''}`}
                  onClick={() => setFilter('pending')}
                >
                  Pending ({projects.filter(p => p.status === 'Pending' || p.status === 'Not Started').length})
                </button>
              </div>
            </div>

            <div className="controls-right">
              {/* Sort */}
              <div className="sort-container">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="sort-select"
                >
                  <option value="name">Sort by Name</option>
                  <option value="location">Sort by Location</option>
                  <option value="manager">Sort by Manager</option>
                  <option value="status">Sort by Status</option>
                  <option value="startDate">Sort by Start Date</option>
                </select>
                <button
                  className="sort-order-btn"
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                >
                  {sortOrder === 'asc' ? <FaChevronUp /> : <FaChevronDown />}
                </button>
              </div>

              {/* View Mode */}
              <div className="view-mode-container">
                <button
                  className={`view-mode-btn ${viewMode === 'grid' ? 'active' : ''}`}
                  onClick={() => setViewMode('grid')}
                >
                  <FaTh />
                </button>
                <button
                  className={`view-mode-btn ${viewMode === 'list' ? 'active' : ''}`}
                  onClick={() => setViewMode('list')}
                >
                  <FaList />
                </button>
              </div>
            </div>
          </div>

          {/* Error State */}
          {error && (
            <div className="error-state">
              <FaClock />
              <span>{error}</span>
              <button onClick={() => window.location.reload()} className="retry-btn">
                Try Again
              </button>
            </div>
          )}

          {/* Projects Grid/List */}
          {!error && (
            <div className={`projects-display ${viewMode}`}>
              {displayedProjects.length === 0 ? (
                <div className="empty-state">
                  <FaProjectDiagram />
                  <h3>No projects found</h3>
                  <p>
                    {searchTerm || filter !== 'all' 
                      ? 'Try adjusting your search or filters'
                      : 'You are not assigned to any projects yet'
                    }
                  </p>
                </div>
              ) : (
                displayedProjects.map(project => (
                  <div
                    key={project._id}
                    className="project-card"
                    onClick={() => navigate(`/hr-site/current-project/${project._id}`)}
                  >
                    {/* Project Image */}
                    <div className="project-image-container">
                      <img
                        src={project.photos && project.photos.length > 0
                          ? project.photos[0]
                          : 'https://placehold.co/400x250?text=No+Photo'}
                        alt={project.projectName}
                        className="project-image"
                      />
                      <div className="project-status-badge" style={{ backgroundColor: getStatusColor(project.status) }}>
                        {getStatusIcon(project.status)}
                        <span>{project.status || 'Unknown'}</span>
                      </div>
                    </div>

                    {/* Project Content */}
                    <div className="project-content">
                      <div className="project-header">
                        <h3 className="project-name">{project.projectName}</h3>
                        <div className="project-location">
                          <FaMapMarkerAlt />
                          <span>{project.location?.name || 'No Location'}</span>
                        </div>
                      </div>

                      <div className="project-details">
                        <div className="detail-item">
                          <FaUserTie className="detail-icon" />
                          <div className="detail-content">
                            <span className="detail-label">Project Manager</span>
                            <span className="detail-value">{project.projectManager?.name || 'Not Assigned'}</span>
                          </div>
                        </div>

                        <div className="detail-item">
                          <FaBuilding className="detail-icon" />
                          <div className="detail-content">
                            <span className="detail-label">Contractor</span>
                            <span className="detail-value">{project.contractor || 'Not Assigned'}</span>
                          </div>
                        </div>

                        <div className="detail-item">
                          <FaCalendarAlt className="detail-icon" />
                          <div className="detail-content">
                            <span className="detail-label">Timeline</span>
                            <span className="detail-value">
                              {project.startDate && project.endDate
                                ? `${new Date(project.startDate).toLocaleDateString()} - ${new Date(project.endDate).toLocaleDateString()}`
                                : 'Not Set'
                              }
                            </span>
                          </div>
                        </div>

                        <div className="detail-item">
                          <FaUsersIcon className="detail-icon" />
                          <div className="detail-content">
                            <span className="detail-label">Manpower</span>
                            <span className="detail-value">
                              {Array.isArray(project.manpower) && project.manpower.length > 0
                                ? `${project.manpower.length} assigned`
                                : 'No manpower assigned'
                              }
                            </span>
                          </div>
                        </div>

                        {project.budget && (
                          <div className="detail-item">
                            <FaMoneyBillWave className="detail-icon" />
                            <div className="detail-content">
                              <span className="detail-label">Budget</span>
                              <span className="detail-value">{project.budget}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default HrSiteAllProjects;
