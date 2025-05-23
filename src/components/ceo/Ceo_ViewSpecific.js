import React, { useState, useEffect } from 'react';
import "../style/ceo_style/Ceo_ViewSpecific.css";
import { Link, useNavigate, useParams } from 'react-router-dom';

const Ceo_ViewSpecific = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [project, setProject] = useState(null); // ✅ You missed this!

  useEffect(() => {
    const fetchProject = async () => {
      try {
        const res = await fetch(`http://localhost:5000/api/projects/${id}`);
        const data = await res.json();
        setProject(data);
        console.log("Fetched project data:", data);
      } catch (err) {
        console.error("Failed to fetch project:", err);
      }
    };

    fetchProject();
  }, [id]);

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

  if (!project) return <div>Loading...</div>;

  return (
    <div className="app-container">
      <header className="header">
        <div className="logo-container">
          <div className="logo">
            <div className="logo-building"></div>
            <div className="logo-flag"></div>
          </div>
          <h1 className="brand-name">FadzTrack</h1>
        </div>
        <nav className="nav-menu">
          <Link to="/ceo/dash" className="nav-link">Dashboard</Link>
          <Link to="/requests" className="nav-link">Requests</Link>
          <Link to="/ceo/proj" className="nav-link">Projects</Link>
          <Link to="/chat" className="nav-link">Chat</Link>
          <Link to="/logs" className="nav-link">Logs</Link>
          <Link to="/reports" className="nav-link">Reports</Link>
        </nav>
        <div className="search-profile">
          <div className="search-container">
            <input type="text" placeholder="Search in site" className="search-input" />
            <button className="search-button">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </button>
          </div>
          <div className="profile-menu-container">
            <div className="profile-circle" onClick={() => setProfileMenuOpen(!profileMenuOpen)}>
              Z
            </div>
            {profileMenuOpen && (
              <div className="profile-menu">
                <button onClick={handleLogout}>Logout</button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="main">
        <div className="project-detail-container">
          <div className="back-button" onClick={() => navigate('/ceo/proj')} style={{ cursor: 'pointer' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24">
              <path d="M19 12H5"></path>
              <path d="M12 19l-7-7 7-7"></path>
            </svg>
          </div>

          <div className="project-image-container">
            <img 
              src="https://placehold.com/800x400"
              alt={project.projectName} 
              className="project-image"
            />
            <button className="favorite-button">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
            </button>
          </div>

          <h1 className="project-title">{project.projectName}</h1>

          <div className="project-details-grid">
            <div className="details-column">
              <p className="detail-item"><span className="detail-label">Location:</span> {project.location}</p>

              <div className="detail-group">
                <p className="detail-label">Project Manager:</p>
                <p className="detail-value">{project.projectManager?.name || "N/A"}</p>
              </div>

              <div className="detail-group">
                <p className="detail-label">Contractor:</p>
                <p className="detail-value">{project.contractor}</p>
              </div>

              <div className="detail-group">
                <p className="detail-label">Target Date:</p>
                <p className="detail-value">
                  {project.targetDate || "N/A"}
                </p>
              </div>
            </div>

            <div className="details-column">
              <div className="budget-container">
                <p className="budget-amount">{project.budget?.toLocaleString()}</p>
                <p className="budget-label">Estimated Budget</p>
              </div>

              <div className="detail-group">
                <p className="detail-label">PIC:</p>
                <p className="detail-value">{project.pic && project.pic.length > 0 
    ? project.pic.map(p => p.name).join(', ') 
    : 'N/A'}</p>
              </div>
            </div>
          </div>

          <div className="manpower-section">
            <p className="detail-label">Manpower:</p>
            <p className="manpower-list">{project.manpower}</p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Ceo_ViewSpecific;
