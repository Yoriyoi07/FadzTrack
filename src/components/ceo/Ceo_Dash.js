import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell } from 'recharts';
import { useNavigate, Link } from 'react-router-dom';
import '../style/ceo_style/Ceo_Dash.css';
import api from '../../api/axiosInstance';

const Ceo_Dash = () => {
  const navigate = useNavigate();
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState('');
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  const [sidebarProjects, setSidebarProjects] = useState([
    { id: 1, name: 'Batangas', engineer: 'Engr. Daryll Miralles' },
    { id: 2, name: 'Twin Lakes Project', engineer: 'Engr. Shaquille' },
    { id: 3, name: 'Calatagan Townhomes', engineer: 'Engr. Rychea Miralles' },
    { id: 4, name: 'Makati', engineer: 'Engr. Michelle Amor' },
    { id: 5, name: 'Cavite', engineer: 'Engr. Zenarose Miranda' },
    { id: 6, name: 'Taguig', engineer: 'Engr. Third Castellar' }
  ]);

  const [activities, setActivities] = useState([]);

  const [reports, setReports] = useState([
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

  const [chats, setChats] = useState([
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
    const fetchUserData = async () => {
      try {
        const stored = localStorage.getItem('user');
        const user = stored ? JSON.parse(stored) : null;
        if (user) {
          setUserName(user.name);
          setUserRole(user.role);
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };

    const fetchProjects = async () => {
      try {
        const { data: projectsData } = await api.get('/projects');
        // Fetch progress and latest update for each project
        const projectsWithProgress = await Promise.all(
          projectsData.map(async (project) => {
            try {
              const { data: progressData } = await api.get(`/daily-reports/project/${project._id}/progress`);
              // Fetch latest daily report for sorting
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
                latestDate
              };
            } catch (error) {
              return null; // skip if error
            }
          })
        );
        // Filter out projects with no progress or no daily log
        const filtered = projectsWithProgress.filter(
          p => p && p.progress && Array.isArray(p.progress) && p.progress[0].name !== 'No Data' && p.latestDate
        );
        // Sort by latest update (descending)
        filtered.sort((a, b) => new Date(b.latestDate) - new Date(a.latestDate));
        setProjects(filtered);
      } catch (error) {
        console.error('Error fetching projects:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
    fetchProjects();
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

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const { data } = await api.get("/audit-logs");
        const sliced = data.slice(0, 3).map((log, i) => ({
          id: i,
          user: {
            name: log.performedBy?.name || "Unknown",
            initial: (log.performedBy?.name || "U")[0]
          },
          date: new Date(log.timestamp).toLocaleString(),
          activity: `${log.action} - ${log.description}`,
          details: log.meta ? Object.entries(log.meta).map(([key, val]) => `${key}: ${val}`) : []
        }));
        setActivities(sliced);
      } catch (err) {
        console.error("Failed to fetch logs", err);
      }
    };
    fetchLogs();
  }, []);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading dashboard data...</p>
      </div>
    );
  }

  return (
    <div className="head">
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
          <Link to="/ceo/audit-logs" className="nav-link">Audit Logs</Link>
          <Link to="/reports" className="nav-link">Reports</Link>
        </nav>
        <div className="profile-menu-container">
          <div className="profile-circle" onClick={() => setProfileMenuOpen(!profileMenuOpen)}>Z</div>
          {profileMenuOpen && (
            <div className="profile-menu">
              <button onClick={handleLogout}>Logout</button>
            </div>
          )}
        </div>
      </header>

      <div className="dashboard-layout">
        <div className="sidebar">
          <h2>Dashboard</h2>
          <button className="add-project-btn" onClick={() => navigate('/ceo/addarea')}>Add New Area</button>
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
            <p className="logged-in-role">Currently logged in as: {userRole}</p>
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
                            // Always show all statuses, even if value is 0
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
          </div>

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

export default Ceo_Dash;
