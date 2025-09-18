import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { useNavigate, Link } from 'react-router-dom';
import '../style/am_style/Area_Dash.css';
import api from '../../api/axiosInstance';
import AppHeader from '../layout/AppHeader';

// React Icons
import { FaCalendarAlt, FaCheckCircle, FaExclamationTriangle, FaArrowRight, FaChevronDown, FaChevronUp, FaBuilding, FaMapMarkerAlt, FaUserTie, FaChevronRight, FaChevronLeft, FaUsers, FaProjectDiagram, FaBoxes, FaChartBar, FaBars, FaHardHat, FaHammer, FaTruck, FaIndustry } from 'react-icons/fa';

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
          setMetricsLoading(true);
          const { data: projectsData } = await api.get('/projects', { signal: controller.signal });
          if (!isActive) return;
          setAllProjects(projectsData);
          const userProjects = projectsData.filter(project =>
            locations.some(loc => loc._id === (project.location?._id || project.location))
          );

          const contribMap = {};

          const projectsWithProgress = await Promise.all(
            userProjects.map(async (project) => {
              try {
                const totalPics = Array.isArray(project.pic) ? project.pic.length : 0;
                let avg = 0;
                let latestDate = null;
                let reportingPics = 0;
                let pendingPics = totalPics;
                let picContributions = [];

                // Primary source: project reports
                try {
                  const { data: repData } = await api.get(`/projects/${project._id}/reports`, { signal: controller.signal });
                  const list = repData?.reports || [];
                  if (list.length) {
                    const sorted = [...list].sort((a,b)=> new Date(b.uploadedAt||0)-new Date(a.uploadedAt||0));
                    latestDate = sorted[0]?.uploadedAt || null;
                    const byUploader = new Map();
                    for (const r of sorted) {
                      const key = r.uploadedBy || r.uploadedByName || r._id;
                      if (!byUploader.has(key)) byUploader.set(key, r); // keep latest per uploader
                    }
                    const distinct = [...byUploader.values()];
                    const percents = distinct
                      .map(r => {
                        const ai = r?.ai || {};
                        const raw = Number(ai.pic_contribution_percent_raw);
                        const legacy = Number(ai.pic_contribution_percent);
                        if (isFinite(raw) && raw >= 0) return raw;
                        if (isFinite(legacy) && legacy >= 0) return legacy;
                        return NaN;
                      })
                      .filter(v => isFinite(v) && v >= 0);
                    if (percents.length) {
                      avg = percents.reduce((s,v)=>s+v,0) / percents.length;
                    }
                    reportingPics = distinct.length;
                    pendingPics = totalPics > 0 ? Math.max(0, totalPics - reportingPics) : 0;
                    picContributions = distinct.map(r => {
                      const ai = r?.ai || {};
                      const raw = Number(ai.pic_contribution_percent_raw);
                      const legacy = Number(ai.pic_contribution_percent);
                      const chosen = isFinite(raw) && raw >= 0 ? raw : (isFinite(legacy) && legacy >= 0 ? legacy : 0);
                      return {
                        picId: r.uploadedBy || r._id,
                        picName: r.uploadedByName || 'Unknown',
                        contribution: Math.round(chosen),
                        hasReport: true,
                        lastReportDate: r.uploadedAt || null
                      };
                    });
                  }
                } catch { /* ignore reports errors */ }

                // Fallback: aggregated daily-report contributions if still zero
                if (avg === 0) {
                  try {
                    const { data: contrib } = await api.get(`/daily-reports/project/${project._id}/pic-contributions`, { signal: controller.signal });
                    if (contrib) {
                      if (!latestDate) {
                        const ld = (contrib.picContributions||[])
                          .filter(p=>p.lastReportDate)
                          .map(p=> new Date(p.lastReportDate))
                          .sort((a,b)=> b-a)[0];
                        latestDate = ld ? ld.toISOString() : latestDate;
                      }
                      if (contrib.averageContribution) avg = contrib.averageContribution;
                      if (!reportingPics) reportingPics = contrib.reportingPics || 0;
                      if (totalPics && pendingPics === totalPics) pendingPics = contrib.pendingPics ?? pendingPics;
                      if (!picContributions.length) picContributions = (contrib.picContributions || []).map(p => ({
                        picId: p.picId,
                        picName: p.picName,
                        contribution: Math.round(p.contribution || 0),
                        hasReport: !!p.lastReportDate,
                        lastReportDate: p.lastReportDate || null
                      }));
                    }
                  } catch { /* ignore fallback errors */ }
                }

                const finalPercent = Math.min(100, Math.max(0, Math.round(avg)));
                contribMap[project._id] = {
                  averageContribution: finalPercent,
                  totalPics,
                  reportingPics,
                  pendingPics,
                  picContributions
                };
                return {
                  ...project,
                  progress: [{ name: 'Completed', value: finalPercent }],
                  latestDate,
                };
              } catch (e) {
                return { ...project, progress: [{ name: 'Completed', value: 0 }], latestDate: null };
              }
            })
          );

          if (!isActive) return;
          setProjectContribs(contribMap);
          setProjects(projectsWithProgress);
        } catch (error) {
          console.error('Error fetching projects:', error);
        } finally {
          if (isActive) {
            setMetricsLoading(false);
            setLoading(false);
          }
        }
    };

    const normalizeStatus = (s='') => s.replace(/\s+/g,' ').trim().toUpperCase();

    const fetchRequests = async (locations) => {
      try {
        const { data } = await api.get('/requests', { signal: controller.signal });
        if (!isActive) return;
        setMaterialRequests(Array.isArray(data)? data : []);
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

  // Listen for global projectReportsUpdated events to refresh a single project's contribution snapshot
  useEffect(() => {
    const handler = (e) => {
      const projectId = e?.detail?.projectId;
      if(!projectId) return;
      (async () => {
        try {
          const { data: repData } = await api.get(`/projects/${projectId}/reports`);
          const list = repData?.reports || [];
          if(!list.length) return;
          const sorted = [...list].sort((a,b)=> new Date(b.uploadedAt||0)-new Date(a.uploadedAt||0));
          const byUploader = new Map();
          for(const r of sorted){ const key=r.uploadedBy||r.uploadedByName||r._id; if(!byUploader.has(key)) byUploader.set(key,r); }
          const distinct=[...byUploader.values()];
          const percents = distinct.map(r=>{ const ai=r.ai||{}; const raw=Number(ai.pic_contribution_percent_raw); const legacy=Number(ai.pic_contribution_percent); if(isFinite(raw)&&raw>=0) return raw; if(isFinite(legacy)&&legacy>=0) return legacy; return NaN; }).filter(v=> isFinite(v)&&v>=0);
          let avg=0; if(percents.length) avg=percents.reduce((s,v)=> s+v,0)/percents.length;
          const projectObj = allProjects.find(p=> String(p._id)===String(projectId));
          const totalPics = Array.isArray(projectObj?.pic)? projectObj.pic.length : 0;
          const reportingPics = distinct.length;
          const pendingPics = totalPics>0? Math.max(0,totalPics-reportingPics):0;
          const picContributions = distinct.map(r=>{ const ai=r.ai||{}; const raw=Number(ai.pic_contribution_percent_raw); const legacy=Number(ai.pic_contribution_percent); const chosen=isFinite(raw)&&raw>=0? raw : (isFinite(legacy)&&legacy>=0? legacy : 0); return { picId:r.uploadedBy||r._id, picName:r.uploadedByName||'Unknown', contribution:Math.round(chosen), hasReport:true, lastReportDate:r.uploadedAt||null }; });
          setProjectContribs(prev => ({ ...prev, [projectId]: { averageContribution: Math.min(100,Math.max(0,Math.round(avg))), totalPics, reportingPics, pendingPics, picContributions } }));
        } catch {}
      })();
    };
    window.addEventListener('projectReportsUpdated', handler);
    return () => window.removeEventListener('projectReportsUpdated', handler);
  }, [allProjects]);

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

  // Recalculate pending requests whenever material requests or assigned locations change
  useEffect(()=>{
    const norm = (s='')=> s.replace(/\s+/g,' ').trim().toUpperCase();
    if(!materialRequests.length){ setPendingRequests([]); return; }
    const pending = materialRequests.filter(r=>{
      if(!r || !r.project) return false;
      const status = norm(r.status||'');
      const isPending = status.includes('PENDING AM') || status.includes('PENDING AREA MANAGER');
      if(!isPending) return false;
      // Try direct location on request.project
      let locId = r.project?.location?._id || (typeof r.project?.location === 'string' ? r.project.location : null);
      if(!locId){
        // fallback: find project in enriched list
        const pid = r.project._id || r.project.id || r.project; // handle raw id
        const proj = enrichedAllProjects.find(p=> p._id === pid);
        if(proj) locId = proj.location?._id || proj.location; 
      }
      if(!locId) return false; // cannot verify assignment
      return assignedLocations.some(l=> l._id === locId);
    });
    setPendingRequests(pending);
  },[materialRequests, assignedLocations, enrichedAllProjects]);

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
  // (Removed CEO-style filter controls to restore original horizontal layout)
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

  // Original layout uses full projectMetrics list directly (no local filtering UI)

  return (
    <div className="am-dashboard dashboard-container">
      <AppHeader 
        roleSegment="am" 
        extraLeft={
          <button
            className="sidebar-toggle-btn am-header-toggle"
            onClick={toggleSidebar}
            aria-label={sidebarOpen ? 'Close areas & projects panel' : 'Open areas & projects panel'}
          >
            <FaBars />
          </button>
        }
      />

      {/* Main Dashboard Content */}
      <main className="dashboard-main blueprint-bg">

        {/* Areas & Projects Sidebar */}
        <div className={`areas-projects-sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="sidebar-header">
            <h3><FaHardHat className="hdr-ico" /> Areas & Projects</h3>
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
                <Link to="/am/viewproj" className="stat-item stat-link" aria-label="Go to Projects">
                  <span className="stat-number">{enrichedAllProjects.length}</span>
                  <span className="stat-label">Total Projects</span>
                </Link>
                <Link to="/am/viewproj" className="stat-item stat-link" aria-label="Go to Projects">
                  <span className="stat-number">{assignedLocations.length}</span>
                  <span className="stat-label">Areas Managed</span>
                </Link>
              </div>
              <div className="kpi-strip">
                <Link to="/am/matreq" className="kpi" aria-label="Pending material requests">
                  <div className="kpi-ico"><FaBoxes /></div>
                  <div className="kpi-body">
                    <div className="kpi-title">Pending Requests</div>
                    <div className="kpi-value">{pendingRequests.length}</div>
                  </div>
                </Link>
                <Link to="/am/viewproj" className="kpi" aria-label="Active projects">
                  <div className="kpi-ico"><FaProjectDiagram /></div>
                  <div className="kpi-body">
                    <div className="kpi-title">Active Projects</div>
                    <div className="kpi-value">{metrics.activeProjects}</div>
                  </div>
                </Link>
                <Link to="/am/viewproj" className="kpi" aria-label="Average progress">
                  <div className="kpi-ico"><FaChartBar /></div>
                  <div className="kpi-body">
                    <div className="kpi-title">Avg. Progress</div>
                    <div className="kpi-value">{metrics.averageProgress}%</div>
                  </div>
                </Link>
              </div>
              <div
                className="hero-art"
                aria-hidden="true"
                style={{
                  backgroundImage: `radial-gradient(ellipse at 65% 35%, rgba(255,255,255,0.18), transparent 55%), url(${process.env.PUBLIC_URL || ''}/images/illustration-construction-site.png)`
                }}
              ></div>
            </div>

            {/* Project Metrics - Restored Original Layout (horizontal scroll, no filters) */}
            <div className="dashboard-card project-metrics-card">
              <div className="card-header">
                <h3><FaChartBar /> Project Progress</h3>
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
                      <Link
                        to={`/am/projects/${metric.projectId}`}
                        key={metric.projectId}
                        className="project-metric-item project-metric-link"
                        style={{ textDecoration:'none' }}
                        aria-label={`View project ${metric.projectName}`}
                      >
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
                          {/* Professional metric badges (no bar graphs) */}
                          <div className="metric-badges" style={{marginTop:8, display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(90px,1fr))', gap:6, fontSize:11}}>
                            <div style={{background:'#f1f5f9',padding:'6px 8px',borderRadius:6,display:'flex',flexDirection:'column',gap:2}}>
                              <span style={{opacity:.6}}>Progress</span>
                              <strong>{metric.progress}%</strong>
                            </div>
                            <div style={{background:'#f1f5f9',padding:'6px 8px',borderRadius:6,display:'flex',flexDirection:'column',gap:2}}>
                              <span style={{opacity:.6}}>Reported</span>
                              <strong>{metric.reportingPics}/{metric.totalPics||0}</strong>
                            </div>
                            <div style={{background:'#f1f5f9',padding:'6px 8px',borderRadius:6,display:'flex',flexDirection:'column',gap:2}}>
                              <span style={{opacity:.6}}>Pending PICs</span>
                              <strong>{metric.pendingPics}</strong>
                            </div>
                            <div style={{
                              background: (() => {
                                const status = metric.waitingForAll ? 'Waiting' : metric.status;
                                switch(status?.toLowerCase()) {
                                  case 'completed':
                                  case 'done':
                                  case 'finished':
                                    return '#ecfdf5'; // Green background
                                  case 'ontrack':
                                  case 'on track':
                                  case 'in progress':
                                  case 'active':
                                  case 'ongoing':
                                    return '#eff6ff'; // Blue background
                                  case 'pending':
                                  case 'waiting':
                                    return '#fffbeb'; // Orange background
                                  case 'regressing':
                                  case 'delayed':
                                  case 'behind':
                                    return '#fef2f2'; // Red background
                                  case 'on hold':
                                  case 'paused':
                                    return '#f3e8ff'; // Purple background
                                  default:
                                    return '#f1f5f9'; // Default gray background
                                }
                              })(),
                              border: (() => {
                                const status = metric.waitingForAll ? 'Waiting' : metric.status;
                                switch(status?.toLowerCase()) {
                                  case 'completed':
                                  case 'done':
                                  case 'finished':
                                    return '1px solid #bbf7d0'; // Green border
                                  case 'ontrack':
                                  case 'on track':
                                  case 'in progress':
                                  case 'active':
                                  case 'ongoing':
                                    return '1px solid #dbeafe'; // Blue border
                                  case 'pending':
                                  case 'waiting':
                                    return '1px solid #fed7aa'; // Orange border
                                  case 'regressing':
                                  case 'delayed':
                                  case 'behind':
                                    return '1px solid #fecaca'; // Red border
                                  case 'on hold':
                                  case 'paused':
                                    return '1px solid #e9d5ff'; // Purple border
                                  default:
                                    return '1px solid #e2e8f0'; // Default gray border
                                }
                              })(),
                              padding:'6px 8px',
                              borderRadius:6,
                              display:'flex',
                              flexDirection:'column',
                              gap:2
                            }}>
                              <span style={{opacity:.6}}>Status</span>
                              <strong style={{
                                textTransform:'capitalize',
                                color: (() => {
                                  const status = metric.waitingForAll ? 'Waiting' : metric.status;
                                  switch(status?.toLowerCase()) {
                                    case 'completed':
                                    case 'done':
                                    case 'finished':
                                      return '#059669'; // Green text
                                    case 'ontrack':
                                    case 'on track':
                                    case 'in progress':
                                    case 'active':
                                    case 'ongoing':
                                      return '#1d4ed8'; // Blue text
                                    case 'pending':
                                    case 'waiting':
                                      return '#d97706'; // Orange text
                                    case 'regressing':
                                    case 'delayed':
                                    case 'behind':
                                      return '#dc2626'; // Red text
                                    case 'on hold':
                                    case 'paused':
                                      return '#7c3aed'; // Purple text
                                    default:
                                      return '#374151'; // Default gray text
                                  }
                                })()
                              }}>{metric.waitingForAll ? 'Waiting' : metric.status}</strong>
                            </div>
                            <div style={{background:'#f1f5f9',padding:'6px 8px',borderRadius:6,display:'flex',flexDirection:'column',gap:2}}>
                              <span style={{opacity:.6}}>Last Report</span>
                              <strong>{metric.latestDate ? new Date(metric.latestDate).toLocaleDateString() : '—'}</strong>
                            </div>
                          </div>
                          {/* Mini per-PIC contribution bar chart (re-added as requested) */}
                          <div className="metric-mini-chart" style={{marginTop:10, background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:8, padding:'4px 6px'}}>
                            {(() => {
                              const contrib = projectContribs[metric.projectId]?.picContributions || [];
                              const data = contrib.filter(c=>c.hasReport).map(c=>({
                                name: c.picName.length>6? c.picName.slice(0,6)+'…': c.picName,
                                value: c.contribution || 0
                              }));
                              if(!data.length){
                                return <div style={{fontSize:11, opacity:.6, textAlign:'center', padding:'6px 0'}}>No PIC reports yet</div>;
                              }
                              return (
                                <ResponsiveContainer width="100%" height={90}>
                                  <BarChart data={data} margin={{top:4,right:4,left:0,bottom:0}}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                    <XAxis dataKey="name" tick={{fontSize:9}} axisLine={false} tickLine={false} />
                                    <YAxis hide domain={[0,100]} />
                                    <Tooltip cursor={{fill:'rgba(0,0,0,0.04)'}} formatter={(v)=>[v+'%', 'Contribution']} />
                                    <Bar dataKey="value" radius={[4,4,0,0]} fill="#3B82F6" />
                                  </BarChart>
                                </ResponsiveContainer>
                              );
                            })()}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Aggregated Metrics Charts removed per request */}

            {/* Material Requests Overview - Compact with Tracking (original layout) */}
            <div className="dashboard-card requests-card">
              <div className="card-header">
                <h3 className="card-title"><FaTruck /> Material Requests</h3>
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
                        const normA = (a.status||'').replace(/\s+/g,' ').trim().toUpperCase();
                        const normB = (b.status||'').replace(/\s+/g,' ').trim().toUpperCase();
                        const aPendingAM = normA==='PENDING AM' || normA==='PENDING AREA MANAGER';
                        const bPendingAM = normB==='PENDING AM' || normB==='PENDING AREA MANAGER';
                        if (aPendingAM && !bPendingAM) return -1;
                        if (!aPendingAM && bPendingAM) return 1;
                        return new Date(b.createdAt) - new Date(a.createdAt);
                      })
                      .map(request => {
                        const statusNorm = (request.status||'').replace(/\s+/g,' ').trim().toUpperCase();
                        const pendingAM = statusNorm==='PENDING AM' || statusNorm==='PENDING AREA MANAGER';
                        return (
                          <Link to={`/am/material-request/${request._id}`} key={request._id} className={`request-item-new-layout ${pendingAM? 'pending-for-user':''}`} style={{textDecoration:'none'}}>
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
                        );
                      })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
      {/* Page-level overlay removed; now injected globally in index.html */}
    </div>
  );
};

export default AreaDash;
