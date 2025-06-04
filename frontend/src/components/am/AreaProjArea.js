import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../api/axiosInstance';
import '../style/ceo_style/Ceo_Proj.css';

const AreaProj = () => {
  const [filter, setFilter] = useState('all');
  const [viewMode, setViewMode] = useState('grid'); // Added state for view mode
  const navigate = useNavigate();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [projects, setProjects] = useState([]);

  // 1. Get area manager id from local storage/user context
  const stored = localStorage.getItem('user');
  const user = stored ? JSON.parse(stored) : null;
  const areaManagerId = user?._id;

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest(".profile-menu-container")) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  // 2. Fetch all projects
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const response = await api.get('/projects');
        setProjects(response.data);
      } catch (error) {
        console.error('Failed to fetch projects:', error);
      }
    };
    fetchProjects();
  }, []);

  // 3. Filter projects for this area manager
  const filteredProjects = projects.filter(
    project => project.areamanager && project.areamanager._id === areaManagerId
  );

  // Optionally, keep the status filter as well
  const displayedProjects = filteredProjects.filter(project => {
    if (filter === 'completed') {
      return project.status === 'Completed';
    }
    if (filter === 'ongoing') {
      return project.status === 'Ongoing' || project.status === 'On Going';
    }
    return true;
  });

  return (
    <div className="dashboard-container">
      {/* Header remains the same */}
      <header className="header">
        <div className="logo-container">
          <img src={require('../../assets/images/FadzLogo1.png')} alt="FadzTrack Logo" className="logo-img" />
          <h1 className="brand-name">FadzTrack</h1>
        </div>
        <nav className="nav-menu">
          <Link to="/am" className="nav-link">Dashboard</Link>
          <Link to="/am/matreq" className="nav-link">Material</Link>
          <Link to="/am/manpower-requests" className="nav-link">Manpower</Link>
          <Link to="/am/viewproj" className="nav-link">Projects</Link>
          <Link to="/chat" className="nav-link">Chat</Link>
          <Link to="/logs" className="nav-link">Logs</Link>
          <Link to="/reports" className="nav-link">Reports</Link>
        </nav>
        <div className="profile-menu-container">
          <div
            className="profile-circle"
            onClick={() => setProfileMenuOpen(!profileMenuOpen)}
          >
            Z
          </div>
          {profileMenuOpen && (
            <div className="profile-menu">
              <button onClick={handleLogout}>Logout</button>
            </div>
          )}
        </div>
      </header>

      <div className="ceo-proj-projects-container">
        {/* Filter bar */}
        <div className="ceo-proj-filter-bar">
          {/* Area Filter */}
          <div className="ceo-proj-area-filter">
            <span className="ceo-proj-filter-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
              </svg>
              Area Filter
            </span>
            <div className="ceo-proj-filter-tabs">
              <button
                className={filter === 'all' ? 'ceo-proj-active' : ''}
                onClick={() => setFilter('all')}
              >
                All
              </button>
              <span className="ceo-proj-divider">|</span>
              <button
                className={filter === 'completed' ? 'ceo-proj-active' : ''}
                onClick={() => setFilter('completed')}
              >
                Completed
              </button>
              <span className="ceo-proj-divider">|</span>
              <button
                className={filter === 'ongoing' ? 'ceo-proj-active' : ''}
                onClick={() => setFilter('ongoing')}
              >
                On Going
              </button>
            </div>
            
          </div>
          <div className="ceo-proj-view-mode">
          <button
            className={viewMode === 'grid' ? 'ceo-proj-active' : ''}
            onClick={() => setViewMode('grid')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
            </svg>
          </button>
          <button
            className={viewMode === 'list' ? 'ceo-proj-active' : ''}
            onClick={() => setViewMode('list')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="8" y1="6" x2="21" y2="6"></line>
              <line x1="8" y1="12" x2="21" y2="12"></line>
              <line x1="8" y1="18" x2="21" y2="18"></line>
              <line x1="3" y1="6" x2="3.01" y2="6"></line>
              <line x1="3" y1="12" x2="3.01" y2="12"></line>
              <line x1="3" y1="18" x2="3.01" y2="18"></line>
            </svg>
          </button>
        </div>
        </div> 

        {/* Project cards */}
        <div className={`ceo-proj-project-cards ${viewMode}`}>
          {displayedProjects.map(project => (
            <div
              key={project._id}
              className="ceo-proj-project-card"
              onClick={() => navigate(`/am/projects/${project._id}`)}
              style={{ cursor: 'pointer' }}
            >
              {/* Project Image */}
              <div className="ceo-proj-project-image-container">
                <img
                  src={project.photos && project.photos.length > 0
                    ? `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}${project.photos[0]}`
                    : 'https://placehold.co/400x250?text=No+Photo'}
                  alt={project.projectName}
                  className="ceo-proj-project-image"
                  width={250}
                  height={150}
                  style={{ objectFit: "cover", borderRadius: 8 }}
                />
              </div>
              {/* Project Details */}
              <div className="ceo-proj-project-details">
                <div className="ceo-proj-left-details">
                  <h3 className="ceo-proj-project-name">{project.projectName}</h3>
                  <p className="ceo-proj-project-location">
                    {project.location?.name
                      ? `${project.location.name} (${project.location.region})`
                      : 'No Location'}
                  </p>
                  <div className="ceo-proj-project-info-grid">
                    <div className="ceo-proj-info-column">
                      <span className="ceo-proj-info-column-header">Project Manager:</span>
                      <span className="ceo-proj-info-column-value">{project.projectmanager?.name}</span>
                    </div>
                    <div className="ceo-proj-info-column">
                      <span className="ceo-proj-info-column-header">Contractor:</span>
                      <span className="ceo-proj-info-column-value">{project.contractor}</span>
                    </div>
                    <div className="ceo-proj-info-column">
                      <span className="ceo-proj-info-column-header">Target Date:</span>
                      <span className="ceo-proj-info-column-value">
                        {project.startDate && project.endDate
                          ? `${new Date(project.startDate).toLocaleDateString()} to ${new Date(project.endDate).toLocaleDateString()}`
                          : "N/A"}
                      </span>
                    </div>
                    <div className="ceo-proj-manpower-section">
                      <span className="ceo-proj-manpower-header">Manpower:</span>
                      <span className="ceo-proj-manpower-value">
                        {Array.isArray(project.manpower) && project.manpower.length > 0
                          ? project.manpower.map(mp => `${mp.name} (${mp.position})`).join(', ')
                          : 'No Manpower Assigned'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="ceo-proj-right-details">
                  <div className="ceo-proj-budget">
                    <p className="ceo-proj-budget-amount">{project.budget}</p>
                    <p className="ceo-proj-budget-label">Estimated Budget</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AreaProj;
