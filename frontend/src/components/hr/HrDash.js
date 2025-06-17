import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api/axiosInstance';
import '../style/hr_style/Hr_Dash.css';

const HrDash = () => {

  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('token') || "");
  const [userId, setUserId] = useState(() => user?._id);

  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState('');
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [auditActivities, setAuditActivities] = useState([]);
  const [stats, setStats] = useState({
    totalStaff: 21,
    assigned: 18,
    available: 3,
    requests: 5
  });
  const navigate = useNavigate();
  
  useEffect(() => {
      setUserName(user?.name || '');
      setUserRole(user?.role || '');
    }, [user]);

  useEffect(() => {
    const fetchData = async () => {
      try {
       const [manpowerRes, movementRes] = await Promise.all([
            api.get('/manpower'),
            api.get('/manpower-requests')
          ]);

          const manpower = manpowerRes.data;
          const movements = movementRes.data;


        const totalStaff = manpower.length;
        const assigned = manpower.filter(mp => mp.status === 'Active').length;
        const available = manpower.filter(mp => mp.status === 'Inactive').length;
        const requests = movements.filter(mv => mv.status === 'Approved').length;

        setStats({ totalStaff, assigned, available, requests });
      } catch (error) {
        console.error('Failed to fetch HR stats:', error);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
  const fetchAuditLogs = async () => {
    try {

      const { data } = await api.get('/audit-logs'); 
      const mapped = data.slice(0, 6).map((log, i) => ({
        id: `audit-${i}`,
        icon: '📝', // Or use something from log.action if you want
        iconClass: 'hr-dash-icon-audit',
        title: `${log.action} - ${log.description || ''}`,
        time: new Date(log.timestamp).toLocaleString(),
      }));
      setAuditActivities(mapped);
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
    }
  };
  fetchAuditLogs();
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
      statusClass: 'hr-dash-status-progress',
      staffAssigned: 8,
      dueDate: 'Dec 15',
      capacity: 85
    },
    {
      name: 'Stonehouse Gateway',
      status: 'Planning',
      statusClass: 'hr-dash-status-planning',
      staffAssigned: 6,
      dueDate: 'Jan 30',
      capacity: 60
    },
    {
      name: 'Freemont Place',
      status: 'Active',
      statusClass: 'hr-dash-status-active',
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
      statusClass: 'hr-dash-status-urgent'
    },
    {
      title: '2x Laborers for Stonehouse',
      requester: 'Ronald Richards',
      time: '5 hours ago',
      status: 'Pending',
      statusClass: 'hr-dash-status-pending'
    },
    {
      title: '1x Foreman for Freemont',
      requester: 'Floyd Miles',
      time: '1 day ago',
      status: 'Approved',
      statusClass: 'hr-dash-status-approved'
    },
    {
      title: '2x Plumbers for BDC Hotel',
      requester: 'Jerome Bell',
      time: '2 days ago',
      status: 'Pending',
      statusClass: 'hr-dash-status-pending'
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
      if (!event.target.closest('.profile-menu-container')) setProfileMenuOpen(false);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  return (
    <div className="hr-dash-container">
     <header className="header">
        <div className="logo-container">
          <img src={require('../../assets/images/FadzLogo1.png')} alt="FadzTrack Logo" className="logo-img" />
          <h1 className="brand-name">FadzTrack</h1>
        </div>
          <nav className="nav-menu">
            <Link to="/hr/dash" className="nav-link">Dashboard</Link>
            <Link to="/hr/chat" className="nav-link">Chat</Link>
            <Link to="/hr/mlist" className="nav-link">Manpower</Link>
            <Link to="/hr/movement" className="nav-link">Movement</Link>
            <Link to="/hr/project-records" className="nav-link">Projects</Link>
            <Link to="/logs" className="nav-link">Logs</Link>
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

      <div className="hr-dash-dashboard-container">
        {/* Welcome Header */}
        <div className="hr-dash-welcome-header">
          <div className="hr-dash-welcome-text">
            <h1>Hello, {userName}</h1>
              <p style={{ fontSize: '14px', color: '#666' }}>
                Currently logged in as <strong>{userRole}</strong>
              </p>
          </div>
          <div className="hr-dash-quick-stats">
            <div className="hr-dash-stat-card">
              <span className="hr-dash-stat-number">{stats.totalStaff}</span>
              <span className="hr-dash-stat-label">Total Staff</span>
            </div>
            <div className="hr-dash-stat-card">
              <span className="hr-dash-stat-number">{stats.assigned}</span>
              <span className="hr-dash-stat-label">Assigned</span>
            </div>
            <div className="hr-dash-stat-card">
              <span className="hr-dash-stat-number">{stats.available}</span>
              <span className="hr-dash-stat-label">Unassigned</span>
            </div>
            <div className="hr-dash-stat-card">
              <span className="hr-dash-stat-number">{stats.requests}</span>
              <span className="hr-dash-stat-label">Requests</span>
            </div>
          </div>
        </div>

        {/* Key Metrics
        <div className="hr-dash-metrics-grid">
          <div className="hr-dash-metric-card">
            <div className="hr-dash-metric-value">85%</div>
            <div className="hr-dash-metric-label">Workforce Utilization</div>
            <div className="hr-dash-metric-change hr-dash-change-positive">+5% from last week</div>
          </div>
          <div className="hr-dash-metric-card">
            <div className="hr-dash-metric-value">3</div>
            <div className="hr-dash-metric-label">Active Projects</div>
            <div className="hr-dash-metric-change hr-dash-change-positive">+1 new project</div>
          </div>
          <div className="hr-dash-metric-card">
            <div className="hr-dash-metric-value">12</div>
            <div className="hr-dash-metric-label">Pending Requests</div>
            <div className="hr-dash-metric-change hr-dash-change-positive">-3 from yesterday</div>
          </div>
          <div className="hr-dash-metric-card">
            <div className="hr-dash-metric-value">92%</div>
            <div className="hr-dash-metric-label">Request Approval Rate</div>
            <div className="hr-dash-metric-change hr-dash-change-positive">+8% improvement</div>
          </div>
        </div> */}

        {/* Critical Alerts */}
        {/* 
        <div className="hr-dash-card hr-dash-alerts-section">
          <div className="hr-dash-card-header">
            <h3 className="hr-dash-card-title hr-dash-alert-title">⚠️ Critical Alerts</h3>
            <button className="hr-dash-card-action hr-dash-alert-action-btn" onClick={() => handleAction('View All')}>
              View All
            </button>
          </div>
          <div className="hr-dash-card-content">
            <div className="hr-dash-alert-item">
              <span className="hr-dash-alert-icon">⏰</span>
              <span className="hr-dash-alert-text">
                <strong>Urgent Request:</strong> 3 electricians needed for BDC Hotel by tomorrow
              </span>
              <button className="hr-dash-alert-action" onClick={() => handleAction('Review')}>
                Review
              </button>
            </div>
            <div className="hr-dash-alert-item">
              <span className="hr-dash-alert-icon">🚨</span>
              <span className="hr-dash-alert-text">
                <strong>High Priority:</strong> 2 foremen requested for Stonehouse Gateway - immediate assignment needed
              </span>
              <button className="hr-dash-alert-action" onClick={() => handleAction('Assign Now')}>
                Assign Now
              </button>
            </div>
          </div>
        </div>
        */}
        {/* Main Dashboard Grid */}
        <div className="hr-dash-dashboard-grid">
          {/* Project Assignment Overview */}
          {/* <div className="hr-dash-card hr-dash-project-overview">
            <div className="hr-dash-card-header">
              <h3 className="hr-dash-card-title">Project Assignment Overview</h3>
              <button className="hr-dash-card-action" onClick={() => handleAction('Manage All')}>
                Manage All
              </button>
            </div>
            <div className="hr-dash-card-content">
              <div className="hr-dash-project-mini-cards">
                {projects.map((project, index) => (
                  <div 
                    key={index}
                    className="hr-dash-mini-project-card"
                    onClick={() => handleProjectClick(project.name)}
                  >
                    <div className="hr-dash-project-header">
                      <span className="hr-dash-project-name">{project.name}</span>
                      <span className={`hr-dash-project-status ${project.statusClass}`}>
                        {project.status}
                      </span>
                    </div>
                    <div className="hr-dash-project-metrics">
                      <span>{project.staffAssigned} Staff Assigned</span>
                      <span>Due: {project.dueDate}</span>
                    </div>
                    <div className="hr-dash-capacity-bar">
                      <div 
                        className="hr-dash-capacity-fill" 
                        style={{ width: `${project.capacity}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div> */}

          {/* Manpower Requests */}
          <div className="hr-dash-card">
            <div className="hr-dash-card-header">
              <h3 className="hr-dash-card-title">Manpower Requests</h3>
              <button className="hr-dash-card-action" onClick={() => handleAction('View All')}>
                View All
              </button>
            </div>
            <div className="hr-dash-card-content">
              <div className="hr-dash-manpower-requests">
                {requests.map((request, index) => (
                  <div key={index} className="hr-dash-request-item">
                    <div className="hr-dash-request-info">
                      <h4>{request.title}</h4>
                      <p>Requested by {request.requester} • {request.time}</p>
                    </div>
                    <span className={`hr-dash-request-status ${request.statusClass}`}>
                      {request.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>


        <div className="hr-dash-card">
  <div className="hr-dash-card-header">
    <h3 className="hr-dash-card-title">Recent Activity</h3>
    <button className="hr-dash-card-action" onClick={() => handleAction('View Timeline')}>
      View Timeline
    </button>
  </div>
  <div className="hr-dash-card-content">
    <div className="hr-dash-activity-feed">
      {auditActivities.length === 0 ? (
        <div style={{ padding: "2rem", color: "#aaa", textAlign: "center" }}>
          No recent activities.
        </div>
      ) : (
        auditActivities.map((activity, index) => (
          <div key={activity.id || index} className="hr-dash-activity-item">
            <div className={`hr-dash-activity-icon ${activity.iconClass || ''}`}>
              {activity.user?.initial || activity.icon || '📝'}
            </div>
            <div className="hr-dash-activity-content">
              <div className="hr-dash-activity-title">
                {activity.user?.name
                  ? <><strong>{activity.user.name}</strong>: {activity.title}</>
                  : activity.title}
              </div>
              <div className="hr-dash-activity-time">{activity.time}</div>
              {/* Optional: if your API provides details */}
              {activity.details && Array.isArray(activity.details) && (
                <div className="hr-dash-activity-extra-details">
                  {activity.details.map((detail, i) => (
                    <div key={i} className="detail-item">{detail}</div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  </div>
</div>



          {/* Communication Center */}
          <div className="hr-dash-card">
            <div className="hr-dash-card-header">
              <h3 className="hr-dash-card-title">Communication Center</h3>
              <button className="hr-dash-card-action" onClick={() => handleAction('Open Chat')}>
                Open Chat
              </button>
            </div>
            <div className="hr-dash-card-content">
              <div className="hr-dash-activity-feed">
                {communications.map((comm, index) => (
                  <div key={index} className="hr-dash-activity-item">
                    <div className="hr-dash-activity-icon hr-dash-comm-icon">
                      {comm.icon}
                    </div>
                    <div className="hr-dash-activity-content">
                      <div className="hr-dash-activity-title">{comm.title}</div>
                      <div className="hr-dash-activity-time">{comm.subtitle}</div>
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

export default HrDash;