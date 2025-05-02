// In Pm_Dash.js
import React from 'react';
import '../style/pm_style/Pm_Dash.css'; 
import { Link } from 'react-router-dom'; // Import Link component

const Dashboard = () => {

  const handleLogout = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/auth/logout', {
        method: 'POST',
        credentials: 'include' 
      });
      const data = await response.json();
      console.log(data.msg);
      window.location.href = '/'; 
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  return (
    <div className="pm-dashboard"> {/* Changed class name to be more specific */}
      {/* Header/Navigation */}
      <header className="pm-header"> {/* Changed class name to be more specific */}
        <div className="pm-logo-container">
          <img src="/images/FadzLogo 1.png" alt="Logo" className="pm-logo-img" /> 
          <span className="pm-logo-text">FadzTrack</span>
          <button onClick={handleLogout} className="pm-nav-link pm-logout-btn">Logout</button>
        </div>
        
        <nav className="pm-main-nav">
          <Link to="/c" className="pm-nav-link">Home</Link>
          <Link to="/d" className="pm-nav-link">Request Manpower</Link>
          <Link to="/j" className="pm-nav-link">View Project</Link>
          <Link to="/chat" className="pm-nav-link">Chat</Link>
          <Link to="/q" className="pm-nav-link">Generate Report</Link>
        </nav>
        
        <div className="pm-search-container">
          <input type="text" placeholder="Search in site" className="pm-search-input" />
          <button className="pm-search-button">
            <i className="pm-search-icon">🔍</i>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="pm-main-content">
        {/* Project Overview Section */}
        <section className="pm-section pm-project-overview">
          <h2 className="pm-section-title">Project Overview</h2>
          <p className="pm-section-subtitle">Summary of the project and manpower</p>
          
          <button className="pm-view-details-btn">View Details</button>
          
          <div className="pm-stats-container">
            <div className="pm-stat-card">
              <h3 className="pm-stat-title">Total Manpower</h3>
              <p className="pm-stat-value">50</p>
            </div>
            <div className="pm-stat-card">
              <h3 className="pm-stat-title">Completed Tasks</h3>
              <p className="pm-stat-value">20</p>
            </div>
          </div>
        </section>
        
        <div className="pm-section-divider"></div>

        {/* Today's Reports Section */}
        <section className="pm-section pm-reports-section">
          <div className="pm-section-layout">
            <div className="pm-section-header">
              <h2 className="pm-section-title">Today's Reports</h2>
              <p className="pm-section-subtitle">Summary of reports generated today</p>
              
              <div className="pm-button-group">
                <Link to="/" className="pm-btn pm-primary-btn">Generate New Report</Link>
                <button className="pm-btn pm-secondary-btn">View All Reports</button>
              </div>
            </div>
            
            <div className="pm-section-content">
              <div className="pm-card-container">
                <div className="pm-report-card">
                  <h3 className="pm-report-title">Report 1</h3>
                  <p className="pm-report-content">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed non euismod nulla. In...</p>
                </div>
                <div className="pm-report-card">
                  <h3 className="pm-report-title">Report 2</h3>
                  <p className="pm-report-content">Pellentesque pulvinar feugiat bibendum. Nulla fermentum vivle maleris. In...</p>
                </div>
              </div>
            </div>
          </div>
        </section>
        
        <div className="pm-section-divider"></div>

        {/* Material Requests Section */}
        <section className="pm-section pm-material-section">
          <div className="pm-section-layout">
            <div className="pm-section-header">
              <h2 className="pm-section-title">Material Requests</h2>
              <p className="pm-section-subtitle">Summary of material requests made</p>
              
              <button className="pm-btn pm-secondary-btn pm-view-all-btn">View All Requests</button>
            </div>
            
            <div className="pm-section-content">
              <div className="pm-card-container">
                <div className="pm-material-card">
                  <div className="pm-file-icon">F...</div>
                  <h3 className="pm-material-title">Material Request 1</h3>
                  <p className="pm-material-details">By PCA • 05/24/2022</p>
                </div>
                <div className="pm-material-card">
                  <div className="pm-file-icon">F...</div>
                  <h3 className="pm-material-title">Material Request 2</h3>
                  <p className="pm-material-details">By PCB • 05/25/2022</p>
                </div>
              </div>
            </div>
          </div>
        </section>
        
        <div className="pm-section-divider"></div>

        {/* Messages Section */}
        <section className="pm-section pm-messages-section">
          <div className="pm-section-header pm-centered">
            <h2 className="pm-section-title">Messages</h2>
            <p className="pm-section-subtitle">Summary of recent messages</p>
            
            <button className="pm-btn pm-secondary-btn pm-view-all-btn">View All Messages</button>
          </div>
          
          <div className="pm-messages-grid">
            <div className="pm-message-card">
              <h3 className="pm-message-title">Message 1</h3>
              <p className="pm-message-content">Nullam vel sagittis orci. Cras a efficitur odio. Aliquam erat volutpat.</p>
              <p className="pm-message-sender">John Doe</p>
            </div>
            <div className="pm-message-card">
              <h3 className="pm-message-title">Message 2</h3>
              <p className="pm-message-content">Vestibulum ultrices neque non maximus efficitur. Maecenas sagittis bibendum sapien sit amet condimentum.</p>
              <p className="pm-message-sender">Jane Smith</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Dashboard;