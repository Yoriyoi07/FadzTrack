import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { useNavigate, Link } from 'react-router-dom';
import '../style/am_style/Area_Dash.css';
import api from '../../api/axiosInstance';
import AppHeader from '../layout/AppHeader';

// React Icons
import { FaCalendarAlt, FaCheckCircle, FaExclamationTriangle, FaArrowRight, FaChevronDown, FaChevronUp, FaBuilding, FaMapMarkerAlt, FaUserTie, FaChevronRight, FaChevronLeft, FaUsers, FaProjectDiagram, FaBoxes, FaChartBar } from 'react-icons/fa';

const AreaDash = () => {
  const navigate = useNavigate();

  // --- Stable user (no re-parsing every render) ---
  const userRef = useRef(null);
  if (userRef.current === null) {
    const raw = localStorage.getItem('user');
    userRef.current = raw ? JSON.parse(raw) : null;
  }
  const user = userRef.current;
  const userId = user?._id ?? null;

  const [userName, setUserName] = useState(user?.name || '');
  const [userRole, setUserRole] = useState(user?.role || '');

  // Header state
  // Header (legacy states removed with unified header)
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Data state
  const [projects, setProjects] = useState([]);
  const [allProjects, setAllProjects] = useState([]);
  const [enrichedAllProjects, setEnrichedAllProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [materialRequests, setMaterialRequests] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [requestsError, setRequestsError] = useState(null);
  const [assignedLocations, setAssignedLocations] = useState([]);
  const [expandedLocations, setExpandedLocations] = useState({});

  // Metrics data
  const [metrics, setMetrics] = useState({
    totalProjects: 0,
    activeProjects: 0,
    completedProjects: 0,
    pendingRequests: 0,
    totalEngineers: 0,
    averageProgress: 0
  });
  // Cache of PIC contributions per project to avoid double fetching
  const [projectContribs, setProjectContribs] = useState({}); // { projectId: contributionsData }

  // ---------- Data load (production-safe, won't spam) ----------
  useEffect(() => {
    if (!userId) {
      navigate('/');
      return;
    }

    let isActive = true; // avoid setState after unmount
    const controller = new AbortController();

    const fetchAssignedLocations = async () => {
      try {
        const { data } = await api.get(`/users/${userId}/locations`, {
          signal: controller.signal,
        });
        return Array.isArray(data) ? data : [];
      } catch {
        return [];
      }
    };

    const fetchProjects = async (locations) => {
      try {
        const { data: projectsData } = await api.get('/projects', { signal: controller.signal });
        if (!isActive) return;
        setAllProjects(projectsData);
        const userProjects = projectsData.filter(project =>
          locations.some(loc => loc._id === (project.location?._id || project.location))
        );
        const contribMap = {};
        const projectsWithProgress = await Promise.all(userProjects.map(async (project) => {
          try {
            const totalPics = Array.isArray(project.pic) ? project.pic.length : 0;
            // First: project reports (these contain ai.pic_contribution_percent similar to ProjectView)
            let avg = 0; let reportingPics = 0; let pendingPics = totalPics; let latestDate = null; let picContributions = [];
            try {
              const { data: repData } = await api.get(`/projects/${project._id}/reports`, { signal: controller.signal });
              const list = repData?.reports || [];
              if(list.length){
                const sorted = [...list].sort((a,b)=> new Date(b.uploadedAt||0)-new Date(a.uploadedAt||0));
                latestDate = sorted[0]?.uploadedAt || null;
                const byUser = new Map();
                for(const r of sorted){
                  const key = r.uploadedBy || r.uploadedByName || r._id;
                  if(!byUser.has(key)) byUser.set(key,r);
                }
                const distinct = [...byUser.values()];
                const valsRaw = distinct.map(r=> Number(r?.ai?.pic_contribution_percent)).filter(v=> isFinite(v) && v>=0);
                let vals = valsRaw;
                if(!vals.length){
                  vals = distinct.map(r=>{ const done = r?.ai?.completed_tasks?.length||0; const total = done + (r?.ai?.summary_of_work_done?.length||0); return total>0 ? (done/total)*100 : 0; });
                }
                if(vals.length){
                  const a = vals.reduce((s,v)=> s+v,0)/vals.length; avg = Math.min(100,Math.max(0, a));
                }
                reportingPics = distinct.length; pendingPics = totalPics>0 ? Math.max(0,totalPics-reportingPics) : 0;
                picContributions = distinct.map(r=> ({ picId: r.uploadedBy || r._id, picName: r.uploadedByName || 'Unknown', contribution: Math.round(Number(r?.ai?.pic_contribution_percent)||0), hasReport:true, lastReportDate: r.uploadedAt||null }));
              }
            } catch { /* ignore, fallback below */ }
            // Fallback: daily reports contributions endpoint if avg still 0
            if(avg === 0){
              try {
                const { data: contrib } = await api.get(`/daily-reports/project/${project._id}/pic-contributions`, { signal: controller.signal });
                if(contrib){
                  if(!latestDate){
                    const ld = (contrib.picContributions||[]).filter(p=>p.lastReportDate).map(p=> new Date(p.lastReportDate)).sort((a,b)=> b-a)[0];
                    latestDate = ld ? ld.toISOString() : latestDate;
                  }
                  if(contrib.averageContribution) avg = contrib.averageContribution;
                  if(!reportingPics) reportingPics = contrib.reportingPics || 0;
                  if(totalPics && pendingPics===totalPics) pendingPics = contrib.pendingPics ?? pendingPics;
                  if(!picContributions.length) picContributions = contrib.picContributions || [];
                }
              } catch { /* ignore */ }
            }
            const finalPercent = Math.round(avg);
            contribMap[project._id] = { averageContribution: finalPercent, totalPics, reportingPics, pendingPics, picContributions };
            const progressArray = [ { name: 'Completed', value: finalPercent } ];
            return {
              id: project._id,
              name: project.projectName,
              engineer: project.projectmanager?.name || 'Not Assigned',
              progress: progressArray,
              latestDate,
              location: project.location,
            };
          } catch { return null; }
        }));
        if(!isActive) return;
        setProjectContribs(contribMap);
        const filtered = projectsWithProgress.filter(p=> p && Array.isArray(p.progress) && p.progress.length);
        filtered.sort((a,b)=> new Date(b.latestDate||0)-new Date(a.latestDate||0));
        setProjects(filtered);
      } catch(error){
        console.error('Error fetching projects:', error);
      } finally { if(isActive) setLoading(false); }
    };

    const fetchRequests = async (locations) => {
      try {
        const { data } = await api.get('/requests', { signal: controller.signal });
        if (!isActive) return;

        const pending = data.filter(
          (request) =>
             (request.status === 'Pending AM' || request.status === 'PENDING AREA MANAGER') &&
            request.project &&
            locations.some(
              (loc) =>
                loc._id ===
                (request.project.location?._id || request.project.location)
            )
        );

        setPendingRequests(pending);
        setMaterialRequests(data);
        setRequestsError(null);
      } catch (error) {
        if (!isActive) return;
        if (error?.response?.status === 401) {
          setRequestsError('Session expired. Please log in again.');
        } else if (error.name !== 'CanceledError') {
          setRequestsError('Error loading material requests');
        }
      }
    };

    (async () => {
      const locations = await fetchAssignedLocations();
      if (!isActive) return;

      setAssignedLocations(locations); // reflect in UI
      await Promise.all([fetchProjects(locations), fetchRequests(locations)]);
    })();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [navigate, userId]);

  // Derive enriched projects when inputs change
  useEffect(() => {
    if (assignedLocations.length && allProjects.length) {
      setEnrichedAllProjects(
        allProjects
          .filter((project) =>
            assignedLocations.some(
              (loc) => loc._id === (project.location?._id || project.location)
            )
          )
          .map((project) => {
            const loc = assignedLocations.find(
              (l) => l._id === (project.location?._id || project.location)
            );
            return {
              ...project,
              location: loc ? { ...loc } : { name: 'Unknown Location', region: '' },
              name: project.projectName,
              engineer: project.projectmanager?.name || 'Not Assigned',
            };
          })
      );
    }
  }, [assignedLocations, allProjects]);

  // Calculate metrics
  useEffect(() => {
    if (enrichedAllProjects.length > 0) {
      const totalProjects = enrichedAllProjects.length;
      const activeProjects = enrichedAllProjects.filter(p => p.status === 'active' || p.status === 'ongoing').length;
      const completedProjects = enrichedAllProjects.filter(p => p.status === 'completed').length;
      const totalEngineers = new Set(enrichedAllProjects.map(p => p.engineer)).size;
      const averageProgress = projects.length > 0 
        ? projects.reduce((acc, p) => {
            const completed = p.progress.find(prog => prog.name === 'Completed');
            return acc + (completed ? completed.value : 0);
          }, 0) / projects.length
        : 0;

      setMetrics({
        totalProjects,
        activeProjects,
        completedProjects,
        pendingRequests: pendingRequests.length,
        totalEngineers,
        averageProgress: Math.round(averageProgress)
      });
    }
  }, [enrichedAllProjects, pendingRequests, projects]);

  // Unified header handles logout & profile menu

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const projectsByLocation = enrichedAllProjects.reduce((acc, project) => {
    const locationId = project.location?._id || 'unknown';
    if (!acc[locationId]) {
      acc[locationId] = {
        name: project.location?.name || 'Unknown Location',
        region: project.location?.region || '',
        projects: [],
      };
    }
    acc[locationId].projects.push(project);
    return acc;
  }, {});

  // Project metrics reuse fetched contributions
  const [projectMetrics, setProjectMetrics] = useState([]);
  const [metricsLoading, setMetricsLoading] = useState(false); // loading tied to fetchProjects
  useEffect(()=>{
    if(!enrichedAllProjects.length){ setProjectMetrics([]); return; }
  const metrics = enrichedAllProjects.map(project => {
      const contrib = projectContribs[project._id];
      if(contrib){
    const avg = (contrib.averageContribution || contrib.fallbackProgress || 0);
        const totalPics = contrib.totalPics || 0;
        const reportingPics = contrib.reportingPics || 0;
        const pendingPics = contrib.pendingPics || 0;
        let status='ontrack';
        if(pendingPics>0 && totalPics>1) status='pending'; else if(avg < 50) status='regressing';
        const latestDate = (contrib.picContributions||[]).filter(p=>p.lastReportDate).map(p=> new Date(p.lastReportDate)).sort((a,b)=> b-a)[0] || null;
        if(latestDate && (Date.now()-latestDate.getTime()) > 3*24*60*60*1000) status='stale';
        const picNames = (contrib.picContributions||[]).map(p=> p.hasReport? p.picName : `${p.picName} (pending)`);
        return { projectId: project._id, projectName: project.name, pm: project.engineer, area: project.location?.name || 'Unknown Area', progress: avg, totalPics, latestDate, status, waitingForAll: pendingPics>0 && totalPics>1, picNames, reportingPics, pendingPics };
      }
      return { projectId: project._id, projectName: project.name, pm: project.engineer, area: project.location?.name || 'Unknown Area', progress:0, totalPics:0, latestDate:null, status:'stale', waitingForAll:false, picNames:[], reportingPics:0, pendingPics:0 };
    });
    metrics.sort((a,b)=>{ if(!a.latestDate && !b.latestDate) return 0; if(!a.latestDate) return 1; if(!b.latestDate) return -1; return new Date(b.latestDate)-new Date(a.latestDate); });
    setProjectMetrics(metrics);
  },[enrichedAllProjects, projectContribs]);

  // Sample metrics data for charts
  const progressData = [
    { name: 'Completed', value: 65, color: '#10B981' },
    { name: 'In Progress', value: 25, color: '#3B82F6' },
    { name: 'Not Started', value: 10, color: '#EF4444' }
  ];

  const monthlyProgress = [
    { month: 'Jan', progress: 45 },
    { month: 'Feb', progress: 52 },
    { month: 'Mar', progress: 58 },
    { month: 'Apr', progress: 65 },
    { month: 'May', progress: 72 },
    { month: 'Jun', progress: 78 }
  ];

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
    
    return ''; // Default - no special styling
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading dashboard data...</p>
      </div>
    );
  }

  return (
    <div className="am-dashboard dashboard-container">
      <AppHeader roleSegment="am" />

      {/* Main Dashboard Content */}
      <main className="dashboard-main">
        {/* Sidebar Toggle Button */}
        <button className="sidebar-toggle-btn" onClick={toggleSidebar}>
          <FaChevronRight />
        </button>

        {/* Areas & Projects Sidebar */}
        <div className={`areas-projects-sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="sidebar-header">
            <h3>Areas & Projects</h3>
            <button className="close-sidebar-btn" onClick={toggleSidebar}>
              <FaChevronLeft />
            </button>
          </div>
          <div className="areas-projects-card">
            <div className="card-header">
              <button className="add-project-btn" onClick={() => navigate('/am/addproj')}>
                Add Project
          </button>
            </div>
            <div className="areas-list">
            {Object.entries(projectsByLocation).map(([locationId, locationData]) => (
                <div key={locationId} className="area-item">
                  <div className="area-header">
                    <div className="area-info">
                      <FaMapMarkerAlt className="area-icon" />
                      <div>
                        <h4>{locationData.name}</h4>
                        <p>{locationData.region}</p>
                      </div>
                    </div>
                    <div className="area-stats">
                      <span className="project-count">{locationData.projects.length} projects</span>
                      <button 
                        className="expand-btn"
                        onClick={() => setExpandedLocations(prev => ({ ...prev, [locationId]: !prev[locationId] }))}
                      >
                        {expandedLocations[locationId] ? <FaChevronUp /> : <FaChevronDown />}
                      </button>
                  </div>
                </div>
                {expandedLocations[locationId] && (
                    <div className="projects-list">
                    {locationData.projects.map((project) => (
                        <Link to={`/am/projects/${project._id}`} key={project._id} className="project-item">
                          <FaProjectDiagram className="project-icon" />
                          <div className="project-info">
                            <h5>{project.name}</h5>
                            <p>{project.engineer}</p>
                        </div>
                          <FaArrowRight className="arrow-icon" />
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        </div>

        {/* Sidebar Overlay */}
        {sidebarOpen && <div className="sidebar-overlay" onClick={toggleSidebar}></div>}

        {/* Main Content Area */}
        <div className="dashboard-content">
          {/* Main Content Grid */}
          <div className="dashboard-grid">
            {/* Welcome Card */}
            <div className="dashboard-card am-welcome-card">
              <div className="welcome-content">
                <h2 className="welcome-title">Welcome back, {userName}! 👋</h2>
                <p className="welcome-subtitle">Here's what's happening with your areas today</p>
              </div>
              <div className="welcome-stats">
                <div className="stat-item">
                  <span className="stat-number">{enrichedAllProjects.length}</span>
                  <span className="stat-label">Total Projects</span>
                </div>
                <div className="stat-item">
                  <span className="stat-number">{assignedLocations.length}</span>
                  <span className="stat-label">Areas Managed</span>
                </div>
              </div>
            </div>

            {/* Project Metrics - Full Width */}
            <div className="dashboard-card project-metrics-card">
              <div className="card-header">
                <h3>Project Progress</h3>
                <span className="metrics-subtitle">Based on latest PIC reports</span>
              </div>
              <div className="project-metrics-container">
                {metricsLoading ? (
                  <div className="metrics-loading">
                    <div className="loading-spinner"></div>
                    <span>Loading project metrics...</span>
                  </div>
                ) : projectMetrics.length === 0 ? (
                  <div className="metrics-empty">
                    <FaChartBar />
                    <span>No project metrics available</span>
                    <p>Reports need to be submitted to see progress</p>
                  </div>
                ) : (
                  <div className="project-metrics-scroll">
                    {projectMetrics.map((metric) => (
                      <div key={metric.projectId} className="project-metric-item">
                        <div className="metric-header">
                          <div className="metric-project-info">
                            <h4 className="metric-project-name">{metric.projectName}</h4>
                            <p className="metric-project-details">
                              <span className="metric-pm">{metric.pm}</span>
                              <span className="metric-area">{metric.area}</span>
                            </p>
                          </div>
                          <div className="metric-progress-circle">
                            <div className="progress-ring">
                              <svg width="60" height="60">
                                <circle
                                  cx="30"
                                  cy="30"
                                  r="25"
                                  stroke="#e2e8f0"
                                  strokeWidth="4"
                                  fill="transparent"
                                />
                                <circle
                                  cx="30"
                                  cy="30"
                                  r="25"
                                  stroke={metric.progress >= 80 ? '#10B981' : metric.progress >= 50 ? '#3B82F6' : '#F59E0B'}
                                  strokeWidth="4"
                                  fill="transparent"
                                  strokeDasharray={`${2 * Math.PI * 25}`}
                                  strokeDashoffset={`${2 * Math.PI * 25 * (1 - metric.progress / 100)}`}
                                  strokeLinecap="round"
                                  transform="rotate(-90 30 30)"
                                />
                              </svg>
                              <div className="progress-text">
                                <span className="progress-percentage">{metric.progress}%</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="metric-footer">
                          <div className="metric-stats">
                            <span className="metric-stat">
                              <FaUsers />
                              {metric.totalPics} PICs
                            </span>
                            <span className="metric-stat">
                              <FaCalendarAlt />
                              {metric.latestDate ? new Date(metric.latestDate).toLocaleDateString() : '\u2014'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Material Requests Overview - Compact with Tracking */}
            <div className="dashboard-card requests-card">
              <div className="card-header">
                <h3 className="card-title">Material Requests</h3>
                <div className="requests-summary">
                  <span className="pending-count">{pendingRequests.length} Pending</span>
                  <Link to="/am/matreq" className="view-all-link">
                    View All <FaArrowRight />
                  </Link>
                </div>
              </div>
              <div className="requests-content">
                {requestsError ? (
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
                    {materialRequests
                      .sort((a, b) => {
                        // Prioritize pending requests for current user
                        const aIsPendingForUser = a.status === 'Pending AM' || a.status === 'PENDING AREA MANAGER';
                        const bIsPendingForUser = b.status === 'Pending AM' || b.status === 'PENDING AREA MANAGER';
                        
                        if (aIsPendingForUser && !bIsPendingForUser) return -1;
                        if (!aIsPendingForUser && bIsPendingForUser) return 1;
                        
                        // Then sort by date (newest first)
                        return new Date(b.createdAt) - new Date(a.createdAt);
                      })
                      .slice(0, 3)
                      .map(request => {
                        console.log('Request status:', request.status); // Debug log
                        return (
                          <div key={request._id} className={`request-item-compact ${request.status === 'Pending AM' || request.status === 'PENDING AREA MANAGER' ? 'pending-for-user' : ''}`}>
                            <div className="request-main-info">
                              <div className="request-icon-small">
                                <FaBoxes />
                              </div>
                              <div className="request-details-compact">
                                <h4 className="request-title-compact">
                                  {request.materials?.map(m => `${m.materialName} (${m.quantity})`).join(', ')}
                                </h4>
                                <div className="request-meta-compact">
                                  <span className="request-project-compact">{request.project?.projectName}</span>
                                  <span className="request-date-compact">
                                    {new Date(request.createdAt).toLocaleDateString()}
                                  </span>
                                </div>
                              </div>
                              <div className="request-status-compact">
                                <span className={`status-text-compact ${request.status?.replace(/\s/g, '').toLowerCase()}`}>
                                  {request.status}
                                </span>
                              </div>
                            </div>
                            
                            {/* Compact Tracking Timeline */}
                            <div className="tracking-timeline-compact">
                              {/* Placed Stage */}
                              <div className={`timeline-step-compact ${getTimelineStatus(request.status, 'placed')}`}>
                                <div className="timeline-icon-compact">
                                  <FaCheckCircle />
                                </div>
                                <span className="timeline-label-compact">Placed</span>
                              </div>
                              
                              <div className={`timeline-connector-compact ${['Pending PM', 'Pending AM', 'Approved', 'Received', 'PENDING PROJECT MANAGER'].includes(request.status) ? 'completed' : ''}`}></div>
                              
                              {/* PM Stage */}
                              <div className={`timeline-step-compact ${getTimelineStatus(request.status, 'pm')}`}>
                                <div className="timeline-icon-compact">
                                  <FaUserTie />
                                </div>
                                <span className="timeline-label-compact">PM</span>
                              </div>

                              <div className={`timeline-connector-compact ${['Pending AM', 'Approved', 'Received', 'PENDING AREA MANAGER'].includes(request.status) ? 'completed' : ''}`}></div>
                              
                              {/* AM Stage */}
                              <div className={`timeline-step-compact ${getTimelineStatus(request.status, 'am')}`}>
                                <div className="timeline-icon-compact">
                                  <FaBuilding />
                                </div>
                                <span className="timeline-label-compact">AM</span>
                              </div>
                              
                              <div className={`timeline-connector-compact ${['Approved', 'Received'].includes(request.status) ? 'completed' : ''}`}></div>
                              
                              {/* Removed CEO/CIO stage */}

                              <div className={`timeline-connector-compact ${request.status === 'Received' ? 'completed' : ''}`}></div>
                              
                              {/* Done Stage */}
                              <div className={`timeline-step-compact ${getTimelineStatus(request.status, 'done')}`}>
                                <div className="timeline-icon-compact">
                                  <FaCheckCircle />
                                </div>
                                <span className="timeline-label-compact">Done</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AreaDash;
