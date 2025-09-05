import React, { useState, useEffect } from 'react';
import '../style/pic_style/Pic_Dash.css';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../api/axiosInstance';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import ProgressTracker from '../ProgressTracker';
import NotificationBell from '../NotificationBell';
import AppHeader from '../layout/AppHeader';
// Nav icons
import { FaTachometerAlt, FaComments, FaClipboardList, FaEye, FaProjectDiagram, FaBoxes, FaArrowRight, FaCheckCircle, FaClock, FaExclamationTriangle } from 'react-icons/fa';
const formatRemaining = (ts) => {
  if(!ts) return null;
  const diff = ts - Date.now();
  if(diff <= 0) return null;
  const m = Math.floor(diff/60000);
  if(m >= 60){ const h=Math.floor(m/60); const rm=m%60; return `${h}h ${rm}m`; }
  const s = Math.floor((diff%60000)/1000);
  return m>0? `${m}m ${s.toString().padStart(2,'0')}s` : `${s}s`;
};

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
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [reports, setReports] = useState([]);
  const [pendingNudges, setPendingNudges] = useState({});

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

  // Helper function for status icons (from PMDash)
  const getStatusIcon = (status) => {
    switch (status) {
      case 'Completed':
        return <FaCheckCircle className="status-icon completed" />;
      case 'Pending Project Manager':
      case 'Pending Area Manager':
        return <FaClock className="status-icon pending" />;
      case 'Rejected':
        return <FaExclamationTriangle className="status-icon rejected" />;
      default:
        return <FaClock className="status-icon pending" />;
    }
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
  const untilTs = nudgeCooldowns[request._id];
  if (untilTs && untilTs > Date.now()) return; // Already on cooldown
  if (pendingNudges[request._id]) return; // already sending
  setPendingNudges(p=>({...p,[request._id]:true}));

  try {
    const { data } = await api.post(`/requests/${request._id}/nudge`);
    alert(`Reminder sent to ${pendingRole}.`);
    const until = data?.nextAllowedAt || (Date.now()+60*60*1000);
  setNudgeCooldowns(prev => ({ ...prev, [request._id]: until }));
  } catch (err) {
    if (err.response && err.response.data && err.response.data.message) {
      alert(err.response.data.message);
      const untilServer = err.response.data.nextAllowedAt;
      if (untilServer) {
        setNudgeCooldowns(prev => ({ ...prev, [request._id]: untilServer }));
      } else {
        const match = /(\d+) minute/.exec(err.response.data.message);
        if (match) {
          const minutes = parseInt(match[1], 10);
            setNudgeCooldowns(prev => ({ ...prev, [request._id]: Date.now() + minutes * 60 * 1000 }));
        }
      }
    } else {
      alert('Failed to send nudge.');
    }
  } finally {
    setPendingNudges(p=>{ const { [request._id]:_, ...rest}=p; return rest; });
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
         console.log('Fetched requests:', data); // Debug log
         const projectRequests = Array.isArray(data)
           ? data.filter(r => r.project && r.project._id === project._id)
           : [];
         console.log('Filtered project requests:', projectRequests); // Debug log
         setRequests(projectRequests);
       })
       .catch((error) => {
         console.error('Error fetching requests:', error);
         setRequests([]);
       });
   }, [token, project]);

  // Fetch reports for this PIC's current project
  useEffect(() => {
    if (!token || !project) return;

    api.get(`/projects/${project._id}/reports`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(({ data }) => {
        setReports(data?.reports || []);
      })
      .catch(() => setReports([]));
  }, [token, project]);



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
  <div className="pic-dashboard dashboard-container">
  <AppHeader roleSegment="pic" />

             {/* Main Content */}
       <div className="dashboard-layout">
         {/* Center Content */}
         <div className="main1">
          <div className="main-content-container">
                         {/* Welcome Section */}
             <div className="welcome-section">
               <div className="welcome-title">Welcome back, {userName}! 👋</div>
               <div className="welcome-subtitle">Here's what's happening with your project today</div>
               {project && (
                 <div className="welcome-project">{project.projectName}</div>
               )}
             </div>

                                       {/* Project Analytics Section - Side by Side Layout */}
              {project ? (
                <div className="project-analytics-section">
                  <h2 className="analytics-title">Project Analytics</h2>
                  
                  <div className="analytics-grid">
                    {/* Left Side - Work Progress Trend Chart */}
                    <div className="chart-section">
                      <div className="chart-card">
                        <h3>Work Progress Trend</h3>
                        {reports.length > 0 ? (
                          <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={reports.slice(0, 6).reverse().map((report, index) => ({
                              name: new Date(report.uploadedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                              completedTasks: report.ai?.completed_tasks?.length || 0,
                              workItems: report.ai?.summary_of_work_done?.length || 0,
                              contribution: report.ai?.pic_contribution_percent || 0
                            }))}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="name" />
                              <YAxis />
                              <Tooltip />
                              <Line type="monotone" dataKey="completedTasks" stroke="#10b981" strokeWidth={2} name="Completed Tasks" />
                              <Line type="monotone" dataKey="workItems" stroke="#3b82f6" strokeWidth={2} name="Work Items" />
                              <Line type="monotone" dataKey="contribution" stroke="#f59e0b" strokeWidth={2} name="Contribution %" />
                            </LineChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="no-data-state">
                            <span>No report data available</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right Side - Metrics Grid */}
                    <div className="metrics-section">
                      <div className="metrics-grid">
                        <div className="metric-card">
                          <div className="metric-header">
                            <span className="metric-title">Completed Task</span>
                            <div className="metric-icon" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                              <FaClipboardList />
                            </div>
                          </div>
                          <div className="metric-value">
                            {reports.length > 0 && reports[0]?.ai?.completed_tasks 
                              ? reports[0].ai.completed_tasks.length 
                              : 0}
                          </div>
                          <div className="metric-description">Tasks completed from latest report</div>
                        </div>

                        <div className="metric-card">
                          <div className="metric-header">
                            <span className="metric-title">PIC Contribution</span>
                            <div className="metric-icon" style={{ background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)' }}>
                              <FaEye />
                            </div>
                          </div>
                          <div className="metric-value">
                            {reports.length > 0 && reports[0]?.ai?.pic_contribution_percent 
                              ? `${reports[0].ai.pic_contribution_percent}%`
                              : 'N/A'}
                          </div>
                          <div className="metric-description">Contribution percentage from latest report</div>
                        </div>

                        <div className="metric-card">
                          <div className="metric-header">
                            <span className="metric-title">Latest Report</span>
                            <div className="metric-icon" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
                              <FaProjectDiagram />
                            </div>
                          </div>
                          <div className="metric-value">
                            {reports.length > 0 
                              ? new Date(reports[0].uploadedAt).toLocaleDateString()
                              : 'No Reports'}
                          </div>
                          <div className="metric-description">Date of latest report</div>
                        </div>

                        <div className="metric-card">
                          <div className="metric-header">
                            <span className="metric-title">Total Reports</span>
                            <div className="metric-icon" style={{ background: 'linear-gradient(135deg, #06b6d4, #0891b2)' }}>
                              <FaClipboardList />
                            </div>
                          </div>
                          <div className="metric-value">{reports.length}</div>
                          <div className="metric-description">Number of reports submitted</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="no-project-state">
                  <div className="no-project-card">
                    <div className="no-project-icon">📊</div>
                    <h3 className="no-project-title">No Active Project</h3>
                    <p className="no-project-description">
                      You don't have any active projects assigned at the moment. 
                      Check back later or contact your project manager for updates.
                    </p>
                  </div>
                </div>
              )}

             

                                       {/* Material Requests - PMDash Style */}
              {project && (
                <div className="dashboard-card requests-card">
                                     <div className="card-header">
                     <h3 className="card-title">Material Requests</h3>
                     <div className="card-actions">
                       <button className="quick-request-btn" onClick={() => navigate(`/pic/projects/${project._id}/request`)}>
                         <FaBoxes />
                         <span>Quick Request</span>
                       </button>
                       <Link to="/pic/projects" className="view-all-link">
                         View All <FaArrowRight />
                       </Link>
                     </div>
                   </div>
                  <div className="requests-content">
                    {requests.length === 0 ? (
                      <div className="empty-state">
                        <FaBoxes />
                        <span>No material requests found</span>
                        <p>All requests have been processed or none are pending</p>
                      </div>
                    ) : (
                                             <div className="requests-list">
                         {requests.slice(0, 3).map(request => (
                           <Link to={`/pic/request/${request._id}`} key={request._id} className="request-item">
                             <div className="request-icon">
                               <FaBoxes />
                             </div>
                             <div className="request-details">
                               <h4 className="request-title">
                                 {request.materials?.map(m => `${m.materialName} (${m.quantity})`).join(', ')}
                               </h4>
                               <p className="request-description">{request.description || 'No description provided'}</p>
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
                             <div className="request-action">
                               <span className="view-details">View Details →</span>
                             </div>
                           </Link>
                         ))}
                       </div>
                    )}
                  </div>
                </div>
              )}
          </div>
        </div>
      </div>
    </div>
  );
};



export default PicDash;
