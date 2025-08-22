import React, { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import NotificationBell from "../NotificationBell";
import jsPDF from "jspdf";
import api from "../../api/axiosInstance";
import '../style/pm_style/PmProgressReport.css';
// Nav icons
import { FaTachometerAlt, FaComments, FaBoxes, FaUsers, FaProjectDiagram, FaClipboardList, FaChartBar, FaCalendarAlt } from 'react-icons/fa';

export default function PmProgressReport({ userName = 'Z', handleLogout }) {
  const { id: projectId } = useParams(); // Get project id from URL
  const [project, setProject] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [logsUsed, setLogsUsed] = useState([]);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  // Fetch project details
  useEffect(() => {
    if (!projectId) return;
    api.get(`/projects/${projectId}`)
      .then(res => setProject(res.data))
      .catch(err => setError("Project not found."));
  }, [projectId]);

  // DSS Generate Report
  const handleGenerateReport = async () => {
    setLoading(true);
    setError("");
    setAiAnalysis("");
    try {
      const res = await api.get(`/daily-reports/project/${projectId}`);
      const allLogs = res.data || [];
      const latestLogs = [...allLogs]
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 7);

      setLogsUsed(latestLogs);

      const dssRes = await api.post('/dss-report/generate-dss-report', { logs: latestLogs });
      setAiAnalysis(dssRes.data.result);
    } catch (err) {
      setError("Failed to generate AI analysis. Please try again.");
      setAiAnalysis("");
    }
    setLoading(false);
  };

  // Download PDF helper
  const handleDownloadPDF = () => {
    if (!aiAnalysis) return;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Project AI Decision Support Report", 14, 18);
    doc.setFontSize(12);
    doc.text(aiAnalysis, 14, 30, { maxWidth: 180 });
    doc.setFontSize(10);
    doc.text("Logs used for analysis:", 14, 120);
    doc.text(JSON.stringify(logsUsed.map(l => ({
      date: l.date,
      summary: l.workPerformed?.map(w => w.task + " - " + w.status).join(", "),
    })), null, 2), 14, 130, { maxWidth: 180 });
    doc.save("AI_Progress_Report.pdf");
  };

  return (
   <div>
     <header className="header">
  <div className="logo-container">
    <img
      src={require('../../assets/images/FadzLogo1.png')}
      alt="FadzTrack Logo"
      className="logo-img"
    />
    <h1 className="brand-name">FadzTrack</h1>
  </div>

  <nav className="nav-menu">
    <Link to="/pm" className="nav-link"><FaTachometerAlt /> Dashboard</Link>
    <Link to="/pm/chat" className="nav-link"><FaComments /> Chat</Link>
    <Link to="/pm/request/:id" className="nav-link"><FaBoxes /> Material</Link>
    <Link to="/pm/manpower-list" className="nav-link"><FaUsers /> Manpower</Link>
    {project && (
      <Link to={`/pm/viewprojects/${project._id || project.id}`} className="nav-link">
        <FaProjectDiagram /> View Project
      </Link>
    )}
    <Link to="/pm/daily-logs" className="nav-link"><FaClipboardList /> Logs</Link>
    {project && (
      <Link to={`/pm/progress-report/${project._id}`} className="nav-link">
        <FaChartBar /> Reports
      </Link>
    )}
    <Link to="/pm/daily-logs-list" className="nav-link"><FaCalendarAlt /> Daily Logs</Link>
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
          <div style={{ margin: "24px 0" }}>
            <button
              className="pm-btn pm-submit-btn"
              onClick={handleGenerateReport}
              disabled={loading}
            >
              {loading ? "Generating AI Analysis..." : "Generate AI Progress Report (DSS)"}
            </button>
            {aiAnalysis && (
              <button
                className="pm-btn pm-download-btn"
                onClick={handleDownloadPDF}
                style={{ marginLeft: 18 }}
              >
                Download as PDF
              </button>
            )}
          </div>
          {error && <div style={{ color: 'red', margin: '12px 0' }}>{error}</div>}
          {aiAnalysis && (
            <div className="ai-report" style={{
              background: "#fff",
              padding: "18px",
              borderRadius: 10,
              margin: "24px 0",
              boxShadow: "0 2px 12px #0002"
            }}>
              <h2>AI Decision Support Analysis:</h2>
              <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 15 }}>{aiAnalysis}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
