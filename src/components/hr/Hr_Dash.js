import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../style/hr_style/Hr_Dash.css';

const Hr_Dash = () => {
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [stats, setStats] = useState({
    totalStaff: 21,
    assigned: 18,
    available: 3,
    requests: 5
  });
  const navigate = useNavigate();

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setStats(prevStats => ({
        ...prevStats,
        totalStaff: Math.max(0, prevStats.totalStaff + (Math.random() > 0.7 ? (Math.random() > 0.5 ? 1 : -1) : 0)),
        assigned: Math.max(0, prevStats.assigned + (Math.random() > 0.7 ? (Math.random() > 0.5 ? 1 : -1) : 0)),
        available: Math.max(0, prevStats.available + (Math.random() > 0.7 ? (Math.random() > 0.5 ? 1 : -1) : 0)),
        requests: Math.max(0, prevStats.requests + (Math.random() > 0.7 ? (Math.random() > 0.5 ? 1 : -1) : 0))
      }));
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const handleAction = (action) => {
    if (action.includes('Assign') || action.includes('Review')) {
      alert(`${action} action triggered - Opening assignment interface...`);
    } else if (action.includes('Chat') || action.includes('message')) {
      alert('Opening communication center...');
    } else if (action.includes('Report')) {
      alert('Opening reports dashboard...');
    } else {
      alert(`${action} clicked - Feature coming soon!`);
    }
  };

  const handleProjectClick = (projectName) => {
    alert(`Opening detailed view for ${projectName}...`);
  };

  const projects = [
    {
      name: 'BDC Hotel',
      status: 'In Progress',
      statusClass: 'status-progress',
      staffAssigned: 8,
      dueDate: 'Dec 15',
      capacity: 85
    },
    {
      name: 'Stonehouse Gateway',
      status: 'Planning',
      statusClass: 'status-planning',
      staffAssigned: 6,
      dueDate: 'Jan 30',
      capacity: 60
    },
    {
      name: 'Freemont Place',
      status: 'Active',
      statusClass: 'status-active',
      staffAssigned: 4,
      dueDate: 'Feb 20',
      capacity: 40
    }
  ];

  const requests = [
    {
      title: '3x Electricians for BDC Hotel',
      requester: 'Jane Cooper',
      time: '2 hours ago',
      status: 'Urgent',
      statusClass: 'status-urgent'
    },
    {
      title: '2x Laborers for Stonehouse',
      requester: 'Ronald Richards',
      time: '5 hours ago',
      status: 'Pending',
      statusClass: 'status-pending'
    },
    {
      title: '1x Foreman for Freemont',
      requester: 'Floyd Miles',
      time: '1 day ago',
      status: 'Approved',
      statusClass: 'status-approved'
    },
    {
      title: '2x Plumbers for BDC Hotel',
      requester: 'Jerome Bell',
      time: '2 days ago',
      status: 'Pending',
      statusClass: 'status-pending'
    }
  ];

  const activities = [
    {
      icon: '👥',
      iconClass: 'icon-assignment',
      title: 'Jacob Jones assigned to BDC Hotel',
      time: '15 minutes ago'
    },
    {
      icon: '📋',
      iconClass: 'icon-request',
      title: 'New manpower request from Stonehouse Gateway',
      time: '1 hour ago'
    },
    {
      icon: '📊',
      iconClass: 'icon-report',
      title: 'Daily log submitted by Freemont Place',
      time: '3 hours ago'
    },
    {
      icon: '👤',
      iconClass: 'icon-assignment',
      title: 'Kristin Watson reassigned to Stonehouse',
      time: '5 hours ago'
    }
  ];

  const communications = [
    {
      icon: '💬',
      title: '5 unread messages from Jane Cooper',
      subtitle: 'BDC Hotel updates'
    },
    {
      icon: '📁',
      title: 'New files shared by Ronald Richards',
      subtitle: 'Stonehouse blueprints'
    },
    {
      icon: '✅',
      title: 'Daily report approved for Freemont',
      subtitle: 'Floyd Miles'
    }
  ];

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
    <div className="hr-dashboard">
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
          <Link to="/hr/dash" className="nav-link">Dashboard</Link>
          <Link to="/requests" className="nav-link">Movement</Link>
          <Link to="/ceo/proj" className="nav-link">Projects</Link>
          <Link to="/chat" className="nav-link">Chat</Link>
          <Link to="/logs" className="nav-link">Logs</Link>
          <Link to="/hr/mlist" className="nav-link">Manpower</Link>
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

      <div className="dashboard-container">
        {/* Welcome Header */}
        <div className="welcome-header">
          <div className="welcome-text">
            <h1>Good Morning, ALECK!</h1>
            <p>Here's your workforce overview for today</p>
          </div>
          <div className="quick-stats">
            <div className="stat-card">
              <span className="stat-number">{stats.totalStaff}</span>
              <span className="stat-label">Total Staff</span>
            </div>
            <div className="stat-card">
              <span className="stat-number">{stats.assigned}</span>
              <span className="stat-label">Assigned</span>
            </div>
            <div className="stat-card">
              <span className="stat-number">{stats.available}</span>
              <span className="stat-label">Available</span>
            </div>
            <div className="stat-card">
              <span className="stat-number">{stats.requests}</span>
              <span className="stat-label">Requests</span>
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-value">85%</div>
            <div className="metric-label">Workforce Utilization</div>
            <div className="metric-change change-positive">+5% from last week</div>
          </div>
          <div className="metric-card">
            <div className="metric-value">3</div>
            <div className="metric-label">Active Projects</div>
            <div className="metric-change change-positive">+1 new project</div>
          </div>
          <div className="metric-card">
            <div className="metric-value">12</div>
            <div className="metric-label">Pending Requests</div>
            <div className="metric-change change-positive">-3 from yesterday</div>
          </div>
          <div className="metric-card">
            <div className="metric-value">92%</div>
            <div className="metric-label">Request Approval Rate</div>
            <div className="metric-change change-positive">+8% improvement</div>
          </div>
        </div>

        {/* Critical Alerts */}
        <div className="card alerts-section">
          <div className="card-header">
            <h3 className="card-title alert-title">⚠️ Critical Alerts</h3>
            <button className="card-action alert-action-btn" onClick={() => handleAction('View All')}>
              View All
            </button>
          </div>
          <div className="card-content">
            <div className="alert-item">
              <span className="alert-icon">⏰</span>
              <span className="alert-text">
                <strong>Urgent Request:</strong> 3 electricians needed for BDC Hotel by tomorrow
              </span>
              <button className="alert-action" onClick={() => handleAction('Review')}>
                Review
              </button>
            </div>
            <div className="alert-item">
              <span className="alert-icon">🚨</span>
              <span className="alert-text">
                <strong>High Priority:</strong> 2 foremen requested for Stonehouse Gateway - immediate assignment needed
              </span>
              <button className="alert-action" onClick={() => handleAction('Assign Now')}>
                Assign Now
              </button>
            </div>
          </div>
        </div>

        {/* Main Dashboard Grid */}
        <div className="dashboard-grid">
          {/* Project Assignment Overview */}
          <div className="card project-overview">
            <div className="card-header">
              <h3 className="card-title">Project Assignment Overview</h3>
              <button className="card-action" onClick={() => handleAction('Manage All')}>
                Manage All
              </button>
            </div>
            <div className="card-content">
              <div className="project-mini-cards">
                {projects.map((project, index) => (
                  <div 
                    key={index}
                    className="mini-project-card"
                    onClick={() => handleProjectClick(project.name)}
                  >
                    <div className="project-header">
                      <span className="project-name">{project.name}</span>
                      <span className={`project-status ${project.statusClass}`}>
                        {project.status}
                      </span>
                    </div>
                    <div className="project-metrics">
                      <span>{project.staffAssigned} Staff Assigned</span>
                      <span>Due: {project.dueDate}</span>
                    </div>
                    <div className="capacity-bar">
                      <div 
                        className="capacity-fill" 
                        style={{ width: `${project.capacity}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Manpower Requests */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Manpower Requests</h3>
              <button className="card-action" onClick={() => handleAction('View All')}>
                View All
              </button>
            </div>
            <div className="card-content">
              <div className="manpower-requests">
                {requests.map((request, index) => (
                  <div key={index} className="request-item">
                    <div className="request-info">
                      <h4>{request.title}</h4>
                      <p>Requested by {request.requester} • {request.time}</p>
                    </div>
                    <span className={`request-status ${request.statusClass}`}>
                      {request.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Recent Activity</h3>
              <button className="card-action" onClick={() => handleAction('View Timeline')}>
                View Timeline
              </button>
            </div>
            <div className="card-content">
              <div className="activity-feed">
                {activities.map((activity, index) => (
                  <div key={index} className="activity-item">
                    <div className={`activity-icon ${activity.iconClass}`}>
                      {activity.icon}
                    </div>
                    <div className="activity-content">
                      <div className="activity-title">{activity.title}</div>
                      <div className="activity-time">{activity.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Communication Center */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Communication Center</h3>
              <button className="card-action" onClick={() => handleAction('Open Chat')}>
                Open Chat
              </button>
            </div>
            <div className="card-content">
              <div className="activity-feed">
                {communications.map((comm, index) => (
                  <div key={index} className="activity-item">
                    <div className="activity-icon comm-icon">
                      {comm.icon}
                    </div>
                    <div className="activity-content">
                      <div className="activity-title">{comm.title}</div>
                      <div className="activity-time">{comm.subtitle}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Hr_Dash;