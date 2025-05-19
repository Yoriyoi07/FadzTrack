import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import '../style/pm_style/Pm_Dash.css';

const PmDash = () => {
  const [userName, setUserName] = useState('ALECK');
  const navigate = useNavigate();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [sidebarProjects, setSidebarProjects] = useState([
    { id: 1, name: 'Batangas', engineer: 'Engr. Daryll Miralles' },
    { id: 2, name: 'Twin Lakes Project', engineer: 'Engr. Shaquille' },
    { id: 3, name: 'Calatagan Townhomes', engineer: 'Engr. Rychea Miralles' },
    { id: 4, name: 'Makati', engineer: 'Engr. Michelle Amor' },
    { id: 5, name: 'Cavite', engineer: 'Engr. Zenarose Miranda' },
    { id: 6, name: 'Taguig', engineer: 'Engr. Third Castellar' }
  ]);

  const [activities, setActivities] = useState([
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

  // Chats data
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

  // Material requests data
  const [materialRequests, setMaterialRequests] = useState([
    {
      id: 1,
      material: '300 Bags of Cement',
      requester: 'Rychea Miralles',
      date: '05/24/2022'
    },
    {
      id: 2,
      material: '300 Bags of Sand',
      requester: 'Zenarose Miranda',
      date: '05/25/2022'
    },
    {
      id: 3,
      material: '300 Bags of Cement',
      requester: 'Rychea Miralles',
      date: '05/24/2022'
    },
    {
      id: 4,
      material: '300 Bags of Sand',
      requester: 'Zenarose Miranda',
      date: '05/25/2022'
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

  // Custom active sector for the pie chart
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
          <Link to="/ceo/dash" className="nav-link">Dashboard</Link>
          <Link to="/requests" className="nav-link">Requests</Link>
          <Link to="/ceo/proj" className="nav-link">Projects</Link>
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

            {/* Material Request Section - Added */}
            <div className="material-request-section">
              <div className="section-header">
                <h2>Material Request</h2>
                <button 
                  className="view-all-btn"
                  onClick={() => navigate('/requests')}
                >
                  View All Requests
                </button>
              </div>
              
              <div className="material-requests-container">
                {materialRequests.map(request => (
                  <div key={request.id} className="material-request-item">
                    <div className="requester-initial">{request.requester.charAt(0)}</div>
                    <div className="request-details">
                      <h4>{request.material}</h4>
                      <div className="request-meta">
                        <span>{request.requester}</span>
                        <span>{request.date}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
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