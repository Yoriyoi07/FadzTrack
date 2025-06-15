import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../../api/axiosInstance';
import NotificationBell from '../NotificationBell';
import "../style/pic_style/Pic_Project.css";

// Sidebar Chats Data (same everywhere)
const chats = [
  { id: 1, name: 'Rychea Miralles', initial: 'R', message: 'Hello Good Morning po! As...', color: '#4A6AA5' },
  { id: 2, name: 'Third Castellar', initial: 'T', message: 'Hello Good Morning po! As...', color: '#2E7D32' },
  { id: 3, name: 'Zenarose Miranda', initial: 'Z', message: 'Hello Good Morning po! As...', color: '#9C27B0' }
];

const PicProject = () => {
   const { id } = useParams();
  const navigate = useNavigate();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [project, setProject] = useState(null);
  const token = localStorage.getItem('token');
  const storedUser = localStorage.getItem('user');
  const user = storedUser ? JSON.parse(storedUser) : null;  
  const [userName, setUserName] = useState(user?.name || '');
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
    <>
      <header className="header">
        <div className="logo-container">
          <img src={require('../../assets/images/FadzLogo1.png')} alt="FadzTrack Logo" className="logo-img" />
          <h1 className="brand-name">FadzTrack</h1>
        </div>
        <nav className="nav-menu">
          <Link to="/pic" className="nav-link">Dashboard</Link>
          {project && (<Link to={`/pic/projects/${project._id}/request`} className="nav-link">Requests</Link>)}
          {project && (<Link to={`/pic/${project._id}`} className="nav-link">View Project</Link>)}
          <Link to="/pic/projects" className="nav-link">My Projects</Link>
          <Link to="/pic/chat" className="nav-link">Chat</Link>
        </nav>
       <div className="profile-menu-container" style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <NotificationBell />
        <div className="profile-circle" onClick={() => setProfileMenuOpen(!profileMenuOpen)}>
          {userName?.charAt(0).toUpperCase() || 'Z'}
        </div>
        {profileMenuOpen && (
          <div className="profile-menu">
            <button onClick={handleLogout}>Logout</button>
          </div>
        )}
      </div>
      </header>

      <div className="dashboard-layout">
        {/* Sidebar with Chats */}
        <div className="sidebar">
          <div className="chats-section">
            <h3 className="chats-title">Chats</h3>
            <div className="chats-list">
              {chats.map(chat => (
                <div key={chat.id} className="chat-item">
                  <div className="chat-avatar" style={{ backgroundColor: chat.color }}>
                    {chat.initial}
                  </div>
                  <div className="chat-info">
                    <div className="chat-name">{chat.name}</div>
                    <div className="chat-message">{chat.message}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main content */}
        <main className="main1">
          <div className="project-detail-container">
            <div className="back-button" onClick={() => navigate('/pic')} style={{ cursor: 'pointer' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24">
                <path d="M19 12H5" stroke="currentColor" strokeWidth="2" fill="none"></path>
                <path d="M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" fill="none"></path>
              </svg>
            </div>
            <div className="project-image-container">
              <img alt={project.projectName} className="project-image" />
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
              <p className="detail-label">Manpower:</p>
              <p className="manpower-list">
                {Array.isArray(project.manpower) && project.manpower.length > 0
                  ? project.manpower.map(mp => `${mp.name} (${mp.position})`).join(', ')
                  : 'No Manpower Assigned'}
              </p>
            </div>
          </div>
        </main>
      </div>
    </>
  );
};

export default PicProject;
