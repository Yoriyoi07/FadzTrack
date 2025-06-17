import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../api/axiosInstance';
import NotificationBell from '../NotificationBell';
import CeoAddArea from './CeoAddArea'; 
import ProgressTracker from '../ProgressTracker';

const ITEMS_PER_PAGE = 5;

const Pagination = ({ currentPage, totalPages, totalEntries, onPageChange, showingRange }) => {
  const visiblePages = [];

  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) visiblePages.push(i);
  } else {
    visiblePages.push(1);
    if (currentPage > 3) visiblePages.push('...');
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    for (let i = start; i <= end; i++) visiblePages.push(i);
    if (currentPage < totalPages - 2) visiblePages.push('...');
    visiblePages.push(totalPages);
  }

  return (
    <div className="pagination-wrapper" style={{ flexDirection: 'column', alignItems: 'center' }}>
      <span className="pagination-info">
        Showing {showingRange.start} to {showingRange.end} of {totalEntries} entries.
      </span>
      <div className="pagination">
        <button className="pagination-btn" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1}>
          &lt;
        </button>
        {visiblePages.map((page, index) => (
          <button
            key={index}
            className={`pagination-btn ${page === currentPage ? 'active' : ''} ${page === '...' ? 'dots' : ''}`}
            disabled={page === '...'}
            onClick={() => typeof page === 'number' && onPageChange(page)}
          >
            {page}
          </button>
        ))}
        <button className="pagination-btn" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages}>
          &gt;
        </button>
      </div>
    </div>
  );
};

