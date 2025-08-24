import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, Link } from 'react-router-dom';
import '../style/am_style/Area_Dash.css';
import '../style/ceo_style/Ceo_Dash.css';
import '../style/ceo_style/Ceo_Dash.css';
import api from '../../api/axiosInstance';
import NotificationBell from '../NotificationBell';
import CeoAddArea from './CeoAddArea';

// Icons (same set used by AM for consistent look)
import {
  FaTachometerAlt,
  FaComments,
  FaUsers,
  FaProjectDiagram,
  FaClipboardList,
  FaChartBar,
  FaCalendarAlt,
  FaArrowRight,
  FaChevronDown,
  FaChevronUp,
  FaMapMarkerAlt,
  FaChevronRight,
  FaChevronLeft
} from 'react-icons/fa';

const CeoDash = () => {
  const navigate = useNavigate();

  // Stable user
  const userRef = useRef(null);
  if (userRef.current === null) {
    const raw = localStorage.getItem('user');
    userRef.current = raw ? JSON.parse(raw) : null;
  }
  const user = userRef.current;
  const [userName] = useState(user?.name || '');
  const [userRole] = useState(user?.role || '');

  // Header/UI state
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Data state
  const [locations, setLocations] = useState([]);
  const [allProjects, setAllProjects] = useState([]);
  const [enrichedAllProjects, setEnrichedAllProjects] = useState([]);
  const [expandedLocations, setExpandedLocations] = useState({});
  const [loading, setLoading] = useState(true);

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

  // Initial load: locations, projects, requests
  useEffect(() => {
    let isActive = true;
    const controller = new AbortController();

    const loadAll = async () => {
      try {
        const [locRes, projRes] = await Promise.all([
          api.get('/locations', { signal: controller.signal }),
          api.get('/projects', { signal: controller.signal })
        ]);

        if (!isActive) return;
        const locs = Array.isArray(locRes.data) ? locRes.data : [];
        const projs = Array.isArray(projRes.data) ? projRes.data : [];
        setLocations(locs);
        setAllProjects(projs);

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
        setRequestsError(null);
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

  // Compute per-project metrics using backend progress endpoint per project (system-wide)
  useEffect(() => {
    const fetchProjectMetrics = async () => {
      if (!enrichedAllProjects.length) return;
      setMetricsLoading(true);
      const metrics = [];

      const getPctFromAi = (ai) => {
        const v = Number(ai?.pic_contribution_percent);
        if (Number.isFinite(v) && v >= 0) return Math.max(0, Math.min(100, Math.round(v)));
        // Fallback heuristic if contribution is missing: use completed_tasks count
        const ct = Array.isArray(ai?.completed_tasks) ? ai.completed_tasks.length : 0;
        return Math.max(0, Math.min(100, ct * 5));
      };

      for (const project of enrichedAllProjects) {
        try {
          // Fetch AI reports for this project
          const { data } = await api.get(`/projects/${project._id}/reports`);
          const all = Array.isArray(data?.reports) ? data.reports : [];
          if (!all.length) {
            metrics.push({
              projectId: project._id,
              projectName: project.name,
              pm: project.engineer,
              area: project.location?.name || 'Unknown Area',
              progress: 0,
              totalPics: 0,
              latestDate: null,
              status: 'stale',
              waitingForAll: false,
              picNames: []
            });
            continue;
          }

          // Latest report per PIC (by uploadedBy)
          const byPic = {};
          for (const rep of all) {
            const picId = rep.uploadedBy || rep.uploadedByName || 'unknown';
            const repDate = rep.uploadedAt || rep.createdAt || rep.date;
            if (!byPic[picId] || new Date(repDate) > new Date(byPic[picId].uploadedAt)) {
              byPic[picId] = { ...rep, uploadedAt: repDate };
            }
          }

          const picIds = Object.keys(byPic);
          const expectedPics = Array.isArray(project.pic) ? project.pic.length : picIds.length; // fall back to seen PICs
          const latestDate = picIds.length
            ? picIds.map((id) => byPic[id].uploadedAt).sort((a, b) => new Date(b) - new Date(a))[0]
            : null;

          // Consider only reports matching the latest shared date when multiple PICs
          const sameDay = (d1, d2) => new Date(d1).toDateString() === new Date(d2).toDateString();
          let valuesAtLatest = [];
          const namesAtLatest = [];
          if (picIds.length > 1) {
            picIds.forEach((id) => {
              const rep = byPic[id];
              if (rep?.uploadedAt && sameDay(rep.uploadedAt, latestDate)) {
                valuesAtLatest.push(getPctFromAi(rep.ai || {}));
                namesAtLatest.push(rep.uploadedByName || 'Unknown');
              }
            });
          } else {
            valuesAtLatest = picIds.map((id) => getPctFromAi(byPic[id].ai || {}));
            namesAtLatest.push(byPic[picIds[0]]?.uploadedByName || 'Unknown');
          }

          const haveAll = picIds.length > 1 ? valuesAtLatest.length === expectedPics : valuesAtLatest.length > 0;
          const avg = valuesAtLatest.length
            ? Math.round(valuesAtLatest.reduce((s, v) => s + v, 0) / valuesAtLatest.length)
            : 0;

          // Status using AI performance score when available
          const scores = picIds
            .map((id) => Number((byPic[id]?.ai?.pic_performance_evaluation || {}).score))
            .filter((n) => Number.isFinite(n));
          const avgScore = scores.length ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) : null;

          let status = 'ontrack';
          if (!haveAll && picIds.length > 1) status = 'pending';
          else if (latestDate && (Date.now() - new Date(latestDate).getTime()) > 3 * 24 * 60 * 60 * 1000) status = 'stale';
          else if (avgScore != null) status = avgScore >= 70 ? 'ontrack' : avgScore < 50 ? 'regressing' : 'ontrack';
          else if (avg < 50) status = 'regressing';

          // Build PiC names display; include pending labels for those not on latest date
          const pendingNames = picIds
            .filter((id) => !(byPic[id]?.uploadedAt && sameDay(byPic[id].uploadedAt, latestDate)))
            .map((id) => (byPic[id]?.uploadedByName || 'Unknown') + ' (pending)');
          const allNames = [...namesAtLatest, ...pendingNames];

          // Extract a risk string from any PIC's latest AI (prefer realistic CPA's risk)
          let aiRisk = '';
          for (const id of picIds) {
            const ai = byPic[id]?.ai;
            const cpa = Array.isArray(ai?.critical_path_analysis) ? ai.critical_path_analysis : [];
            const realistic = cpa.find(c => (c?.path_type || '').toLowerCase() === 'realistic');
            aiRisk = (realistic?.risk || ai?.risk || '').toString();
            if (aiRisk) break;
          }

          metrics.push({
            projectId: project._id,
            projectName: project.name,
            pm: project.engineer,
            area: project.location?.name || 'Unknown Area',
            progress: avg,
            totalPics: picIds.length,
            latestDate,
            status,
            waitingForAll: picIds.length > 1 && !haveAll,
            picNames: allNames,
            aiRisk
          });
        } catch (e) {
          metrics.push({
            projectId: project._id,
            projectName: project.name,
            pm: project.engineer,
            area: project.location?.name || 'Unknown Area',
            progress: 0,
            totalPics: 0,
            latestDate: null,
            status: 'stale',
            waitingForAll: false,
            picNames: []
          });
        }
      }

      metrics.sort((a, b) => {
        if (!a.latestDate && !b.latestDate) return 0;
        if (!a.latestDate) return 1;
        if (!b.latestDate) return -1;
        return new Date(b.latestDate) - new Date(a.latestDate);
      });

      setProjectMetrics(metrics);
      setMetricsLoading(false);
    };

    fetchProjectMetrics();
  }, [enrichedAllProjects]);

  // (no pagination state)

  // Header collapse on scroll and outside click for profile menu
  useEffect(() => {
    const onScroll = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      setIsHeaderCollapsed(scrollTop > 50);
    };
    const onDocClick = (e) => {
      if (!e.target.closest('.profile-menu-container')) setProfileMenuOpen(false);
    };
    window.addEventListener('scroll', onScroll);
    document.addEventListener('click', onDocClick);
    return () => {
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('click', onDocClick);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  const toggleSidebar = () => setSidebarOpen((v) => !v);

  // Group projects by location for sidebar
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

  // (Heatmap removed)

  // Filter metrics by area when selected from heatmap
  const visibleMetrics = (selectedArea
    ? projectMetrics.filter(m => (m.area || 'Unknown Area') === selectedArea)
    : projectMetrics)
    .filter(m => !statusFilter || m.status === statusFilter)
    .filter(m => !searchTerm || m.projectName.toLowerCase().includes(searchTerm.toLowerCase()));

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
    <div className="dashboard-container">
      {/* Header (AM style) */}
      <header className={`dashboard-header ${isHeaderCollapsed ? 'collapsed' : ''}`}>
        <div className="header-top">
          <div className="logo-section">
            <img
              src={require('../../assets/images/FadzLogo1.png')}
              alt="FadzTrack Logo"
              className="header-logo"
            />
            <h1 className="header-brand">FadzTrack</h1>
          </div>
          <div className="user-profile profile-menu-container" onClick={() => setProfileMenuOpen(!profileMenuOpen)}>
            <div className="profile-avatar">{userName ? userName.charAt(0).toUpperCase() : 'U'}</div>
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
        <div className="header-bottom">
          <nav className="header-nav">
            <Link to="/ceo/dash" className="nav-item active">
              <FaTachometerAlt />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Dashboard</span>
            </Link>
            <Link to="/ceo/chat" className="nav-item">
              <FaComments />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Chat</span>
            </Link>
            <Link to="/ceo/proj" className="nav-item">
              <FaProjectDiagram />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Projects</span>
            </Link>
            <Link to="/ceo/audit-logs" className="nav-item">
              <FaClipboardList />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Audit Logs</span>
            </Link>
            <Link to="/reports" className="nav-item">
              <FaChartBar />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Reports</span>
            </Link>
            <button type="button" className="nav-item" onClick={toggleSidebar} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
              <FaMapMarkerAlt />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Areas & Projects</span>
            </button>
          </nav>
          <NotificationBell />
        </div>
      </header>

      {/* Main */}
      <main className="dashboard-main">
        {/* Sidebar toggle */}
        <button className="sidebar-toggle-btn" onClick={toggleSidebar}>
          <FaChevronRight />
        </button>

        {/* Areas & Projects Sidebar (portal) */}
        {createPortal(
          <div
            className={`areas-projects-sidebar ${sidebarOpen ? 'open' : ''}`}
            style={{
              position: 'fixed',
              top: 0,
              left: sidebarOpen ? 0 : -400,
              height: '100vh',
              width: 400,
              background: '#ffffff',
              zIndex: 20010,
              boxShadow: '4px 0 20px rgba(0,0,0,0.1)'
            }}
          >
            <div className="sidebar-header">
              <h3>Areas & Projects</h3>
              <button className="close-sidebar-btn" onClick={toggleSidebar}>
                <FaChevronLeft />
              </button>
            </div>
            <div className="areas-projects-card">
              <div className="card-header">
                <button className="add-project-btn" onClick={() => setShowAddAreaModal(true)}>
                  Add Project
                </button>
              </div>
              <div className="areas-list">
                {Object.keys(projectsByLocation).length === 0 ? (
                  <div className="empty-state" style={{ padding: '1rem' }}>
                    <span>No areas or projects found</span>
                    <p>Projects will appear here once available.</p>
                  </div>
                ) : (
                  Object.entries(projectsByLocation).map(([locationId, locationData]) => (
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
                            onClick={() => setExpandedLocations((prev) => ({ ...prev, [locationId]: !prev[locationId] }))}
                          >
                            {expandedLocations[locationId] ? <FaChevronUp /> : <FaChevronDown />}
                          </button>
                        </div>
                      </div>
                      {expandedLocations[locationId] && (
                        <div className="projects-list">
                          {locationData.projects.map((project) => (
                            <Link to={`/ceo/proj/${project._id}`} key={project._id} className="project-item">
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
                  ))
                )}
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Overlay (portal) */}
        {sidebarOpen && createPortal(
          <div className="sidebar-overlay" onClick={toggleSidebar} style={{ zIndex: 20000 }}></div>,
          document.body
        )}

        {/* Content grid (AM style) */}
        <div className="dashboard-content ceo-content">
          {/* Welcome (row 1) */}
          <div className="dashboard-card ceo-welcome-card" style={{ paddingBottom: '0.5rem', marginBottom: '5rem' }}>
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
                    <div className="stat-item">
                      <span className="stat-number">{total}</span>
                      <span className="stat-label">Total Projects</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-number">{ongoing}</span>
                      <span className="stat-label">Ongoing</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-number">{completed}</span>
                      <span className="stat-label">Completed</span>
                    </div>
                  </>
                );
              })()}
            
            </div>
          </div>

          {/* Project Metrics (row 2) */}
          <div style={{ height: '24px' }} />
          <div className="dashboard-grid" style={{ marginTop: '0rem' }}>
            <div className="dashboard-card project-metrics-card" style={{ marginBottom: '0.5rem' }}>
              <div className="card-header" style={{ alignItems: 'center' }}>
                <h3>Project Progress</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span className="metrics-subtitle">Based on latest PIC reports</span>
                  <input
                    type="text"
                    placeholder="Search projects..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 10px' }}
                  />
                  <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 10px' }}>
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
                  <div className="metrics-loading">
                    <div className="loading-spinner"></div>
                    <span>Loading project metrics...</span>
                  </div>
                ) : visibleMetrics.length === 0 ? (
                  <div className="metrics-empty">
                    <FaChartBar />
                    <span>No project metrics available</span>
                    <p>Reports need to be submitted to see progress</p>
                  </div>
                ) : (
                  <div className="project-metrics-scroll">
                    {selectedArea && (
                      <div style={{ alignSelf: 'center', marginRight: 12, color: '#64748b', fontSize: 12 }}>
                        Filter: <b>{selectedArea}</b> <button onClick={() => setSelectedArea(null)} style={{ marginLeft: 6, background: '#e2e8f0', border: '1px solid #cbd5e1', borderRadius: 6, padding: '2px 6px', cursor: 'pointer' }}>Clear</button>
                      </div>
                    )}
                    {visibleMetrics.map((metric) => (
                      <div key={metric.projectId} className="project-metric-item" style={{ minWidth: 320 }}>
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
                              {metric.latestDate ? new Date(metric.latestDate).toLocaleDateString() : 'No reports'}
                            </span>
                            <span className={`metric-status status-${metric.status}`}>
                              {metric.waitingForAll ? 'Waiting for all PICs' : metric.status === 'ontrack' ? 'On Track' : metric.status === 'regressing' ? 'Regressing' : metric.status === 'stale' ? 'Stale' : 'Pending'}
                            </span>
                          </div>
                          {metric.picNames?.length > 0 && (
                            <div className="metric-pics" style={{ marginTop: 6, color: '#64748b', fontSize: 12 }}>
                              <b>PICs:</b> {metric.picNames.join(', ')}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Top Risks from AI */}
          <div className="dashboard-grid" style={{ marginTop: '0.5rem' }}>
            <div className="dashboard-card" style={{ minHeight: 80 }}>
              <div className="card-header">
                <h3>Top Risks from AI</h3>
              </div>
              {(() => {
                const risks = projectMetrics
                  .map(m => ({ projectId: m.projectId, projectName: m.projectName, risk: (m.aiRisk || '').toString() }))
                  .filter(x => x.risk)
                  .slice(0, 8);
                if (risks.length === 0) {
                  return (
                    <div style={{ color: '#64748b', paddingLeft: 18 }}>No risks extracted from AI reports</div>
                  );
                }
                return (
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
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
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
          <div className="modal-content" style={{ background: '#fff', padding: 0, borderRadius: 16, minWidth: 380, maxWidth: '95vw', maxHeight: '95vh', overflowY: 'auto', position: 'relative', boxShadow: '0 2px 24px rgba(0,0,0,0.18)' }}>
            <button className="modal-close-btn" onClick={() => setShowAddAreaModal(false)} style={{ position: 'absolute', right: 12, top: 8, fontSize: 24, background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}>&times;</button>
            <CeoAddArea onSuccess={() => setShowAddAreaModal(false)} onCancel={() => setShowAddAreaModal(false)} />
          </div>
        </div>
      )}
    </div>
  );
};

export default CeoDash;
