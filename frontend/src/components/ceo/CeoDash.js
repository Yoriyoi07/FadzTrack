import React, { useEffect, useRef, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import '../style/ceo_style/Ceo_Dash.css';
import api from '../../api/axiosInstance';
import CeoAddArea from './CeoAddArea';
import AppHeader from '../layout/AppHeader';

// Icons (same set used by AM for consistent look)
import {
  FaUsers,
  FaProjectDiagram,
  FaCalendarAlt,
  FaArrowRight,
  FaChevronDown,
  FaChevronUp,
  FaMapMarkerAlt,
  FaChevronRight,
  FaChevronLeft,
  FaBoxes,
  FaChartBar,
  FaBars
} from 'react-icons/fa';

const CeoDash = () => {
  // Stable user
  const userRef = useRef(null);
  if (userRef.current === null) {
    const raw = localStorage.getItem('user');
    userRef.current = raw ? JSON.parse(raw) : null;
  }
  const user = userRef.current;
  const [userName] = useState(user?.name || '');
  const [userRole] = useState(user?.role || '');

  // Header now unified via AppHeader
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Data state
  const [locations, setLocations] = useState([]);
  const [allProjects, setAllProjects] = useState([]);
  const [enrichedAllProjects, setEnrichedAllProjects] = useState([]);
  const [expandedLocations, setExpandedLocations] = useState({});
  const [loading, setLoading] = useState(true);

  // Material Requests
  const [materialRequests, setMaterialRequests] = useState([]);
  const [materialRequestsLoading, setMaterialRequestsLoading] = useState(true);

  // Requests
  const [requestsError, setRequestsError] = useState(null);

  // Metrics
  const [projectMetrics, setProjectMetrics] = useState([]);
  const [metricsLoading, setMetricsLoading] = useState(true);
  // pagination removed; we keep horizontal scroll of all items

  const [showAddAreaModal, setShowAddAreaModal] = useState(false);
  const [selectedArea, setSelectedArea] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [locationSearch, setLocationSearch] = useState('');

  // Initial load: locations, projects, requests
  useEffect(() => {
    let isActive = true;
    const controller = new AbortController();

    const loadAll = async () => {
      try {
        const [locRes, projRes, matRes] = await Promise.all([
          api.get('/locations', { signal: controller.signal }),
          api.get('/projects', { signal: controller.signal }),
          api.get('/requests', { signal: controller.signal })
        ]);

        if (!isActive) return;
        const locs = Array.isArray(locRes.data) ? locRes.data : [];
        const projs = Array.isArray(projRes.data) ? projRes.data : [];
        const mats = Array.isArray(matRes.data) ? matRes.data : [];
        setLocations(locs);
        setAllProjects(projs);
        setMaterialRequests(mats);
        setMaterialRequestsLoading(false);
        setRequestsError(null);

        // Enrich projects with location object + display fields
        const enriched = projs.map((p) => {
          const loc = typeof p.location === 'object' && p.location?.name
            ? p.location
            : locs.find(l => l._id === (p.location?._id || p.location));
          return {
            ...p,
            location: loc ? { ...loc } : { name: 'Unknown Location', region: '' },
            name: p.projectName,
            engineer: p.projectmanager?.name || 'Not Assigned',
          };
        });
        setEnrichedAllProjects(enriched);
      } catch (err) {
        if (!isActive) return;
        setRequestsError('Error loading data');
      } finally {
        if (isActive) setLoading(false);
      }
    };

    loadAll();
    return () => { isActive = false; controller.abort(); };
  }, []);

  // Compute per-project metrics replicating Area Manager dashboard logic (reports first, then fallback to contributions)
  useEffect(() => {
    if (!enrichedAllProjects.length) { setProjectMetrics([]); return; }
    let cancelled = false;
    setMetricsLoading(true);

    const buildMetrics = async () => {
    const metrics = await Promise.all(enrichedAllProjects.map(async (project) => {
        try {
          const totalPics = Array.isArray(project.pic) ? project.pic.length : 0;
      let avg = 0; // running average (precise)
      let reportingPics = 0; let pendingPics = totalPics; let latestDate = null; let picContributions = []; let aiRisk = '';

          // 1. Fetch project reports (primary source like AM dashboard)
          try {
            const { data: repData } = await api.get(`/projects/${project._id}/reports`);
            const list = repData?.reports || [];
            if (list.length) {
              const sorted = [...list].sort((a,b)=> new Date(b.uploadedAt||0) - new Date(a.uploadedAt||0));
              latestDate = sorted[0]?.uploadedAt || null;
              const byUser = new Map();
              for (const r of sorted) {
                const key = r.uploadedBy || r.uploadedByName || r._id;
                if (!byUser.has(key)) byUser.set(key, r); // keep newest per user
              }
              const distinct = [...byUser.values()];
              const valsRaw = distinct
                .map(r => {
                  const ai = r?.ai || {};
                  const rawVal = ai.pic_contribution_percent_raw;
                  const legacyVal = ai.pic_contribution_percent;
                  let num = null;
                  if (rawVal !== undefined && rawVal !== null) {
                    const n = typeof rawVal === 'string' ? parseFloat(rawVal.toString().replace(/[^0-9.]+/g,'')) : Number(rawVal);
                    if (isFinite(n)) num = n;
                  } else if (legacyVal !== undefined && legacyVal !== null) {
                    const n = typeof legacyVal === 'string' ? parseFloat(legacyVal.toString().replace(/[^0-9.]+/g,'')) : Number(legacyVal);
                    if (isFinite(n)) num = n;
                  }
                  return num;
                })
                .filter(v => v !== null && v >= 0 && v <= 100);
              let vals = valsRaw;
              if (!vals.length) {
                // heuristic fallback from completed_tasks vs summary_of_work_done
                vals = distinct.map(r => {
                  const done = r?.ai?.completed_tasks?.length || 0;
                  const total = done + (r?.ai?.summary_of_work_done?.length || 0);
                  return total > 0 ? (done / total) * 100 : 0;
                });
              }
              if (vals.length) {
                const a = vals.reduce((s,v)=> s+v,0) / vals.length;
                avg = Math.min(100, Math.max(0, a));
              }
              reportingPics = distinct.length; pendingPics = totalPics > 0 ? Math.max(0, totalPics - reportingPics) : 0;
              picContributions = distinct.map(r => {
                const ai = r?.ai || {};
                const rawVal = ai.pic_contribution_percent_raw;
                const legacyVal = ai.pic_contribution_percent;
                let chosen = 0;
                if (rawVal !== undefined && rawVal !== null) {
                  const n = typeof rawVal === 'string' ? parseFloat(rawVal.toString().replace(/[^0-9.]+/g,'')) : Number(rawVal);
                  if (isFinite(n)) chosen = n;
                } else if (legacyVal !== undefined && legacyVal !== null) {
                  const n = typeof legacyVal === 'string' ? parseFloat(legacyVal.toString().replace(/[^0-9.]+/g,'')) : Number(legacyVal);
                  if (isFinite(n)) chosen = n;
                }
                return { picId: r.uploadedBy || r._id, picName: r.uploadedByName || 'Unknown', contribution: Math.round(chosen), hasReport: true, lastReportDate: r.uploadedAt || null };
              });

              // Risk extraction (prefer realistic critical path analysis first report that contains it)
              for (const rep of distinct) {
                const ai = rep?.ai;
                const cpa = Array.isArray(ai?.critical_path_analysis) ? ai.critical_path_analysis : [];
                const realistic = cpa.find(c => (c?.path_type || '').toLowerCase() === 'realistic');
                aiRisk = (realistic?.risk || ai?.risk || '').toString();
                if (aiRisk) break;
              }
            }
          } catch { /* ignore, fallback below */ }

          // 2. Fallback to aggregated contributions endpoint if avg still 0
          if (avg === 0) {
            try {
              const { data: contrib } = await api.get(`/daily-reports/project/${project._id}/pic-contributions`);
              if (contrib) {
                if (!latestDate) {
                  const ld = (contrib.picContributions || []).filter(p => p.lastReportDate).map(p => new Date(p.lastReportDate)).sort((a,b)=> b-a)[0];
                  latestDate = ld ? ld.toISOString() : latestDate;
                }
                if (contrib.averageContribution) avg = contrib.averageContribution;
                if (!reportingPics) reportingPics = contrib.reportingPics || 0;
                if (totalPics && pendingPics === totalPics) pendingPics = contrib.pendingPics ?? pendingPics;
                if (!picContributions.length) picContributions = contrib.picContributions || [];
              }
            } catch { /* ignore */ }
          }

          // 3. (Optional) Legacy progress endpoint fallback if still 0 (additional safety)
          if (Math.round(avg) === 0 && reportingPics === 0) {
            try {
              const { data: legacy } = await api.get(`/daily-reports/project/${project._id}/progress`);
              const segs = Array.isArray(legacy?.progress) ? legacy.progress : [];
              const completed = segs.find(s => /completed/i.test(s.name))?.value || 0;
              const inProg = segs.find(s => /in progress/i.test(s.name))?.value || 0;
              const approx = Math.round(Math.min(100, Math.max(0, completed + inProg * 0.5)));
              if (approx > 0) avg = approx;
            } catch { /* ignore */ }
          }

            let status = 'ontrack';
          if (pendingPics > 0 && totalPics > 1) status = 'pending';
          else if (avg < 50) status = 'regressing';
          const latestDateObj = latestDate ? new Date(latestDate) : null;
          if (latestDateObj && (Date.now() - latestDateObj.getTime()) > 3 * 24 * 60 * 60 * 1000) status = 'stale';
          const picNames = (picContributions || []).map(p => p.hasReport ? p.picName : `${p.picName} (pending)`);

          return {
            projectId: project._id,
            projectName: project.name,
            pm: project.engineer,
            area: project.location?.name || 'Unknown Area',
            progressPrecise: Number(avg.toFixed(2)),
            progress: Math.round(avg),
            totalPics,
            latestDate: latestDateObj,
            status,
            waitingForAll: pendingPics > 0 && totalPics > 1,
            picNames,
            aiRisk,
            reportingPics,
            pendingPics,
            picContributions
          };
        } catch (err) {
          return {
            projectId: project._id,
            projectName: project.name,
            pm: project.engineer,
            area: project.location?.name || 'Unknown Area',
            progressPrecise: 0,
            progress: 0,
            totalPics: 0,
            latestDate: null,
            status: 'stale',
            waitingForAll: false,
            picNames: [],
            picContributions: []
          };
        }
      }));

      metrics.sort((a,b)=> {
        if (!a.latestDate && !b.latestDate) return 0;
        if (!a.latestDate) return 1;
        if (!b.latestDate) return -1;
        return new Date(b.latestDate) - new Date(a.latestDate);
      });

      if (!cancelled) {
        setProjectMetrics(metrics);
        setMetricsLoading(false);
      }
    };

    buildMetrics();
    return () => { cancelled = true; };
  }, [enrichedAllProjects]);

  // Listen for global projectReportsUpdated to update per-project metrics incrementally
  useEffect(()=>{
    const handler = (e)=>{
      const projectId = e?.detail?.projectId; if(!projectId) return;
      // Find the project in enrichedAllProjects; if absent ignore
      const project = enrichedAllProjects.find(p=> String(p._id)===String(projectId));
      if(!project) return;
      (async()=>{
        try {
          const totalPics = Array.isArray(project.pic)? project.pic.length : 0;
          let avg=0; let reportingPics=0; let pendingPics=totalPics; let latestDate=null; let picContributions=[]; let aiRisk='';
          const { data: repData } = await api.get(`/projects/${projectId}/reports`);
          const list = repData?.reports||[];
          if(list.length){
            const sorted=[...list].sort((a,b)=> new Date(b.uploadedAt||0)-new Date(a.uploadedAt||0));
            latestDate = sorted[0]?.uploadedAt||null;
            const byUser=new Map();
            for(const r of sorted){ const key=r.uploadedBy||r.uploadedByName||r._id; if(!byUser.has(key)) byUser.set(key,r); }
            const distinct=[...byUser.values()];
            const vals = distinct.map(r=>{ const ai=r.ai||{}; const raw=Number(ai.pic_contribution_percent_raw); const legacy=Number(ai.pic_contribution_percent); if(isFinite(raw)&&raw>=0) return raw; if(isFinite(legacy)&&legacy>=0) return legacy; const done=ai.completed_tasks?.length||0; const total=done+(ai.summary_of_work_done?.length||0); return total>0?(done/total)*100:0; }).filter(v=> isFinite(v)&&v>=0);
            if(vals.length) avg = Math.min(100,Math.max(0, vals.reduce((s,v)=> s+v,0)/vals.length));
            reportingPics=distinct.length; pendingPics= totalPics>0? Math.max(0,totalPics-reportingPics):0;
            picContributions = distinct.map(r=>{ const ai=r.ai||{}; const raw=Number(ai.pic_contribution_percent_raw); const legacy=Number(ai.pic_contribution_percent); const chosen=isFinite(raw)&&raw>=0? raw : (isFinite(legacy)&&legacy>=0? legacy : 0); return { picId:r.uploadedBy||r._id, picName:r.uploadedByName||'Unknown', contribution:Math.round(chosen), hasReport:true, lastReportDate:r.uploadedAt||null }; });
          }
          setProjectMetrics(prev=> prev.map(m=> m.projectId===projectId? { ...m, progressPrecise: Number(avg.toFixed(2)), progress: Math.round(avg), reportingPics, pendingPics, latestDate: latestDate? new Date(latestDate): null, picContributions } : m));
        } catch {}
      })();
    };
    window.addEventListener('projectReportsUpdated', handler);
    return ()=> window.removeEventListener('projectReportsUpdated', handler);
  },[enrichedAllProjects, setProjectMetrics]);

  // (no pagination state)

  const toggleSidebar = () => setSidebarOpen((v) => !v);

  // Group ONLY ongoing/active projects by location for sidebar (exclude completed)
  const projectsByLocation = enrichedAllProjects.reduce((acc, project) => {
    const statusStr = String(project.status || '').toLowerCase();
    const isCompleted = statusStr === 'completed' || /\bcompleted\b/.test(statusStr);
    if (isCompleted) return acc; // skip completed in sidebar list
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
  const sidebarProjectCount = Object.values(projectsByLocation).reduce((sum, l) => sum + l.projects.length, 0);

  // (Heatmap removed)

  // Filter metrics by area when selected from heatmap
  const visibleMetrics = (selectedArea
    ? projectMetrics.filter(m => (m.area || 'Unknown Area') === selectedArea)
    : projectMetrics)
    .filter(m => !statusFilter || m.status === statusFilter)
    .filter(m => !searchTerm ||
      m.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.area || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

  // Prepare widget datasets (use overall metrics so widgets always show data)
  const widgetStuck = projectMetrics.filter(m => m.status === 'stale' || m.waitingForAll).slice(0, 5);
  const widgetRecent = projectMetrics
    .slice()
    .sort((a,b) => new Date(b.latestDate||0) - new Date(a.latestDate||0))
    .slice(0,5);
  const widgetAging = projectMetrics
    .map(m => ({ ...m, age: m.latestDate ? Math.floor((Date.now() - new Date(m.latestDate).getTime()) / (24*60*60*1000)) : null }))
    .sort((a,b) => (b.age||0) - (a.age||0))
    .slice(0,5);
  const widgetPerf = projectMetrics
    .slice()
    .sort((a,b) => (b.progress||0) - (a.progress||0))
    .slice(0,5);

  // Request timeline status helper (same logic as AM)
  const getTimelineStatus = (status, stage) => {
    const statusLower = status?.toLowerCase() || '';
    if (statusLower.includes('rejected')) return 'rejected';
    switch (stage) {
      case 'placed':
        if (statusLower.includes('pending pm') || statusLower.includes('project manager')) return 'completed one-step-behind';
        if (statusLower.includes('pending am') || statusLower.includes('area manager') || statusLower.includes('pending cio') || statusLower.includes('received')) return 'completed';
        return 'completed';
      case 'pm':
        if (statusLower.includes('rejected pm') || statusLower.includes('pm rejected')) return 'rejected';
        if (statusLower.includes('pending pm') || statusLower.includes('project manager')) return 'pending';
        if (statusLower.includes('pending am') || statusLower.includes('area manager')) return 'completed one-step-behind';
        if (statusLower.includes('pending cio') || statusLower.includes('received')) return 'completed';
        break;
      case 'am':
        if (statusLower.includes('rejected am') || statusLower.includes('am rejected')) return 'rejected';
        if (statusLower.includes('pending am') || statusLower.includes('area manager')) return 'pending';
        if (statusLower.includes('pending cio')) return 'completed one-step-behind';
        if (statusLower.includes('received')) return 'completed';
        break;
      case 'cio':
        if (statusLower.includes('rejected cio') || statusLower.includes('cio rejected')) return 'rejected';
        if (statusLower.includes('pending cio') || statusLower.includes('pending ceo')) return 'pending';
        if (statusLower.includes('received')) return 'completed one-step-behind';
        break;
      case 'done':
        if (statusLower.includes('received')) return 'completed';
        break;
    }
    return '';
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
    <div className="ceo-dashboard dashboard-container">
      {/* Unified AppHeader (reports nav omitted by default) */}
      <AppHeader
        roleSegment="ceo"
        extraLeft={
          <button
            className="sidebar-toggle-btn ceo-header-toggle"
            onClick={toggleSidebar}
            aria-label={sidebarOpen ? 'Close areas & projects panel' : 'Open areas & projects panel'}
          >
            <FaBars />
          </button>
        }
      />

      {/* Main */}
      <main className="dashboard-main">
        {/* Sidebar toggle moved to header */}

        {/* Areas & Projects Sidebar (portal) */}
        {createPortal(
          <aside className={`areas-projects-sidebar ceo-sidepanel ${sidebarOpen ? 'open' : ''}`} aria-label="Areas and Projects" role="complementary">
            <div className="sidepanel-header">
              <button className="icon-btn ghost" onClick={toggleSidebar} aria-label="Close sidebar"><FaChevronLeft /></button>
              <h3 className="panel-title">Areas & Projects</h3>
              <button className="icon-btn primary" onClick={() => setShowAddAreaModal(true)}>Add</button>
            </div>
            <div className="sidepanel-search-row">
              <input
                type="text"
                className="sidepanel-search"
                placeholder="Search area or region..."
                value={locationSearch}
                onChange={(e)=> setLocationSearch(e.target.value)}
              />
            </div>
            <div className="sidepanel-scroll">
              {Object.keys(projectsByLocation).length === 0 ? (
                <div className="empty-state small pad-1rem">
                  <span>No areas or projects found</span>
                  <p>Projects will appear here once available.</p>
                </div>
              ) : (
                Object.entries(projectsByLocation)
                  .filter(([,loc])=> !locationSearch || loc.name.toLowerCase().includes(locationSearch.toLowerCase()) || loc.region.toLowerCase().includes(locationSearch.toLowerCase()))
                  .map(([locationId, locationData]) => {
                    const expanded = !!expandedLocations[locationId];
                    return (
                      <div key={locationId} className={`area-block ${expanded ? 'expanded' : ''}`}>
                        <button
                          className="area-summary"
                          onClick={() => setExpandedLocations(prev => ({ ...prev, [locationId]: !prev[locationId] }))}
                          aria-expanded={expanded}
                        >
                          <span className="marker"><FaMapMarkerAlt /></span>
                          <span className="area-texts">
                            <span className="area-name">{locationData.name}</span>
                            <span className="area-region">{locationData.region}</span>
                          </span>
                          <span className="count-pill" title="Projects">{locationData.projects.length}</span>
                          <span className="chevron">{expanded ? <FaChevronUp /> : <FaChevronDown />}</span>
                        </button>
                        {expanded && (
                          <div className="projects-collapsible">
                            {locationData.projects.map(project => (
                              <Link to={`/ceo/proj/${project._id}`} key={project._id} className="project-link" onClick={toggleSidebar}>
                                <FaProjectDiagram className="pj-ic" />
                                <span className="pj-name" title={project.name}>{project.name}</span>
                                <span className="pj-pm" title={project.engineer}>{project.engineer}</span>
                                <FaArrowRight className="arrow" />
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
              )}
            </div>
            <div className="sidepanel-footer">
              <span>{sidebarProjectCount} ongoing projects</span>
            </div>
          </aside>,
          document.body
        )}

        {/* Overlay (portal) */}
        {sidebarOpen && createPortal(
          <div className="sidebar-overlay" onClick={toggleSidebar} style={{ zIndex: 20000 }}></div>,
          document.body
        )}

        {/* Content area */}
        <div className="dashboard-content ceo-content">
          {/* Welcome */}
          <div className="dashboard-card ceo-welcome-card ceo-welcome">
            <div className="welcome-content">
              <h2 className="welcome-title">Welcome back, {userName}! 👋</h2>
              <p className="welcome-subtitle">Here's the status of all company projects</p>
            </div>
            <div className="welcome-stats">
              {(() => {
                const total = allProjects.length;
                const ongoing = allProjects.filter(p => {
                  const s = String(p.status || '').toLowerCase();
                  return s === 'ongoing' || s === 'active' || s === 'in progress';
                }).length;
                const completed = allProjects.filter(p => String(p.status || '').toLowerCase() === 'completed').length;
                return (
                  <>
                    <Link to="/ceo/proj" className="stat-item stat-link no-decoration inherit-color" aria-label="View all projects">
                      <span className="stat-number">{total}</span>
                      <span className="stat-label">Total Projects</span>
                    </Link>
                    <Link to="/ceo/proj?status=ongoing" className="stat-item stat-link no-decoration inherit-color" aria-label="View ongoing projects">
                      <span className="stat-number">{ongoing}</span>
                      <span className="stat-label">Ongoing</span>
                    </Link>
                    <Link to="/ceo/proj?status=completed" className="stat-item stat-link no-decoration inherit-color" aria-label="View completed projects">
                      <span className="stat-number">{completed}</span>
                      <span className="stat-label">Completed</span>
                    </Link>
                    <Link to="/ceo/material-list" className="stat-item stat-link no-decoration inherit-color" aria-label="View material requests">
                      <span className="stat-number">{materialRequests.length}</span>
                      <span className="stat-label"> Material Requests</span>
                    </Link>
                  </>
                );
              })()}
            
            </div>
            {/* KPI strip similar to AM */}
            <div className="kpi-strip">
              <Link to="/ceo/material-list" className="kpi" aria-label="Pending material requests">
                <div className="kpi-ico"><FaBoxes /></div>
                <div className="kpi-body">
                  <div className="kpi-title">Pending Requests</div>
                  <div className="kpi-value">{materialRequests.filter(r=>/pending/i.test(String(r.status||''))).length}</div>
                </div>
              </Link>
              <Link to="/ceo/proj" className="kpi" aria-label="Active projects">
                <div className="kpi-ico"><FaProjectDiagram /></div>
                <div className="kpi-body">
                  <div className="kpi-title">Active Projects</div>
                  <div className="kpi-value">{allProjects.filter(p=>/ongoing|active|in progress/i.test(String(p.status||''))).length}</div>
                </div>
              </Link>
              <div className="kpi" aria-label="Avg. progress">
                <div className="kpi-ico"><FaChartBar /></div>
                <div className="kpi-body">
                  <div className="kpi-title">Avg. Progress</div>
                  <div className="kpi-value">{Math.round(visibleMetrics.reduce((a,m)=>a+(m.progress||0),0)/(visibleMetrics.length||1))}%</div>
                </div>
              </div>
            </div>
            {/* CEO hero art inside the welcome card (right side) */}
            <div
              className="hero-art"
              aria-hidden="true"
              style={{
                backgroundImage: `radial-gradient(ellipse at 65% 35%, rgba(255,255,255,0.18), transparent 55%), url(${process.env.PUBLIC_URL || ''}/images/illustration-construction-site.png)`
              }}
            ></div>
          </div>

          {/* Progress Metrics */}
          <div className="dashboard-grid single-col">
            <div className="dashboard-card ceo-project-metrics-card">
              <div className="card-header ceo-metrics-header">
                <h3>Project Progress</h3>
                <div className="metrics-filters-row">
                  <span className="metrics-subtitle subtle-text">Based on latest PIC reports</span>
                  <input
                    type="text"
                    placeholder="Search projects or area..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="input text-input"
                    aria-label="Search projects or by area name"
                  />
                  <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input select-input">
                    <option value="">All statuses</option>
                    <option value="ontrack">On Track</option>
                    <option value="regressing">Regressing</option>
                    <option value="stale">Stale</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>
              </div>
              <div className="project-metrics-container">
                {metricsLoading ? (
                  <div className="metrics-loading fade-in">
                    <div className="loading-spinner"></div>
                    <span>Loading project metrics...</span>
                  </div>
                ) : visibleMetrics.length === 0 ? (
                  <div className="metrics-empty fade-in">
                    <FaChartBar />
                    <span>No project metrics available</span>
                    <p>Reports need to be submitted to see progress</p>
                  </div>
                ) : (
                  <div className="project-metrics-scroll">
                    {selectedArea && (
                      <div className="active-filter-pill">
                        Filter: <b>{selectedArea}</b> <button onClick={() => setSelectedArea(null)} className="btn-light-xs">Clear</button>
                      </div>
                    )}
                    {visibleMetrics.map((metric) => (
                      <Link to={`/ceo/proj/${metric.projectId}`} key={metric.projectId} className="project-metric-item metric-card metric-card-link">
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
                                <circle cx="30" cy="30" r="25" stroke="#e2e8f0" strokeWidth="4" fill="transparent" />
                                <circle
                                  cx="30"
                                  cy="30"
                                  r="25"
                                  stroke={metric.progress >= 80 ? '#10B981' : metric.progress >= 50 ? '#3B82F6' : '#F59E0B'}
                                  strokeWidth="4"
                                  fill="transparent"
                                  strokeDasharray={`${2 * Math.PI * 25}`}
                                  strokeDashoffset={`${2 * Math.PI * 25 * (1 - (metric.progressPrecise ?? metric.progress) / 100)}`}
                                  strokeLinecap="round"
                                  transform="rotate(-90 30 30)"
                                />
                              </svg>
                              <div className="progress-text" title={`${metric.progressPrecise?.toFixed(2) || metric.progress}% exact`}>
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
                              {metric.latestDate ? new Date(metric.latestDate).toLocaleDateString() : 'No reports'}
                            </span>
                            <span className={`metric-status status-${metric.status}`}>
                              {metric.waitingForAll ? 'Waiting for all PICs' : metric.status === 'ontrack' ? 'On Track' : metric.status === 'regressing' ? 'Regressing' : metric.status === 'stale' ? 'Stale' : 'Pending'}
                            </span>
                          </div>
                          {/* AM-style metric badges */}
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
                            <div style={{background:'#f1f5f9',padding:'6px 8px',borderRadius:6,display:'flex',flexDirection:'column',gap:2}}>
                              <span style={{opacity:.6}}>Status</span>
                              <strong style={{textTransform:'capitalize'}}>{metric.waitingForAll ? 'Waiting' : metric.status}</strong>
                            </div>
                            <div style={{background:'#f1f5f9',padding:'6px 8px',borderRadius:6,display:'flex',flexDirection:'column',gap:2}}>
                              <span style={{opacity:.6}}>Last Report</span>
                              <strong>{metric.latestDate ? new Date(metric.latestDate).toLocaleDateString() : '—'}</strong>
                            </div>
                          </div>
                          {/* Mini per-PIC contribution bar chart */}
                          <div className="metric-mini-chart" style={{marginTop:10, background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:8, padding:'4px 6px'}}>
                            {(() => {
                              const contrib = metric.picContributions || [];
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
          </div>

          {/* Material Requests + Risks Row */}
          <div className="dashboard-grid two-col compact-row">
            <div className="dashboard-card material-requests-card stretch-card">
              <div className="card-header">
                <h3>Material Request Tracking</h3>
                <Link to="/ceo/material-list" className="inline-link">
                  View All →
                </Link>
              </div>
              <div className="card-body compact-padding">
                <div className="helper-row">
                  <span className="helper-text">
                    📋 Quick access to material request management
                  </span>
                </div>
                {materialRequestsLoading ? (
                  <div className="muted">Loading material requests...</div>
                ) : materialRequests.length === 0 ? (
                  <div className="muted">No material requests found</div>
                ) : (
                  <div className="mr-list-wrapper">
                    <div className="mr-list-label">
                      Recent Requests with Tracking:
                    </div>
                    <div className="mr-items">
                      {materialRequests.slice(0, 3).map((request) => {
                        const approvals = Array.isArray(request.approvals) ? request.approvals : [];
                        const pmApproval = approvals.find(a => /project manager/i.test(a.role) && a.decision === 'approved');
                        const amApproval = approvals.find(a => /area manager/i.test(a.role) && a.decision === 'approved');
                        const pmApprovedAt = pmApproval?.timestamp;
                        const amApprovedAt = amApproval?.timestamp;
                        return (
                        <Link to={`/ceo/material-request/${request._id}`} key={request._id} className="mr-item mr-item-link">
                          <div className="mr-item-head">
                            <span className="mr-item-title">
                              {request.description?.substring(0, 40) || 'No description'}...
                            </span>
                            <span className={`status-chip ${request.status?.includes('approved') ? 'status-approved' : request.status?.includes('denied') ? 'status-denied' : 'status-pending'}`}>{request.status || 'Pending'}</span>
                          </div>
                          
                          {/* Tracking Progress */}
                          <div className="mr-tracking">
                            <div className="mr-tracking-label">
                              Tracking Progress:
                            </div>
                            <div className="mr-tracking-rail">
                              {/* Placed Stage */}
                              <div className="track-stage completed">
                                <div className="stage-icon">
                                  ✓
                                </div>
                                <span className="stage-label">Placed</span>
                                <span className="stage-status success">Completed</span>
                                <span className="stage-date">{new Date(request.createdAt).toLocaleDateString()}</span>
                              </div>
                              
                              {/* Connector 1 */}
                              <div className="track-connector completed" />
                              
                              {/* PM Stage */}
                              <div className={`track-stage ${ pmApprovedAt ? 'completed' : (request.status?.includes('Denied by Project Manager') ? 'rejected' : 'pending') }`}>
                                <div className="stage-icon">
                                  {pmApprovedAt ? '✓' : (request.status?.includes('Denied by Project Manager') ? '✗' : '○')}
                                </div>
                                <span className="stage-label">Project Manager</span>
                                <span className={`stage-status ${ pmApprovedAt ? 'success' : (request.status?.includes('Denied by Project Manager') ? 'error' : 'pending') }`}>
                                  {pmApprovedAt ? 'Approved' : (request.status?.includes('Denied by Project Manager') ? 'Rejected' : 'Pending')}
                                </span>
                                <span className="stage-date">{pmApprovedAt ? new Date(pmApprovedAt).toLocaleDateString() : 'N/A'}</span>
                              </div>
                              
                              {/* Connector 2 */}
                              <div className={`track-connector ${ (request.status?.includes('pm') || request.status?.includes('project manager')) && !request.status?.includes('denied') ? 'completed' : '' }`} />
                              
                              {/* AM Stage */}
                              <div className={`track-stage ${ amApprovedAt ? 'completed' : (request.status?.includes('Denied by Area Manager') ? 'rejected' : 'pending') }`}>
                                <div className="stage-icon">
                                  {amApprovedAt ? '✓' : (request.status?.includes('Denied by Area Manager') ? '✗' : '○')}
                                </div>
                                <span className="stage-label">Area Manager</span>
                                <span className={`stage-status ${ amApprovedAt ? 'success' : (request.status?.includes('Denied by Area Manager') ? 'error' : 'pending') }`}>
                                  {amApprovedAt ? 'Approved' : (request.status?.includes('Denied by Area Manager') ? 'Rejected' : 'Pending')}
                                </span>
                                <span className="stage-date">{amApprovedAt ? new Date(amApprovedAt).toLocaleDateString() : 'N/A'}</span>
                              </div>
                              
                              {/* Connector 3 */}
                              <div className={`track-connector ${ (request.status?.includes('am') || request.status?.includes('area manager')) && !request.status?.includes('denied') ? 'completed' : '' }`} />
                              
                              {/* Received Stage */}
                              <div className={`track-stage ${ request.receivedByPIC ? 'completed' : 'pending' }`}>
                                <div className="stage-icon">
                                  {request.receivedByPIC ? '✓' : '○'}
                                </div>
                                <span className="stage-label">Received</span>
                                <span className={`stage-status ${ request.receivedByPIC ? 'success' : 'pending' }`}>
                                  {request.receivedByPIC ? 'Received' : 'Pending'}
                                </span>
                                <span className="stage-date">{request.receivedByPIC ? new Date(request.receivedByPIC).toLocaleDateString() : 'N/A'}</span>
                              </div>
                            </div>
                          </div>
                          <div className="mr-meta muted">
                            <span className="strong">{request.createdBy?.name || 'Unknown'}</span> • {new Date(request.createdAt).toLocaleDateString()}
                            {request.project?.projectName && (<span> • Project: {request.project.projectName}</span>)}
                          </div>
                        </Link>
                      );})}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="dashboard-card risks-card stretch-card">
                <div className="card-header">
                  <h3>Top Risks from AI</h3>
                </div>
                {(() => {
                  const risks = projectMetrics
                    .map(m => ({ projectId: m.projectId, projectName: m.projectName, risk: (m.aiRisk || '').toString() }))
                    .filter(x => x.risk)
                    .slice(0, 10);
                  if (risks.length === 0) {
                    return (<div className="muted pad-l">No risks extracted from AI reports</div>);
                  }
                  return (
                    <ul className="risk-list">
                      {risks.map(x => (
                        <li key={x.projectId}>
                          <b>{x.projectName}</b> — {x.risk}
                        </li>
                      ))}
                    </ul>
                  );
                })()}
            </div>
          </div>

          {/* (heatmap removed) */}
        </div>
        {/* Material Requests removed for CEO dashboard as requested */}
      </main>

      {/* Modal for Add Area */}
      {showAddAreaModal && (
        <div className="modal-overlay modal-centered">
          <div className="modal-content modal-standard ceo-narrow-modal">
            <CeoAddArea onSuccess={() => setShowAddAreaModal(false)} onCancel={() => setShowAddAreaModal(false)} />
          </div>
        </div>
      )}
    </div>
  );
};

export default CeoDash;
