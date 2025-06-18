import React, { useState } from "react";
import { Link } from "react-router-dom";
import NotificationBell from "../NotificationBell"; // Adjust the import as needed
import '../style/pm_style/PmProgressReport.css';

// Dummy Data for demonstration
const currentPeriod = {
  period: "Apr 1 - Apr 14, 2025",
  file: "Progress Report.docx",
  submitted: null,
};
const previousReports = [
  {
    period: "Mar 18 - Mar 31, 2025",
    file: "Progress Report.docx",
    submitted: "3/31/25 11:59pm",
  },
  {
    period: "Mar 4 - Mar 17, 2025",
    file: "Progress Report.docx",
    submitted: "3/17/25 11:59pm",
  },
  {
    period: "Feb 18 - Mar 3, 2025",
    file: "Progress Report.docx",
    submitted: "3/3/25 11:59pm",
  },
  {
    period: "Feb 4 - Feb 17, 2025",
    file: "Progress Report.docx",
    submitted: "2/17/25 11:59pm",
  },
  {
    period: "Jan 21 - Feb 3, 2025",
    file: "Progress Report.docx",
    submitted: "2/3/25 11:59pm",
  },
];

export default function PmProgressReport({ project, userName = 'Z', handleLogout }) {
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  // --- Button Handlers (replace with real logic) ---
  const handleDownload = (file) => {
    // TODO: implement download (fetch from backend)
    alert(`Downloading: ${file}`);
  };

  const handleUpload = (e) => {
    const file = e.target.files[0];
    setSelectedFile(file);
    // TODO: upload to backend
    setUploading(true);
    setTimeout(() => {
      setUploading(false);
      alert("Upload complete (stub)");
    }, 1000);
  };

  const handleSubmit = () => {
    // TODO: implement submit logic
    alert("Submitted this period's report! (stub)");
  };

  const handleBack = () => {
    // TODO: navigate back
    alert("Going back (stub)");
  };

  return (
     <div>
      <header className="header">
        <div className="logo-container">
          <img src={require('../../assets/images/FadzLogo1.png')} alt="FadzTrack Logo" className="logo-img" />
          <h1 className="brand-name">FadzTrack</h1>
        </div>
        <nav className="nav-menu">
          <Link to="/pm" className="nav-link">Dashboard</Link>
          <Link to="/pm/request/:id" className="nav-link">Material</Link>
          <Link to="/pm/manpower-list" className="nav-link">Manpower</Link>
          {project && (
            <Link to={`/pm/viewprojects/${project._id || project.id}`} className="nav-link">View Project</Link>
          )}
          <Link to="/chat" className="nav-link">Chat</Link>
          <Link to="/pm/daily-logs" className="nav-link">Logs</Link>
          <Link to="/pm/progress-report/:id" className="nav-link">Reports</Link>
          <Link to="/pm/daily-logs-list" className="nav-link">Daily Logs</Link>
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

      <div className="pm-progress-bg">
        <div className="pm-progress-container">
          <h1 className="pm-progress-title">Progress Report</h1>

          {/* This Period's Progress Report */}
          <div className="pm-this-period-section">
            <h2 className="pm-section-header">This Period's Progress Report</h2>
            <div className="pm-report-row pm-this-period">
              <div className="pm-report-period">{currentPeriod.period}</div>
              <div className="pm-report-file">{currentPeriod.file}</div>
              <button
                className="pm-btn pm-download-btn"
                onClick={() => handleDownload(currentPeriod.file)}
              >
                Download
              </button>
              <label className="pm-btn pm-upload-btn" style={{ cursor: "pointer" }}>
                Upload
                <input
                  type="file"
                  style={{ display: "none" }}
                  onChange={handleUpload}
                />
              </label>
              <button
                className="pm-btn pm-submit-btn"
                onClick={handleSubmit}
                disabled={uploading}
              >
                {uploading ? "Uploading..." : "Submit"}
              </button>
            </div>
          </div>

          {/* Previous Progress Reports */}
          <div className="pm-previous-section">
            <h2 className="pm-section-header">Previous Progress Reports</h2>
            <div className="pm-table-header pm-report-row">
              <div>Report Period</div>
              <div>File</div>
              <div></div>
              <div></div>
              <div>Submitted</div>
            </div>
            {previousReports.map((report, idx) => (
              <div className="pm-report-row" key={idx}>
                <div className="pm-report-period">{report.period}</div>
                <div className="pm-report-file">{report.file}</div>
                <button
                  className="pm-btn pm-download-btn"
                  onClick={() => handleDownload(report.file)}
                >
                  Download
                </button>
                <label className="pm-btn pm-upload-btn" style={{ cursor: "pointer" }}>
                  Upload
                  <input
                    type="file"
                    style={{ display: "none" }}
                    onChange={handleUpload}
                  />
                </label>
                <div className="pm-report-submitted">{report.submitted}</div>
              </div>
            ))}
          </div>

          <button className="pm-btn pm-back-btn" onClick={handleBack}>
            Back
          </button>
        </div>
      </div>
    </div>
  );
}
