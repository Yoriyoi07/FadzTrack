import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import '../style/pm_style/Pm_Dash.css';
import api from '../../api/axiosInstance';
import { PieChart, Pie, Cell } from 'recharts';
import NotificationBell from '../NotificationBell';

const PmDash = ({forceUserUpdate}) => {
  const navigate = useNavigate();

  // --- 1. User, token, userId state ---
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('token') || "");
  const [userId, setUserId] = useState(() => user?._id);

  // --- 2. Listen for storage changes for live update on login/logout/user switch ---
 useEffect(() => {
    const handleUserChange = () => {
      const stored = localStorage.getItem('user');
      setUser(stored ? JSON.parse(stored) : null);
      setUserId(stored ? JSON.parse(stored)._id : undefined);
      setToken(localStorage.getItem('token') || "");
    };
    window.addEventListener("storage", handleUserChange);
    return () => window.removeEventListener("storage", handleUserChange);
  }, []);

  // --- 3. Update username/role from state ---
  const [userName, setUserName] = useState(user?.name || 'ALECK');
  const [userRole, setUserRole] = useState(user?.role || '');

  useEffect(() => {
    setUserName(user?.name || 'ALECK');
    setUserRole(user?.role || '');
  }, [user]);

  // --- 4. Page data state ---
  const [project, setProject] = useState(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const [chats] = useState([
    { id: 1, name: 'Rychea Miralles', initial: 'R', message: 'Hello Good Morning po! As...', color: '#4A6AA5' },
    { id: 2, name: 'Third Castellar', initial: 'T', message: 'Hello Good Morning po! As...', color: '#2E7D32' },
    { id: 3, name: 'Zenarose Miranda', initial: 'Z', message: 'Hello Good Morning po! As...', color: '#9C27B0' }
  ]);

  const [materialRequests, setMaterialRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [requestsError, setRequestsError] = useState(null);

  // --- 5. Redirect to login if not logged in ---
  useEffect(() => {
    if (!token || !userId) {
      navigate('/');
      return;
    }
  }, [token, userId, navigate]);

  // --- 6. Fetch assigned project for current PM ---
  useEffect(() => {
    if (!token || !userId) return;
    const fetchAssignedPMProject = async () => {
      try {
        const { data } = await api.get(`/projects/assigned/projectmanager/${userId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setProject(data);
      } catch (err) {
        setProject(null);
      }
    };
    fetchAssignedPMProject();
  }, [token, userId]);

  // --- 7. Fetch material requests for current user ---
  useEffect(() => {
    if (!token) {
      setRequestsError('Session expired. Please log in again.');
      setLoadingRequests(false);
      return;
    }
    const fetchRequests = async () => {
      try {
        const { data } = await api.get('/requests/mine', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setMaterialRequests(Array.isArray(data) ? data : []);
        setRequestsError(null);
      } catch (error) {
        setRequestsError('Error loading material requests');
        setMaterialRequests([]);
      }
      setLoadingRequests(false);
    };
    fetchRequests();
  }, [token]);

  // --- 8. Close profile menu on outside click ---
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest(".profile-menu-container")) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  // --- 9. Logout handler ---
  const handleLogout = () => {
    api.post('/auth/logout', {}, {
      headers: { Authorization: `Bearer ${token}` }
    }).finally(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
      setUserId(undefined);
      setToken("");
      if (forceUserUpdate) forceUserUpdate(); // <--- Key line
      window.dispatchEvent(new Event('storage')); // For other tabs
      navigate('/');
    });
  };

  // --- 10. KPI data for Pie Chart ---
  const taskStatusData = React.useMemo(() => {
    if (!project?.tasks || !Array.isArray(project.tasks)) {
      return {
        data: [],
        completedTasks: 0,
        inProgressTasks: 0,
        notStartedTasks: 0,
        totalTasks: 0,
      };
    }
    const completedTasks = project.tasks.filter(task => task.percent === 100).length;
    const inProgressTasks = project.tasks.filter(task => task.percent > 0 && task.percent < 100).length;
    const notStartedTasks = project.tasks.filter(task => task.percent === 0).length;
    const totalTasks = project.tasks.length;
    const data = [
      { name: 'Completed', value: completedTasks, color: '#4CAF50' },
      { name: 'In Progress', value: inProgressTasks, color: '#5E4FDB' },
      { name: 'Not Started', value: notStartedTasks, color: '#FF6B6B' },
    ];
    return {
      data: data.filter(item => item.value > 0),
      completedTasks,
      inProgressTasks,
      notStartedTasks,
      totalTasks,
    };
  }, [project?.tasks]);

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
          <Link to="/reports" className="nav-link">Reports</Link>
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

      <div className="pm-dash dashboard-layout">
        <div className="left-column">
          <div className="analytics-box">
            <div>
              <h1>Good Morning, {userName}!</h1>
              <p style={{ fontSize: '14px', color: '#666' }}>
                Currently logged in as <strong>{userRole}</strong>
              </p>
              {project && (
                <>
                  <h2 style={{ marginTop: '10px' }}>{project.projectName} Summary</h2>
                  <div className="kpi">
                    <p><b>Total Tasks:</b> {taskStatusData.totalTasks}</p>
                    <p><b>Completed:</b> {taskStatusData.completedTasks}</p>
                    <p><b>In Progress:</b> {taskStatusData.inProgressTasks}</p>
                    <p><b>Not Started:</b> {taskStatusData.notStartedTasks}</p>
                    <p><b>Assigned Manpower:</b> {project.manpower?.length || 0}</p>
                  </div>
                </>
              )}
            </div>
            {project && taskStatusData.data.length > 0 && (
              <PieChart width={160} height={160}>
                <Pie
                  data={taskStatusData.data}
                  cx={80}
                  cy={80}
                  innerRadius={50}
                  outerRadius={70}
                  fill="#8884d8"
                  paddingAngle={0}
                  dataKey="value"
                  label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {taskStatusData.data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            )}
          </div>
          <div className="chats-box">
            <h3>Chats</h3>
            <div className="pm-dash chats-list">
              {chats.map(chat => (
                <div key={chat.id} className="pm-dash chat-item">
                  <div className="pm-dash chat-avatar" style={{ backgroundColor: chat.color }}>{chat.initial}</div>
                  <div className="pm-dash chat-details">
                    <div className="pm-dash chat-name">{chat.name}</div>
                    <div className="pm-dash chat-message">{chat.message}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="right-column">
          <div className="material-header">
            <h2>Material Requests</h2>
            <Link to="/pm/request/:id" className="view-all-btn">View All</Link>
          </div>
          <div className="pm-dash pending-requests-list">
            {loadingRequests ? (
              <div>Loading requests...</div>
            ) : requestsError ? (
              <div className="error-message">{requestsError}</div>
            ) : materialRequests.length === 0 ? (
              <div className="no-requests">No material requests found.</div>
            ) : (
              materialRequests.slice(0, 3).map(request => (
                <Link to={`/pm/request/${request._id}`} key={request._id} className="pm-dash pending-request-item">
                  <div className="pm-dash request-icon">📦</div>
                  <div className="pm-dash request-details">
                    <h3 className="request-title">
                      {request.materials?.map(m => `${m.materialName} (${m.quantity})`).join(', ')}
                    </h3>
                    <p className="request-description">{request.description}</p>
                    <div className="request-meta">
                      <span className="request-project">{request.project?.projectName}</span>
                      <span className="request-date">
                        Requested: {new Date(request.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="pm-dash request-status">
                    <span className={`pm-dash status-badge ${request.status?.replace(/\s/g, '').toLowerCase()}`}>
                      {request.status}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PmDash;
