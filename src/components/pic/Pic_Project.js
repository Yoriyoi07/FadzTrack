import React, { useState, useEffect } from 'react';
import "../style/pic_style/Pic_Project.css";
import { Link, useNavigate, useParams } from 'react-router-dom';

const Pic_Project = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [project, setProject] = useState(null);

 useEffect(() => {
  const user = JSON.parse(localStorage.getItem('user'));
  if (!id || !user?.id) return;

  const fetchAssignedProjects = async () => {
    try {
      const res = await fetch(`http://localhost:5000/api/projects/assigned/${user.id}`);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const projects = await res.json();
      console.log('Fetched projects:', projects);
      console.log('Looking for project with id:', id);

      const matchedProject = projects.find(p => p._id === id);
      console.log('Matched project:', matchedProject);

      if (matchedProject) {
        setProject(matchedProject);
      } else {
        setProject(null);
      }
    } catch (err) {
      setProject(null);
    }
  };

  fetchAssignedProjects();
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
          <Link to="/pic" className="nav-link">Dashboard</Link>
                      <Link to="/requests" className="nav-link">Requests</Link>
                      <Link to={`/pic/${project._id}`}>View Project</Link>
                      <Link to="/chat" className="nav-link">Chat</Link>
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
          <div className="back-button" onClick={() => navigate('/Pic')} style={{ cursor: 'pointer' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24">
              <path d="M19 12H5"></path>
              <path d="M12 19l-7-7 7-7"></path>
            </svg>
          </div>

          <div className="project-image-container">
            <img 
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
                <p className="detail-value">{project.projectmanager?.name || 'N/A'}</p>
              </div>

              <div className="detail-group">
                <p className="detail-label">Contractor:</p>
                <p className="detail-value">{project.contractor}</p>
              </div>

              <div className="detail-group">
                <p className="detail-label">Target Date:</p>
                <p className="detail-value">
                  {new Date(project.startDate).toLocaleDateString()} - {new Date(project.endDate).toLocaleDateString()}
                </p>
              </div>
            </div>

            <div className="details-column">
              <div className="budget-container">
                <p className="budget-amount">₱{project.budget?.toLocaleString() || '0'}</p>
                <p className="budget-label">Estimated Budget</p>
              </div>

              <div className="detail-group">
                <p className="detail-value">
                <p className="detail-label">PIC:</p>
  {project.pic && project.pic.length > 0 
    ? project.pic.map(p => p.name).join(', ') 
    : 'N/A'}
</p>
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

export default Pic_Project;
