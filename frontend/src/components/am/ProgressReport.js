import React, { useState } from 'react';
import { Link } from 'react-router-dom'; 
import NotificationBell from '../NotificationBell'; 
import '../style/am_style/ProgressReport.css';

const ProgressReport = () => {
  const [selectedLocation, setSelectedLocation] = useState('Alveo Sanctuary');
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  // Define userName and handleLogout for demo
  const userName = "Zandro"; // <-- Replace with your actual logic for user name
  const handleLogout = () => {
    // Your logout logic here
    console.log('Logout');
  };

  // Sample data for recent progress reports
  const recentReports = [
    {
      id: 1,
      period: 'Apr 1 - Apr 14, 2025',
      file: 'Progress Report.docx',
      submitted: '4/10/24 11:59pm',
      location: 'Alveo Sanctuary'
    },
    // ...other reports
  ];

  // Sample data for previous progress reports
  const previousReports = [
    {
      id: 4,
      period: 'Apr 1 - Apr 14, 2025',
      file: 'Progress Report.docx',
      submitted: '4/10/24 11:59pm',
      location: 'Alveo Sanctuary'
    },
    // ...other reports
  ];

  const locations = ['All', 'Alveo Sanctuary', 'BGC Hotel', 'Makati Central'];

  const handleDownload = (reportId) => {
    // Handle download functionality
    console.log(`Downloading report ${reportId}`);
  };

  const handleBack = () => {
    // Handle back navigation
    console.log('Navigate back');
  };

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
          <Link to="/am/matreq" className="nav-link">Material</Link>
          <Link to="/am/manpower-requests" className="nav-link">Manpower</Link>
          <Link to="/am/viewproj" className="nav-link">Projects</Link>
          <Link to="/chat" className="nav-link">Chat</Link>
          <Link to="/logs" className="nav-link">Logs</Link>
          <Link to="/am/progress-report" className="nav-link">Reports</Link>
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
      <div className="progress-report-container">
        <div className="progress-report-content">
          <div className="report-header">
            <h1 className="report-title">
              Progress Report
              <span className="dropdown-arrow">⌄</span>
            </h1>

            <div className="filter-section">
              <div className="filter-group">
                <button className="filter-btn active">All</button>
                <div className="location-dropdown">
                  <select
                    value={selectedLocation}
                    onChange={(e) => setSelectedLocation(e.target.value)}
                    className="location-select"
                  >
                    {locations.map(location => (
                      <option key={location} value={location}>{location}</option>
                    ))}
                  </select>
                  <span className="dropdown-arrow">⌄</span>
                </div>
              </div>
            </div>
          </div>

          <div className="reports-section">
            <h2 className="section-title">Recent Progress Report</h2>
            <div className="reports-table">
              <div className="table-header">
                <div className="header-cell">Report Period</div>
                <div className="header-cell">File</div>
                <div className="header-cell"></div>
                <div className="header-cell">Submitted</div>
                <div className="header-cell">Location</div>
              </div>
              {recentReports.map(report => (
                <div key={report.id} className="table-row">
                  <div className="table-cell">{report.period}</div>
                  <div className="table-cell">{report.file}</div>
                  <div className="table-cell">
                    <button
                      className="download-btn"
                      onClick={() => handleDownload(report.id)}
                    >
                      📄 Download
                    </button>
                  </div>
                  <div className="table-cell">{report.submitted}</div>
                  <div className="table-cell">{report.location}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="reports-section">
            <h2 className="section-title">Previous Progress Reports</h2>
            <div className="reports-table">
              <div className="table-header">
                <div className="header-cell">Report Period</div>
                <div className="header-cell">File</div>
                <div className="header-cell"></div>
                <div className="header-cell">Submitted</div>
                <div className="header-cell">Location</div>
              </div>
              {previousReports.map(report => (
                <div key={report.id} className="table-row">
                  <div className="table-cell">{report.period}</div>
                  <div className="table-cell">{report.file}</div>
                  <div className="table-cell">
                    <button
                      className="download-btn"
                      onClick={() => handleDownload(report.id)}
                    >
                      📄 Download
                    </button>
                  </div>
                  <div className="table-cell">{report.submitted}</div>
                  <div className="table-cell">{report.location}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="back-button-container">
            <button className="back-btn" onClick={handleBack}>
              Back
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProgressReport;
