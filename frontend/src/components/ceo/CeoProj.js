import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../api/axiosInstance';
import '../style/ceo_style/Ceo_Proj.css';
import NotificationBell from '../NotificationBell';

// Nav icons
import { FaTachometerAlt, FaComments, FaBoxes, FaProjectDiagram, FaClipboardList, FaChartBar } from 'react-icons/fa';


const CeoProj = () => {
 const stored = localStorage.getItem('user');
  const userName = stored ? JSON.parse(stored).name : 'ALECK';

  const [filter, setFilter] = useState('all');
  const [viewMode, setViewMode] = useState('grid');
  const navigate = useNavigate();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [projects, setProjects] = useState([]);

  // Close profile menu on click outside
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

  // Fetch projects using AXIOS INSTANCE
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

  return (
    <div className="dashboard-container">
      <header className="header">
  <div className="logo-container">
    <img
      src={require('../../assets/images/FadzLogo1.png')}
      alt="FadzTrack Logo"
      className="logo-img"
    />
    <h1 className="brand-name">FadzTrack</h1>
  </div>

  <nav className="nav-menu">
    <Link to="/ceo/dash" className="nav-link"><FaTachometerAlt /> Dashboard</Link>
    <Link to="/ceo/chat" className="nav-link"><FaComments /> Chat</Link>
    <Link to="/ceo/material-list" className="nav-link"><FaBoxes /> Material</Link>
    <Link to="/ceo/proj" className="nav-link"><FaProjectDiagram /> Projects</Link>
    <Link to="/ceo/audit-logs" className="nav-link"><FaClipboardList /> Audit Logs</Link>
    <Link to="/reports" className="nav-link"><FaChartBar /> Reports</Link>
  </nav>

  <div className="profile-menu-container" style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
    <NotificationBell />
    <div className="profile-circle" onClick={() => setProfileMenuOpen(!profileMenuOpen)}>
      {userName ? userName.charAt(0).toUpperCase() : 'Z'}
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
              {/* Grid icon */}
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
              {/* List icon */}
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
          {projects.map(project => (
            <div
              key={project._id}
              className="ceo-proj-project-card"
              onClick={() => navigate(`/ceo/proj/${project._id}`)}
              style={{ cursor: 'pointer' }}
            >
              <div className="ceo-proj-project-image-container">
                <img
                  src={
                    project.photos && project.photos.length > 0
                      ? `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}${project.photos[0]}`
                      : 'https://placehold.co/400x250?text=No+Photo'
                  }
                  alt={project.projectName}
                  className="ceo-proj-project-image"
                  width={250}
                  height={150}
                  style={{ objectFit: "cover", borderRadius: 8 }}
                />

                <button className="ceo-proj-favorite-btn" onClick={(e) => e.stopPropagation()}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                  </svg>
                </button>
              </div>
              <div className="ceo-proj-project-details">
                <div className="ceo-proj-left-details">
                  <h3 className="ceo-proj-project-name">{project.name}</h3>
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

export default CeoProj;
