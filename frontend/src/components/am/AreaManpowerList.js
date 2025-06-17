import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../api/axiosInstance';
import '../style/am_style/Area_Manpower_List.css'; 
import NotificationBell from '../NotificationBell';

const ITEMS_PER_PAGE = 5;

const AreaManpowerList = () => {
  const navigate = useNavigate();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('All');
  const [searchTerm, ] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [userName, setUserName] = useState(user?.name || 'ALECK');

  // Sidebar state
  const [assignedLocations, setAssignedLocations] = useState([]);
  const [allProjects, setAllProjects] = useState([]);
  const [enrichedAllProjects, setEnrichedAllProjects] = useState([]);
  const [expandedLocations, setExpandedLocations] = useState({});
  const [pendingRequests, setPendingRequests] = useState([]);
  const [chats] = useState([
    { id: 1, name: 'Rychea Miralles', initial: 'R', message: 'Hello Good Morning po! As...', color: '#4A6AA5' },
    { id: 2, name: 'Third Castellar', initial: 'T', message: 'Hello Good Morning po! As...', color: '#2E7D32' },
    { id: 3, name: 'Zenarose Miranda', initial: 'Z', message: 'Hello Good Morning po! As...', color: '#9C27B0' }
  ]);


  // Fetch manpower requests (for this page)
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Session expired. Please log in.');
      setLoading(false);
      return;
    }

    api.get('/manpower-requests')
      .then(res => {
        setRequests(Array.isArray(res.data) ? res.data : []);
        setLoading(false);
        setError('');
      })
      .catch(err => {
        if (err.response && (err.response.status === 403 || err.response.status === 401)) {
          setError('Session expired or unauthorized. Please login.');
        } else {
          setError('Failed to load requests');
        }
        setRequests([]);
        setLoading(false);
      });
  }, []);

  // Sidebar location/projects fetch
  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: locData } = await api.get(`/users/${user._id}/locations`);
        setAssignedLocations(locData);
        const { data: projData } = await api.get('/projects');
        setAllProjects(projData);
        const { data: requestsData } = await api.get('/manpower-requests');
        setPendingRequests(
          requestsData.filter(
            req =>
              req.status === 'Pending AM' &&
              req.project &&
              locData.some(
                loc =>
                  loc._id === (req.project.location?._id || req.project.location)
              )
          )
        );
      } catch (err) {
        setAssignedLocations([]);
        setAllProjects([]);
        setPendingRequests([]);
      }
    };
    if (user._id) fetchData();
  }, [user._id]);

  // Enrich projects for sidebar
  useEffect(() => {
    if (assignedLocations.length && allProjects.length) {
      setEnrichedAllProjects(
        allProjects
          .filter(project =>
            assignedLocations.some(
              loc => loc._id === (project.location?._id || project.location)
            )
          )
          .map(project => {
            const loc = assignedLocations.find(
              l => l._id === (project.location?._id || project.location)
            );
            return {
              ...project,
              location: loc ? { ...loc } : { name: 'Unknown Location', region: '' },
              name: project.projectName,
              engineer: project.projectmanager?.name || 'Not Assigned'
            };
          })
      );
    }
  }, [assignedLocations, allProjects]);

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

  // Sidebar grouping logic
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

  // Filtering/search/pagination
  const filteredRequests = requests.filter(request => {
    const status = (request.status || '').toLowerCase();
    const matchesFilter =
      filter === 'All' ||
      (filter === 'Pending' && status.includes('pending')) ||
      (filter === 'Approved' && status.includes('approved')) ||
      (filter === 'Cancelled' && (status.includes('denied') || status.includes('cancel')));

    const searchTarget = [
      request.manpowers && request.manpowers.map(m => m.type).join(', '),
      request.description,
      request.createdBy?.name,
      request.project?.projectName,
    ].join(' ').toLowerCase();

    const matchesSearch = searchTerm ? searchTarget.includes(searchTerm.toLowerCase()) : true;
    return matchesFilter && matchesSearch;
  });

  const totalPages = Math.ceil(filteredRequests.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedRequests = filteredRequests.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  return (
    <div>
      {/* Header */}
      <header className="header">
        <div className="logo-container">
          <img src={require('../../assets/images/FadzLogo1.png')} alt="FadzTrack Logo" className="logo-img" />
          <h1 className="brand-name">FadzTrack</h1>
        </div>
        <nav className="nav-menu">
          <Link to="/am" className="nav-link">Dashboard</Link>
          <Link to="/am/chat" className="nav-link">Chat</Link>
          <Link to="/am/matreq" className="nav-link">Material</Link>
          <Link to="/am/manpower-requests" className="nav-link">Manpower</Link>
          <Link to="/am/viewproj" className="nav-link">Projects</Link>
          <Link to="/logs" className="nav-link">Logs</Link>
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

      {/* Three-column layout */}
      <div className="area-dash dashboard-layout">
        {/* Left Sidebar */}
        <div className="area-dash sidebar">
          <h2>Dashboard</h2>
          <button
            className="area-dash add-project-btn"
            onClick={() => navigate('/am/addproj')}
          >
            Add New Project
          </button>
          <div className="area-dash location-folders">
            {Object.entries(projectsByLocation).map(([locationId, locationData]) => (
              <div key={locationId} className="area-dash location-folder">
                <div
                  className="area-dash location-header"
                  onClick={() =>
                    setExpandedLocations(prev => ({
                      ...prev,
                      [locationId]: !prev[locationId]
                    }))
                  }
                >
                  <div className="area-dash folder-icon">
                    <span className={`area-dash folder-arrow ${expandedLocations[locationId] ? 'expanded' : ''}`}>▶</span>
                    <span className="area-dash folder-icon-img">📁</span>
                  </div>
                  <div className="area-dash location-info">
                    <div className="area-dash location-name">{locationData.name}</div>
                    <div className="area-dash location-region">{locationData.region}</div>
                  </div>
                  <div className="area-dash project-count">{locationData.projects.length}</div>
                </div>
                {expandedLocations[locationId] && (
                  <div className="area-dash projects-list">
                    {locationData.projects.map(proj => (
                      <Link
                        to={`/am/projects/${proj._id}`}
                        key={proj._id}
                        className="area-dash project-item"
                      >
                        <div className="area-dash project-icon">
                          <span className="area-dash icon">🏗️</span>
                          <div className="area-dash icon-bg" />
                        </div>
                        <div className="area-dash project-info">
                          <div className="area-dash project-name">{proj.name}</div>
                          <div className="area-dash project-engineer">{proj.engineer}</div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Main */}
        <main className="main-content" style={{ flex: 1, minHeight: "100vh" }}>
          <div className="requests-container">
            <div className="requests-header">
              <h2 className="page-title">Manpower Requests</h2>
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
            </div>

            {/* Request List */}
            <div className="requests-list">
              {loading ? (
                <div>Loading requests...</div>
              ) : error ? (
                <div style={{ color: 'red', marginBottom: 20 }}>{error}</div>
              ) : paginatedRequests.length === 0 ? (
                <div className="no-requests">
                  <p>No manpower requests found matching your criteria.</p>
                </div>
              ) : (
                paginatedRequests.map(request => (
                  <Link
                    to={`/am/manpower-requests/${request._id}`}
                    className="request-item"
                    key={request._id}
                    style={{ textDecoration: 'none', color: 'inherit' }}
                  >
                    <div className="request-icon">👷</div>
                    <div className="request-details">
                      <h3 className="request-title">
                        {request.manpowers && request.manpowers.length > 0
                          ? request.manpowers.map(m => `${m.quantity} ${m.type}`).join(', ')
                          : 'Manpower Request'}
                      </h3>
                      <p className="request-description">{request.description}</p>
                    </div>
                    <div className="request-meta">
                      <div className="request-author">{request.createdBy?.name || 'Unknown'}</div>
                      <div className="request-project">{request.project?.projectName || '-'}</div>
                      <div className="request-date">
                        {request.acquisitionDate ? new Date(request.acquisitionDate).toLocaleDateString() : ''}
                      </div>
                    </div>
                    <div className="request-actions">
                      <span className={`status-badge ${(request.status || '').replace(/\s/g, '').toLowerCase()}`}>
                        {request.status}
                      </span>
                    </div>
                  </Link>
                ))
              )}
            </div>

            {/* Pagination Controls */}
            <div className="pagination">
              <span className="pagination-info">
                Showing {startIndex + 1} to {Math.min(startIndex + ITEMS_PER_PAGE, filteredRequests.length)} of {filteredRequests.length} entries.
              </span>
              <div className="pagination-controls">
                <button className="pagination-btn" onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1}>{'<'}</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(num => (
                  <button
                    key={num}
                    className={`pagination-btn ${num === currentPage ? 'active' : ''}`}
                    onClick={() => setCurrentPage(num)}
                  >
                    {num}
                  </button>
                ))}
                <button className="pagination-btn" onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages}>{'>'}</button>
              </div>
            </div>
          </div>
        </main>

        {/* Right Sidebar */}
        <div className="area-dash right-sidebar">
          <div className="area-dash pending-requests-section">
            <div className="area-dash section-header">
              <h2>Pending Manpower Requests</h2>
              <Link to="/am/manpower-requests" className="area-dash view-all-btn">View All</Link>
            </div>
            <div className="area-dash pending-requests-list">
              {pendingRequests.length === 0 ? (
                <div className="area-dash no-requests">No pending manpower requests</div>
              ) : (
                pendingRequests.slice(0, 3).map(request => (
                  <Link to={`/am/manpower-requests/${request._id}`} key={request._id} className="area-dash pending-request-item">
                    <div className="area-dash request-icon">👷</div>
                    <div className="area-dash request-details">
                      <h3 className="area-dash request-title">
                        {request.manpowers?.map(m => `${m.quantity} ${m.type}`).join(', ')}
                      </h3>
                      <p className="area-dash request-description">{request.description}</p>
                      <div className="area-dash request-meta">
                        <span className="area-dash request-project">{request.project?.projectName}</span>
                        <span className="area-dash request-date">
                          Requested: {new Date(request.acquisitionDate).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="area-dash request-status">
                      <span className="area-dash status-badge pending">Pending AM Approval</span>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>

          <div className="area-dash chats-section">
            <h3>Chats</h3>
            <div className="area-dash chats-list">
              {chats.map(chat => (
                <div key={chat.id} className="area-dash chat-item">
                  <div className="area-dash chat-avatar" style={{ backgroundColor: chat.color }}>{chat.initial}</div>
                  <div className="area-dash chat-details">
                    <div className="area-dash chat-name">{chat.name}</div>
                    <div className="area-dash chat-message">{chat.message}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AreaManpowerList;
