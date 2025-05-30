import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import '../style/pm_style/Pm_Dash.css';

const PmDash = () => {

  const token = localStorage.getItem('token');
  const stored = localStorage.getItem('user');
  const user = stored ? JSON.parse(stored) : null;
  const userId = user?._id;


  const [userName, setUserName] = useState('ALECK');
  const [projects, setProjects] = useState([]);
  const [project, setProject] = useState(null);
  const navigate = useNavigate();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  useEffect(() => {
  if (!token || !user) {
    navigate('/');
    return;
  }
  setUserName(user.name); 
}, [navigate, token, user]);


useEffect(() => {
  if (!token || !user) return;
  const fetchProjects = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/projects', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      console.log('Fetched projects:', data); 
      // Filter for projects where this user is the Project Manager
      const filtered = data.filter(
  (p) => p.projectManager && (
    (typeof p.projectManager === 'object' && (p.projectManager._id === userId || p.projectManager.id === userId)) ||
    p.projectManager === userId // in case it's just an ID string
  )
);
      console.log('Filtered projects:', filtered); 
      setProjects(filtered);
    } catch (err) {
      console.error('Failed to fetch projects:', err);
    }
  };
  fetchProjects();
}, [token, user, userId]);



  useEffect(() => {
  if (!token || !userId) return;
  const fetchAssigned = async () => {
    try {
      const res = await fetch(
        `http://localhost:5000/api/projects/assigned/${userId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      console.log('Assigned project from API:', data);
      setProject(data[0] || null);
    } catch (err) {
      console.error('Failed to fetch assigned project:', err);
      setProject(null);
    }
  };
  fetchAssigned();
}, [token, userId]);

  



  // Sidebar Projects, Activities, Reports, and Chats remain static or can be dynamic
  const [sidebarProjects] = useState([
    { id: 1, name: 'Batangas', engineer: 'Engr. Daryll Miralles' },
    { id: 2, name: 'Twin Lakes Project', engineer: 'Engr. Shaquille' },
    { id: 3, name: 'Calatagan Townhomes', engineer: 'Engr. Rychea Miralles' },
    { id: 4, name: 'Makati', engineer: 'Engr. Michelle Amor' },
    { id: 5, name: 'Cavite', engineer: 'Engr. Zenarose Miranda' },
    { id: 6, name: 'Taguig', engineer: 'Engr. Third Castellar' }
  ]);
  const [activities] = useState([
    {
      id: 1,
      user: { name: 'Daniel Pocon', initial: 'D' },
      date: 'July 1, 2029',
      activity: 'Submitted Daily Logs for San Miguel Corporation Project B',
      details: [
        'Weather: Cloudy in AM, Light Rain in PM ☁️',
        '1. 📊 Site Attendance Log',
        'Total Workers: 16',
        'Trades on Site...'
      ]
    }
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

  // --- DYNAMIC: Material Requests ---
  const [materialRequests, setMaterialRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [requestsError, setRequestsError] = useState(null);

  useEffect(() => {
    const fetchRequests = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setRequestsError('Session expired. Please log in again.');
        setLoadingRequests(false);
        return;
      }
      try {
        const res = await fetch('http://localhost:5000/api/requests/mine', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to fetch requests');
        const data = await res.json();
        setMaterialRequests(data);
        setRequestsError(null);
      } catch (error) {
        setRequestsError('Error loading material requests');
      }
      setLoadingRequests(false);
    };
    fetchRequests();
  }, []);

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

  return (
    <div className="head">
      {/* Header with Navigation */}
      <header className="header">
        <div className="logo-container">
          <div className="logo">
            <div className="logo-building"></div>
            <div className="logo-flag"></div>
          </div>
          <h1 className="brand-name">FadzTrack</h1>
        </div>
        <nav className="nav-menu">
          <Link to="/pm" className="nav-link">Dashboard</Link>
          <Link to="/pm/request/:id" className="nav-link">Requests</Link>
          {projects.length > 0 && (
          <Link to={`/pm/viewprojects/${projects[0].id || projects[0]._id}`} className="nav-link">View Project</Link>)}
          <Link to="/chat" className="nav-link">Chat</Link>
          <Link to="/logs" className="nav-link">Logs</Link>
          <Link to="/reports" className="nav-link">Reports</Link>
        </nav>
        <div className="search-profile">
          <div className="search-container">
            <input type="text" placeholder="Search in site" className="search-input" />
            <button className="search-button">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </button>
          </div>
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
        </div>
      </header>

      {/* Main Content */}
      <div className="dashboard-layout">
        {/* Left Sidebar */}
        <div className="sidebar">
          <h2>Dashboard</h2>
          <button 
            className="add-project-btn" 
            onClick={() => navigate('/ceo/addproj')}
          >
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

        {/* Center Content */}
        <div className="main1">
          <div className="greeting-section">
            <h1>Good Morning, {userName}!</h1>

            {/* Material Request Section - Dynamic */}
            <div className="material-request-section">
              <div className="section-header">
                <h2>Material Request</h2>
                <button 
                className="view-all-btn"
                onClick={() => navigate('/pm/request/:id')}
              >
                View All Requests
              </button>
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
                    <Link
                      to={`/requests/${request._id}`}
                      key={request._id}
                      className="material-request-item"
                      style={{ textDecoration: 'none', color: 'inherit' }}
                    >
                      <div className="requester-initial">
                        {request.createdBy?.name
                          ? request.createdBy.name.charAt(0)
                          : 'U'}
                      </div>
                      <div className="request-details">
                        <h4>
                          {request.materials && request.materials.length > 0
                            ? request.materials.map(m => `${m.materialName} (${m.quantity})`).join(', ')
                            : 'No Materials'}
                        </h4>
                        <div className="request-meta">
                          <span>
                            {request.createdBy?.name || 'Unknown'}
                            {request.project?.projectName ? ` · ${request.project.projectName}` : ''}
                          </span>
                          <span>
                            {new Date(request.createdAt).toLocaleDateString()}
                          </span>
                          <span style={{
                            background: '#e3e6f0',
                            color: '#0056b3',
                            padding: '2px 8px',
                            borderRadius: '8px',
                            fontSize: '0.85em',
                            marginLeft: 8
                          }}>{request.status}</span>
                        </div>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Recent Activities */}
          <div className="recent-activities-section">
            <h2>Recent Activities</h2>
            {activities.map(activity => (
              <div key={activity.id} className="activity-item">
                <div className="user-initial">{activity.user.initial}</div>
                <div className="activity-details">
                  <div className="activity-header">
                    <span className="user-name">{activity.user.name}</span>
                    <span className="activity-date">{activity.date}</span>
                  </div>
                  <div className="activity-description">{activity.activity}</div>
                  <div className="activity-extra-details">
                    {activity.details.map((detail, index) => (
                      <div key={index} className="detail-item">{detail}</div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
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
