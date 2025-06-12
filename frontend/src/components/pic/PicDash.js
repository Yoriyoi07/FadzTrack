import React, { useState, useEffect } from 'react';
import '../style/pic_style/Pic_Dash.css';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../api/axiosInstance';
import { PieChart, Pie, Cell } from 'recharts';
import ProgressTracker from '../ProgressTracker';
import NotificationBell from '../NotificationBell';

const PicDash = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const stored = localStorage.getItem('user');
  const user = stored ? JSON.parse(stored) : null;
  const userId = user?._id;

  const [requests, setRequests] = useState([]);
  const [userName, setUserName] = useState(user?.name || '');
  const [userRole, setUserRole] = useState(user?.role || '');
  const [project, setProject] = useState(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const [nudgeCooldowns, setNudgeCooldowns] = useState({});


  useEffect(() => {
  const saved = localStorage.getItem('nudgeCooldowns');
  if (saved) {
    const parsed = JSON.parse(saved);
    const now = Date.now();
    const filtered = Object.fromEntries(
      Object.entries(parsed).filter(([_, ts]) => ts > now)
    );
    setNudgeCooldowns(filtered);
  }
}, []);

useEffect(() => {
  localStorage.setItem('nudgeCooldowns', JSON.stringify(nudgeCooldowns));
}, [nudgeCooldowns]);

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

  const handleNudge = async (request, pendingRole) => {
  if (nudgeCooldowns[request._id]) return; // Already on cooldown

  try {
    await api.post(`/requests/${request._id}/nudge`);
    alert(`Nudge sent to ${pendingRole}.`);
    setNudgeCooldowns(prev => ({
      ...prev,
      [request._id]: Date.now() + 60 * 60 * 1000 // 1 hour from now
    }));
    setTimeout(() => {
      setNudgeCooldowns(prev => {
        const { [request._id]: _, ...rest } = prev;
        return rest;
      });
    }, 60 * 60 * 1000); // 1 hour
  } catch (err) {
    // Handle 429 too, set cooldown for the remaining time
    if (err.response && err.response.data && err.response.data.message) {
      alert(err.response.data.message);
      const match = /(\d+) minute/.exec(err.response.data.message);
      if (match) {
        const minutes = parseInt(match[1], 10);
        setNudgeCooldowns(prev => ({
          ...prev,
          [request._id]: Date.now() + minutes * 60 * 1000
        }));
        setTimeout(() => {
          setNudgeCooldowns(prev => {
            const { [request._id]: _, ...rest } = prev;
            return rest;
          });
        }, minutes * 60 * 1000);
      }
    } else {
      alert('Failed to send nudge.');
    }
  }
};



  // Only fetch user's active/ongoing project
  useEffect(() => {
    if (!token || !userId) return;
    const fetchActiveProject = async () => {
      try {
        const { data } = await api.get(`/projects/by-user-status?userId=${userId}&role=pic&status=Ongoing`);
        setProject(data[0] || null);
      } catch (err) {
        setProject(null);
      }
    };
    fetchActiveProject();
  }, [token, userId]);

  // Fetch requests for this PIC's current project **only**
  useEffect(() => {
    if (!token || !project) return;

    api.get('/requests/mine', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(({ data }) => {
        const projectRequests = Array.isArray(data)
          ? data.filter(r => r.project && r.project._id === project._id)
          : [];
        setRequests(projectRequests);
      })
      .catch(() => setRequests([]));
  }, [token, project]);

  // Sample chats data
  const [chats] = useState([
    { id: 1, name: 'Rychea Miralles', initial: 'R', message: 'Hello Good Morning po! As...', color: '#4A6AA5' },
    { id: 2, name: 'Third Castellar', initial: 'T', message: 'Hello Good Morning po! As...', color: '#2E7D32' },
    { id: 3, name: 'Zenarose Miranda', initial: 'Z', message: 'Hello Good Morning po! As...', color: '#9C27B0' }
  ]);

const handleLogout = () => {
  const token = localStorage.getItem('token');
  api.post('/auth/logout', {}, {
    headers: { Authorization: `Bearer ${token}` }
  }).finally(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  });
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
          <Link to="/pic/projects" className="nav-link">My Projects</Link>
          <Link to="/pic/chat" className="nav-link">Chat</Link>
        </nav>
        <div className="profile-menu-container" style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <NotificationBell />
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
            <h1 className="main-title">Hello, {userName}!</h1>
            <p style={{ fontSize: '14px', color: '#666', marginBottom: '12px' }}>
              Currently logged in as <strong>{userRole}</strong>
            </p>

            {/* --- Project Summary and Requests Section --- */}
            {project ? (
              <div className="clean-project-summary">
                <div className="left-summary">
                  <h2 style={{ marginBottom: 10 }}>{project.projectName} Summary</h2>
                  <ProjectStats project={project} />
                </div>
                <div className="right-summary flat-summary">
                  <span className="request-title">Requests</span>
                  <button
                    className="add-project-btn"
                    onClick={() => navigate(`/pic/projects/${project._id}/request`)}
                  >
                    Add New Request
                  </button>
                  <span className="request-total-label">Total Requests</span>
                  <span className="request-total-number">{requests.length}</span>
                </div>
              </div>
            ) : (
              <div className="clean-project-summary">
                <div style={{ padding: 32, width: "100%" }}>
                  <h2>No Ongoing Project Assigned</h2>
                  <p>
                    You are not currently assigned to any ongoing project.<br />
                    See <Link to="/pic/projects">My Projects</Link> for completed/archived.
                  </p>
                </div>
              </div>
            )}

            {/* Request Overview only if active project */}
            {project && (
              <div>
                <h2 className="section-title">Request Overview</h2>
                <div className="request-list">
                  {currentRequests.map(request => {
  // Logic to check which role is pending
  let pendingRole = null;
  if (request.status === 'Pending Project Manager') pendingRole = 'Project Manager';
  else if (request.status === 'Pending Area Manager') pendingRole = 'Area Manager';
  else if (request.status === 'Pending CEO') pendingRole = 'CEO';

  return (
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
        <div className="request-project">
          {request.project?.projectName || '-'}
        </div>
        <div>
          <ProgressTracker request={request} />
        </div>
        {/* Nudge button (only show if there's a pending role) */}
        {pendingRole && (
         <button
  className="nudge-btn"
  disabled={!!nudgeCooldowns[request._id]} // disable if in cooldown
  onClick={e => {
    e.stopPropagation();
    handleNudge(request, pendingRole);
  }}>
  {nudgeCooldowns[request._id]
    ? `Nudge Disabled (${Math.ceil((nudgeCooldowns[request._id] - Date.now()) / 60000)}m left)`
    : `Nudge ${pendingRole}`}
</button>

        )}
      </div>
      <div className="request-requester">
        <div className="request-requester-name">{request.createdBy?.name || '-'}</div>
        <div className="request-date">
          {request.createdAt ? new Date(request.createdAt).toLocaleDateString() : ''}
        </div>
      </div>
    </div>
  );
})}
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
            )}
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
