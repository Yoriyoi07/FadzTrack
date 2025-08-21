import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import '../style/pm_style/Pm_Dash.css';
import api from '../../api/axiosInstance';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import NotificationBell from '../NotificationBell';
// Nav icons
import { 
  FaTachometerAlt, 
  FaComments, 
  FaBoxes, 
  FaUsers, 
  FaEye, 
  FaClipboardList, 
  FaChartBar, 
  FaCalendarAlt,
  FaUserCircle,
  FaProjectDiagram,
  FaTasks,
  FaCheckCircle,
  FaClock,
  FaExclamationTriangle,
  FaArrowRight
} from 'react-icons/fa';

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
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);

  const [chats, setChats] = useState([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [chatsError, setChatsError] = useState(null);

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

  // --- 6. Scroll handler for header collapse ---
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const shouldCollapse = scrollTop > 50;
      console.log('Scroll detected:', { scrollTop, shouldCollapse, currentState: isHeaderCollapsed });
      setIsHeaderCollapsed(shouldCollapse);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isHeaderCollapsed]);

  // --- 7. Fetch assigned project for current PM ---
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

  // --- 8. Fetch material requests for current user ---
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

  // --- 9. Fetch recent chats for current user ---
  useEffect(() => {
    if (!token) {
      setChatsError('Session expired. Please log in again.');
      setLoadingChats(false);
      return;
    }
    const fetchChats = async () => {
      try {
        // Try to fetch recent chats from the chat endpoint
        const { data } = await api.get('/chats', {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        console.log('Raw chat data received:', data);
        
        // If we get an array, use it directly
        if (Array.isArray(data)) {
          console.log('Using data as array directly');
          setChats(data);
        } 
        // If we get an object with a chats property, use that
        else if (data && data.chats && Array.isArray(data.chats)) {
          console.log('Using data.chats array');
          setChats(data.chats);
        }
        // If we get an object with a messages property, use that
        else if (data && data.messages && Array.isArray(data.messages)) {
          console.log('Using data.messages array');
          setChats(data.messages);
        }
        // Otherwise, try to create a mock structure from the data
        else if (data && typeof data === 'object') {
          console.log('Converting object to array format');
          // Convert object to array format
          const chatArray = Object.keys(data).map(key => {
            const chat = data[key];
            return {
              _id: key,
              name: typeof chat.name === 'string' ? chat.name : 
                    typeof chat.senderName === 'string' ? chat.senderName : 
                    'Unknown User',
              lastMessage: typeof chat.lastMessage === 'string' ? chat.lastMessage : 
                         typeof chat.message === 'string' ? chat.message : 
                         typeof chat.content === 'string' ? chat.content : 
                         'No message',
              lastMessageTime: chat.lastMessageTime || chat.timestamp || chat.createdAt || new Date(),
              color: typeof chat.color === 'string' ? chat.color : '#4A6AA5'
            };
          });
          console.log('Converted chat array:', chatArray);
          setChats(chatArray);
        } else {
          console.log('No valid chat data found, setting empty array');
          setChats([]);
        }
        
        setChatsError(null);
      } catch (error) {
        console.log('Chat fetch error:', error);
        // If chats endpoint doesn't exist, use empty array
        setChats([]);
        setChatsError(null);
      }
      setLoadingChats(false);
    };
    fetchChats();
  }, [token]);

  // --- 10. Close profile menu on outside click ---
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest(".user-profile")) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  // --- 11. Logout handler ---
  const handleLogout = () => {
    api.post('/auth/logout', {}, {
      headers: { Authorization: `Bearer ${token}` }
    }).finally(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
      setUserId(undefined);
      setToken("");
      if (forceUserUpdate) forceUserUpdate();
      window.dispatchEvent(new Event('storage'));
      navigate('/');
    });
  };

  // --- 12. KPI data for Pie Chart ---
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
      { name: 'Completed', value: completedTasks, color: '#22c55e' },
      { name: 'In Progress', value: inProgressTasks, color: '#3b82f6' },
      { name: 'Not Started', value: notStartedTasks, color: '#ef4444' },
    ];
    return {
      data: data.filter(item => item.value > 0),
      completedTasks,
      inProgressTasks,
      notStartedTasks,
      totalTasks,
    };
  }, [project?.tasks]);

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed':
      case 'approved':
        return <FaCheckCircle className="status-icon completed" />;
      case 'in progress':
      case 'pending':
        return <FaClock className="status-icon pending" />;
      case 'rejected':
      case 'cancelled':
        return <FaExclamationTriangle className="status-icon rejected" />;
      default:
        return <FaClock className="status-icon pending" />;
    }
  };

  return (
    <div className="dashboard-container">
      {/* Modern Header */}
      <header className={`dashboard-header ${isHeaderCollapsed ? 'collapsed' : ''}`}>
        {/* Top Row: Logo and Profile */}
        <div className="header-top">
          <div className="logo-section">
            <img
              src={require('../../assets/images/FadzLogo1.png')}
              alt="FadzTrack Logo"
              className="header-logo"
            />
            <h1 className="header-brand">FadzTrack</h1>
          </div>
          
          <div className="user-profile" onClick={() => setProfileMenuOpen(!profileMenuOpen)}>
            <div className="profile-avatar">
              <FaUserCircle />
            </div>
            <div className={`profile-info ${isHeaderCollapsed ? 'hidden' : ''}`}>
              <span className="profile-name">{userName}</span>
              <span className="profile-role">{userRole}</span>
            </div>
            {profileMenuOpen && (
              <div className="profile-dropdown">
                <button onClick={handleLogout} className="logout-btn">
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Row: Navigation and Notifications */}
        <div className="header-bottom">
          <nav className="header-nav">
            <Link to="/pm" className="nav-item active">
              <FaTachometerAlt />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Dashboard</span>
            </Link>
            <Link to="/pm/chat" className="nav-item">
              <FaComments />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Chat</span>
            </Link>
            <Link to="/pm/request/:id" className="nav-item">
              <FaBoxes />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Material</span>
            </Link>
            <Link to="/pm/manpower-list" className="nav-item">
              <FaUsers />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Manpower</span>
            </Link>
            {project && (
              <Link to={`/pm/viewprojects/${project._id || project.id}`} className="nav-item">
                <FaEye />
                <span className={isHeaderCollapsed ? 'hidden' : ''}>View Project</span>
              </Link>
            )}
            <Link to="/pm/daily-logs" className="nav-item">
              <FaClipboardList />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Logs</span>
            </Link>
            {project && (
              <Link to={`/pm/progress-report/${project._id}`} className="nav-item">
                <FaChartBar />
                <span className={isHeaderCollapsed ? 'hidden' : ''}>Reports</span>
              </Link>
            )}
            <Link to="/pm/daily-logs-list" className="nav-item">
              <FaCalendarAlt />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Daily Logs</span>
            </Link>
          </nav>
          
          <NotificationBell />
        </div>
      </header>

      {/* Main Dashboard Content */}
      <main className="dashboard-main">
        <div className="dashboard-grid">
          {/* Welcome & Project Overview Card */}
          <div className="dashboard-card welcome-card">
            <div className="card-header">
              <div className="welcome-content">
                <h2 className="welcome-title">Welcome back, {userName}! 👋</h2>
                <p className="welcome-subtitle">Here's what's happening with your project today</p>
              </div>
              {project && (
                <div className="project-badge">
                  <FaProjectDiagram />
                  <span>{project.projectName}</span>
                </div>
              )}
            </div>
            
            {project && (
              <div className="project-stats">
                <div className="stat-item">
                  <div className="stat-icon">
                    <FaTasks />
                  </div>
                  <div className="stat-content">
                    <span className="stat-value">{taskStatusData.totalTasks}</span>
                    <span className="stat-label">Total Tasks</span>
                  </div>
                </div>
                <div className="stat-item">
                  <div className="stat-icon completed">
                    <FaCheckCircle />
                  </div>
                  <div className="stat-content">
                    <span className="stat-value">{taskStatusData.completedTasks}</span>
                    <span className="stat-label">Completed</span>
                  </div>
                </div>
                <div className="stat-item">
                  <div className="stat-icon in-progress">
                    <FaClock />
                  </div>
                  <div className="stat-content">
                    <span className="stat-value">{taskStatusData.inProgressTasks}</span>
                    <span className="stat-label">In Progress</span>
                  </div>
                </div>
                <div className="stat-item">
                  <div className="stat-icon not-started">
                    <FaExclamationTriangle />
                  </div>
                  <div className="stat-content">
                    <span className="stat-value">{taskStatusData.notStartedTasks}</span>
                    <span className="stat-label">Not Started</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Task Progress Chart */}
          {project && taskStatusData.data.length > 0 && (
            <div className="dashboard-card chart-card">
              <div className="card-header">
                <h3 className="card-title">Task Progress Overview</h3>
              </div>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={taskStatusData.data}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={80}
                      fill="#8884d8"
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {taskStatusData.data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Recent Chats */}
          <div className="dashboard-card chats-card">
            <div className="card-header">
              <h3 className="card-title">Recent Conversations</h3>
              <Link to="/pm/chat" className="view-all-link">
                View All <FaArrowRight />
              </Link>
            </div>
            <div className="chats-list">
              {loadingChats ? (
                <div className="loading-state">
                  <div className="loading-spinner"></div>
                  <span>Loading conversations...</span>
                </div>
              ) : chatsError ? (
                <div className="error-state">
                  <FaExclamationTriangle />
                  <span>{chatsError}</span>
                </div>
              ) : chats.length === 0 ? (
                <div className="empty-state">
                  <FaComments />
                  <span>No recent conversations</span>
                  <p>Start chatting with your team members</p>
                </div>
              ) : (
                chats.slice(0, 3).map((chat, index) => {
                  console.log('Chat data for time debugging:', {
                    chatId: chat._id || index,
                    lastMessageTime: chat.lastMessageTime,
                    timestamp: chat.timestamp,
                    createdAt: chat.createdAt,
                    fullChat: chat
                  });
                  
                  return (
                    <Link 
                      key={chat._id || index} 
                      to={`/pm/chat/${chat._id || chat.chatId || index}`}
                      className="chat-item"
                      style={{ textDecoration: 'none' }}
                    >
                      <div className="chat-avatar" style={{ backgroundColor: chat.color || '#3b82f6' }}>
                        {typeof chat.name === 'string' ? chat.name.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <div className="chat-content">
                        <div className="chat-header">
                          <span className="chat-name">
                            {typeof chat.name === 'string' ? chat.name : 'Unknown User'}
                          </span>
                          <span className="chat-time">
                            {(() => {
                              const time = chat.lastMessageTime || chat.timestamp || chat.createdAt;
                              if (!time) return 'Just now';
                              
                              try {
                                if (typeof time === 'string') {
                                  const date = new Date(time);
                                  if (isNaN(date.getTime())) return 'Just now';
                                  return date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                                } else if (time instanceof Date) {
                                  return time.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                                } else if (typeof time === 'number') {
                                  const date = new Date(time);
                                  return date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                                }
                                return 'Just now';
                              } catch (error) {
                                console.log('Time formatting error:', error, 'for time:', time);
                                return 'Just now';
                              }
                            })()}
                          </span>
                        </div>
                        <p className="chat-message">
                          {typeof chat.lastMessage === 'string' ? chat.lastMessage : 'No messages yet'}
                        </p>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </div>

          {/* Material Requests */}
          <div className="dashboard-card requests-card">
            <div className="card-header">
              <h3 className="card-title">Material Requests</h3>
              <Link to="/pm/request/:id" className="view-all-link">
                View All <FaArrowRight />
              </Link>
            </div>
            <div className="requests-content">
              {loadingRequests ? (
                <div className="loading-state">
                  <div className="loading-spinner"></div>
                  <span>Loading requests...</span>
                </div>
              ) : requestsError ? (
                <div className="error-state">
                  <FaExclamationTriangle />
                  <span>{requestsError}</span>
                </div>
              ) : materialRequests.length === 0 ? (
                <div className="empty-state">
                  <FaBoxes />
                  <span>No material requests found</span>
                  <p>All requests have been processed or none are pending</p>
                </div>
              ) : (
                <div className="requests-list">
                  {materialRequests.slice(0, 3).map(request => (
                    <Link to={`/pm/request/${request._id}`} key={request._id} className="request-item">
                      <div className="request-icon">
                        <FaBoxes />
                      </div>
                      <div className="request-details">
                        <h4 className="request-title">
                          {request.materials?.map(m => `${m.materialName} (${m.quantity})`).join(', ')}
                        </h4>
                        <p className="request-description">{request.description}</p>
                        <div className="request-meta">
                          <span className="request-project">{request.project?.projectName}</span>
                          <span className="request-date">
                            {new Date(request.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className="request-status">
                        {getStatusIcon(request.status)}
                        <span className={`status-text ${request.status?.replace(/\s/g, '').toLowerCase()}`}>
                          {request.status}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PmDash;
