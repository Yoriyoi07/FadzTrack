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

  // Auto-refresh reports when socket-driven global event fired
  useEffect(()=>{
    const handler = (e)=>{ if(String(e?.detail?.projectId)===String(project?._id) && token){
      api.get(`/projects/${project._id}/reports`, { headers:{ Authorization:`Bearer ${token}` } })
        .then(({data})=> setReports(data?.reports||[]))
        .catch(()=>{});
    }};
    window.addEventListener('projectReportsUpdated', handler);
    return ()=> window.removeEventListener('projectReportsUpdated', handler);
  },[project?._id, token]);



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
              <div className="pic-section-stack">
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
                <div className="project-analytics-section enhanced">
                  <h2 className="analytics-title">Project Analytics</h2>
                  
                  <div className="analytics-flex single-column">
                    <div className="analytics-block chart-block full-width">
                      <div className="chart-card gradient-border">
                        <div className="card-head-row">
                          <h3>Work Progress Trend</h3>
                          {reports.length > 1 && (
                            <span className="mini-trend-note">Last {Math.min(6, reports.length)} reports</span>
                          )}
                        </div>
                        {reports.length > 0 ? (
                          <ResponsiveContainer width="100%" height={360}>
                            <LineChart data={reports.slice(0, 6).reverse().map(report => ({
                              name: new Date(report.uploadedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                              completedTasks: report.ai?.completed_tasks?.length || 0,
                              workItems: report.ai?.summary_of_work_done?.length || 0,
                              contribution: (()=>{ const ai=report.ai||{}; const raw=Number(ai.pic_contribution_percent_raw); const legacy=Number(ai.pic_contribution_percent); if(isFinite(raw)&&raw>=0) return raw; if(isFinite(legacy)&&legacy>=0) return legacy; return 0; })()
                            }))}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                              <YAxis tick={{ fontSize: 12 }} />
                              <Tooltip contentStyle={{ fontSize: 12 }} />
                              <Line type="monotone" dataKey="completedTasks" stroke="#10b981" strokeWidth={2} name="Completed" dot={{ r:3 }} />
                              <Line type="monotone" dataKey="workItems" stroke="#3b82f6" strokeWidth={2} name="Work Items" dot={{ r:3 }} />
                              <Line type="monotone" dataKey="contribution" stroke="#f59e0b" strokeWidth={2} name="Contribution %" dot={{ r:3 }} />
                            </LineChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="no-data-state alt">
                            <div className="skeleton-chart" />
                            <span>No report data yet</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="metrics-row-inline">
                      {([{
                        label: 'Completed Task',
                        value: reports[0]?.ai?.completed_tasks?.length || 0,
                        desc: 'Tasks in latest report',
                        icon: <FaClipboardList />, bg: 'linear-gradient(135deg,#10b981,#059669)'
                      },{
                        label: 'PIC Contribution',
                        value: (()=>{ if(!reports[0]) return 'N/A'; const ai=reports[0].ai||{}; const raw=Number(ai.pic_contribution_percent_raw); const legacy=Number(ai.pic_contribution_percent); const val = isFinite(raw)&&raw>=0? raw : (isFinite(legacy)&&legacy>=0? legacy : null); return val==null? 'N/A' : `${Math.round(val)}%`; })(),
                        desc: 'Contribution (latest)',
                        icon: <FaEye />, bg: 'linear-gradient(135deg,#8b5cf6,#7c3aed)'
                      },{
                        label: 'Latest Report',
                        value: reports[0] ? new Date(reports[0].uploadedAt).toLocaleDateString() : 'No Reports',
                        desc: 'Date of latest upload',
                        icon: <FaProjectDiagram />, bg: 'linear-gradient(135deg,#f59e0b,#d97706)'
                      },{
                        label: 'Total Reports',
                        value: reports.length,
                        desc: 'All submitted reports',
                        icon: <FaClipboardList />, bg: 'linear-gradient(135deg,#06b6d4,#0891b2)'
                      }]).map((m,i)=> (
                        <div className="metric-card compact inline" key={i}>
                          <div className="metric-header">
                            <span className="metric-title">{m.label}</span>
                            <div className="metric-icon" style={{ background:m.bg }}>{m.icon}</div>
                          </div>
                          <div className="metric-value small">{m.value}</div>
                          <div className="metric-description small">{m.desc}</div>
                        </div>
                      ))}
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

             

                                      {/* Material Requests - Modernized UI */}
              {project && (
                <div className="material-requests-panel gradient-border">
                  <div className="mr-panel-head">
                    <div className="mr-head-left">
                      <h3 className="mr-title">Material Requests</h3>
                      <div className="mr-sub">Recent activity · <span>{requests.length}</span> total</div>
                    </div>
                    <div className="mr-actions">
                      <button className="mr-quick-btn" onClick={() => navigate(`/pic/projects/${project._id}/request`)}>
                        <FaBoxes /> <span>New Request</span>
                      </button>
                      <Link to="/pic/requests" className="mr-view-all">View All <FaArrowRight /></Link>
                    </div>
                  </div>
                  <div className="mr-list-wrapper">
                    {requests.length === 0 ? (
                      <div className="mr-empty">
                        <div className="mr-empty-icon"><FaBoxes /></div>
                        <div className="mr-empty-title">No material requests</div>
                        <div className="mr-empty-desc">Create a new request to get started</div>
                      </div>
                    ) : (
                      <div className="mr-list">
                        {requests.slice(0,4).map(req => {
                          const mats = req.materials || [];
                          const shown = mats.slice(0,2);
                          const extra = mats.length - shown.length;
                          const created = new Date(req.createdAt);
                          const now = Date.now();
                          const diffDays = (now - created.getTime())/86400000;
                          const relative = diffDays < 1 ? 'Today' : diffDays < 2 ? 'Yesterday' : created.toLocaleDateString();
                          const statusSlug = (req.status||'').replace(/\s+/g,'-').toLowerCase();
                          return (
                            <Link to={`/pic/material-request/${req._id}`} key={req._id} className={`mr-item status-${statusSlug}`}>
                              <div className="mr-left">
                                <div className="mr-icon"><FaBoxes /></div>
                                <div className="mr-main">
                                  <div className="mr-top-row">
                                    <div className="mr-material-badges">
                                      {shown.map((m,i)=>(
                                        <span key={i} className="mr-mat">{m.materialName}<span className="q">×{m.quantity}</span></span>
                                      ))}
                                      {extra>0 && <span className="mr-mat more">+{extra} more</span>}
                                    </div>
                                    <span className={`mr-status-badge ${statusSlug}`}>{req.status}</span>
                                  </div>
                                  <div className="mr-desc">{req.description || 'No description provided'}</div>
                                  <div className="mr-meta">
                                    <span className="mr-project">{req.project?.projectName}</span>
                                    <span className="mr-date" title={created.toLocaleString()}>{relative}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="mr-action">Open →</div>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};



export default PicDash;
