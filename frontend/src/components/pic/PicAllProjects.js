import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api/axiosInstance';
import NotificationBell from '../NotificationBell';
import '../style/pic_style/PicAllProjects.css';
// Nav icons
import { FaTachometerAlt, FaComments, FaClipboardList, FaEye, FaProjectDiagram } from 'react-icons/fa';

// Sidebar Chats Data
const chats = [
  { id: 1, name: 'Rychea Miralles', initial: 'R', message: 'Hello Good Morning po! As...', color: '#4A6AA5' },
  { id: 2, name: 'Third Castellar', initial: 'T', message: 'Hello Good Morning po! As...', color: '#2E7D32' },
  { id: 3, name: 'Zenarose Miranda', initial: 'Z', message: 'Hello Good Morning po! As...', color: '#9C27B0' }
];

const PicAllProjects = () => {
  const token = localStorage.getItem('token');
  const stored = localStorage.getItem('user');
  const user = stored ? JSON.parse(stored) : null;
  const userId = user?._id;

  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [activeTab, setActiveTab] = useState('Ongoing');
  const [ongoing, setOngoing] = useState([]);
  const [completed, setCompleted] = useState([]);
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState(null);

  // Profile menu and user display
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [userName, setUserName] = useState(user?.name || '');

  useEffect(() => {
    const handleClickOutside = (event) => {
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

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    Promise.all([
      api.get(`/projects/by-user-status?userId=${userId}&role=pic&status=Ongoing`),
      api.get(`/projects/by-user-status?userId=${userId}&role=pic&status=Completed`)
    ])
      .then(([resOngoing, resCompleted]) => {
        setOngoing(resOngoing.data || []);
        setCompleted(resCompleted.data || []);
        setLoading(false);
      })
      .catch(() => {
        setOngoing([]); setCompleted([]); setLoading(false);
      });
  }, [userId]);

  // Only fetch user's active/ongoing project
  useEffect(() => {
    if (!token || !userId) return;
    const fetchActiveProject = async () => {
      try {
        const { data } = await api.get(`/projects/by-user-status?userId=${userId}&role=pic&status=Ongoing`);
        setProject(data[0] || null);
      } catch (err) {
        setProject(null);
      }
    };
    fetchActiveProject();
  }, [token, userId]);

  // Fetch requests for this PIC's current project **only**
  useEffect(() => {
    if (!token || !project) return;

    api.get('/requests/mine', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(({ data }) => {
        const projectRequests = Array.isArray(data)
          ? data.filter(r => r.project && r.project._id === project._id)
          : [];
        setRequests(projectRequests);
      })
      .catch(() => setRequests([]));
  }, [token, project]);

  if (loading) return <div style={{ padding: 32 }}>Loading...</div>;

  const ProjectTable = ({ projects }) => (
    <table className="myprojects-table">
      <thead>
        <tr>
          <th>Project Name</th>
          <th>Status</th>
          <th>Location</th>
          <th>Start</th>
          <th>End</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {projects.length === 0 && (
          <tr>
            <td colSpan={6} style={{ textAlign: 'center' }}>No projects found.</td>
          </tr>
        )}
        {projects.map((proj) => (
          <tr key={proj._id}>
            <td>{proj.projectName}</td>
            <td>
              <span className={`status-badge badge-${proj.status?.toLowerCase() || 'unknown'}`}>{proj.status}</span>
            </td>
            <td>{proj.location?.name || '-'}</td>
            <td>{proj.startDate ? new Date(proj.startDate).toLocaleDateString() : '-'}</td>
            <td>{proj.endDate ? new Date(proj.endDate).toLocaleDateString() : '-'}</td>
            <td>
              <button
                className="view-btn"
                onClick={() => navigate(`/pic/${proj._id}`)}
              >View</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <>
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
    <Link to="/pic" className="nav-link"><FaTachometerAlt /> Dashboard</Link>
    <Link to="/pic/chat" className="nav-link"><FaComments /> Chat</Link>
    <Link to="/pic/requests" className="nav-link">
      <FaClipboardList /> Requests
    </Link>
    {project && (
      <Link to={`/pic/${project._id}`} className="nav-link">
        <FaEye /> View Project
      </Link>
    )}
    <Link to="/pic/projects" className="nav-link"><FaProjectDiagram /> My Projects</Link>
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


      {/* Dashboard Layout with Sidebar */}
      <div className="dashboard-layout">
        {/* Sidebar */}
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

        {/* Main Content */}
        <main className="main1">
          <div className="main-content-container">
            <h1 className="main-title">My Projects</h1>
            <div className="tabs">
              <button
                className={activeTab === 'Ongoing' ? 'tab active' : 'tab'}
                onClick={() => setActiveTab('Ongoing')}
              >Ongoing</button>
              <button
                className={activeTab === 'Completed' ? 'tab active' : 'tab'}
                onClick={() => setActiveTab('Completed')}
              >Completed</button>
            </div>
            <div className="projects-table-container">
              {activeTab === 'Ongoing' ? (
                <ProjectTable projects={ongoing} />
              ) : (
                <ProjectTable projects={completed} />
              )}
            </div>
          </div>
        </main>
      </div>
    </>
  );
};

export default PicAllProjects;
