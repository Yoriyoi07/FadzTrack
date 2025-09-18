import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import '../style/pm_style/Pm_Dash.css';
import api from '../../api/axiosInstance';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import AppHeader from '../layout/AppHeader';
// Nav icons
import { FaComments, FaBoxes, FaProjectDiagram, FaTasks, FaCheckCircle, FaClock, FaExclamationTriangle, FaArrowRight, FaUserTie, FaBuilding, FaChartBar, FaUsers } from 'react-icons/fa';

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
  // Unified header removes local profile/collapse states

  const [chats, setChats] = useState([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [chatsError, setChatsError] = useState(null);

  const [materialRequests, setMaterialRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [requestsError, setRequestsError] = useState(null);

  // Timeline status logic function
  const getTimelineStatus = (status, stage) => {
    const statusLower = status?.toLowerCase() || '';
    
    // Check for rejected statuses
    if (statusLower.includes('rejected')) {
      return 'rejected';
    }
    
    switch (stage) {
      case 'placed':
        // Placed should be green (one step behind) when PM is pending
        if (statusLower.includes('pending pm') || statusLower.includes('project manager')) {
          return 'completed one-step-behind'; // Green - one step behind pending
        } else if (statusLower.includes('pending am') || statusLower.includes('area manager') || 
                   statusLower.includes('approved') || statusLower.includes('received')) {
          return 'completed'; // Blue - two or more steps behind pending
        }
        return 'completed'; // Default to blue for placed
        
      case 'pm':
        if (statusLower.includes('rejected pm') || statusLower.includes('pm rejected')) {
          return 'rejected';
        } else if (statusLower.includes('pending pm') || statusLower.includes('project manager')) {
          return 'pending'; // Yellow/Orange - pending
        } else if (statusLower.includes('pending am') || statusLower.includes('area manager')) {
          return 'completed one-step-behind'; // Green - one step behind pending
        } else if (statusLower.includes('approved') || statusLower.includes('received')) {
          return 'completed'; // Blue - two or more steps behind pending
        }
        break;
        
      case 'am':
        if (statusLower.includes('rejected am') || statusLower.includes('am rejected')) {
          return 'rejected';
        } else if (statusLower.includes('pending am') || statusLower.includes('area manager')) {
          return 'pending'; // Yellow/Orange - pending
        } else if (statusLower.includes('approved')) {
          return 'completed one-step-behind'; // Green - one step behind final
        } else if (statusLower.includes('received')) {
          return 'completed'; // Blue - final reached
        }
        break;
      
        
      case 'done':
        if (statusLower.includes('received')) {
          return 'completed'; // Blue - completed
        }
        break;
    }
    
    return ''; // Default empty state
  };

  // --- 5. Redirect to login if not logged in ---
  useEffect(() => {
    if (!token || !userId) {
      navigate('/');
      return;
    }
  }, [token, userId, navigate]);

  // Removed: header collapse logic handled globally or no longer required

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

  // Removed custom logout (AppHeader handles logout)

  // --- 12. Report-based metrics ---
  const [reports, setReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(false);

  // Fetch reports for the project
  const fetchReports = useCallback(async () => {
    if (!project?._id || !token) return;
    
    try {
      setReportsLoading(true);
      const { data } = await api.get(`/projects/${project._id}/reports`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setReports(data?.reports || []);
    } catch (error) {
      console.error('Failed to fetch reports:', error);
      setReports([]);
    } finally {
      setReportsLoading(false);
    }
  }, [project?._id, token]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Auto-refresh reports when global event dispatched (from ProjectView socket)
  useEffect(()=>{
    const handler = (e)=>{ if(String(e?.detail?.projectId)===String(project?._id)) fetchReports(); };
    window.addEventListener('projectReportsUpdated', handler);
    return ()=> window.removeEventListener('projectReportsUpdated', handler);
  },[project?._id, fetchReports]);

  // Calculate metrics from reports
  const reportMetrics = React.useMemo(() => {
    if (!reports.length) {
      return {
        data: [],
        totalReports: 0,
        completedWorkItems: 0,
        inProgressWorkItems: 0,
        totalWorkItems: 0,
        averageContribution: 0,
        reportingPics: 0,
        lastReportDate: null
      };
    }

    // Get latest report per PIC
    const sorted = [...reports].sort((a, b) => new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0));
    const byUploader = new Map();
    for (const report of sorted) {
      const key = report.uploadedBy || report.uploadedByName || report._id;
      if (!byUploader.has(key)) byUploader.set(key, report);
    }
    const distinctReports = [...byUploader.values()];

    // Calculate work items from reports
    let totalCompleted = 0;
    let totalInProgress = 0;
    let totalWorkItems = 0;
    let totalContribution = 0;
    let validContributions = 0;

    distinctReports.forEach(report => {
      const ai = report.ai || {};
      const completed = ai.completed_tasks?.length || 0;
      const inProgress = ai.summary_of_work_done?.length || 0;
      const raw = Number(ai.pic_contribution_percent_raw);
      const legacy = Number(ai.pic_contribution_percent);
      const contribution = (isFinite(raw) && raw >= 0) ? raw : ((isFinite(legacy) && legacy >= 0) ? legacy : 0);

      totalCompleted += completed;
      totalInProgress += inProgress;
      totalWorkItems += completed + inProgress;

      if (contribution > 0) {
        totalContribution += contribution;
        validContributions++;
      }
    });

    const averageContribution = validContributions > 0 ? totalContribution / validContributions : 0;
    const lastReportDate = sorted[0]?.uploadedAt || null;

    const data = [
      { name: 'Completed', value: totalCompleted, color: '#22c55e' },
      { name: 'In Progress', value: totalInProgress, color: '#3b82f6' },
    ].filter(item => item.value > 0);

    return {
      data,
      totalReports: reports.length,
      completedWorkItems: totalCompleted,
      inProgressWorkItems: totalInProgress,
      totalWorkItems,
      averageContribution: Math.round(averageContribution),
      reportingPics: distinctReports.length,
      lastReportDate
    };
  }, [reports]);

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
      <AppHeader roleSegment="pm" />

      {/* Main Dashboard Content */}
      <main className="dashboard-main">
        <div className="dashboard-grid">
          {/* Welcome & Project Overview Card */}
          <div className="dashboard-card pm-welcome-card">
            {/* Hero Art */}
            <div 
              className="hero-art"
              aria-hidden="true"
              style={{
                backgroundImage: `radial-gradient(ellipse at 65% 35%, rgba(255,255,255,0.18), transparent 55%), url(${process.env.PUBLIC_URL || ''}/images/illustration-construction-site.png)`
              }}
            />
            
            <div className="welcome-content">
              <h2 className="welcome-title">Welcome back, {userName}! 👋</h2>
              <p className="welcome-subtitle">Here's what's happening with your project today</p>
            </div>
            
            {/* Welcome Stats */}
            <div className="welcome-stats">
              <Link to="/pm/viewproj" className="stat-link">
                <div className="stat-item">
                  <div className="stat-icon">
                    <FaProjectDiagram />
                  </div>
                  <div className="stat-content">
                    <div className="stat-value">{project ? 1 : 0}</div>
                    <div className="stat-label">TOTAL PROJECTS</div>
                  </div>
                </div>
              </Link>
              
              <Link to="/pm/viewproj" className="stat-link">
                <div className="stat-item">
                  <div className="stat-icon">
                    <FaUsers />
                  </div>
                  <div className="stat-content">
                    <div className="stat-value">{project?.manpower?.length || 0}</div>
                    <div className="stat-label">TEAM MEMBERS</div>
                  </div>
                </div>
              </Link>
            </div>

            {/* KPI Strip */}
            <div className="kpi-strip">
              <Link to="/pm/request/:id" className="kpi">
                <div className="kpi-ico">
                  <FaBoxes />
                </div>
                <div className="kpi-body">
                  <div className="kpi-title">Pending Requests</div>
                  <div className="kpi-value">{materialRequests.filter(r => r.status === 'Pending').length}</div>
                </div>
              </Link>
              
              <Link to="/pm/viewproj" className="kpi">
                <div className="kpi-ico">
                  <FaChartBar />
                </div>
                <div className="kpi-body">
                  <div className="kpi-title">Active Projects</div>
                  <div className="kpi-value">{project ? 1 : 0}</div>
                </div>
              </Link>
              
              <Link to="/pm/viewproj" className="kpi">
                <div className="kpi-ico">
                  <FaProjectDiagram />
                </div>
                <div className="kpi-body">
                  <div className="kpi-title">Avg. Progress</div>
                  <div className="kpi-value">{project?.progress || 0}%</div>
                </div>
              </Link>
            </div>
            

          </div>

          {/* Work Progress Chart */}
          {project && reportMetrics.data.length > 0 && (
            <div className="dashboard-card chart-card">
              <div className="card-header">
                <h3 className="card-title">Work Progress Overview</h3>
                <div className="card-subtitle">
                  Based on {reportMetrics.reportingPics} PIC reports
                </div>
              </div>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={reportMetrics.data}
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
                      {reportMetrics.data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {reportMetrics.lastReportDate && (
                <div className="chart-footer">
                  <span className="last-report">
                    Last report: {new Date(reportMetrics.lastReportDate).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          )}


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
                    <Link to={`/pm/request/${request._id}`} key={request._id} className="request-item-new-layout" style={{textDecoration:'none'}}>
                      {/* Left Section - Item Details */}
                      <div className="request-left-section">
                        <div className="request-icon-new">
                          <FaBoxes />
                        </div>
                        <div className="request-details-new">
                          <h4 className="request-title-new">
                            {request.materials?.map(m => `${m.materialName} (${m.quantity})`).join(', ')}
                          </h4>
                          <div className="request-meta-new">
                            <span className="request-project-new">{request.project?.projectName}</span>
                            <span className="request-date-new">
                              {new Date(request.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Center Section - Progress Tracking */}
                      <div className="request-center-section">
                        <div className="tracking-timeline-new">
                          {/* Placed Stage */}
                          <div className={`timeline-step-new ${getTimelineStatus(request.status, 'placed')}`}>
                            <div className="timeline-icon-new">
                              <FaCheckCircle />
                            </div>
                            <span className="timeline-label-new">Placed</span>
                          </div>
                          <div className={`timeline-connector-new ${['Pending PM', 'Pending AM', 'Approved', 'Received', 'PENDING PROJECT MANAGER'].includes(request.status) ? 'completed' : ''}`}></div>
                          {/* PM Stage */}
                          <div className={`timeline-step-new ${getTimelineStatus(request.status, 'pm')}`}>
                            <div className="timeline-icon-new">
                              <FaUserTie />
                            </div>
                            <span className="timeline-label-new">PM</span>
                          </div>
                          <div className={`timeline-connector-new ${['Pending AM', 'Approved', 'Received', 'PENDING AREA MANAGER'].includes(request.status) ? 'completed' : ''}`}></div>
                          {/* AM Stage */}
                          <div className={`timeline-step-new ${getTimelineStatus(request.status, 'am')}`}>
                            <div className="timeline-icon-new">
                              <FaBuilding />
                            </div>
                            <span className="timeline-label-new">AM</span>
                          </div>
                          <div className={`timeline-connector-new ${['Approved', 'Received'].includes(request.status) ? 'completed' : ''}`}></div>
                          {/* Done Stage */}
                          <div className={`timeline-step-new ${getTimelineStatus(request.status, 'done')}`}>
                            <div className="timeline-icon-new">
                              <FaCheckCircle />
                            </div>
                            <span className="timeline-label-new">Done</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Right Section - Status */}
                      <div className="request-right-section">
                        <div className="request-status-new">
                          <span className={`status-text-new ${request.status?.replace(/\s/g, '').toLowerCase()}`}>
                            {request.status}
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

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
        </div>
      </main>
    </div>
  );
};

export default PmDash;
