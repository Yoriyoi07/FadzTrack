import React, { useEffect, useState } from "react";
import api from '../../api/axiosInstance';
import { useNavigate, Link } from 'react-router-dom';
import NotificationBell from '../NotificationBell';

// Nav icons
import { FaTachometerAlt, FaComments, FaBoxes, FaProjectDiagram, FaClipboardList, FaChartBar } from 'react-icons/fa';


const ITEMS_PER_PAGE = 15;

const CeoAuditLogs = () => {
  const navigate = useNavigate();
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState('');
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    api.get('/audit-logs')
      .then((res) => {
        setLogs(res.data); 
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

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

  // Filter logic
  const filteredLogs = logs.filter((log) => {
    return (
      (!roleFilter || log.performedByRole?.toLowerCase().includes(roleFilter.toLowerCase())) &&
      (!actionFilter || log.action?.toLowerCase().includes(actionFilter.toLowerCase())) &&
      (
        !search ||
        log.description?.toLowerCase().includes(search.toLowerCase()) ||
        log.performedBy?.name?.toLowerCase().includes(search.toLowerCase()) ||
        log.performedByRole?.toLowerCase().includes(search.toLowerCase()) ||
        log.action?.toLowerCase().includes(search.toLowerCase())
      )
    );
  });

  // Pagination
  const totalPages = Math.ceil(filteredLogs.length / ITEMS_PER_PAGE);
  const pagedLogs = filteredLogs.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // When filter/search changes, go to page 1
  useEffect(() => {
    setCurrentPage(1);
  }, [search, roleFilter, actionFilter]);

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
    <Link to="/ceo/dash" className="nav-link"><FaTachometerAlt /> Dashboard</Link>
    <Link to="/ceo/chat" className="nav-link"><FaComments /> Chat</Link>
    <Link to="/ceo/material-list" className="nav-link"><FaBoxes /> Material</Link>
    <Link to="/ceo/proj" className="nav-link"><FaProjectDiagram /> Projects</Link>
    <Link to="/ceo/audit-logs" className="nav-link"><FaClipboardList /> Audit Logs</Link>
    <Link to="/reports" className="nav-link"><FaChartBar /> Reports</Link>
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

      <div style={{ maxWidth: 1200, margin: "30px auto", padding: 24, background: "#fff", borderRadius: 12, boxShadow: "0 2px 16px #0001" }}>
        <h2 style={{ marginBottom: 24 }}>Audit Log</h2>

        <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          <input
            placeholder="Search anything..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ flex: 2, minWidth: 180, padding: 8, borderRadius: 6, border: "1px solid #bbb" }}
          />
          <input
            placeholder="Filter by role"
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            style={{ flex: 1, minWidth: 120, padding: 8, borderRadius: 6, border: "1px solid #bbb" }}
          />
          <input
            placeholder="Filter by action"
            value={actionFilter}
            onChange={e => setActionFilter(e.target.value)}
            style={{ flex: 1, minWidth: 120, padding: 8, borderRadius: 6, border: "1px solid #bbb" }}
          />
        </div>

        {loading ? (
          <div>Loading...</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 15 }}>
              <thead>
                <tr style={{ background: "#f6f6f6" }}>
                  <th style={th}>Date/Time</th>
                  <th style={th}>Action</th>
                  <th style={th}>Performed By</th>
                  <th style={th}>Role</th>
                  <th style={th}>Description</th>
                  <th style={th}>Details</th>
                </tr>
              </thead>
              <tbody>
                {pagedLogs.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: "center", color: "#888" }}>No logs found.</td></tr>
                ) : (
                  pagedLogs.map((log, i) => (
                    <tr key={log._id || i} style={{ background: i % 2 ? "#fafbfc" : "#fff" }}>
                      <td style={td}>{new Date(log.timestamp).toLocaleString()}</td>
                      <td style={td}><span style={{ background: "#f3f6ff", borderRadius: 4, padding: "2px 8px" }}>{log.action}</span></td>
                      <td style={td}>{log.performedBy?.name || "Unknown"}</td>
                      <td style={td}>{log.performedByRole}</td>
                      <td style={td}>{log.description}</td>
                      <td style={td}>
                        <details>
                          <summary style={{ cursor: "pointer" }}>View</summary>
                          <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, background: "#f8f8f8", padding: 8, borderRadius: 6 }}>{JSON.stringify(log.meta, null, 2)}</pre>
                        </details>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 10, marginTop: 30 }}>
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            style={{
              padding: "7px 18px",
              borderRadius: 6,
              border: "1px solid #bbb",
              background: currentPage === 1 ? "#eee" : "#fafcff",
              color: currentPage === 1 ? "#bbb" : "#333",
              cursor: currentPage === 1 ? "not-allowed" : "pointer"
            }}
          >Prev</button>
          {/* Page numbers */}
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(pageNum => 
              pageNum === 1 ||
              pageNum === totalPages ||
              Math.abs(pageNum - currentPage) <= 2
            )
            .reduce((arr, pageNum, idx, src) => {
              // add ... for skipped numbers
              if (idx > 0 && pageNum - src[idx - 1] > 1) arr.push('...');
              arr.push(pageNum);
              return arr;
            }, [])
            .map((page, idx) =>
              page === '...' ? (
                <span key={'ellipsis-' + idx} style={{ padding: "0 6px", color: "#aaa" }}>...</span>
              ) : (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  style={{
                    padding: "7px 14px",
                    borderRadius: 5,
                    border: page === currentPage ? "2px solid #384ee6" : "1px solid #ccc",
                    background: page === currentPage ? "#f3f6ff" : "#fff",
                    color: page === currentPage ? "#384ee6" : "#333",
                    fontWeight: page === currentPage ? 700 : 400,
                    cursor: "pointer",
                    margin: "0 2px"
                  }}
                  disabled={page === currentPage}
                >{page}</button>
              )
            )
          }
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages || totalPages === 0}
            style={{
              padding: "7px 18px",
              borderRadius: 6,
              border: "1px solid #bbb",
              background: currentPage === totalPages || totalPages === 0 ? "#eee" : "#fafcff",
              color: currentPage === totalPages || totalPages === 0 ? "#bbb" : "#333",
              cursor: currentPage === totalPages || totalPages === 0 ? "not-allowed" : "pointer"
            }}
          >Next</button>
        </div>
      </div>
    </div>
  );
};

const th = {
  textAlign: "left",
  padding: "10px 8px",
  fontWeight: 600,
  borderBottom: "2px solid #eee",
};
const td = {
  padding: "8px 8px",
  borderBottom: "1px solid #eee",
};

export default CeoAuditLogs;
