import React, { useState, useEffect } from 'react';
import { Users, Clock, AlertTriangle, MessageCircle, FileText, Plus, Zap, BarChart3 } from 'lucide-react';
import './HRDashboard.css';

const Hr_Dash = () => {
  const [stats, setStats] = useState({
    totalStaff: 21,
    assigned: 18,
    available: 3,
    requests: 5
  });

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setStats(prev => ({
        ...prev,
        totalStaff: Math.max(15, prev.totalStaff + (Math.random() > 0.7 ? (Math.random() > 0.5 ? 1 : -1) : 0)),
        assigned: Math.max(10, prev.assigned + (Math.random() > 0.7 ? (Math.random() > 0.5 ? 1 : -1) : 0)),
        available: Math.max(0, prev.available + (Math.random() > 0.7 ? (Math.random() > 0.5 ? 1 : -1) : 0)),
        requests: Math.max(0, prev.requests + (Math.random() > 0.7 ? (Math.random() > 0.5 ? 1 : -1) : 0))
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

  const projects = [
    {
      name: 'BDC Hotel',
      status: 'In Progress',
      statusClass: 'bg-blue-100 text-blue-800',
      assigned: 8,
      due: 'Dec 15',
      progress: 85
    },
    {
      name: 'Stonehouse Gateway',
      status: 'Planning',
      statusClass: 'bg-yellow-100 text-yellow-800',
      assigned: 6,
      due: 'Jan 30',
      progress: 60
    },
    {
      name: 'Freemont Place',
      status: 'Active',
      statusClass: 'bg-green-100 text-green-800',
      assigned: 4,
      due: 'Feb 20',
      progress: 40
    }
  ];

  const requests = [
    {
      title: '3x Electricians for BDC Hotel',
      requester: 'Jane Cooper',
      time: '2 hours ago',
      status: 'Urgent',
      statusClass: 'bg-red-100 text-red-800'
    },
    {
      title: '2x Laborers for Stonehouse',
      requester: 'Ronald Richards',
      time: '5 hours ago',
      status: 'Pending',
      statusClass: 'bg-yellow-100 text-yellow-800'
    },
    {
      title: '1x Foreman for Freemont',
      requester: 'Floyd Miles',
      time: '1 day ago',
      status: 'Approved',
      statusClass: 'bg-green-100 text-green-800'
    },
    {
      title: '2x Plumbers for BDC Hotel',
      requester: 'Jerome Bell',
      time: '2 days ago',
      status: 'Pending',
      statusClass: 'bg-yellow-100 text-yellow-800'
    }
  ];

  const activities = [
    {
      title: 'Jacob Jones assigned to BDC Hotel',
      time: '15 minutes ago',
      icon: '👥',
      iconBg: 'bg-blue-100 text-blue-600'
    },
    {
      title: 'New manpower request from Stonehouse Gateway',
      time: '1 hour ago',
      icon: '📋',
      iconBg: 'bg-yellow-100 text-yellow-600'
    },
    {
      title: 'Daily log submitted by Freemont Place',
      time: '3 hours ago',
      icon: '📊',
      iconBg: 'bg-purple-100 text-purple-600'
    },
    {
      title: 'Kristin Watson reassigned to Stonehouse',
      time: '5 hours ago',
      icon: '👤',
      iconBg: 'bg-blue-100 text-blue-600'
    }
  ];

  const communications = [
    {
      title: '5 unread messages from Jane Cooper',
      subtitle: 'BDC Hotel updates',
      icon: '💬',
      iconBg: 'bg-blue-100 text-blue-600'
    },
    {
      title: 'New files shared by Ronald Richards',
      subtitle: 'Stonehouse blueprints',
      icon: '📁',
      iconBg: 'bg-yellow-100 text-yellow-600'
    },
    {
      title: 'Daily report approved for Freemont',
      subtitle: 'Floyd Miles',
      icon: '✅',
      iconBg: 'bg-green-100 text-green-600'
    }
  ];

  return (
    <div className="dashboard-container">
      {/* Navigation Bar */}
      <nav className="navbar">
        <div className="navbar-content">
          <div className="logo">
            <div className="logo-icon">F</div>
            <span className="logo-text">FadzTrack</span>
          </div>
          
          <div className="nav-links">
            <a href="#" className="nav-link">Dashboard</a>
            <a href="#" className="nav-link">Projects</a>
            <a href="#" className="nav-link">Requests</a>
            <a href="#" className="nav-link">Reports</a>
            <a href="#" className="nav-link">Chat</a>
          </div>
          
          <div className="user-profile">
            <span>ALECK (HR Manager)</span>
            <div className="avatar">A</div>
          </div>
        </div>
      </nav>

      <div className="main-content">
        {/* Welcome Header */}
        <div className="welcome-header">
          <div className="welcome-text">
            <h1>Good Morning, ALECK!</h1>
            <p>Here's your workforce overview for today</p>
          </div>
          
          <div className="quick-stats">
            {[
              { value: stats.totalStaff, label: 'Total Staff' },
              { value: stats.assigned, label: 'Assigned' },
              { value: stats.available, label: 'Available' },
              { value: stats.requests, label: 'Requests' }
            ].map((stat, idx) => (
              <div key={idx} className="stat-card">
                <div className="stat-value">{stat.value}</div>
                <div className="stat-label">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Key Metrics */}
        <div className="metrics-grid">
          {[
            { value: '85%', label: 'Workforce Utilization', change: '+5% from last week', positive: true },
            { value: '3', label: 'Active Projects', change: '+1 new project', positive: true },
            { value: '12', label: 'Pending Requests', change: '-3 from yesterday', positive: true },
            { value: '92%', label: 'Request Approval Rate', change: '+8% improvement', positive: true }
          ].map((metric, idx) => (
            <div key={idx} className="metric-card">
              <div className="metric-value">{metric.value}</div>
              <div className="metric-label">{metric.label}</div>
              <div className={`metric-change ${metric.positive ? 'positive' : 'negative'}`}>
                {metric.change}
              </div>
            </div>
          ))}
        </div>

        {/* Critical Alerts */}
        <div className="alerts-section">
          <div className="card-header">
            <h3 className="card-title alert-title">
              <AlertTriangle className="alert-icon" />
              Critical Alerts
            </h3>
            <button 
              onClick={() => handleAction('View All Alerts')}
              className="card-action alert-action"
            >
              View All
            </button>
          </div>
          <div className="card-content">
            <div className="alert-item">
              <Clock className="alert-item-icon" />
              <span className="alert-text">
                <strong>Urgent Request:</strong> 3 electricians needed for BDC Hotel by tomorrow
              </span>
              <button 
                onClick={() => handleAction('Review Urgent Request')}
                className="alert-item-action"
              >
                Review
              </button>
            </div>
            <div className="alert-item">
              <AlertTriangle className="alert-item-icon" />
              <span className="alert-text">
                <strong>High Priority:</strong> 2 foremen requested for Stonehouse Gateway - immediate assignment needed
              </span>
              <button 
                onClick={() => handleAction('Assign Now')}
                className="alert-item-action"
              >
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
              <button 
                onClick={() => handleAction('Manage All Projects')}
                className="card-action"
              >
                Manage All
              </button>
            </div>
            <div className="card-content">
              <div className="project-grid">
                {projects.map((project, idx) => (
                  <div 
                    key={idx}
                    className="project-card"
                    onClick={() => handleAction(`View ${project.name} Details`)}
                  >
                    <div className="project-header">
                      <span className="project-name">{project.name}</span>
                      <span className={`project-status ${project.status.toLowerCase().replace(' ', '-')}`}>
                        {project.status}
                      </span>
                    </div>
                    <div className="project-metrics">
                      <span>{project.assigned} Staff Assigned</span>
                      <span>Due: {project.due}</span>
                    </div>
                    <div className="progress-bar">
                      <div 
                        className="progress-fill"
                        style={{ width: `${project.progress}%` }}
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
              <button 
                onClick={() => handleAction('View All Requests')}
                className="card-action"
              >
                View All
              </button>
            </div>
            <div className="card-content">
              <div className="scrollable-content">
                {requests.map((request, idx) => (
                  <div key={idx} className="request-item">
                    <div className="request-info">
                      <h4>{request.title}</h4>
                      <p>Requested by {request.requester} • {request.time}</p>
                    </div>
                    <span className={`status-badge ${request.status.toLowerCase()}`}>
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
              <button 
                onClick={() => handleAction('View Timeline')}
                className="card-action"
              >
                View Timeline
              </button>
            </div>
            <div className="card-content">
              <div className="scrollable-content">
                {activities.map((activity, idx) => (
                  <div key={idx} className="activity-item">
                    <div className={`activity-icon ${activity.icon.includes('👥') ? 'assignment' : activity.icon.includes('📋') ? 'request' : 'report'}`}>
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
              <button 
                onClick={() => handleAction('Open Chat')}
                className="card-action"
              >
                Open Chat
              </button>
            </div>
            <div className="card-content">
              <div className="scrollable-content">
                {communications.map((comm, idx) => (
                  <div key={idx} className="communication-item">
                    <div className={`communication-icon ${comm.icon.includes('💬') ? 'message' : comm.icon.includes('📁') ? 'file' : 'approval'}`}>
                      {comm.icon}
                    </div>
                    <div className="communication-content">
                      <div className="communication-title">{comm.title}</div>
                      <div className="communication-subtitle">{comm.subtitle}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Team Updates */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Team Updates</h3>
              <button 
                onClick={() => handleAction('View All Updates')}
                className="card-action"
              >
                View All
              </button>
            </div>
            <div className="card-content">
              <div className="team-updates">
                <div className="update-item meeting">
                  <Users className="update-icon" />
                  <div>
                    <div className="update-title">Weekly team meeting scheduled</div>
                    <div className="update-time">Tomorrow at 2:00 PM</div>
                  </div>
                </div>
                <div className="update-item report">
                  <FileText className="update-icon" />
                  <div>
                    <div className="update-title">Safety report submitted</div>
                    <div className="update-time">All projects compliant</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Action Buttons */}
      <div className="fab-container">
        <button 
          onClick={() => handleAction('Create Report')}
          className="fab fab-report"
          title="Create Report"
        >
          <BarChart3 className="fab-icon" />
        </button>
        <button 
          onClick={() => handleAction('Bulk Assignment')}
          className="fab fab-assignment"
          title="Bulk Assignment"
        >
          <Zap className="fab-icon" />
        </button>
        <button 
          onClick={() => handleAction('New Request')}
          className="fab fab-primary"
          title="New Request"
        >
          <Plus className="fab-icon" />
        </button>
      </div>
    </div>
  );
};

export default Hr_Dash;