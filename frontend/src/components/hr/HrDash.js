import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import '../style/hr_style/Hr_Dash.css';
import api from '../../api/axiosInstance';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import NotificationBell from '../NotificationBell'; // retained for any future usage in cards
import AppHeader from '../layout/AppHeader';
// Nav icons
import {
  FaTachometerAlt,
  FaComments,
  FaUsers,
  FaExchangeAlt,
  FaProjectDiagram,
  FaUserPlus,
  FaUserCheck,
  FaUserClock,
  FaClipboardList,
  FaChartBar,
  FaCalendarAlt,
  FaArrowRight,
  FaExclamationTriangle,
  FaCheckCircle,
  FaClock
} from 'react-icons/fa';

const HrDash = ({ forceUserUpdate }) => {
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
  const [userName, setUserName] = useState(user?.name || 'HR Manager');
  const [userRole, setUserRole] = useState(user?.role || '');
  
  useEffect(() => {
    setUserName(user?.name || 'HR Manager');
      setUserRole(user?.role || '');
    }, [user]);

  // --- 4. Page data state ---
  // Header state no longer needed with AppHeader

  const [chats, setChats] = useState([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [chatsError, setChatsError] = useState(null);

  const [manpowerRequests, setManpowerRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [requestsError, setRequestsError] = useState(null);

  const [viewedRequestIds, setViewedRequestIds] = useState(() => {
    try {
      const raw = localStorage.getItem('hrViewedRequests');
      const arr = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(arr) ? arr : []);
    } catch {
      return new Set();
    }
  });

  const persistViewedIds = useCallback((idsSet) => {
    try {
      localStorage.setItem('hrViewedRequests', JSON.stringify(Array.from(idsSet)));
    } catch {}
  }, []);

  const [stats, setStats] = useState({
    totalStaff: 0,
    assigned: 0,
    available: 0,
    requests: 0,
    pendingRequests: 0,
    approvedRequests: 0
  });

  const [recentActivities, setRecentActivities] = useState([]);
  const [loadingActivities, setLoadingActivities] = useState(true);

  // --- 5. Redirect to login if not logged in ---
  useEffect(() => {
    if (!token || !userId) {
      navigate('/');
      return;
    }
  }, [token, userId, navigate]);

  // --- 6. Header collapse handled internally by generic AppHeader (no-op retained for clarity) ---

  // --- 7. Fetch HR statistics ---
  const fetchHRStats = useCallback(async () => {
    if (!token) return;
    
      try {
       const [manpowerRes, movementRes] = await Promise.all([
        api.get('/manpower', { headers: { Authorization: `Bearer ${token}` } }),
        api.get('/manpower-requests', { headers: { Authorization: `Bearer ${token}` } })
          ]);

          const manpower = manpowerRes.data;
          const movements = movementRes.data;

        const totalStaff = manpower.length;
        const assigned = manpower.filter(mp => mp.status === 'Active').length;
        const available = manpower.filter(mp => mp.status === 'Inactive').length;
      const requests = movements.length;
      const pendingRequests = movements.filter(mv => mv.status === 'Pending').length;
      const approvedRequests = movements.filter(mv => mv.status === 'Approved').length;

      setStats({ totalStaff, assigned, available, requests, pendingRequests, approvedRequests });
      } catch (error) {
        console.error('Failed to fetch HR stats:', error);
      }
  }, [token]);

  useEffect(() => {
    fetchHRStats();
  }, [fetchHRStats]);

  // --- 8. Fetch recent conversations ---
  const fetchChats = useCallback(async () => {
    if (!token || !userId) return;

    try {
      const { data } = await api.get(`/chats/user/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (data && Array.isArray(data)) {
        const processedChats = data.slice(0, 5).map((conversation, index) => {
          // Get the other user's name (not the current user)
          const otherUser = conversation.users?.find(u => u._id !== userId);
          let otherUserName = 'Unknown User';
          
          if (otherUser) {
            otherUserName = otherUser.name || `${otherUser.firstname || ''} ${otherUser.lastname || ''}`.trim() || 'Unknown User';
          } else if (conversation.users?.length > 0) {
            const allUserNames = conversation.users.map(user =>
              user.name || `${user.firstname || ''} ${user.lastname || ''}`.trim() || 'Unknown'
            ).filter(name => name !== 'Unknown');
            otherUserName = allUserNames.length > 0 ? allUserNames.join(', ') : 'Unknown User';
          }

          let lastMessageContent = 'No messages yet';
          let lastMessageTime = new Date();

          if (conversation.lastMessage) {
            lastMessageContent = conversation.lastMessage.content || 'No messages yet';
            lastMessageTime = conversation.lastMessage.timestamp || new Date();
          }

          return {
            _id: conversation._id,
            name: conversation.isGroup ? conversation.name : otherUserName,
            isGroup: conversation.isGroup || false,
            lastMessage: lastMessageContent,
            lastMessageTime: lastMessageTime,
            users: conversation.users || [],
            color: '#4A6AA5'
          };
        });

        setChats(processedChats);
      } else {
        setChats([]);
      }

      setChatsError(null);
    } catch (error) {
      console.log('Chat fetch error:', error);
      setChats([]);
      setChatsError(`Failed to load conversations: ${error.message}`);
    }
    setLoadingChats(false);
  }, [token, userId]);

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  // --- 9. Fetch manpower requests ---
  const fetchManpowerRequests = useCallback(async () => {
    if (!token) return;

    try {
      const { data } = await api.get('/manpower-requests', {
        headers: { Authorization: `Bearer ${token}` }
      });

      console.log('Raw manpower requests data:', data); // Debug log

      if (data && Array.isArray(data)) {
        const processedRequests = data.map(request => {
          console.log('Processing individual request:', request); // Debug individual request
          
          const idStr = String(request._id || request.id || '');
          // Extract project name from the actual API structure
          let projectName = 'Unknown Project';
          if (request.project?.projectName) {
            projectName = request.project.projectName;
          }

          // Extract requested by from the actual API structure
          let requestedBy = 'Unknown';
          if (request.createdBy?.name) {
            requestedBy = request.createdBy.name;
          }

          // Extract position and quantity from manpowers array
          let position = 'Unknown Position';
          let quantity = 1;
          
          if (request.manpowers && Array.isArray(request.manpowers) && request.manpowers.length > 0) {
            // Get the first manpower entry (assuming one type per request for display)
            const manpower = request.manpowers[0];
            position = manpower.type || 'Unknown Position';
            quantity = manpower.quantity || 1;
          }

          const rawStatus = (request.status || 'Pending').toString();
          let displayStatus = rawStatus;
          try {
            const acq = request.acquisitionDate ? new Date(request.acquisitionDate) : null;
            const isOverdue = rawStatus.toLowerCase() === 'pending' && acq && acq < new Date();
            if (isOverdue) displayStatus = 'Overdue';
          } catch {}

          const processedRequest = {
            _id: idStr,
            projectName: projectName,
            requestedBy: requestedBy,
            position: position,
            quantity: quantity,
            status: displayStatus,
            requestDate: new Date(request.createdAt || request.acquisitionDate || Date.now()),
            priority: request.priority || 'Normal',
            isViewed: Boolean(request.isViewed) || viewedRequestIds.has(idStr)
          };
          
          console.log('Processed request:', processedRequest); // Debug processed request
          
          return processedRequest;
        });

        // Sort by date (most recent first) and take only the first 5
        const sortedRequests = processedRequests
          .sort((a, b) => b.requestDate - a.requestDate)
          .slice(0, 5);

        setManpowerRequests(sortedRequests);
      } else {
        setManpowerRequests([]);
      }

      setRequestsError(null);
    } catch (error) {
      console.log('Manpower requests fetch error:', error);
      setManpowerRequests([]);
      setRequestsError(`Failed to load requests: ${error.message}`);
    }
    setLoadingRequests(false);
  }, [token, viewedRequestIds]);

  useEffect(() => {
    fetchManpowerRequests();
  }, [fetchManpowerRequests]);

  // Keep local list in sync with viewedRequestIds so highlight clears even without refetch
  useEffect(() => {
    setManpowerRequests(prev => prev.map(r => (
      viewedRequestIds.has(r._id) ? { ...r, isViewed: true } : r
    )));
  }, [viewedRequestIds]);

  // Refetch when window regains focus to reflect viewed status after navigating back
  useEffect(() => {
    const onFocus = () => {
      fetchManpowerRequests();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [fetchManpowerRequests]);

  // --- 10. Fetch recent activities ---
  const fetchRecentActivities = useCallback(async () => {
    if (!token) return;

    try {
      const { data } = await api.get('/audit-logs', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (data && Array.isArray(data)) {
        const processedActivities = data.slice(0, 6).map((log, index) => ({
          id: log._id || `activity-${index}`,
          icon: getActivityIcon(log.action),
          iconClass: 'activity-icon',
          title: `${log.action} - ${log.description || ''}`,
          time: new Date(log.timestamp).toLocaleString(),
          type: log.action?.toLowerCase() || 'general'
        }));

        setRecentActivities(processedActivities);
      } else {
        setRecentActivities([]);
      }
    } catch (error) {
      console.error('Failed to fetch recent activities:', error);
      setRecentActivities([]);
    }
    setLoadingActivities(false);
  }, [token]);

  useEffect(() => {
    fetchRecentActivities();
  }, [fetchRecentActivities]);

  // --- 11. Helper function for activity icons ---
  const getActivityIcon = (action) => {
    const actionLower = action?.toLowerCase() || '';
    if (actionLower.includes('login') || actionLower.includes('logout')) return '🔐';
    if (actionLower.includes('create') || actionLower.includes('add')) return '➕';
    if (actionLower.includes('update') || actionLower.includes('edit')) return '✏️';
    if (actionLower.includes('delete') || actionLower.includes('remove')) return '🗑️';
    if (actionLower.includes('approve') || actionLower.includes('approval')) return '✅';
    if (actionLower.includes('reject') || actionLower.includes('deny')) return '❌';
    if (actionLower.includes('assign') || actionLower.includes('assignment')) return '👥';
    if (actionLower.includes('request') || actionLower.includes('requisition')) return '📋';
    return '📝';
  };

  // --- 12. Legacy profile menu logic removed (handled by AppHeader) ---

  // --- 13. Logout handler passed to AppHeader ---
  const handleLogout = useCallback(() => {
    api.post('/auth/logout', {}, { headers: { Authorization: `Bearer ${token}` } }).finally(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
      setUserId(undefined);
      setToken("");
      if (forceUserUpdate) forceUserUpdate();
      window.dispatchEvent(new Event('storage'));
      navigate('/');
    });
  }, [token, forceUserUpdate, navigate]);

  // --- 14. KPI data for charts ---
  const workforceData = React.useMemo(() => {
    const total = stats.totalStaff;
    if (total === 0) return { data: [], assigned: 0, available: 0, total: 0 };
    
    const assigned = stats.assigned;
    const available = stats.available;
    
    const data = [
      { name: 'Assigned', value: assigned, color: '#22c55e' },
      { name: 'Available', value: available, color: '#3b82f6' }
    ];
    
    return {
      data: data.filter(item => item.value > 0),
      assigned,
      available,
      total
    };
  }, [stats]);

  const requestStatusData = React.useMemo(() => {
    const pending = stats.pendingRequests;
    const approved = stats.approvedRequests;
    const total = stats.requests;
    
    if (total === 0) return { data: [], pending: 0, approved: 0, total: 0 };
    
    const data = [
      { name: 'Pending', value: pending, color: '#f59e0b' },
      { name: 'Approved', value: approved, color: '#22c55e' }
    ];
    
    return {
      data: data.filter(item => item.value > 0),
      pending,
      approved,
      total
    };
  }, [stats]);

  // Function to truncate text
  const truncateMessage = (text, maxWords = 10) => {
    if (!text || typeof text !== 'string') return 'No messages yet';
    const words = text.trim().split(/\s+/);
    if (words.length <= maxWords) return text;
    return words.slice(0, maxWords).join(' ') + '...';
  };

  // Function to format date
  const formatDate = (date) => {
    if (!date) return 'Unknown';
    const d = new Date(date);
    const now = new Date();
    const diffTime = Math.abs(now - d);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'Today';
    if (diffDays === 2) return 'Yesterday';
    if (diffDays <= 7) return `${diffDays - 1} days ago`;
    return d.toLocaleDateString();
  };

  // Mark a request as viewed (optimistic update + API)
  const markRequestAsViewed = useCallback(async (requestId) => {
    try {
      await api.put(`/manpower-requests/${requestId}`, { isViewed: true }, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (error) {
      console.error('Failed to mark as viewed:', error);
    }
  }, [token]);

  const handleRequestClick = useCallback((event, requestId) => {
    const idStr = String(requestId);
    try {
      if (event && event.currentTarget && event.currentTarget.classList) {
        event.currentTarget.classList.remove('unviewed');
        event.currentTarget.setAttribute('data-viewed', '1');
      }
    } catch {}
    // Optimistically update local state so highlight disappears immediately
    setManpowerRequests(prev => prev.map(r => (
      String(r._id) === idStr ? { ...r, isViewed: true } : r
    )));
    // Persist locally as viewed to keep state on return even if backend lags
    setViewedRequestIds(prev => {
      const next = new Set(prev);
      next.add(idStr);
      persistViewedIds(next);
      return next;
    });
    // Persist on server (detail page also does this; redundancy is safe)
    markRequestAsViewed(idStr);
    navigate(`/hr/manpower-request/${idStr}`);
  }, [markRequestAsViewed, navigate, persistViewedIds]);

  return (
    <div className="hr-dashboard dashboard-container">
      <AppHeader 
        roleSegment="hr"
        onLogout={handleLogout}
        overrideNav={[
          { to:'/hr', label:'Dashboard', icon:<FaTachometerAlt/>, match:'/hr' },
          { to:'/hr/chat', label:'Chat', icon:<FaComments/>, match:'/hr/chat' },
            { to:'/hr/mlist', label:'Manpower', icon:<FaUsers/>, match:'/hr/mlist' },
          { to:'/hr/movement', label:'Movement', icon:<FaExchangeAlt/>, match:'/hr/movement' },
          { to:'/hr/project-records', label:'Projects', icon:<FaProjectDiagram/>, match:'/hr/project-records' }
        ]}
      />
      <main className="dashboard-main">
        <div className="dashboard-grid">
          {/* Welcome & Overview Card */}
          <div className="dashboard-card hr-welcome-card">
            <div className="welcome-header">
              <div className="welcome-content">
                <h2 className="welcome-title">Welcome back, {userName}! 👋</h2>
                <p className="welcome-subtitle">Manage your workforce and track manpower activities</p>
              </div>
              
          
        </div>

            <div className="overview-stats">
              <div className="stat-item">
                <div className="stat-icon">
                  <FaUsers />
          </div>
                <div className="stat-content">
                  <span className="stat-value">{stats.totalStaff}</span>
                  <span className="stat-label">Total Staff</span>
            </div>
          </div>
              <div className="stat-item">
                <div className="stat-icon assigned">
                  <FaUserCheck />
        </div>
                <div className="stat-content">
                  <span className="stat-value">{stats.assigned}</span>
                  <span className="stat-label">Assigned</span>
                    </div>
                  </div>
              <div className="stat-item">
                <div className="stat-icon available">
                  <FaUserClock />
                </div>
                <div className="stat-content">
                  <span className="stat-value">{stats.available}</span>
                  <span className="stat-label">Available</span>
              </div>
            </div>
              <div className="stat-item">
                <div className="stat-icon requests">
                  <FaClipboardList />
            </div>
                <div className="stat-content">
                  <span className="stat-value">{stats.requests}</span>
                  <span className="stat-label">Requests</span>
                  </div>
              </div>
            </div>
          </div>

          {/* Enhanced Workforce Distribution Chart */}
          {workforceData.data.length > 0 && (
            <div className="dashboard-card chart-card">
              <div className="card-header">
                <h3 className="card-title">Workforce Analytics</h3>
  </div>
              <div className="chart-content">
                <div className="chart-container">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={workforceData.data}
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
                        {workforceData.data.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
        </div>
                <div className="chart-metrics">
                  <div className="metric-item">
                    <div className="metric-label">Total Workforce</div>
                    <div className="metric-value">{workforceData.total}</div>
            </div>
                  <div className="metric-item">
                    <div className="metric-label">Assigned</div>
                    <div className="metric-value assigned">{workforceData.assigned}</div>
              </div>
                  <div className="metric-item">
                    <div className="metric-label">Available</div>
                    <div className="metric-value available">{workforceData.available}</div>
                </div>
                  <div className="metric-item">
                    <div className="metric-label">Utilization Rate</div>
                    <div className="metric-value">
                      {workforceData.total > 0 ? Math.round((workforceData.assigned / workforceData.total) * 100) : 0}%
            </div>
          </div>
    </div>
  </div>
</div>
          )}

          {/* Recent Manpower Requests */}
          <div className="dashboard-card requests-card">
            <div className="card-header">
              <h3 className="card-title">Recent Manpower Requests</h3>
              <div className="card-actions">
                <button
                  className="refresh-btn"
                  onClick={fetchManpowerRequests}
                  title="Refresh requests"
                  disabled={loadingRequests}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 4v6h6M23 20v-6h-6" />
                    <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
                  </svg>
              </button>
                                 <Link to="/hr/movement" className="view-all-btn">
                  View All
                  <FaArrowRight />
                </Link>
              </div>
            </div>
            <div className="card-content">
              {loadingRequests ? (
                <div className="loading-state">
                  <div className="loading-spinner"></div>
                  <span>Loading requests...</span>
                </div>
              ) : requestsError ? (
                <div className="error-state">
                  <span>⚠️ {requestsError}</span>
                </div>
              ) : manpowerRequests.length === 0 ? (
                <div className="empty-state">
                  <span>No recent requests</span>
                </div>
              ) : (
                                 <div className="requests-list">
                   {manpowerRequests.map((request) => (
                     <div 
                       key={request._id} 
                       className={`request-item ${!request.isViewed ? 'unviewed' : ''}`}
                                               onClick={(e) => handleRequestClick(e, request._id)}
                       style={{ cursor: 'pointer' }}
                     >
                      <div className="request-left">
                         <div className="request-project">{request.projectName}</div>
                         <div className={`request-status ${request.status.toLowerCase()}`}>
                           {request.status}
                         </div>
            </div>
                       <div className="request-middle">
                         <div className="request-position">{request.position}</div>
                         <div className="request-quantity">{request.quantity} needed</div>
                    </div>
                       <div className="request-right">
                         <div className="request-by">By: {request.requestedBy}</div>
                         <div className="request-date">{formatDate(request.requestDate)}</div>
                    </div>
                  </div>
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

export default HrDash;