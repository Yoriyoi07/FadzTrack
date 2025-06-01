import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import '../style/pm_style/Pm_Dash.css';
import api from '../../api/axiosInstance';

const PmDash = () => {
  const token = localStorage.getItem('token');
  const stored = localStorage.getItem('user');
  const user = stored ? JSON.parse(stored) : null;
  const userId = user?._id;

  const [userName, setUserName] = useState(user?.name || 'ALECK');
  const [userRole, setUserRole] = useState(user?.role || '');
  const [projects, setProjects] = useState([]);
  const [project, setProject] = useState(null);
  const navigate = useNavigate();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  // Static sidebar data
  const [sidebarProjects] = useState([
    { id: 1, name: 'Batangas', engineer: 'Engr. Daryll Miralles' },
    { id: 2, name: 'Twin Lakes Project', engineer: 'Engr. Shaquille' },
    { id: 3, name: 'Calatagan Townhomes', engineer: 'Engr. Rychea Miralles' },
    { id: 4, name: 'Makati', engineer: 'Engr. Michelle Amor' },
    { id: 5, name: 'Cavite', engineer: 'Engr. Zenarose Miranda' },
    { id: 6, name: 'Taguig', engineer: 'Engr. Third Castellar' }
  ]);

  const [reports] = useState([
    { id: 1, name: 'BGC Hotel', dateRange: '7/13/25 - 7/27/25', engineer: 'Engr.' },
    { id: 2, name: 'Protacio Townhomes', dateRange: '7/13/25 - 7/27/25', engineer: 'Engr.' },
    { id: 3, name: 'Fegarido Residences', dateRange: '7/13/25 - 7/27/25', engineer: 'Engr.' }
  ]);

  const [chats] = useState([
    { id: 1, name: 'Rychea Miralles', initial: 'R', message: 'Hello Good Morning po! As...', color: '#4A6AA5' },
    { id: 2, name: 'Third Castellar', initial: 'T', message: 'Hello Good Morning po! As...', color: '#2E7D32' },
    { id: 3, name: 'Zenarose Miranda', initial: 'Z', message: 'Hello Good Morning po! As...', color: '#9C27B0' }
  ]);

  const [materialRequests, setMaterialRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [requestsError, setRequestsError] = useState(null);

  const [manpowerRequests, setManpowerRequests] = useState([]);
  const [loadingManpower, setLoadingManpower] = useState(true);
  const [manpowerError, setManpowerError] = useState(null);

  // Auth and name setup
  useEffect(() => {
    if (!token || !user) {
      navigate('/');
      return;
    }
    setUserName(user.name);
    setUserRole(user.role);
  }, [navigate, token, user]);

  // Fetch projects
  useEffect(() => {
    if (!token || !user) return;
    const fetchProjects = async () => {
      try {
        const { data } = await api.get('/projects');
        const filtered = data.filter(p =>
          (typeof p.projectmanager === 'object' &&
            (p.projectmanager._id === userId || p.projectmanager.id === userId)) ||
          p.projectManager === userId
        );
        setProjects(filtered);
      } catch (err) {
        setProjects([]);
        // Optional: set an error message if needed
      }
    };
    fetchProjects();
  }, [token, user, userId]);

  // Fetch assigned project
  useEffect(() => {
    if (!token || !userId) return;
    const fetchAssigned = async () => {
      try {
        const { data } = await api.get(`/projects/assigned/${userId}`);
        setProject(data[0] || null);
      } catch (err) {
        setProject(null);
      }
    };
    fetchAssigned();
  }, [token, userId]);

  // Fetch material requests
  useEffect(() => {
    const fetchRequests = async () => {
      if (!token) {
        setRequestsError('Session expired. Please log in again.');
        setLoadingRequests(false);
        return;
      }
      try {
        const { data } = await api.get('/requests/mine');
        setMaterialRequests(Array.isArray(data) ? data : []);
        setRequestsError(null);
      } catch (error) {
        setRequestsError('Error loading material requests');
        setMaterialRequests([]);
      }
      setLoadingRequests(false);
    };
    fetchRequests();
  }, [token]);

  // Fetch manpower requests
  useEffect(() => {
    const fetchManpower = async () => {
      if (!token) {
        setManpowerError('Session expired. Please log in again.');
        setLoadingManpower(false);
        return;
      }
      try {
        const { data } = await api.get('/manpower-requests/mine');
        setManpowerRequests(Array.isArray(data) ? data : []);
        setManpowerError(null);
      } catch (error) {
        setManpowerError('Error loading manpower requests');
        setManpowerRequests([]);
      }
      setLoadingManpower(false);
    };
    fetchManpower();
  }, [token]);

  // Profile menu close on outside click
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

  return (
    <div className="head">
      <header className="header">
        <div className="logo-container">
          <img src={require('../../assets/images/FadzLogo1.png')} alt="FadzTrack Logo" className="logo-img" />
          <h1 className="brand-name">FadzTrack</h1>
        </div>
        <nav className="nav-menu">
          <Link to="/pm" className="nav-link">Dashboard</Link>
          <Link to="/pm/request/:id" className="nav-link">Material</Link>
          <Link to="/pm/manpower-list" className="nav-link">Manpower</Link>
          {projects.length > 0 && (
            <Link to={`/pm/viewprojects/${projects[0]._id || projects[0].id}`} className="nav-link">View Project</Link>
          )}
          <Link to="/chat" className="nav-link">Chat</Link>
          <Link to="/pm/daily-logs" className="nav-link">Logs</Link>
          <Link to="/reports" className="nav-link">Reports</Link>
        </nav>
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
      </header>

      {/* Main Content */}
      <div className="dashboard-layout">
        <div className="sidebar">
          <h2>Dashboard</h2>
          <button className="add-project-btn" onClick={() => navigate('/ceo/addproj')}>
            Add New Project
          </button>
          <div className="project-list">
            {sidebarProjects.map(project => (
              <div key={project.id} className="project-item">
                <div className="project-icon">
                  <span className="icon">🏗️</span>
                  <div className="icon-bg"></div>
                </div>
                <div className="project-info">
                  <div className="project-name">{project.name}</div>
                  <div className="project-engineer">{project.engineer}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="main1">
          <div className="greeting-section">
            <h1>Good Morning, {userName}!</h1>
            <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>
              Currently logged in as <strong>{userRole}</strong>
            </p>

            {/* Material Requests */}
            <div className="material-request-section">
              <div className="section-header">
                <h2>Material Request</h2>
                <button className="view-all-btn" onClick={() => navigate('/pm/request/:id')}>View All Requests</button>
              </div>
              <div className="material-requests-container">
                {loadingRequests ? (
                  <div>Loading requests...</div>
                ) : requestsError ? (
                  <div style={{ color: 'red' }}>{requestsError}</div>
                ) : materialRequests.length === 0 ? (
                  <div>No material requests found.</div>
                ) : (
                  materialRequests.map(request => (
                    <Link to={`/requests/${request._id}`} key={request._id} className="material-request-item">
                      <div className="requester-initial">
                        {request.createdBy?.name?.charAt(0) || 'U'}
                      </div>
                      <div className="request-details">
                        <h4>
                          {request.materials?.map(m => `${m.materialName} (${m.quantity})`).join(', ') || 'No Materials'}
                        </h4>
                        <div className="request-meta">
                          <span>{request.createdBy?.name || 'Unknown'} · {request.project?.projectName || ''}</span>
                          <span>{new Date(request.createdAt).toLocaleDateString()}</span>
                          <span className="status-pill">{request.status}</span>
                        </div>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Manpower Requests Section */}
          <div className="material-request-section">
            <div className="section-header">
              <h2>Manpower Request</h2>
              <button 
                className="view-all-btn" 
                onClick={() => navigate('/pm/manpower-list')}
              >
                View All Requests
              </button>
            </div>
            <div className="material-requests-container horizontal-scroll">
              {loadingManpower ? (
                <div>Loading manpower requests...</div>
              ) : manpowerError ? (
                <div style={{ color: 'red' }}>{manpowerError}</div>
              ) : manpowerRequests.length === 0 ? (
                <div>No manpower requests found.</div>
              ) : (
                manpowerRequests
                  .slice(0, 4)
                  .map(request => (
                    <Link
                      to={`/manpower-requests/${request._id}`}
                      key={request._id}
                      className="material-request-item"
                    >
                      <div className="requester-initial">
                        {request.createdBy?.name?.charAt(0) || 'U'}
                      </div>
                      <div className="request-details">
                        <h4>
                          {Array.isArray(request.manpowers)
                            ? request.manpowers.map(m => `${m.type} (${m.quantity})`).join(', ')
                            : 'No Manpower'}
                        </h4>
                        <div className="request-meta">
                          <span>{request.createdBy?.name || 'Unknown'} · {request.project?.projectName || ''}</span>
                          <span>{new Date(request.createdAt).toLocaleDateString()}</span>
                          <span className="status-pill">{request.status}</span>
                        </div>
                      </div>
                    </Link>
                  ))
              )}
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="right-sidebar">
          <div className="reports-section">
            <h3>Reports</h3>
            <div className="reports-list">
              {reports.map(report => (
                <div key={report.id} className="report-item">
                  <div className="report-icon">📋</div>
                  <div className="report-details">
                    <div className="report-name">{report.name}</div>
                    <div className="report-date">{report.dateRange}</div>
                    <div className="report-engineer">{report.engineer}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="chats-section">
            <h3>Chats</h3>
            <div className="chats-list">
              {chats.map(chat => (
                <div key={chat.id} className="chat-item">
                  <div className="chat-avatar" style={{ backgroundColor: chat.color }}>{chat.initial}</div>
                  <div className="chat-details">
                    <div className="chat-name">{chat.name}</div>
                    <div className="chat-message">{chat.message}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PmDash;
