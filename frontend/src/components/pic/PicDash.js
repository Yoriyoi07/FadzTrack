import React, { useState, useEffect } from 'react';
import '../style/pic_style/Pic_Dash.css';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../api/axiosInstance';
import { PieChart, Pie, Cell } from 'recharts';

const PicDash = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const stored = localStorage.getItem('user');
  const user = stored ? JSON.parse(stored) : null;
  const userId = user?._id;

  const [requests, setRequests] = useState([]);
  const [userName, setUserName] = useState(user?.name || '');
  const [, setProjects] = useState([]);
  const [project, setProject] = useState(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Pagination helpers
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentRequests = requests.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(requests.length / itemsPerPage);

  const goToPage = (pageNumber) => {
    if (pageNumber > 0 && pageNumber <= totalPages) setCurrentPage(pageNumber);
  };

  // Auth guard
  useEffect(() => {
    if (!token || !user) {
      navigate('/');
      return;
    }
    setUserName(user.name);
  }, [navigate, token, user]);

  // Fetch all projects where this user is PIC
  useEffect(() => {
    if (!token || !user) return;
    const fetchProjects = async () => {
      try {
        const { data } = await api.get('/projects', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const filtered = data.filter(
          (p) => Array.isArray(p.pic) && p.pic.some((picUser) => picUser._id === userId)
        );
        setProjects(filtered);
      } catch (err) {
        setProjects([]);
      }
    };
    fetchProjects();
  }, [token, user, userId]);

  // Fetch assigned project for nav links
  useEffect(() => {
    if (!token || !userId) return;
    const fetchAssigned = async () => {
      try {
        const { data } = await api.get(`/projects/assigned/${userId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setProject(data[0] || null);
      } catch (err) {
        setProject(null);
      }
    };
    fetchAssigned();
  }, [token, userId]);

  // Fetch requests for this PIC
  useEffect(() => {
    if (!token) return;
    api.get('/requests/mine', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(({ data }) => setRequests(Array.isArray(data) ? data : []))
      .catch(() => setRequests([]));
  }, [token]);

  // Sample chats data
  const [chats] = useState([
    { id: 1, name: 'Rychea Miralles', initial: 'R', message: 'Hello Good Morning po! As...', color: '#4A6AA5' },
    { id: 2, name: 'Third Castellar', initial: 'T', message: 'Hello Good Morning po! As...', color: '#2E7D32' },
    { id: 3, name: 'Zenarose Miranda', initial: 'Z', message: 'Hello Good Morning po! As...', color: '#9C27B0' }
  ]);

  // Logout handler
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  // Profile menu close on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest(".profile-menu-container")) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  return (
    <div className="head">
      {/* Header with Navigation */}
      <header className="header">
        <div className="logo-container">
          <img src={require('../../assets/images/FadzLogo1.png')} alt="FadzTrack Logo" className="logo-img" />
          <h1 className="brand-name">FadzTrack</h1>
        </div>
        <nav className="nav-menu">
          <Link to="/pic" className="nav-link">Dashboard</Link>
          {project && (<Link to={`/pic/projects/${project._id}/request`} className="nav-link">Requests</Link>)}
          {project && (<Link to={`/pic/${project._id}`} className="nav-link">View Project</Link>)}
          <Link to="/pic/chat" className="nav-link">Chat</Link>
        </nav>
        <div className="profile-menu-container">
          <div className="profile-circle" onClick={() => setProfileMenuOpen(!profileMenuOpen)}>
            {userName.charAt(0).toUpperCase() || 'Z'}
          </div>
          {profileMenuOpen && (
            <div className="profile-menu">
              <button onClick={handleLogout}>Logout</button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="dashboard-layout">
        {/* Left Sidebar */}
        <div className="sidebar">
          <h2>Requests</h2>
          <button
            className="add-project-btn"
            onClick={() => {
              if (project) navigate(`/pic/projects/${project._id}/request`);
            }}
            disabled={!project}
          >
            Add New Request
          </button>
          {/* Chats List in Left Sidebar */}
          <div className="chats-section">
            <h3 className="chats-title">Chats</h3>
            <div className="chats-list">
              {chats.map(chat => (
                <div key={chat.id} className="chat-item">
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
        </div>

        {/* Center Content */}
        <div className="main1">
          <div className="main-content-container">
            <h1 className="main-title">Good Morning, {userName}!</h1>

            {/* --- CURRENT PROJECT SUMMARY (like PMDash) --- */}
            {project && (
              <div className="project-summary" style={{ marginBottom: "24px" }}>
                <h2>{project.projectName} Summary</h2>
                <div className="kpi" style={{ display: "flex", alignItems: "center", gap: 24 }}>
                  <div>
                    {/* Task stats */}
                    <ProjectStats project={project} />
                  </div>
                </div>
              </div>
            )}
            {/* --- END PROJECT SUMMARY --- */}

            <div>
              <h2 className="section-title">Request Overview</h2>

              <div className="request-list">
                {currentRequests.map(request => (
                  <div key={request._id} className="request-item"
                    style={{ cursor: "pointer" }}
                    onClick={() => navigate(`/pic/request/${request._id}`)}>
                    <div className="request-icon">📦</div>
                    <div className="request-details">
                      <div className="request-name">
                        <p>request for</p>
                        {request.materials && request.materials.length > 0
                          ? request.materials.map(m => `${m.materialName} (${m.quantity})`).join(', ')
                          : '-'}
                      </div>
                      <div className="request-project" style={{ fontSize: "13px", color: "#666", marginTop: "6px" }}>
                        {request.project?.projectName || '-'}
                      </div>
                    </div>
                    <div className="request-requester" style={{ textAlign: 'right' }}>
                      <div className="request-requester-name">{request.createdBy?.name || '-'}</div>
                      <div className="request-date">
                        {request.createdAt ? new Date(request.createdAt).toLocaleDateString() : ''}
                      </div>
                    </div>
                    <div className={`badge badge-${(request.status || '').toLowerCase()}`}>
                      {request.status}
                    </div>
                  </div>
                ))}
              </div>
              <div className="pagination-controls">
                <span className="pagination-info">
                  Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, requests.length)} of {requests.length} entries.
                </span>
                <div className="pagination-buttons">
                  <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1}>&lt;</button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, index) => {
                    let pageNum = index + 1;
                    if (currentPage > 3 && totalPages > 5) {
                      pageNum = (currentPage + index) - 2;
                      if (pageNum > totalPages) pageNum = totalPages - 4 + index;
                    }
                    return (
                      <button
                        key={index}
                        onClick={() => goToPage(pageNum)}
                        className={pageNum === currentPage ? 'active' : ''}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages}>&gt;</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Helper Component: ProjectStats (KPI + Pie Chart) ---
const ProjectStats = ({ project }) => {
  const tasks = Array.isArray(project?.tasks) ? project.tasks : [];
  const completed = tasks.filter(t => t.percent === 100).length;
  const inProgress = tasks.filter(t => t.percent > 0 && t.percent < 100).length;
  const notStarted = tasks.filter(t => t.percent === 0).length;
  const total = tasks.length;

  const pieData = [
    { name: 'Completed', value: completed, color: '#4CAF50' },
    { name: 'In Progress', value: inProgress, color: '#5E4FDB' },
    { name: 'Not Started', value: notStarted, color: '#FF6B6B' },
  ].filter(d => d.value > 0);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
      <div>
        <p><b>Total Tasks:</b> {total}</p>
        <p><b>Completed:</b> {completed}</p>
        <p><b>In Progress:</b> {inProgress}</p>
        <p><b>Not Started:</b> {notStarted}</p>
        <p><b>Assigned Team:</b> {project.manpower?.length || 0}</p>
      </div>
      {pieData.length > 0 && (
        <PieChart width={120} height={120}>
          <Pie
            data={pieData}
            cx={60}
            cy={60}
            innerRadius={36}
            outerRadius={54}
            dataKey="value"
            labelLine={false}
            label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
          >
            {pieData.map((entry, idx) => (
              <Cell key={idx} fill={entry.color} />
            ))}
          </Pie>
        </PieChart>
      )}
    </div>
  );
};

export default PicDash;
