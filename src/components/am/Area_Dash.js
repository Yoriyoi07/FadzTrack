import React, { useState } from 'react';
import { PieChart, Pie, Cell } from 'recharts';
import '../style/am_style/Area_Dash.css';

const Dashboard = () => {
  const [userName, setUserName] = useState('ALECK');
  const [projects, setProjects] = useState([
    { 
      id: 1, 
      name: 'Twin Lakes Project',
      engineer: 'Engr. Shaquille',
      progress: [
        { name: 'Incomplete', value: 60, color: '#FF6B6B' },
        { name: 'Complete', value: 20, color: '#4CAF50' },
        { name: 'On Going', value: 20, color: '#5E4FDB' }
      ]
    },
    { 
      id: 2, 
      name: 'Calatagan Townhomes',
      engineer: 'Engr. Rychea Miralles',
      progress: [
        { name: 'Incomplete', value: 55, color: '#FF6B6B' },
        { name: 'Complete', value: 15, color: '#4CAF50' },
        { name: 'On Going', value: 30, color: '#5E4FDB' }
      ]
    },
    { 
      id: 3, 
      name: 'BGC Hotel',
      engineer: 'Engr.',
      progress: [
        { name: 'Incomplete', value: 50, color: '#FF6B6B' },
        { name: 'Complete', value: 20, color: '#4CAF50' },
        { name: 'On Going', value: 30, color: '#5E4FDB' }
      ]
    }
  ]);

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

  return (
    <div className="dashboard-container">
      {/* Top navigation bar */}
      <div className="top-navbar">
        <div className="logo-container">
          <div className="logo">
            <span className="logo-icon">🏗️</span>
          </div>
          <h1 className="app-name">FadzTrack</h1>
        </div>
        
        <div className="nav-links">
          <a href="#" className="nav-link">Requests</a>
          <a href="#" className="nav-link">Projects</a>
          <a href="#" className="nav-link">Chat</a>
          <a href="#" className="nav-link">Logs</a>
          <a href="#" className="nav-link">Reports</a>
        </div>
        
        <div className="search-container">
          <input type="text" placeholder="Search in site" className="search-input" />
          <button className="search-button">🔍</button>
        </div>
        
        <div className="user-profile">
          <div className="user-avatar">Z</div>
        </div>
      </div>

      {/* Main Content */}
      <div className="dashboard-layout">
        {/* Left Sidebar */}
        <div className="sidebar">
          <h2>Dashboard</h2>
          <button className="add-project-btn">Add New Project</button>
          
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
            
            <div className="progress-tracking-section">
              <h2>Progress Tracking</h2>
              
              <div className="latest-projects-progress">
                <h3>Latest Projects Progress</h3>
                <div className="project-charts">
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
                        {project.progress.map((item, index) => (
                          <div key={index} className="legend-item">
                            <span className="color-box" style={{ backgroundColor: item.color }}></span>
                            <span className="legend-text">{item.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
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

export default Dashboard;