import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../api/axiosInstance';
import '../style/ceo_style/Ceo_Proj.css';

const AreaProj = () => {
  const [filter, ] = useState('all');
  const [viewMode,] = useState('grid');
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
      <header className="header">
        <div className="logo-container">
          <img src={require('../../assets/images/FadzLogo1.png')} alt="FadzTrack Logo" className="logo-img" />
          <h1 className="brand-name">FadzTrack</h1>
        </div>
        <nav className="nav-menu">
          <Link to="/ceo/dash" className="nav-link">Dashboard</Link>
          <Link to="/ceo/material-list" className="nav-link">Material</Link>
          <Link to="/ceo/proj" className="nav-link">Projects</Link>
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
          {/* ...same as before */}
        </div>

        {/* Project cards */}
        <div className={`ceo-proj-project-cards ${viewMode}`}>
          {displayedProjects.map(project => (
            <div
              key={project._id}
              className="ceo-proj-project-card"
              onClick={() => navigate(`/ceo/proj/${project._id}`)}
              style={{ cursor: 'pointer' }}
            >
              {/* ...rest of the card */}
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
              </div>
              <div className="ceo-proj-project-details">
                {/* ...your details rendering */}
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
