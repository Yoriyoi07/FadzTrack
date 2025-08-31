
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../api/axiosInstance';
import AppHeader from '../layout/AppHeader';
import '../style/am_style/Area_Projects.css';

// React Icons
import {
  FaBoxes,
  FaUsers,
  FaProjectDiagram,
  FaMapMarkerAlt,
  FaUserTie,
  FaBuilding,
  FaCalendarAlt,
  FaUsers as FaUsersIcon,
  FaMoneyBillWave,
  FaCheckCircle,
  FaClock,
  FaTh,
  FaList,
  FaSearch,
  FaChevronDown,
  FaChevronUp
} from 'react-icons/fa';

const AreaProj = () => {
  const [filter, setFilter] = useState('all');
  const [viewMode, setViewMode] = useState('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  // Unified header removed collapse/profile local states
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const navigate = useNavigate();
  const stored = localStorage.getItem('user');
  const user = stored ? JSON.parse(stored) : null;
  const userName = user?.name || 'Area Manager';
  const userRole = user?.role || 'Area Manager';
  const areaManagerId = user?._id;

  // Unified header handles logout & profile interactions

  // Fetch projects
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setLoading(true);
        const response = await api.get('/projects');
        setProjects(response.data);
        setError(null);
      } catch (error) {
        console.error('Failed to fetch projects:', error);
        setError('Failed to load projects. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    fetchProjects();
  }, []);

  // Filter projects for this area manager
  const filteredProjects = projects.filter(project => 
    project.areamanager && project.areamanager._id === areaManagerId
  );

  // Apply filters and search
  const displayedProjects = filteredProjects
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
          project.projectmanager?.name?.toLowerCase().includes(searchLower) ||
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
          aValue = a.projectmanager?.name || '';
          bValue = b.projectmanager?.name || '';
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
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading projects...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <AppHeader roleSegment="am" />

      {/* Main Content */}
      <main className="dashboard-main">
        <div className="projects-container">
          {/* Page Header */}
          <div className="page-header">
            <div className="page-title-section">
              <h1 className="page-title">My Projects</h1>
              <p className="page-subtitle">Manage and monitor all projects under your areas</p>
            </div>
            <div className="page-actions">
              <button className="add-project-btn" onClick={() => navigate('/am/addproj')}>
                <FaProjectDiagram />
                Add Project
              </button>
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
                  All ({filteredProjects.length})
                </button>
                <button
                  className={`filter-btn ${filter === 'ongoing' ? 'active' : ''}`}
                  onClick={() => setFilter('ongoing')}
                >
                  Ongoing ({filteredProjects.filter(p => p.status === 'Ongoing' || p.status === 'On Going').length})
                </button>
                <button
                  className={`filter-btn ${filter === 'completed' ? 'active' : ''}`}
                  onClick={() => setFilter('completed')}
                >
                  Completed ({filteredProjects.filter(p => p.status === 'Completed').length})
                </button>
                <button
                  className={`filter-btn ${filter === 'pending' ? 'active' : ''}`}
                  onClick={() => setFilter('pending')}
                >
                  Pending ({filteredProjects.filter(p => p.status === 'Pending' || p.status === 'Not Started').length})
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
                      : 'You don\'t have any projects assigned yet'
                    }
                  </p>
                  {!searchTerm && filter === 'all' && (
                    <button className="add-project-btn" onClick={() => navigate('/am/addproj')}>
                      Add Your First Project
                    </button>
                  )}
                </div>
              ) : (
                displayedProjects.map(project => (
                  <div
                    key={project._id}
                    className="project-card"
                    onClick={() => navigate(`/am/projects/${project._id}`)}
                  >
                    {/* Project Image */}
                    <div className="project-image-container">
                      <img
                        src={project.photos && project.photos.length > 0
                          ? project.photos[0]
                          : 'https://placehold.co/400x250?text=No+Photo'}
                        alt={project.name}
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
                        <h3 className="project-name">{project.name}</h3>
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
                            <span className="detail-value">{project.engineer?.name || 'Not Assigned'}</span>
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

export default AreaProj;
