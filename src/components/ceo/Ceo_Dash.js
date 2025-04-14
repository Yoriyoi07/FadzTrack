import React from "react";
import { Link } from 'react-router-dom';
import "../style/ceo_style/Ceo_Dash.css";

const CeoDash = () => {
    return (
      <div className="ceo-dashboard">
        {/* Header */}
        <header className="ceo-header">
          <div className="logo">
            <img src="/images/FadzLogo 1.png" alt="FadzTrack Logo" className="logo-img" />
            <h1>FadzTrack</h1>
          </div>
          <nav>
            <ul>
              <li><Link to="/cdash">Home</Link></li>
              <li><Link to="/cprojects">View Projects</Link></li>
              <li><Link to="/crecords">View Records</Link></li>
              <li><Link to="/cchat">Chat</Link></li>
            </ul>
          </nav>
          <div className="search-container">
            <input type="text" placeholder="Search in site" className="search-input" />
            <button className="search-btn">🔍</button>
          </div>
        </header>
  
        {/* Main Content */}
        <div className="dashboard-content">
          {/* Today's Reports Section */}
          <section className="reports-section">
            <div className="report-card">
              <div className="report-image-placeholder"></div>
              <div className="report-content">
                <h2>Today's Reports</h2>
                <p>Summary of reports generated today</p>
              </div>
              <div className="report-actions">
                <button className="generate-report">Generate New Report</button>
                <button className="view-reports">View All Reports</button>
              </div>
              <div className="report-summaries">
                <div className="report-summary">Report 1 Summary</div>
                <div className="report-summary">Report 2 Summary</div>
              </div>
            </div>
          </section>
  
          {/* Incident Reports Section */}
          <section className="incident-section">
            <h2>Incident Reports</h2>
            <p>Summary of recent incident reports</p>
            <button className="view-all-reports">View All Reports</button>
            <div className="incident-grid">
              <div className="incident-card">
                <div className="incident-icon"></div>
                <h3>Incident Report 1</h3>
                <p>Filed by John Smith</p>
                <p className="filed-date">Filed on 2022-05-15</p>
              </div>
              <div className="incident-card">
                <div className="incident-icon"></div>
                <h3>Incident Report 2</h3>
                <p>Filed by Emily Johnson</p>
                <p className="filed-date">Filed on 2022-05-17</p>
              </div>
            </div>
          </section>
  
          {/* Messages Section */}
          <section className="messages-section">
            <h2>Messages</h2>
            <p>Summary of recent messages</p>
            <button className="view-all-messages">View All Messages</button>
            <div className="messages-grid">
              <div className="message-card">
                <p className="message-title">Message 1</p>
                <p className="message-text">Nullam vel sagittis orci. Cras a efficitur odio.</p>
                <p className="message-author">John Doe</p>
              </div>
              <div className="message-card">
                <p className="message-title">Message 2</p>
                <p className="message-text">Vestibulum ultricies nisl non maximus efficitur.</p>
                <p className="message-author">Jane Smith</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    );
  };
  
  export default CeoDash;