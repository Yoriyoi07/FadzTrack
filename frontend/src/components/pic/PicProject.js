import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../../api/axiosInstance'; // Make sure the path matches your project structure
import "../style/pic_style/Pic_Project.css";

const PicProject = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!id || !user?.id) return;

    api.get(`/projects/assigned/${user.id}`)
      .then(res => {
        const matched = res.data.find(p => p._id === id);
        setProject(matched || null);
        setLoading(false);
      })
      .catch(() => {
        setProject(null);
        setLoading(false);
      });
  }, [id]);

  useEffect(() => {
    const handleClickOutside = event => {
      if (!event.target.closest(".profile-menu-container")) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  if (loading) return <div>Loading...</div>;
  if (!project) return <div>Project not found.</div>;

  return (
    <div>
      <header className="header">
        <div className="logo-container">
          <img src={require('../../assets/images/FadzLogo1.png')} alt="FadzTrack Logo" className="logo-img" />
          <h1 className="brand-name">FadzTrack</h1>
        </div>
        <nav className="nav-menu">
          <Link to="/pic" className="nav-link">Dashboard</Link>
          <Link to="/pic/projects/:projectId/request" className="nav-link">Requests</Link>
          <Link to={`/pic/${project._id}`} className="nav-link">View Project</Link>
          <Link to="/pic/chat" className="nav-link">Chat</Link>
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

      <main className="main">
        <div className="project-detail-container">
          <div className="back-button" onClick={() => navigate('/pic')} style={{ cursor: 'pointer' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24">
              <path d="M19 12H5"></path>
              <path d="M12 19l-7-7 7-7"></path>
            </svg>
          </div>
          <div className="project-image-container">
            <img alt={project.projectName} className="project-image" />
            <button className="favorite-button">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
            </button>
          </div>
          <h1 className="project-title">{project.projectName}</h1>
          <div className="project-details-grid">
            <div className="details-column">
              <p className="detail-item">
                <span className="detail-label">Location:</span>
                {project.location?.name || 'N/A'}
              </p>
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
                <span className="detail-label">PIC:</span>
                <div className="detail-value">
                  {project.pic && project.pic.length > 0
                    ? project.pic.map((p, idx) => <div key={p._id || idx}>{p.name}</div>)
                    : 'N/A'}
                </div>
              </div>
            </div>
          </div>
          <div className="manpower-section">
            <div className="manpower-section">
            <p className="detail-label">Manpower:</p>
            <p className="manpower-list">
              {Array.isArray(project.manpower) && project.manpower.length > 0
                ? project.manpower.map(mp => `${mp.name} (${mp.position})`).join(', ')
                : 'No Manpower Assigned'}
            </p>
          </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PicProject;
