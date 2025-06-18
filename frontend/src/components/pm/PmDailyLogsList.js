import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import NotificationBell from '../NotificationBell';
import api from '../../api/axiosInstance';

const ITEMS_PER_PAGE = 7;

const iconByType = (title) => {
  if (title?.toLowerCase().includes('no. 1') || title?.toLowerCase().includes('no. 2') || title?.toLowerCase().includes('no. 3'))
    return "📦";
  if (title?.toLowerCase().includes('no. 32') || title?.toLowerCase().includes('no. 15') || title?.toLowerCase().includes('no. 84'))
    return "✏️";
  if (title?.toLowerCase().includes('no. 31'))
    return "🧱";
  return "📦";
};

const statusFilterMap = {
  All: () => true,
};

const PmDailyLogsList = () => {
  const navigate = useNavigate();

  // Get user for initials
  const [userName, setUserName] = useState('Z');
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);

  // For fetching the assigned project (optional for nav link)
  const [project, setProject] = useState(null);
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('token') || "");
  const [userId, setUserId] = useState(() => user?._id);

  useEffect(() => {
    // Set username for header circle
    const user = JSON.parse(localStorage.getItem('user'));
    setUserName(user?.name || 'Z');
  }, []);

  useEffect(() => {
    api.get('/daily-reports/mine')
      .then(res => {
        setLogs(Array.isArray(res.data) ? res.data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    // Fetch assigned project for PM for "View Project" nav
    if (!token || !userId) return;
    api.get(`/projects/assigned/projectmanager/${userId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(({ data }) => setProject(data))
      .catch(() => setProject(null));
  }, [token, userId]);

  // Filtering/pagination
  const filteredLogs = logs.filter(statusFilterMap[filter] || (() => true));
  const totalPages = Math.ceil(filteredLogs.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const pageLogs = filteredLogs.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  // Date formatting helper
  const formatDate = (d) => {
    const date = new Date(d);
    return date.toLocaleDateString('en-US');
  };

  // Logout
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
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

      {/* Filter Row */}
      <div style={{
        maxWidth: 1000, margin: "36px auto 0", background: "#fff", borderRadius: 12,
        boxShadow: "0 2px 16px rgba(0,0,0,0.07)", padding: "20px 0 0 0"
      }}>
        <div style={{ display: "flex", alignItems: "center", padding: "0 24px", marginBottom: 6 }}>
          <button className="date-filter-btn" style={{
            border: "1px solid #bbb", borderRadius: 6, background: "#fff", color: "#1e2852", fontWeight: 500,
            padding: "5px 20px", marginRight: 22, cursor: "pointer"
          }}>🗓 Date Filter</button>
          {["All"].map(tab => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={filter === tab ? "tab-btn active" : "tab-btn"}
              style={{
                border: "none", background: "none", color: filter === tab ? "#191970" : "#64688a", fontWeight: filter === tab ? 700 : 500,
                fontSize: 16, marginRight: 12, padding: "6px 10px", borderBottom: filter === tab ? "2.5px solid #191970" : "none", cursor: "pointer"
              }}
            >{tab}</button>
          ))}
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            {/* List/Grid icons, just UI */}
            <span style={{
              width: 30, height: 30, display: "inline-flex", alignItems: "center", justifyContent: "center",
              border: "1.5px solid #d4d8e2", borderRadius: 6, marginRight: 3, color: "#191970", background: "#f2f4fa"
            }}>
              <svg width="16" height="16"><rect width="16" height="3" fill="#191970" /><rect y="6" width="16" height="3" fill="#d4d8e2" /><rect y="12" width="16" height="3" fill="#d4d8e2" /></svg>
            </span>
            <span style={{
              width: 30, height: 30, display: "inline-flex", alignItems: "center", justifyContent: "center",
              border: "1.5px solid #d4d8e2", borderRadius: 6, color: "#bbb", background: "#f2f4fa"
            }}>
              <svg width="16" height="16"><rect width="6" height="6" fill="#d4d8e2" /><rect x="10" width="6" height="6" fill="#d4d8e2" /><rect y="10" width="6" height="6" fill="#d4d8e2" /><rect x="10" y="10" width="6" height="6" fill="#d4d8e2" /></svg>
            </span>
          </div>
        </div>
        <div style={{ borderBottom: "1px solid #eaeaea", marginTop: 8 }}></div>

        {/* List */}
        <div style={{ padding: "12px 0" }}>
          {loading ? (
            <div style={{ textAlign: "center", color: "#888", margin: 50 }}>Loading...</div>
          ) : pageLogs.length === 0 ? (
            <div style={{ textAlign: "center", color: "#888", margin: 50 }}>No logs found.</div>
          ) : (
            pageLogs.map((log, idx) => (
              <div key={log._id || idx}
                className="log-list-row"
                style={{
                  display: "flex", alignItems: "center", padding: "14px 24px",
                  borderBottom: "1px solid #eee", cursor: "pointer", background: "#fff"
                }}
                onClick={() => navigate(`/pm/daily-logs/${log._id}`)}
              >
                {/* Icon */}
                <div style={{ flex: "0 0 46px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{
                    width: 42, height: 42, display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 30, background: "#ece7df", borderRadius: "50%"
                  }}>{iconByType(log.title || log.logTitle)}</span>
                </div>
                {/* Details */}
                <div style={{ flex: 1, minWidth: 0, marginLeft: 16 }}>
                  <div style={{ fontWeight: 700, color: "#23232e", fontSize: 16, lineHeight: "20px" }}>
                    {log.title || log.logTitle || `Daily Log no. ${log.logNumber || (idx + 1)}`}
                  </div>
                  <div style={{ color: "#6c757d", fontWeight: 500, fontSize: 14, marginTop: 1 }}>
                    {log.submittedBy?.name || "—"}
                  </div>
                </div>
                {/* Project + Date */}
                <div style={{ minWidth: 170, textAlign: "right", marginLeft: 12 }}>
                  <div style={{ fontWeight: 600, color: "#343357", fontSize: 15 }}>
                    {log.project?.projectName || "—"}
                  </div>
                  <div style={{ color: "#7b7b8b", fontWeight: 500, fontSize: 14, marginTop: 2 }}>
                    {formatDate(log.date || log.createdAt)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", margin: "18px 0" }}>
            <div className="pagination" style={{ display: "flex", gap: 3 }}>
              <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} style={{
                border: "none", background: "none", fontSize: 16, color: "#191970", padding: "4px 8px", minWidth: 26, fontWeight: 700, opacity: currentPage === 1 ? 0.35 : 1
              }}>&lt;</button>
              {Array.from({ length: totalPages }).map((_, i) => (
                <button key={i}
                  className={currentPage === i + 1 ? "active" : ""}
                  onClick={() => setCurrentPage(i + 1)}
                  style={{
                    border: "none", background: currentPage === i + 1 ? "#3a48a6" : "none", color: currentPage === i + 1 ? "#fff" : "#191970",
                    fontWeight: 700, fontSize: 15, borderRadius: 5, padding: "4px 10px", margin: "0 2px"
                  }}
                >{i + 1}</button>
              ))}
              <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} style={{
                border: "none", background: "none", fontSize: 16, color: "#191970", padding: "4px 8px", minWidth: 26, fontWeight: 700, opacity: currentPage === totalPages ? 0.35 : 1
              }}>&gt;</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PmDailyLogsList;
