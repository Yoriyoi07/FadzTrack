import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { useNavigate, Link } from 'react-router-dom';
import '../style/am_style/Area_Dash.css';
import api from '../../api/axiosInstance';
import NotificationBell from '../NotificationBell';

// React Icons
import {
  FaTachometerAlt,
  FaComments,
  FaBoxes,
  FaUsers,
  FaProjectDiagram,
  FaClipboardList,
  FaChartBar,
  FaCalendarAlt,
  FaTasks,
  FaCheckCircle,
  FaClock,
  FaExclamationTriangle,
  FaArrowRight,
  FaChevronDown,
  FaChevronUp,
  FaFolder,
  FaFolderOpen,
  FaBuilding,
  FaMapMarkerAlt,
  FaUserTie,
  FaChartLine,
  FaBell,
  FaSearch,
  FaChevronRight,
  FaChevronLeft
} from 'react-icons/fa';

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
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
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
        const { data: projectsData } = await api.get('/projects', {
          signal: controller.signal,
        });
        if (!isActive) return;
        setAllProjects(projectsData);

        const userProjects = projectsData.filter((project) =>
          locations.some(
            (loc) => loc._id === (project.location?._id || project.location)
          )
        );

        const projectsWithProgress = await Promise.all(
          userProjects.map(async (project) => {
            try {
              const [{ data: progressData }, { data: reports }] = await Promise.all([
                api.get(`/daily-reports/project/${project._id}/progress`, {
                  signal: controller.signal,
                }),
                api.get(`/daily-reports/project/${project._id}`, {
                  signal: controller.signal,
                }),
              ]);

              let latestDate = null;
              if (Array.isArray(reports) && reports.length > 0) {
                latestDate = reports[reports.length - 1].date || null;
              }

              return {
                id: project._id,
                name: project.projectName,
                engineer: project.projectmanager?.name || 'Not Assigned',
                progress: progressData.progress,
                latestDate,
                location: project.location,
              };
            } catch {
              return null;
            }
          })
        );

        if (!isActive) return;

        const filtered = projectsWithProgress.filter(
          (p) =>
            p &&
            p.progress &&
            Array.isArray(p.progress) &&
            p.progress[0].name !== 'No Data' &&
            p.latestDate
        );
        filtered.sort(
          (a, b) => new Date(b.latestDate) - new Date(a.latestDate)
        );
        setProjects(filtered);
      } catch (error) {
        console.error('Error fetching projects:', error);
      } finally {
        if (isActive) setLoading(false);
      }
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

  // Scroll handler for header collapse
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const shouldCollapse = scrollTop > 50;
      setIsHeaderCollapsed(shouldCollapse);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.profile-menu-container')) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

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

  // Project metrics data
  const [projectMetrics, setProjectMetrics] = useState([]);
  const [metricsLoading, setMetricsLoading] = useState(true);

  // Fetch project metrics from reports
  useEffect(() => {
    const fetchProjectMetrics = async () => {
      if (!enrichedAllProjects.length) return;
      
      setMetricsLoading(true);
      const metrics = [];

      for (const project of enrichedAllProjects) {
        try {
          // Get all reports for this project
          const { data: reports } = await api.get(`/daily-reports/project/${project._id}`);
          
          if (reports && reports.length > 0) {
            // Get the latest report from each PIC
            const latestReports = [];
            const picReports = {};
            
            reports.forEach(report => {
              const picId = report.pic?._id || report.pic;
              if (!picReports[picId] || new Date(report.date) > new Date(picReports[picId].date)) {
                picReports[picId] = report;
              }
            });

            // Calculate average progress from latest reports
            const progressValues = Object.values(picReports).map(report => {
              if (report.progress && Array.isArray(report.progress)) {
                const completed = report.progress.find(p => p.name === 'Completed');
                return completed ? completed.value : 0;
              }
              return 0;
            });

            const averageProgress = progressValues.length > 0 
              ? Math.round(progressValues.reduce((sum, val) => sum + val, 0) / progressValues.length)
              : 0;

            metrics.push({
              projectId: project._id,
              projectName: project.name,
              pm: project.engineer,
              area: project.location?.name || 'Unknown Area',
              progress: averageProgress,
              totalPics: Object.keys(picReports).length,
              latestDate: Object.values(picReports).reduce((latest, report) => 
                new Date(report.date) > new Date(latest) ? report.date : latest, 
                Object.values(picReports)[0]?.date || new Date()
              )
            });
          }
        } catch (error) {
          console.error(`Error fetching metrics for project ${project.name}:`, error);
        }
      }

      setProjectMetrics(metrics);
      setMetricsLoading(false);
    };

    fetchProjectMetrics();
  }, [enrichedAllProjects]);

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
                   statusLower.includes('pending cio') || statusLower.includes('received')) {
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
        } else if (statusLower.includes('pending cio') || statusLower.includes('received')) {
          return 'completed'; // Blue - two or more steps behind pending
        }
        break;
        
      case 'am':
        if (statusLower.includes('rejected am') || statusLower.includes('am rejected')) {
          return 'rejected';
        } else if (statusLower.includes('pending am') || statusLower.includes('area manager')) {
          return 'pending'; // Yellow/Orange - pending
        } else if (statusLower.includes('pending cio')) {
          return 'completed one-step-behind'; // Green - one step behind pending
        } else if (statusLower.includes('received')) {
          return 'completed'; // Blue - two or more steps behind pending
        }
        break;
        
      case 'cio':
        if (statusLower.includes('rejected cio') || statusLower.includes('cio rejected')) {
          return 'rejected';
        } else if (statusLower.includes('pending cio')) {
          return 'pending'; // Yellow/Orange - pending
        } else if (statusLower.includes('received')) {
          return 'completed one-step-behind'; // Green - one step behind pending
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
    <div className="dashboard-container">
      {/* Modern Header - PM Style */}
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

          <div className="user-profile profile-menu-container" onClick={() => setProfileMenuOpen(!profileMenuOpen)}>
            <div className="profile-avatar">
              {userName ? userName.charAt(0).toUpperCase() : 'A'}
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
            <Link to="/am" className="nav-item active">
              <FaTachometerAlt />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Dashboard</span>
            </Link>
            <Link to="/am/chat" className="nav-item">
              <FaComments />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Chat</span>
            </Link>
            <Link to="/am/matreq" className="nav-item">
              <FaBoxes />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Material</span>
            </Link>
            <Link to="/am/manpower-requests" className="nav-item">
              <FaUsers />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Manpower</span>
            </Link>
            <Link to="/am/viewproj" className="nav-item">
              <FaProjectDiagram />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Projects</span>
            </Link>
            <Link to="/logs" className="nav-item">
              <FaClipboardList />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Logs</span>
            </Link>
            <Link to="/reports" className="nav-item">
              <FaChartBar />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Reports</span>
            </Link>
          </nav>

          <NotificationBell />
  </div>
</header>

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
            <div className="dashboard-card welcome-card">
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
                              {new Date(metric.latestDate).toLocaleDateString()}
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
                              
                              <div className={`timeline-connector-compact ${['Pending PM', 'Pending AM', 'Pending CIO', 'Received', 'PENDING PROJECT MANAGER'].includes(request.status) ? 'completed' : ''}`}></div>
                              
                              {/* PM Stage */}
                              <div className={`timeline-step-compact ${getTimelineStatus(request.status, 'pm')}`}>
                                <div className="timeline-icon-compact">
                                  <FaUserTie />
                                </div>
                                <span className="timeline-label-compact">PM</span>
                              </div>

                              <div className={`timeline-connector-compact ${['Pending AM', 'Pending CIO', 'Received', 'PENDING AREA MANAGER'].includes(request.status) ? 'completed' : ''}`}></div>
                              
                              {/* AM Stage */}
                              <div className={`timeline-step-compact ${getTimelineStatus(request.status, 'am')}`}>
                                <div className="timeline-icon-compact">
                                  <FaBuilding />
                                </div>
                                <span className="timeline-label-compact">AM</span>
                              </div>
                              
                              <div className={`timeline-connector-compact ${['Pending CIO', 'Received'].includes(request.status) ? 'completed' : ''}`}></div>
                              
                              {/* CIO Stage */}
                              <div className={`timeline-step-compact ${getTimelineStatus(request.status, 'cio')}`}>
                                <div className="timeline-icon-compact">
                                  <FaUserTie />
                                </div>
                                <span className="timeline-label-compact">CIO</span>
                              </div>

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