const CeoMaterialList = () => {
  const navigate = useNavigate();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  // Sidebars shared state:
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState('');
  const [showAddAreaModal, setShowAddAreaModal] = useState(false);
  const [locations, setLocations] = useState([]);
  const [allProjects, setAllProjects] = useState([]);
  const [enrichedAllProjects, setEnrichedAllProjects] = useState([]);
  const [expandedLocations, setExpandedLocations] = useState({});
  const [pendingRequestsSidebar, setPendingRequestsSidebar] = useState([]);
  const [chats, setChats] = useState([
    { id: 1, name: 'Rychea Miralles', initial: 'R', message: 'Hello Good Morning po! As...', color: '#4A6AA5' },
    { id: 2, name: 'Third Castellar', initial: 'T', message: 'Hello Good Morning po! As...', color: '#2E7D32' },
    { id: 3, name: 'Zenarose Miranda', initial: 'Z', message: 'Hello Good Morning po! As...', color: '#9C27B0' }
  ]);
  const [activities, setActivities] = useState([]);

  // Main list data:
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Sidebar: fetch user, locations, all projects, activities, pending requests, chats
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const stored = localStorage.getItem('user');
        const user = stored ? JSON.parse(stored) : null;
        if (user) {
          setUserName(user.name);
          setUserRole(user.role);
        }
      } catch (error) {}
    };

    const fetchLocations = async () => {
      try {
        const { data } = await api.get('/locations');
        setLocations(data);
      } catch {}
    };

    const fetchAllProjects = async () => {
      try {
        const { data } = await api.get('/projects');
        setAllProjects(data);
      } catch {}
    };

    const fetchPendingRequestsSidebar = async () => {
      try {
        const { data } = await api.get('/requests');
        const pending = data.filter(request => request.status === 'Pending CEO');
        setPendingRequestsSidebar(pending);
      } catch {}
    };

    const fetchLogs = async () => {
      try {
        const { data } = await api.get("/audit-logs");
        const sliced = data.slice(0, 3).map((log, i) => ({
          id: i,
          user: {
            name: log.performedBy?.name || "Unknown",
            initial: (log.performedBy?.name || "U")[0]
          },
          date: new Date(log.timestamp).toLocaleString(),
          activity: `${log.action} - ${log.description}`,
          details: log.meta ? Object.entries(log.meta).map(([key, val]) => `${key}: ${val}`) : []
        }));
        setActivities(sliced);
      } catch {}
    };

    fetchUserData();
    fetchLocations();
    fetchAllProjects();
    fetchPendingRequestsSidebar();
    fetchLogs();
  }, []);

  useEffect(() => {
    if (locations.length && allProjects.length > 0) {
      setEnrichedAllProjects(
        allProjects.map(project => {
          if (typeof project.location === 'object' && project.location !== null && project.location.name) {
            return {
              ...project,
              name: project.projectName,
              engineer: project.projectmanager?.name || 'Not Assigned',
            };
          }
          const loc = locations.find(l => l._id === (project.location?._id || project.location));
          return {
            ...project,
            location: loc ? { ...loc } : { name: 'Unknown Location', region: '' },
            name: project.projectName,
            engineer: project.projectmanager?.name || 'Not Assigned',
          };
        })
      );
    }
  }, [locations, allProjects]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest(".profile-menu-container")) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  // Main List fetch
  useEffect(() => {
    api.get('/requests/mine')
      .then(res => {
        setRequests(Array.isArray(res.data) ? res.data : []);
        setLoading(false);
        setError('');
      })
      .catch(err => {
        if (err.response && (err.response.status === 403 || err.response.status === 401)) {
          setError('Session expired or unauthorized. Please login.');
          setRequests([]);
        } else {
          setError('Failed to load requests');
        }
        setLoading(false);
      });
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  const toggleLocation = (locationId) => {
    setExpandedLocations(prev => ({
      ...prev,
      [locationId]: !prev[locationId]
    }));
  };

  const getIconForType = (request) => {
    if (!request.materials || request.materials.length === 0) return '📄';
    const name = request.materials[0].materialName?.toLowerCase() || '';
    if (name.includes('steel')) return '🔧';
    if (name.includes('brick')) return '🧱';
    if (name.includes('cement')) return '🪨';
    if (name.includes('sand')) return '🏖️';
    return '📦';
  };

  const filteredRequests = requests.filter(request => {
    const status = (request.status || '').toLowerCase();
    const matchesFilter =
      filter === 'All' ||
      (filter === 'Pending' && status.includes('pending')) ||
      (filter === 'Approved' && status.includes('approved')) ||
      (filter === 'Cancelled' && (status.includes('denied') || status.includes('cancel')));
    const searchTarget = [
      request.materials?.map(m => m.materialName).join(', '),
      request.description,
      request.createdBy?.name,
      request.project?.projectName,
    ].join(' ').toLowerCase();
    return matchesFilter && searchTarget.includes(searchTerm.toLowerCase());
  });

  const totalPages = Math.ceil(filteredRequests.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentRequests = filteredRequests.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  // Group all projects by location for sidebar
  const projectsByLocation = enrichedAllProjects.reduce((acc, project) => {
    const locationId = project.location?._id || 'unknown';
    if (!acc[locationId]) {
      acc[locationId] = {
        name: project.location?.name || 'Unknown Location',
        region: project.location?.region || '',
        projects: []
      };
    }
    acc[locationId].projects.push(project);
    return acc;
  }, {});

  return (
    <div className="head">
      <header className="header">
        <div className="logo-container">
          <img src={require('../../assets/images/FadzLogo1.png')} alt="FadzTrack Logo" className="logo-img" />
          <h1 className="brand-name">FadzTrack</h1>
        </div>
        <nav className="nav-menu">
          <Link to="/ceo/dash" className="nav-link">Dashboard</Link>
          <Link to="/ceo/chat" className="nav-link">Chat</Link>
          <Link to="/ceo/material-list" className="nav-link">Material</Link>
          <Link to="/ceo/proj" className="nav-link">Projects</Link>
          <Link to="/ceo/audit-logs" className="nav-link">Audit Logs</Link>
          <Link to="/reports" className="nav-link">Reports</Link>
        </nav>
        <div className="profile-menu-container" style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <NotificationBell />
          <div className="profile-circle" onClick={() => setProfileMenuOpen(!profileMenuOpen)}>
            {userName ? userName.charAt(0).toUpperCase() : 'Z'}
          </div>
          {profileMenuOpen && (
            <div className="profile-menu">
              <button onClick={handleLogout}>Logout</button>
            </div>
          )}
        </div>
      </header>

      <div className="dashboard-layout">
        {/* LEFT SIDEBAR */}
        <div className="sidebar">
          <h2>Dashboard</h2>
          <button className="add-project-btn" onClick={() => setShowAddAreaModal(true)}>
            Add New Area
          </button>
          <div className="location-folders">
            {Object.entries(projectsByLocation).map(([locationId, locationData]) => (
              <div key={locationId} className="location-folder">
                <div className="location-header" onClick={() => toggleLocation(locationId)}>
                  <div className="folder-icon">
                    <span className={`folder-arrow ${expandedLocations[locationId] ? 'expanded' : ''}`}>▶</span>
                    <span className="folder-icon-img">📁</span>
                  </div>
                  <div className="location-info">
                    <div className="location-name">{locationData.name}</div>
                    <div className="location-region">{locationData.region}</div>
                  </div>
                  <div className="project-count">{locationData.projects.length}</div>
                </div>
                {expandedLocations[locationId] && (
                  <div className="projects-list">
                    {locationData.projects.map(project => (
                      <Link to={`/ceo/proj/${project._id}`} key={project._id} className="project-item">
                        <div className="project-icon">
                          <span className="icon">🏗️</span>
                          <div className="icon-bg"></div>
                        </div>
                        <div className="project-info">
                          <div className="project-name">{project.name}</div>
                          <div className="project-engineer">{project.engineer}</div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* MAIN CONTENT */}
        <div className="main1">
          <main className="main-content">
            <div className="requests-container">
              <div className="requests-header">
                <h2 className="page-title">Requests</h2>
                <div className="filter-tabs">
                  {['All', 'Pending', 'Approved', 'Cancelled'].map(tab => (
                    <button
                      key={tab}
                      className={`filter-tab ${filter === tab ? 'active' : ''}`}
                      onClick={() => setFilter(tab)}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
                <input
                  className="search-input"
                  style={{ marginLeft: 8, padding: '6px 12px' }}
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="requests-list">
                {loading ? (
                  <div className="loading-msg">Loading requests...</div>
                ) : error ? (
                  <div className="error-msg">{error}</div>
                ) : currentRequests.length === 0 ? (
                  <div className="no-requests">
                    <p>No requests found matching your criteria.</p>
                  </div>
                ) : (
                  currentRequests.map(request => (
                    <Link to={`/ceo/material-request/${request._id}`} className="request-item" key={request._id}>
                      <div className="request-icon">{getIconForType(request)}</div>
                      <div className="request-details">
                        <h3 className="request-title">
                          {request.materials?.length > 0
                            ? request.materials.map(m => `${m.materialName} (${m.quantity})`).join(', ')
                            : 'Material Request'}
                        </h3>
                        <p className="request-description">{request.description}</p>
                      </div>
                                         <div className="request-actions">
                        <ProgressTracker request={request} />
                      </div>
                      <div className="request-meta">
                        <div className="request-author">{request.createdBy?.name || 'Unknown'}</div>
                        <div className="request-project">{request.project?.projectName || '-'}</div>
                        <div className="request-date">
                          <div>Requested: {request.createdAt ? new Date(request.createdAt).toLocaleString() : ''}</div>
                          {request.approvals?.find(a => a.role === 'PM' && a.decision === 'approved') && (
                            <div>
                              PM Approved: {new Date(request.approvals.find(a => a.role === 'PM' && a.decision === 'approved').timestamp).toLocaleString()}
                            </div>
                          )}
                          {request.approvals?.find(a => a.role === 'AM' && a.decision === 'approved') && (
                            <div>
                              AM Approved: {new Date(request.approvals.find(a => a.role === 'AM' && a.decision === 'approved').timestamp).toLocaleString()}
                            </div>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))
                )}
              </div>

              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalEntries={filteredRequests.length}
                showingRange={{
                  start: startIndex + 1,
                  end: Math.min(startIndex + ITEMS_PER_PAGE, filteredRequests.length)
                }}
                onPageChange={setCurrentPage}
              />
            </div>
          </main>
        </div>

        {/* RIGHT SIDEBAR */}
        <div className="right-sidebar">
          <div className="pending-requests-section">
            <div className="section-header">
              <h2>Pending Material Requests</h2>
              <Link to="/ceo/material-list" className="view-all-btn">View All</Link>
            </div>
            <div className="pending-requests-list">
              {pendingRequestsSidebar.length === 0 ? (
                <div className="no-requests">No pending material requests</div>
              ) : (
                pendingRequestsSidebar.slice(0, 3).map(request => (
                  <Link to={`/ceo/material-request/${request._id}`} key={request._id} className="pending-request-item">
                    <div className="request-icon">📦</div>
                    <div className="request-details">
                      <h3 className="request-title">
                        {request.materials?.map(m => `${m.materialName} (${m.quantity})`).join(', ')}
                      </h3>
                      <p className="request-description">{request.description}</p>
                      <div className="request-meta">
                        <span className="request-project">{request.project?.projectName}</span>
                        <span className="request-date">
                          Requested: {new Date(request.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="request-status">
                      <span className="status-badge pending">Pending CEO Approval</span>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>

          <div className="chats-section">
            <h3>Chats</h3>
            <div className="chats-list">
              {chats.map(chat => (
                <div key={chat.id} className="chat-item">
                  <div className="chat-avatar" style={{ backgroundColor: chat.color }}>{chat.initial}</div>
                  <div className="chat-details">
                    <div className="chat-name">{chat.name}</div>
                    <div className="chat-message">{chat.message}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* MODAL - Add New Area */}
      {showAddAreaModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <button
              className="modal-close-btn"
              onClick={() => setShowAddAreaModal(false)}
              style={{
                position: "absolute", top: 12, right: 16, background: "none",
                border: "none", fontSize: 24, cursor: "pointer"
              }}
            >
              &times;
            </button>
            <CeoAddArea
              onSuccess={() => {
                setShowAddAreaModal(false);
                // Optionally, reload project/area data here if needed!
              }}
              onCancel={() => setShowAddAreaModal(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default CeoMaterialList;
