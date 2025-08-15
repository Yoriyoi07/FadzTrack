import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import api from '../../api/axiosInstance';
import ApproveDenyActions from '../ApproveDenyActions';
import NotificationBell from '../NotificationBell';
import CeoAddArea from './CeoAddArea';
import '../style/pm_style/Pm_MatRequest.css';

// Nav icons
import { FaTachometerAlt, FaComments, FaBoxes, FaProjectDiagram, FaClipboardList, FaChartBar } from 'react-icons/fa';


const CeoMaterialReq = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [requestData, setRequestData] = useState(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // --- Sidebar state
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

  const user = JSON.parse(localStorage.getItem('user'));
  const userId = user?._id;
  const userRoleLocal = user?.role;

  // ---- Fetch request
  useEffect(() => {
    api.get(`/requests/${id}`)
      .then(res => {
        setRequestData(res.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  // --- Sidebar fetch logic ---
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

  const toggleLocation = (locationId) => {
    setExpandedLocations(prev => ({
      ...prev,
      [locationId]: !prev[locationId]
    }));
  };

  // --- Attachments helpers ---
  const getAttachmentUrl = (file) =>
    file.startsWith('http') ? file : `http://localhost:5000/uploads/${file}`;

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest(".profile-menu-container")) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading request details...</p>
      </div>
    );
  }
  if (!requestData) {
    return (
      <div className="error-container">
        <p>Request not found</p>
        <button onClick={() => navigate(-1)} className="back-button">Go Back</button>
      </div>
    );
  }

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
    <img
      src={require('../../assets/images/FadzLogo1.png')}
      alt="FadzTrack Logo"
      className="logo-img"
    />
    <h1 className="brand-name">FadzTrack</h1>
  </div>

  <nav className="nav-menu">
    <Link to="/ceo/dash" className="nav-link"><FaTachometerAlt /> Dashboard</Link>
    <Link to="/ceo/chat" className="nav-link"><FaComments /> Chat</Link>
    <Link to="/ceo/material-list" className="nav-link"><FaBoxes /> Material</Link>
    <Link to="/ceo/proj" className="nav-link"><FaProjectDiagram /> Projects</Link>
    <Link to="/ceo/audit-logs" className="nav-link"><FaClipboardList /> Audit Logs</Link>
    <Link to="/reports" className="nav-link"><FaChartBar /> Reports</Link>
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
          <main className="main-content-picmatreq">
            <div className="request-materials-container-picmatreq">
              <h1 className="page-title-picmatreq">
                Material Request #{requestData.requestNumber}
              </h1>
              <div className="project-details-box" style={{ marginBottom: '20px' }}>
                <h2 style={{ margin: 0 }}>{requestData.project?.projectName || '-'}</h2>
                <p style={{ margin: 0, fontStyle: 'italic' }}>{requestData.project?.location || '-'}</p>
                <p style={{ margin: 0, color: '#555' }}>{requestData.project?.targetDate || ''}</p>
              </div>

              {/* Materials */}
              <div className="materials-section">
                <h2 className="section-title">Material to be Requested</h2>
                <div className="materials-list">
                  {requestData.materials.map((mat, idx) => (
                    <div key={idx} className="material-item">
                      <span className="material-name">
                        <strong>Material:</strong> {mat.materialName}
                      </span>
                      <span className="material-quantity">
                        <strong>Quantity:</strong> {mat.quantity}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              {/* Attachments */}
              <div className="attachments-section">
                <h2 className="section-title">Attachment Proof</h2>
                <div className="attachments-grid">
                  {requestData.attachments?.length
                    ? requestData.attachments.map((file, idx) => (
                      <div key={idx} className="attachment-item">
                        <img src={getAttachmentUrl(file)} alt={`Attachment ${idx + 1}`} className="attachment-image" />
                      </div>
                    ))
                    : <div>No attachments</div>
                  }
                </div>
              </div>
              {/* Description */}
              <div className="description-section">
                <h2 className="section-title">Request Description</h2>
                <div className="description-content">
                  <p>{requestData.description}</p>
                </div>
              </div>

              {/* Action Buttons and CEO approval fields (Handled inside ApproveDenyActions) */}
              <ApproveDenyActions
                requestData={requestData}
                userId={userId}
                userRole={userRoleLocal}
                onBack={() => navigate(-1)}
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
              }}
              onCancel={() => setShowAddAreaModal(false)}
            />
          </div>
        </div>
      )}
      {/* Simple Modal Styling for ApproveDenyActions */}
      <style>{`
        .modal-overlay {
          position: fixed;
          z-index: 20;
          top: 0; left: 0; right: 0; bottom: 0;
          display: flex;
          align-items: center; justify-content: center;
        }
        .modal-content {
          background: #fff;
          border-radius: 10px;
          box-shadow: 0 4px 24px rgba(0,0,0,0.14);
          padding: 2rem;
          min-width: 320px;
          z-index: 22;
        }
        .modal-backdrop {
          position: fixed;
          z-index: 21;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.15);
        }
      `}</style>
    </div>
  );
};

export default CeoMaterialReq;
