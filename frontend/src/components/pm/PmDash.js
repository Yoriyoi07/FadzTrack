import React, { useState, useEffect, useCallback } from 'react';
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
  FaClipboardList,
  FaChartBar,
  FaCalendarAlt,
  FaProjectDiagram,
  FaTasks,
  FaCheckCircle,
  FaClock,
  FaExclamationTriangle,
  FaArrowRight
} from 'react-icons/fa';

const PmDash = ({ forceUserUpdate }) => {
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
  const fetchChats = useCallback(async () => {
    if (!token) {
      console.log('No token available for fetchChats');
      setChatsError('Session expired. Please log in again.');
      setLoadingChats(false);
      return;
    }

    if (!userId) {
      console.log('No userId available for fetchChats');
      setChatsError('User ID not available');
      setLoadingChats(false);
      return;
    }

    console.log('Starting fetchChats with token and userId:', { token: token.substring(0, 20) + '...', userId });
    setLoadingChats(true);

    try {
      // First, let's test what user ID the backend expects
      try {
        const testResponse = await api.get('/auth/me', { headers: { Authorization: `Bearer ${token}` } });
        console.log('Backend user info:', testResponse.data);
        console.log('Backend user ID:', testResponse.data._id);
        console.log('Frontend userId:', userId);
        console.log('Are they the same?', testResponse.data._id === userId);
      } catch (testError) {
        console.log('Could not get backend user info:', testError.message);
      }

      // Fetch conversations for the current user
      const headers = { Authorization: `Bearer ${token}` };
      console.log('Making API call to /chats with headers:', headers);

      const { data } = await api.get('/chats', { headers });

      console.log('Raw chat data received:', data);
      console.log('Data type:', typeof data);
      console.log('Is array?', Array.isArray(data));

      if (Array.isArray(data)) {
        console.log('Chat data is array, length:', data.length);
        if (data.length > 0) {
          console.log('First chat item structure:', data[0]);
          console.log('First chat users:', data[0].users);
          console.log('Current userId:', userId);
        }

        // Process each conversation to extract proper data
        const processedChats = data.map((conversation, index) => {
          console.log(`Processing chat ${index}:`, conversation);

          // Get the other user's name (not the current user)
          // Try different ways to find the other user
          let otherUser = conversation.users?.find(user => user._id !== userId);

          // If no other user found, try with string comparison
          if (!otherUser && conversation.users?.length > 0) {
            otherUser = conversation.users.find(user => user._id.toString() !== userId.toString());
          }

          // If still no other user, just take the first user that's not the current one
          if (!otherUser && conversation.users?.length > 0) {
            otherUser = conversation.users.find(user => user._id !== userId);
          }

          console.log(`Other user for chat ${index}:`, otherUser);
          console.log(`Other user _id:`, otherUser?._id);
          console.log(`Current userId:`, userId);
          console.log(`Comparison result:`, otherUser?._id !== userId);

          let otherUserName = 'Unknown User';
          if (otherUser) {
            otherUserName = otherUser.name || `${otherUser.firstname || ''} ${otherUser.lastname || ''}`.trim() || 'Unknown User';
          } else if (conversation.users?.length > 0) {
            // Fallback: show all users in the chat
            const allUserNames = conversation.users.map(user =>
              user.name || `${user.firstname || ''} ${user.lastname || ''}`.trim() || 'Unknown'
            ).filter(name => name !== 'Unknown');
            otherUserName = allUserNames.length > 0 ? allUserNames.join(', ') : 'Unknown User';
          }

          console.log(`Other user name for chat ${index}:`, otherUserName);

          // Get the last message content
          let lastMessageContent = 'No messages yet';
          let lastMessageTime = new Date();

          if (conversation.lastMessage) {
            lastMessageContent = conversation.lastMessage.content || 'No messages yet';
            lastMessageTime = conversation.lastMessage.timestamp || new Date();
            console.log(`Last message for chat ${index}:`, { content: lastMessageContent, time: lastMessageTime });
          }

          const processedChat = {
            _id: conversation._id,
            name: conversation.isGroup ? conversation.name : otherUserName,
            isGroup: conversation.isGroup || false,
            lastMessage: lastMessageContent,
            lastMessageTime: lastMessageTime,
            users: conversation.users || [],
            color: '#4A6AA5'
          };

          console.log(`Processed chat ${index}:`, processedChat);
          return processedChat;
        });

        console.log('All processed chats:', processedChats);
        setChats(processedChats);
      } else {
        console.log('No valid chat data found, setting empty array');
        console.log('Data received was:', data);
        setChats([]);
      }

      setChatsError(null);
    } catch (error) {
      console.log('Chat fetch error:', error);
      console.log('Error response:', error.response);
      console.log('Error message:', error.message);
      setChats([]);
      setChatsError(`Failed to load conversations: ${error.message}`);
    }
    setLoadingChats(false);
  }, [token, userId]);

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  // Auto-refresh chats every 30 seconds
  useEffect(() => {
    if (!token || !userId) return;

    const interval = setInterval(() => {
      console.log('Auto-refreshing conversations...');
      fetchChats();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [token, userId, fetchChats]);

  // Refresh conversations when user returns to dashboard tab
  useEffect(() => {
    const handleFocus = () => {
      if (token && userId) {
        console.log('Dashboard focused, refreshing conversations...');
        fetchChats();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [token, userId, fetchChats]);

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

  // Function to truncate text to about 10 words
  const truncateMessage = (text, maxWords = 10) => {
    if (!text || typeof text !== 'string') return 'No messages yet';

    const words = text.trim().split(/\s+/);
    if (words.length <= maxWords) return text;

    return words.slice(0, maxWords).join(' ') + '...';
  };

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
    <div className="pm-dashboard dashboard-container">
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
              {userName ? userName.charAt(0).toUpperCase() : 'P'}
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
              <FaProjectDiagram />
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
              <div className="card-actions">
                <button
                  className="refresh-btn"
                  onClick={fetchChats}
                  title="Refresh conversations"
                  disabled={loadingChats}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 4v6h6M23 20v-6h-6" />
                    <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
                  </svg>
                </button>
                <Link to="/pm/chat" className="view-all-link">
                  View All <FaArrowRight />
                </Link>
              </div>
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
                                  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                } else if (time instanceof Date) {
                                  return time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                } else if (typeof time === 'number') {
                                  const date = new Date(time);
                                  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
                          {truncateMessage(typeof chat.lastMessage === 'string' ? chat.lastMessage : 'No messages yet')}
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
