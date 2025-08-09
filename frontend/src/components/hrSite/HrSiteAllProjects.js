import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../api/axiosInstance";
import NotificationBell from "../NotificationBell";
import '../style/ceo_style/Ceo_Proj.css';

/**
 * HRAllProjects
 * — Mirrors StaffAllProjects but tailored for the HR-site user role.
 * — Pulls projects where the current user participates with role=hr.
 * — Same UX: header, tabs (Ongoing / Completed), project table, and a simple chat sidebar.
 * — Routes are under the /hr path segment.
 */

const demoChats = [
  { id: 1, name: "Payroll Team", initial: "P", message: "Reminder: cut-off Fri…", color: "#4A6AA5" },
  { id: 2, name: "Recruitment", initial: "R", message: "Candidates for PIC role…", color: "#2E7D32" },
  { id: 3, name: "Compliance", initial: "C", message: "Update 201 files…", color: "#9C27B0" }
];

const HrSiteAllProjects = () => {
  const navigate = useNavigate();

  // --- current user
  const stored = typeof window !== "undefined" ? localStorage.getItem("user") : null;
  const user = stored ? JSON.parse(stored) : null;
  const userId = user?._id || user?.id;
  const userName = user?.name || "";

  // --- ui state
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("Ongoing");
  const [ongoing, setOngoing] = useState([]);
  const [completed, setCompleted] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Close profile menu on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest(".profile-menu-container")) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  // Logout
  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/");
  };

  // Fetch HR user's projects by status
  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    setError("");

    const base = `/projects/by-user-status?userId=${encodeURIComponent(userId)}&role=hr`;

    Promise.all([
      api.get(`${base}&status=Ongoing`),
      api.get(`${base}&status=Completed`)
    ])
      .then(([resOngoing, resCompleted]) => {
        setOngoing(Array.isArray(resOngoing?.data) ? resOngoing.data : []);
        setCompleted(Array.isArray(resCompleted?.data) ? resCompleted.data : []);
      })
      .catch((e) => {
        console.error("Failed to load HR projects", e);
        setOngoing([]);
        setCompleted([]);
        setError("We couldn't load your projects. Please try again.");
      })
      .finally(() => setLoading(false));
  }, [userId]);

  const visibleProjects = useMemo(() => (activeTab === "Ongoing" ? ongoing : completed), [activeTab, ongoing, completed]);

  if (loading) return <div style={{ padding: 32 }}>Loading...</div>;

  const ProjectTable = ({ projects }) => (
    <table className="myprojects-table">
      <thead>
        <tr>
          <th>Project Name</th>
          <th>Status</th>
          <th>Location</th>
          <th>Start</th>
          <th>End</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {projects.length === 0 ? (
          <tr>
            <td colSpan={6} style={{ textAlign: "center", padding: "20px", color: "#666" }}>
              You don’t have any {activeTab.toLowerCase()} projects assigned yet.
            </td>
          </tr>
        ) : (
          projects.map((proj) => (
            <tr key={proj._id}>
              <td>{proj.projectName}</td>
              <td>
                <span className={`status-badge badge-${(proj.status || "unknown").toLowerCase()}`}>
                  {proj.status}
                </span>
              </td>
              <td>{proj.location?.name || "-"}</td>
              <td>{proj.startDate ? new Date(proj.startDate).toLocaleDateString() : "-"}</td>
              <td>{proj.endDate ? new Date(proj.endDate).toLocaleDateString() : "-"}</td>
              <td>
                <button className="view-btn" onClick={() => navigate(`/hr/${proj._id}`)}>
                  View
                </button>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );

  return (
    <>
      <header className="header">
        <div className="logo-container">
          <img src={require("../../assets/images/FadzLogo1.png")} alt="FadzTrack Logo" className="logo-img" />
          <h1 className="brand-name">FadzTrack</h1>
        </div>

        <nav className="nav-menu">
          <Link to="/hr/current-project" className="nav-link">Dashboard</Link>
          <Link to="/hr/projects" className="nav-link">Projects</Link>
          <Link to="/hr/chat" className="nav-link">Chat</Link>
        </nav>

        <div className="profile-menu-container" style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <NotificationBell />
          <div className="profile-circle" onClick={() => setProfileMenuOpen(!profileMenuOpen)}>
            {(userName?.charAt(0) || "Z").toUpperCase()}
          </div>
          {profileMenuOpen && (
            <div className="profile-menu">
              <button onClick={handleLogout}>Logout</button>
            </div>
          )}
        </div>
      </header>

      <div className="dashboard-layout">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="chats-section">
            <h3 className="chats-title">Chats</h3>
            <div className="chats-list">
              {demoChats.map((chat) => (
                <div key={chat.id} className="chat-item" onClick={() => navigate("/hr/chat") }>
                  <div className="chat-avatar" style={{ backgroundColor: chat.color }}>
                    {chat.initial}
                  </div>
                  <div className="chat-info">
                    <div className="chat-name">{chat.name}</div>
                    <div className="chat-message">{chat.message}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="main1">
          <div className="main-content-container">
            <div className="title-row">
              <h1 className="main-title">My Projects</h1>
              {error && <div className="inline-error" role="status">{error}</div>}
            </div>

            <div className="tabs">
              <button
                className={activeTab === "Ongoing" ? "tab active" : "tab"}
                onClick={() => setActiveTab("Ongoing")}
                aria-pressed={activeTab === "Ongoing"}
              >
                Ongoing
              </button>
              <button
                className={activeTab === "Completed" ? "tab active" : "tab"}
                onClick={() => setActiveTab("Completed")}
                aria-pressed={activeTab === "Completed"}
              >
                Completed
              </button>
            </div>

            <div className="projects-table-container">
              <ProjectTable projects={visibleProjects} />
            </div>
          </div>
        </main>
      </div>
    </>
  );
};

export default HrSiteAllProjects;
