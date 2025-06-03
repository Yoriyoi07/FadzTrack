import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell } from 'recharts';
import { useNavigate, Link } from 'react-router-dom';
import '../style/ceo_style/Ceo_Dash.css';
import api from '../../api/axiosInstance';

const Area_Dash = () => {
  const navigate = useNavigate();
  const [userName, setUserName] = useState('');
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [projects, setProjects] = useState([]);
  const [allProjects, setAllProjects] = useState([]);
  const [enrichedAllProjects, setEnrichedAllProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [materialRequests, setMaterialRequests] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [requestsError, setRequestsError] = useState(null);
  const [assignedLocations, setAssignedLocations] = useState([]);
  const [expandedLocations, setExpandedLocations] = useState({});
  const stored = localStorage.getItem('user');
  const user = stored ? JSON.parse(stored) : null;
  const userId = user?._id;

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    setUserName(user.name);

    const fetchAssignedLocations = async () => {
      try {
        const { data } = await api.get(`/users/${userId}/locations`);
        setAssignedLocations(data);
      } catch (err) {
        setAssignedLocations([]);
      }
    };

    const fetchProjects = async () => {
      try {
        const { data: projectsData } = await api.get('/projects');
        setAllProjects(projectsData);
        const userProjects = projectsData.filter(project =>
          assignedLocations.some(loc => loc._id === (project.location?._id || project.location))
        );
        const projectsWithProgress = await Promise.all(
          userProjects.map(async (project) => {
            try {
              const { data: progressData } = await api.get(`/daily-reports/project/${project._id}/progress`);
              const { data: reports } = await api.get(`/daily-reports/project/${project._id}`);
              let latestDate = null;
              if (Array.isArray(reports) && reports.length > 0) {
                latestDate = reports[reports.length - 1].date || null;
              }
              return {
                id: project._id,
                name: project.projectName,
                engineer: project.projectmanager?.name || 'Not Assigned',
                progress: progressData.progress,
                latestDate,
                location: project.location
              };
            } catch (error) {
              return null;
            }
          })
        );
        const filtered = projectsWithProgress.filter(
          p => p && p.progress && Array.isArray(p.progress) && p.progress[0].name !== 'No Data' && p.latestDate
        );
        filtered.sort((a, b) => new Date(b.latestDate) - new Date(a.latestDate));
        setProjects(filtered);
      } catch (error) {
        console.error('Error fetching projects:', error);
      } finally {
        setLoading(false);
      }
    };

    const fetchRequests = async () => {
      try {
        const { data } = await api.get('/requests');
        const pending = data.filter(request =>
          request.status === 'Pending AM' &&
          request.project && assignedLocations.some(loc => loc._id === (request.project.location?._id || request.project.location))
        );
        setPendingRequests(pending);
        setMaterialRequests(data);
        setRequestsError(null);
      } catch (error) {
        if (error.response && error.response.status === 401) {
          setRequestsError('Session expired. Please log in again.');
        } else {
          setRequestsError('Error loading material requests');
        }
      }
    };

    fetchAssignedLocations().then(() => {
      fetchProjects();
      fetchRequests();
    });
  }, [navigate, user, userId]);

  useEffect(() => {
    if (assignedLocations.length && allProjects.length) {
      setEnrichedAllProjects(
        allProjects
          .filter(project => assignedLocations.some(loc => loc._id === (project.location?._id || project.location)))
          .map(project => {
            const loc = assignedLocations.find(l => l._id === (project.location?._id || project.location));
            return {
              ...project,
              location: loc ? { ...loc } : { name: 'Unknown Location', region: '' },
              name: project.projectName,
              engineer: project.projectmanager?.name || 'Not Assigned',
            };
          })
      );
    }
  }, [assignedLocations, allProjects]);

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

  // Reports data
  const [reports] = useState([
    {
      id: 1,
      name: 'BGC Hotel',
      dateRange: '7/13/25 - 7/27/25',
      engineer: 'Engr.'
    },
    {
      id: 2,
      name: 'Protacio Townhomes',
      dateRange: '7/13/25 - 7/27/25',
      engineer: 'Engr.'
    },
    {
      id: 3,
      name: 'Fegarido Residences',
      dateRange: '7/13/25 - 7/27/25',
      engineer: 'Engr.'
    }
  ]);

  // Chats data
  const [chats] = useState([
    {
      id: 1,
      name: 'Rychea Miralles',
      initial: 'R',
      message: 'Hello Good Morning po! As...',
      color: '#4A6AA5'
    },
    {
      id: 2,
      name: 'Third Castellar',
      initial: 'T',
      message: 'Hello Good Morning po! As...',
      color: '#2E7D32'
    },
    {
      id: 3,
      name: 'Zenarose Miranda',
      initial: 'Z',
      message: 'Hello Good Morning po! As...',
      color: '#9C27B0'
    }
  ]);

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

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading dashboard data...</p>
      </div>
    );
  }

  const projectsByLocation = enrichedAllProjects.reduce((acc, project) => {
    const locationId = project.location?._id || 'unknown';
    if (!acc[locationId]) {
      acc[locationId] = {
        name: project.location?.name || 'Unknown Location',
        region: project.location?.region || '',
        projects: []
      };
    }
    acc[locationId].projects.push(project);
    return acc;
  }, {});

  return (
    <div className="head">
      {/* Header with Navigation */}
      <header className="header">
        <div className="logo-container">
          <img src={require('../../assets/images/FadzLogo1.png')} alt="FadzTrack Logo" className="logo-img" />
          <h1 className="brand-name">FadzTrack</h1>
        </div>
        <nav className="nav-menu">
          <Link to="/am" className="nav-link">Dashboard</Link>
          <Link to="/am/matreq" className="nav-link">Material</Link>
          <Link to="/am/manpower-requests" className="nav-link">Manpower</Link>
          <Link to="/am/projects" className="nav-link">Projects</Link>
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

      {/* Main Content */}
      <div className="dashboard-layout">
        {/* Left Sidebar */}
        <div className="sidebar">
          <h2>Dashboard</h2>
          <button
            className="add-project-btn"
            onClick={() => navigate('/am/addproj')}
          >
            Add New Project
          </button>
          <div className="location-folders">
            {Object.entries(projectsByLocation).map(([locationId, locationData]) => (
              <div key={locationId} className="location-folder">
                <div 
                  className="location-header" 
                  onClick={() => setExpandedLocations(prev => ({ ...prev, [locationId]: !prev[locationId] }))}
                >
                  <div className="folder-icon">
                    <span className={`folder-arrow ${expandedLocations[locationId] ? 'expanded' : ''}`}>▶</span>
                    <span className="folder-icon-img">📁</span>
                  </div>
                  <div className="location-info">
                    <div className="location-name">{locationData.name}</div>
                    <div className="location-region">{locationData.region}</div>
                  </div>
                  <div className="project-count">{locationData.projects.length}</div>
                </div>
                {expandedLocations[locationId] && (
                  <div className="projects-list">
                    {locationData.projects.map(project => (
                      <Link 
                        to={`/am/projects/${project._id}`} 
                        key={project._id} 
                        className="project-item"
                      >
                        <div className="project-icon">
                          <span className="icon">🏗️</span>
                          <div className="icon-bg"></div>
                        </div>
                        <div className="project-info">
                          <div className="project-name">{project.name}</div>
                          <div className="project-engineer">{project.engineer}</div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Center Content */}
        <div className="main1">
          <div className="greeting-header">
            <div className="greeting-left">
              <h1>Good Morning, {userName}!</h1>
            </div>
            <div className="total-projects">
              <span className="total-projects-label">Total Projects:</span>
              <span className="total-projects-count">{enrichedAllProjects.length}</span>
            </div>
          </div>
          <div className="progress-tracking-section">
            <h2>Progress Tracking</h2>
            <div className="latest-projects-progress">
              <h3>Latest Projects Progress</h3>
              {projects.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>
                  No updated projects with progress data yet.
                </div>
              ) : (
                <div className="project-charts scroll-x">
                  {projects.map(project => (
                    <div key={project.id} className="project-chart-container">
                      <h4>{project.name}</h4>
                      <div className="pie-chart-wrapper">
                        <PieChart width={160} height={160}>
                          <Pie
                            data={project.progress}
                            cx={80}
                            cy={80}
                            innerRadius={0}
                            outerRadius={65}
                            paddingAngle={0}
                            dataKey="value"
                          >
                            {project.progress.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                        </PieChart>
                      </div>
                      <div className="chart-legend">
                        {["Completed", "In Progress", "Not Started"].map((status, index) => {
                          const item = project.progress.find(p => p.name === status);
                          const color = item ? item.color : (status === 'Completed' ? '#4CAF50' : status === 'In Progress' ? '#5E4FDB' : '#FF6B6B');
                          const value = item ? item.value : 0;
                          return (
                            <div key={status} className="legend-item">
                              <span className="color-box" style={{ backgroundColor: color }}></span>
                              <span className="legend-text">{status}</span>
                              <span style={{ marginLeft: 6, color: '#555', fontWeight: 500 }}>
                                {value.toFixed(1)}%
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#888', marginTop: 4 }}>
                        Last updated: {project.latestDate ? new Date(project.latestDate).toLocaleString() : 'N/A'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recent Activities section moved below progress tracking */}
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
          <div className="pending-requests-section">
            <div className="section-header">
              <h2>Pending Material Requests</h2>
              <Link to="/am/matreq" className="view-all-btn">View All</Link>
            </div>
            <div className="pending-requests-list">
              {pendingRequests.length === 0 ? (
                <div className="no-requests">No pending material requests</div>
              ) : (
                pendingRequests.slice(0, 3).map(request => (
                  <Link to={`/am/material-request/${request._id}`} key={request._id} className="pending-request-item">
                    <div className="request-icon">📦</div>
                    <div className="request-details">
                      <h3 className="request-title">
                        {request.materials?.map(m => `${m.materialName} (${m.quantity})`).join(', ')}
                      </h3>
                      <p className="request-description">{request.description}</p>
                      <div className="request-meta">
                        <span className="request-project">{request.project?.projectName}</span>
                        <span className="request-date">
                          Requested: {new Date(request.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="request-status">
                      <span className="status-badge pending">Pending AM Approval</span>
                    </div>
                  </Link>
                ))
              )}
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

export default Area_Dash;
