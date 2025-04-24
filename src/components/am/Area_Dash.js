// Area_Dash.js
import React from 'react';
import "../style/am_style/Area_Dash.css";

function Area_Dash() {
  return (
    <div className="area-dash">
      <header className="header">
        <div className="logo-container">
          <img src="/logo.png" alt="FadzTrack Logo" className="logo" />
          <h1>FadzTrack</h1>
        </div>
        <nav className="navigation">
          <a href="#" className="nav-link">Home</a>
          <a href="#" className="nav-link">Charts</a>
          <a href="#" className="nav-link">View Projects</a>
          <a href="#" className="nav-link">View Reports</a>
          <a href="#" className="nav-link">View Requests</a>
        </nav>
      </header>
      
      <div className="content">
        {/* Area Overview Section */}
        <section className="area-overview">
          <h2>Area Overview</h2>
          <p className="section-description">Summary of the project and manpower</p>
          
          <div className="view-details-button-container">
            <button className="view-details-button">View Details</button>
          </div>
          
          <div className="projects-stats">
            <div className="project-stat">
              <p className="stat-label">Projects in Area 1</p>
              <p className="stat-value">50</p>
            </div>
            <div className="project-stat">
              <p className="stat-label">Projects in Area 2</p>
              <p className="stat-value">20</p>
            </div>
          </div>
        </section>
        
        {/* Today's Reports Section */}
        <section className="todays-reports">
          <h2>Today's Reports</h2>
          <p className="section-description">Summary of reports generated today</p>
          
          <div className="actions-container">
            <button className="generate-report-button">Generate New Report</button>
            <button className="view-all-button">View All Reports</button>
          </div>
          
          <div className="reports-grid">
            <div className="report-card">
              <h3>Report 1</h3>
              <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor...</p>
            </div>
            <div className="report-card">
              <h3>Report 2</h3>
              <p>Pellentesque pulvinar fringilla bibendum. Nulla commodo mollis et...</p>
            </div>
          </div>
        </section>
        
        {/* Material Requests Section */}
        <section className="material-requests">
          <h2>Material Requests</h2>
          <p className="section-description">Summary of material requests made</p>
          
          <div className="view-all-button-container">
            <button className="view-all-button">View All Requests</button>
          </div>
          
          <div className="requests-grid">
            <div className="request-card">
              <div className="request-icon">F...</div>
              <div className="request-details">
                <h3>Material Request 1</h3>
                <p className="request-info">by PIC A - 05/04/2023</p>
              </div>
            </div>
            <div className="request-card">
              <div className="request-icon">F...</div>
              <div className="request-details">
                <h3>Material Request 2</h3>
                <p className="request-info">by PIC B - 05/05/2023</p>
              </div>
            </div>
          </div>
        </section>
        
        {/* Workforce Requests Section */}
        <section className="workforce-requests">
          <h2>Workforce Requests</h2>
          <p className="section-description">Summary of material requests made</p>
          
          <div className="view-all-button-container">
            <button className="view-all-button">View All Requests</button>
          </div>
          
          <div className="requests-grid">
            <div className="request-card">
              <div className="request-icon">F...</div>
              <div className="request-details">
                <h3>Workforce Request 1</h3>
                <p className="request-info">by PIC A - 05/04/2023</p>
                <p className="project-info">Project 1</p>
              </div>
            </div>
            <div className="request-card">
              <div className="request-icon">F...</div>
              <div className="request-details">
                <h3>Workforce Request 2</h3>
                <p className="request-info">by PIC B - 05/05/2023</p>
                <p className="project-info">Project 2</p>
              </div>
            </div>
          </div>
        </section>
        
        {/* Messages Section */}
        <section className="messages">
          <h2>Messages</h2>
          <p className="section-description">Summary of recent messages</p>
          
          <div className="view-all-button-container">
            <button className="view-all-button">View All Messages</button>
          </div>
          
          <div className="messages-grid">
            <div className="message-card">
              <h3>Message 1</h3>
              <p>Subject: set coghlans eco. Give a officer doloi. displaym and redirect.</p>
              <div className="date-info">
                <small>June 20th</small>
              </div>
            </div>
            <div className="message-card">
              <h3>Message 2</h3>
              <p>vestibulum ultricies tincidunt maecenas efficitur elementum sagittis bibendum augue id amet condi...</p>
              <div className="date-info">
                <small>June 20th</small>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default Area_Dash;