import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell } from 'recharts';
import { useNavigate, Link } from 'react-router-dom';
import '../style/am_style/Area_Dash.css';
import api from '../../api/axiosInstance';
import NotificationBell from '../NotificationBell';

const AreaDash = () => {
  const navigate = useNavigate();
  const [userName, setUserName] = useState('');
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [projects, setProjects] = useState([]);
  const [allProjects, setAllProjects] = useState([]);
  const [enrichedAllProjects, setEnrichedAllProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [, setMaterialRequests] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [, setRequestsError] = useState(null);
  const [assignedLocations, setAssignedLocations] = useState([]);
  const [expandedLocations, setExpandedLocations] = useState({});
  const stored = localStorage.getItem('user');
  const user = stored ? JSON.parse(stored) : null;
  const userId = user?._id;
  const [userRole, setUserRole] = useState(user?.role || '');
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
    <div className="area-dash head">
      {/* Header remains the same */}
      <header className="header">
        <div className="logo-container">
          <img src={require('../../assets/images/FadzLogo1.png')} alt="FadzTrack Logo" className="logo-img" />
          <h1 className="brand-name">FadzTrack</h1>
        </div>
        <nav className="nav-menu">
          <Link to="/am" className="nav-link">Dashboard</Link>
          <Link to="/am/chat" className="nav-link">Chat</Link>
          <Link to="/am/matreq" className="nav-link">Material</Link>
          <Link to="/am/manpower-requests" className="nav-link">Manpower</Link>
          <Link to="/am/viewproj" className="nav-link">Projects</Link>
          <Link to="/logs" className="nav-link">Logs</Link>
          <Link to="/am/progress-report/:id" className="nav-link">Reports</Link>
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

      {/* Main Content */}
      <div className="area-dash dashboard-layout">
        {/* Sidebar */}
        <div className="area-dash sidebar">
          <h2>Dashboard</h2>
          <button className="area-dash add-project-btn" onClick={() => navigate('/am/addproj')}>
            Add New Project
          </button>
          <div className="area-dash location-folders">
            {Object.entries(projectsByLocation).map(([locationId, locationData]) => (
              <div key={locationId} className="area-dash location-folder">
                <div className="area-dash location-header" onClick={() => setExpandedLocations(prev => ({ ...prev, [locationId]: !prev[locationId] }))}>
                  <div className="area-dash folder-icon">
                    <span className={`area-dash folder-arrow ${expandedLocations[locationId] ? 'expanded' : ''}`}>▶</span>
                    <span className="area-dash folder-icon-img">📁</span>
                  </div>
                  <div className="area-dash location-info">
                    <div className="area-dash location-name">{locationData.name}</div>
                    <div className="area-dash location-region">{locationData.region}</div>
                  </div>
                  <div className="area-dash project-count">{locationData.projects.length}</div>
                </div>
                {expandedLocations[locationId] && (
                  <div className="area-dash projects-list">
                    {locationData.projects.map(project => (
                      <Link to={`/am/projects/${project._id}`} key={project._id} className="area-dash project-item">
                        <div className="area-dash project-icon">
                          <span className="area-dash icon">🏗️</span>
                          <div className="area-dash icon-bg"></div>
                        </div>
                        <div className="area-dash project-info">
                          <div className="area-dash project-name">{project.name}</div>
                          <div className="area-dash project-engineer">{project.engineer}</div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Main */}
        <div className="area-dash main1">
          <div className="area-dash chart-wrapper-container">
            <div className="area-dash greeting-header">
              <div className="area-dash greeting-left">
                <h1>Hello, {userName}!</h1>
                <p style={{ fontSize: '14px', color: '#666' }}>
                  Currently logged in as <strong>{userRole}</strong>
                </p>
              </div>
              <div className="area-dash total-projects">
                <span className="area-dash total-projects-label">Total Projects:</span>
                <span className="area-dash total-projects-count">{enrichedAllProjects.length}</span>
              </div>
            </div>

            <div className="area-dash progress-tracking-section">
              <h2>Progress Tracking</h2>
              <div className="area-dash latest-projects-progress">
                <h3>Latest Projects Progress</h3>
                {projects.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>
                    No updated projects with progress data yet.
                  </div>
                ) : (
                  <div className="area-dash project-charts scroll-x">
                    {projects.map(project => (
                      <div key={project.id} className="area-dash project-chart-container">
                        <h4>{project.name}</h4>
                        <div className="area-dash pie-chart-wrapper">
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
                        <div className="area-dash chart-legend">
                          {["Completed", "In Progress", "Not Started"].map((status) => {
                            const item = project.progress.find(p => p.name === status);
                            const color = item ? item.color : (status === 'Completed' ? '#4CAF50' : status === 'In Progress' ? '#5E4FDB' : '#FF6B6B');
                            const value = item ? item.value : 0;
                            return (
                              <div key={status} className="area-dash legend-item">
                                <span className="area-dash color-box" style={{ backgroundColor: color }}></span>
                                <span className="area-dash legend-text">{status}</span>
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
          </div>

          <div className="area-dash recent-activities-section">
            <h2>Recent Activities</h2>
            {activities.map(activity => (
              <div key={activity.id} className="area-dash activity-item">
                <div className="area-dash user-initial">{activity.user.initial}</div>
                <div className="area-dash activity-details">
                  <div className="area-dash activity-header">
                    <span className="area-dash user-name">{activity.user.name}</span>
                    <span className="area-dash activity-date">{activity.date}</span>
                  </div>
                  <div className="area-dash activity-description">{activity.activity}</div>
                  <div className="area-dash activity-extra-details">
                    {activity.details.map((detail, index) => (
                      <div key={index} className="area-dash detail-item">{detail}</div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="area-dash right-sidebar">
          <div className="area-dash pending-requests-section">
            <div className="area-dash section-header">
              <h2>Pending Material Requests</h2>
              <Link to="/am/matreq" className="area-dash view-all-btn">View All</Link>
            </div>
            <div className="area-dash pending-requests-list">
              {pendingRequests.length === 0 ? (
                <div className="area-dash no-requests">No pending material requests</div>
              ) : (
                pendingRequests.slice(0, 3).map(request => (
                  <Link to={`/am/material-request/${request._id}`} key={request._id} className="area-dash pending-request-item">
                    <div className="area-dash request-icon">📦</div>
                    <div className="area-dash request-details">
                      <h3 className="area-dash request-title">
                        {request.materials?.map(m => `${m.materialName} (${m.quantity})`).join(', ')}
                      </h3>
                      <p className="area-dash request-description">{request.description}</p>
                      <div className="area-dash request-meta">
                        <span className="area-dash request-project">{request.project?.projectName}</span>
                        <span className="area-dash request-date">
                          Requested: {new Date(request.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="area-dash request-status">
                      <span className="area-dash status-badge pending">Pending AM Approval</span>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>

          <div className="area-dash chats-section">
            <h3>Chats</h3>
            <div className="area-dash chats-list">
              {chats.map(chat => (
                <div key={chat.id} className="area-dash chat-item">
                  <div className="area-dash chat-avatar" style={{ backgroundColor: chat.color }}>{chat.initial}</div>
                  <div className="area-dash chat-details">
                    <div className="area-dash chat-name">{chat.name}</div>
                    <div className="area-dash chat-message">{chat.message}</div>
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

export default AreaDash;
