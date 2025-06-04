import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import '../style/pm_style/Pm_Dash.css';
import api from '../../api/axiosInstance';
import { PieChart, Pie, Cell } from 'recharts';

const PmDash = () => {
  const token = localStorage.getItem('token');
  const stored = localStorage.getItem('user');
  const user = stored ? JSON.parse(stored) : null;
  const userId = user?._id;

  const [userName, setUserName] = useState(user?.name || 'ALECK');
  const [userRole, setUserRole] = useState(user?.role || '');
  const [project, setProject] = useState(null);
  const navigate = useNavigate();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  // Static sidebar data
  const [sidebarProjects] = useState([
    { id: 1, name: 'Batangas', engineer: 'Engr. Daryll Miralles' },
    { id: 2, name: 'Twin Lakes Project', engineer: 'Engr. Shaquille' },
    { id: 3, name: 'Calatagan Townhomes', engineer: 'Engr. Rychea Miralles' },
    { id: 4, name: 'Makati', engineer: 'Engr. Michelle Amor' },
    { id: 5, name: 'Cavite', engineer: 'Engr. Zenarose Miranda' },
    { id: 6, name: 'Taguig', engineer: 'Engr. Third Castellar' }
  ]);

  const [reports] = useState([
    { id: 1, name: 'BGC Hotel', dateRange: '7/13/25 - 7/27/25', engineer: 'Engr.' },
    { id: 2, name: 'Protacio Townhomes', dateRange: '7/13/25 - 7/27/25', engineer: 'Engr.' },
    { id: 3, name: 'Fegarido Residences', dateRange: '7/13/25 - 7/27/25', engineer: 'Engr.' }
  ]);

  const [chats] = useState([
    { id: 1, name: 'Rychea Miralles', initial: 'R', message: 'Hello Good Morning po! As...', color: '#4A6AA5' },
    { id: 2, name: 'Third Castellar', initial: 'T', message: 'Hello Good Morning po! As...', color: '#2E7D32' },
    { id: 3, name: 'Zenarose Miranda', initial: 'Z', message: 'Hello Good Morning po! As...', color: '#9C27B0' }
  ]);

  const [materialRequests, setMaterialRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [requestsError, setRequestsError] = useState(null);

  const [, setManpowerRequests] = useState([]);
  const [, setLoadingManpower] = useState(true);
  const [, setManpowerError] = useState(null);

  // Calculate task status counts and pie chart data
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

  // Auth and name setup
  useEffect(() => {
    if (!token || !user) {
      navigate('/');
      return;
    }
    setUserName(user.name);
    setUserRole(user.role);
  }, [navigate, token, user]);

  // Fetch project assigned as Project Manager
  useEffect(() => {
    if (!token || !userId) return;

    const fetchAssignedPMProject = async () => {
      try {
        const { data } = await api.get(`/projects/assigned/projectmanager/${userId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setProject(data);
      } catch (err) {
        console.error('Error fetching assigned PM project:', err);
        setProject(null);
      }
    };

    fetchAssignedPMProject();
  }, [token, userId]);

  // Fetch material requests
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

  // Fetch manpower requests
  useEffect(() => {
    if (!token) {
      setManpowerError('Session expired. Please log in again.');
      setLoadingManpower(false);
      return;
    }
    const fetchManpower = async () => {
      try {
        const { data } = await api.get('/manpower-requests/mine', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setManpowerRequests(Array.isArray(data) ? data : []);
        setManpowerError(null);
      } catch (error) {
        setManpowerError('Error loading manpower requests');
        setManpowerRequests([]);
      }
      setLoadingManpower(false);
    };
    fetchManpower();
  }, [token]);

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

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  return (
    <div className="head">
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
        <div className="profile-menu-container">
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

      {/* Main Content */}
      <div className="dashboard-layout">
        <div className="main1">
          <div className="greeting-section">
            <h1>Good Morning, {userName}!</h1>
            <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>
              Currently logged in as <strong>{userRole}</strong>
            </p>

            
            {/* Project Summary Section */}
            {project && (
              <div className="project-summary-section">
                <h2>{project.projectName} Summary</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '30px' }}>
                  {/* Pie Chart */}
                  {taskStatusData.data.length > 0 ? (
                    <PieChart width={180} height={180}>
                    <Pie
                      data={taskStatusData.data}
                      cx={90}
                      cy={90}
                      innerRadius={60}
                      outerRadius={80}
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
                  ) : (
                    <div style={{ width: 200, height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>
                      No tasks defined for this project.
                    </div>
                  )}

                  {/* KPIs */}
                  <div>
                    <h3>Project KPIs</h3>
                    <p><b>Total Tasks:</b> {taskStatusData.totalTasks}</p>
                    <p><b>Completed:</b> {taskStatusData.completedTasks}</p>
                    <p><b>In Progress:</b> {taskStatusData.inProgressTasks}</p>
                    <p><b>Not Started:</b> {taskStatusData.notStartedTasks}</p>
                    <p><b>Assigned Manpower:</b> {project.manpower?.length || 0}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Recent Activities section */}
            <div className="recent-activities-section">
              <h2>Recent Activities</h2>
              {/* You can map recent activities here */}
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="right-sidebar">
            {/* Material Requests */}
            <div className="pending-requests-section">
              <div className="section-header">
                <h2>Material Requests</h2>
                <Link to="/pm/request/:id" className="view-all-btn">View All</Link>
              </div>
              <div className="pending-requests-list">
                {loadingRequests ? (
                  <div>Loading requests...</div>
                ) : requestsError ? (
                  <div className="error-message">{requestsError}</div>
                ) : materialRequests.length === 0 ? (
                  <div className="no-requests">No material requests found.</div>
                ) : (
                  materialRequests.slice(0, 3).map(request => (
                    <Link to={`/pm/request/${request._id}`} key={request._id} className="pending-request-item">
                      <div className="request-icon">📦</div>
                      <div className="request-details">
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
                      <div className="request-status">
                        <span className={`status-badge ${request.status?.replace(/\s/g, '').toLowerCase()}`}>
                          {request.status}
                        </span>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>

            {/* Chats */}
            <div className="chats-section">
              <h3>Chats</h3>
              <div className="chats-list">
                {chats.map(chat => (
                  <div key={chat.id} className="chat-item">
                    <div className="chat-avatar" style={{ backgroundColor: chat.color }}>{chat.initial}</div>
                    <div className="chat-details">
                      <div className="chat-name">{chat.name}</div>
                      <div className="chat-message">{chat.message}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PmDash;
