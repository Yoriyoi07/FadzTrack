import React, { useState, useEffect } from 'react';
import '../style/pic_style/Pic_Dash.css';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../api/axiosInstance';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import ProgressTracker from '../ProgressTracker';
import NotificationBell from '../NotificationBell';
import AppHeader from '../layout/AppHeader';
// Nav icons
import { FaTachometerAlt, FaComments, FaClipboardList, FaEye, FaProjectDiagram, FaBoxes, FaArrowRight, FaCheckCircle, FaClock, FaExclamationTriangle, FaUserTie, FaBuilding, FaChartBar } from 'react-icons/fa';
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

  // Helper function for timeline status (from PMDash)
  const getTimelineStatus = (status, stage) => {
    switch (stage) {
      case 'placed':
        return 'completed';
      case 'pm':
        if (['Pending AM', 'Approved', 'Received', 'PENDING AREA MANAGER'].includes(status)) {
          return 'completed';
        }
        return 'pending';
      case 'am':
        if (['Approved', 'Received'].includes(status)) {
          return 'completed';
        }
        return 'pending';
      case 'done':
        if (['Received'].includes(status)) {
          return 'completed';
        }
        return 'pending';
      default:
        return 'pending';
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

  {/* Main Dashboard Content */}
  <main className="dashboard-main">
    <div className="dashboard-grid">
      {/* Welcome & Project Overview Card */}
      <div className="dashboard-card pic-welcome-card">
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
          <Link to="/pic/projects" className="stat-link">
            <div className="stat-item">
              <div className="stat-icon">
                <FaProjectDiagram />
              </div>
              <div className="stat-content">
                <span className="stat-value">{project ? 1 : 0}</span>
                <span className="stat-label">Active Project</span>
              </div>
            </div>
          </Link>
          
          <Link to="/pic/requests" className="stat-link">
            <div className="stat-item">
              <div className="stat-icon">
                <FaBoxes />
              </div>
              <div className="stat-content">
                <span className="stat-value">{requests.length}</span>
                <span className="stat-label">Material Requests</span>
              </div>
            </div>
          </Link>
        </div>

        {/* KPI Strip */}
        <div className="kpi-strip">
          <Link to="/pic/requests" className="kpi">
            <div className="kpi-ico">
              <FaBoxes />
            </div>
            <div className="kpi-body">
              <div className="kpi-title">Pending Requests</div>
              <div className="kpi-value">{requests.length}</div>
            </div>
          </Link>
          
          <Link to="/pic/projects" className="kpi">
            <div className="kpi-ico">
              <FaProjectDiagram />
            </div>
            <div className="kpi-body">
              <div className="kpi-title">Active Project</div>
              <div className="kpi-value">{project ? 1 : 0}</div>
            </div>
          </Link>
          
          <Link to="/pic/projects" className="kpi">
            <div className="kpi-ico">
              <FaChartBar />
            </div>
            <div className="kpi-body">
              <div className="kpi-title">Avg. Progress</div>
              <div className="kpi-value">{reports.length > 0 ? `${Math.round(reports.reduce((acc, r) => acc + (r.ai?.pic_contribution_percent || 0), 0) / reports.length)}%` : '0%'}</div>
            </div>
          </Link>
        </div>
      </div>

      {/* Work Progress Chart */}
      {project && (
        <div className="dashboard-card chart-card">
          <div className="card-header">
            <h3 className="card-title">Work Progress Trend</h3>
            <div className="card-subtitle">
              Based on {reports.length} report{reports.length !== 1 ? 's' : ''}
            </div>
          </div>
          <div className="chart-container">
            {reports.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={reports.slice(0, 6).reverse().map(report => ({
                  name: new Date(report.uploadedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                  completedTasks: report.ai?.completed_tasks?.length || 0,
                  workItems: report.ai?.summary_of_work_done?.length || 0,
                  contribution: report.ai?.pic_contribution_percent || 0
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
              <div className="empty-state">
                <FaChartBar />
                <span>No report data yet</span>
                <p>Submit your first report to see progress trends</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* No Project State */}
      {!project && (
        <div className="dashboard-card no-project-card">
          <div className="no-project-content">
            <div className="no-project-icon">📊</div>
            <h3 className="no-project-title">No Active Project</h3>
            <p className="no-project-description">
              You don't have any active projects assigned at the moment. 
              Check back later or contact your project manager for updates.
            </p>
            <div className="no-project-actions">
              <Link to="/pic/projects" className="no-project-link">
                View All Projects <FaArrowRight />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Material Requests */}
      {project && (
        <div className="dashboard-card requests-card">
          <div className="card-header">
            <h3 className="card-title">Material Requests</h3>
            <Link to="/pic/requests" className="view-all-link">
              View All <FaArrowRight />
            </Link>
          </div>
          <div className="requests-content">
            {requests.length === 0 ? (
              <div className="empty-state">
                <FaBoxes />
                <span>No material requests found</span>
                <p>Create a new request to get started</p>
              </div>
            ) : (
              <div className="requests-list">
                {requests.slice(0, 3).map(request => (
                  <Link to={`/pic/material-request/${request._id}`} key={request._id} className="request-item-new-layout" style={{textDecoration:'none'}}>
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
      )}
    </div>
  </main>
</div>
  );
}

export default PicDash;