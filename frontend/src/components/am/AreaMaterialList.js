import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import '../style/am_style/Area_Manpower_List.css';
import '../style/pm_style/PmMatRequest.css';
import '../style/pm_style/Pm_Dash.css';
import api from '../../api/axiosInstance';
import NotificationBell from '../NotificationBell'; 

// React Icons
import { FaTachometerAlt, FaComments, FaBoxes, FaUsers, FaProjectDiagram, FaClipboardList, FaChartBar } from 'react-icons/fa';

const ITEMS_PER_PAGE = 5;

const AreaMaterialList = () => {
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
    const [userRole, setUserRole] = useState(user?.role || 'Area Manager');
    const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);

  // --- Sidebar state
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

  // --- Main requests (for this page)
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Session expired. Please log in.');
      setLoading(false);
      return;
    }

    api.get('/requests/mine')
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

  // --- Sidebar location/projects fetch (reuse from AreaDash)
  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. Assigned Locations
        const { data: locData } = await api.get(`/users/${user._id}/locations`);
        setAssignedLocations(locData);
        // 2. All Projects
        const { data: projData } = await api.get('/projects');
        setAllProjects(projData);
        // 3. Pending Requests
        const { data: requestsData } = await api.get('/requests');
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

  // --- Enrich projects for sidebar
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
      if (!event.target.closest(".user-profile")) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const shouldCollapse = scrollTop > 50;
      setIsHeaderCollapsed(shouldCollapse);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  // --- Sidebar grouping logic
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

  // --- Helpers
  const truncateWords = (text = '', maxWords = 10) => {
    if (!text || typeof text !== 'string') return '';
    const words = text.trim().split(/\s+/);
    if (words.length <= maxWords) return text;
    return words.slice(0, maxWords).join(' ') + '...';
  };
  
  const getStatusColor = (status, receivedByPIC) => {
    const s = (status || '').toLowerCase();
    if (receivedByPIC) return '#0ea5e9'; // Completed
    if (s.includes('approved')) return '#10b981';
    if (s.includes('pending')) return '#f59e0b';
    if (s.includes('denied') || s.includes('cancel')) return '#ef4444';
    return '#6b7280';
  };
  
  const getStatusBadge = (status, receivedByPIC) => {
    if (receivedByPIC) return 'Completed';
    const s = (status || '').toLowerCase();
    if (s.includes('approved')) return 'Approved';
    if (s.includes('pending')) return 'Pending';
    if (s.includes('denied') || s.includes('cancel')) return 'Rejected';
    return 'Unknown';
  };

  const needsAmAttention = (request) => {
    const s = (request?.status || '').toLowerCase();
    return s.includes('pending am') || s.includes('pending area manager');
  };

  // --- Filtering/search/pagination
  const filteredRequests = requests.filter(request => {
    const status = (request.status || '').toLowerCase();
    const isCompleted = !!request.receivedByPIC;
    const matchesFilter =
      filter === 'All' ||
      (filter === 'Pending' && status.includes('pending')) ||
      (filter === 'Approved' && status.includes('approved')) ||
      (filter === 'Cancelled' && (status.includes('denied') || status.includes('cancel'))) ||
      (filter === 'Completed' && isCompleted);
    const searchTarget = [
      request.materials && request.materials.map(m => m.materialName).join(', '),
      request.description,
      request.createdBy?.name,
      request.project?.projectName,
    ].join(' ').toLowerCase();
    const matchesSearch = searchTarget.includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  // Sort: push Completed to end when viewing All; otherwise newest first
  const sortedRequests = [...filteredRequests].sort((a, b) => {
    if (filter === 'All') {
      const aCompleted = a.receivedByPIC ? 1 : 0;
      const bCompleted = b.receivedByPIC ? 1 : 0;
      if (aCompleted !== bCompleted) return aCompleted - bCompleted;
    }
    const ad = new Date(a.createdAt || 0).getTime();
    const bd = new Date(b.createdAt || 0).getTime();
    return bd - ad;
  });
  
  const totalPages = Math.ceil(sortedRequests.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedRequests = sortedRequests.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  return (
    <div>
      {/* IT/PM-style collapsible header */}
      <header className={`dashboard-header ${isHeaderCollapsed ? 'collapsed' : ''}`}>
        <div className="header-top">
          <div className="logo-section">
            <img src={require('../../assets/images/FadzLogo1.png')} alt="FadzTrack Logo" className="header-logo" />
            <h1 className="header-brand">FadzTrack</h1>
          </div>
          <div className="user-profile" onClick={() => setProfileMenuOpen(!profileMenuOpen)}>
            <div className="profile-avatar">{userName ? userName.charAt(0).toUpperCase() : 'A'}</div>
            <div className={`profile-info ${isHeaderCollapsed ? 'hidden' : ''}`}>
              <span className="profile-name">{userName}</span>
              <span className="profile-role">{userRole}</span>
            </div>
            {profileMenuOpen && (
              <div className="profile-dropdown" onClick={(e) => e.stopPropagation()}>
                <button onClick={(e) => { e.stopPropagation(); handleLogout(); }} className="logout-btn"><span>Logout</span></button>
              </div>
            )}
          </div>
        </div>
        <div className="header-bottom">
          <nav className="header-nav">
            <Link to="/am" className="nav-item">
              <FaTachometerAlt />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Dashboard</span>
            </Link>
            <Link to="/am/chat" className="nav-item">
              <FaComments />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Chat</span>
            </Link>
            <Link to="/am/matreq" className="nav-item active">
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

      {/* Three-column layout */}
      <div className="area-dash dashboard-layout">
        {/* Main */}
        <main className="dashboard-main">
          <div className="page-container">
            <div className="controls-bar">
              <div className="filter-tabs">
                {['All', 'Pending', 'Approved', 'Cancelled', 'Completed'].map(tab => (
                  <button
                    key={tab}
                    className={`filter-tab ${filter === tab ? 'active' : ''}`}
                    onClick={() => setFilter(tab)}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              <div className="search-sort-section">
                <div className="search-wrapper">
                  <input
                    type="text"
                    placeholder="Search requests..."
                    value={searchTerm}
                    onChange={() => {}}
                    className="search-input"
                  />
                </div>
              </div>
            </div>

            <div className="requests-grid">
              {loading ? (
                <div className="loading-state"><div className="loading-spinner"></div><p>Loading material requests...</p></div>
              ) : error ? (
                <div className="error-state"><p>{error}</p></div>
              ) : paginatedRequests.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📦</div>
                  <h3>No material requests found</h3>
                  <p>No requests match your current filters. Try adjusting your search criteria.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {paginatedRequests.map(request => (
                    <div key={request._id} style={{ 
                      background: '#f8fafc', 
                      border: '1px solid #e2e8f0', 
                      borderRadius: '6px', 
                      padding: '12px',
                      fontSize: '13px',
                      position: 'relative'
                    }}>
                      {/* Attention Pill */}
                      {needsAmAttention(request) && (
                        <span style={{
                          position: 'absolute',
                          top: '8px',
                          left: '8px',
                          background: '#f59e0b',
                          color: 'white',
                          padding: '2px 8px',
                          borderRadius: '10px',
                          fontSize: '10px',
                          fontWeight: '600',
                          zIndex: 1
                        }}>
                          Needs Action
                        </span>
                      )}
                      
                      {/* Request Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div style={{ flex: 1 }}>
                          <h3 style={{ 
                            margin: '0 0 4px 0', 
                            fontSize: '15px', 
                            fontWeight: '600', 
                            color: '#1f2937' 
                          }}>
                            {request.materials?.length
                              ? request.materials.map(m => `${m.materialName} (${m.quantity} ${m.unit || ''})`).join(', ')
                              : 'Material Request'}
                          </h3>
                          <p style={{ 
                            margin: '0 0 6px 0', 
                            color: '#6b7280', 
                            fontSize: '13px',
                            lineHeight: '1.3'
                          }}>
                            {request.description || 'No description provided'}
                          </p>
                        </div>
                        <span style={{ 
                          background: getStatusColor(request.status, request.receivedByPIC),
                          color: '#ffffff',
                          padding: '3px 10px',
                          borderRadius: '10px',
                          fontSize: '11px',
                          fontWeight: '600',
                          marginLeft: '10px'
                        }}>
                          {getStatusBadge(request.status, request.receivedByPIC)}
                        </span>
                      </div>
                      
                      {/* Tracking Progress */}
                      <div style={{ marginBottom: '8px' }}>
                        <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px', fontWeight: '500' }}>
                          Tracking Progress:
                        </div>
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '0px',
                          background: '#ffffff',
                          padding: '8px',
                          borderRadius: '6px',
                          border: '1px solid #e2e8f0'
                        }}>
                          {/* Placed Stage */}
                          <div style={{ 
                            display: 'flex', 
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '3px',
                            minWidth: '75px'
                          }}>
                            <div style={{ 
                              width: '28px',
                              height: '28px',
                              borderRadius: '50%',
                              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'white',
                              fontSize: '12px',
                              fontWeight: 'bold'
                            }}>
                              ✓
                            </div>
                            <span style={{ 
                              fontSize: '10px', 
                              fontWeight: '600',
                              color: '#1f2937',
                              textAlign: 'center'
                            }}>
                              Placed
                            </span>
                            <span style={{ 
                              fontSize: '9px', 
                              color: '#10b981',
                              fontWeight: '500'
                            }}>
                              Done
                            </span>
                            <span style={{ 
                              fontSize: '8px', 
                              color: '#6b7280'
                            }}>
                              {new Date(request.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          
                          {/* Connector 1 */}
                          <div style={{ 
                            width: '16px',
                            height: '2px',
                            background: 'linear-gradient(90deg, #10b981 0%, #d1fae5 100%)',
                            margin: '0 3px'
                          }}></div>
                          
                          {/* PM Stage */}
                          <div style={{ 
                            display: 'flex', 
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '3px',
                            minWidth: '75px'
                          }}>
                            <div style={{ 
                              width: '28px',
                              height: '28px',
                              borderRadius: '50%',
                              background: (request.status?.includes('pm') || request.status?.includes('project manager')) ? 
                                            (request.status?.includes('denied') ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)') : 
                                            'linear-gradient(135deg, #e5e7eb 0%, #d1d5db 100%)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'white',
                              fontSize: '12px',
                              fontWeight: 'bold'
                            }}>
                              {(request.status?.includes('pm') || request.status?.includes('project manager')) ? 
                                (request.status?.includes('denied') ? '✗' : '✓') : '○'}
                            </div>
                            <span style={{ 
                              fontSize: '10px', 
                              fontWeight: '600',
                              color: '#1f2937',
                              textAlign: 'center'
                            }}>
                              Project Manager
                            </span>
                            <span style={{ 
                              fontSize: '9px', 
                              color: (request.status?.includes('pm') || request.status?.includes('project manager')) ? 
                                     (request.status?.includes('denied') ? '#ef4444' : '#10b981') : '#6b7280',
                              fontWeight: '500'
                            }}>
                              {(request.status?.includes('pm') || request.status?.includes('project manager')) ? 
                                (request.status?.includes('denied') ? 'Rejected' : 'Approved') : 'Pending'}
                            </span>
                            <span style={{ 
                              fontSize: '8px', 
                              color: '#6b7280'
                            }}>
                              {request.pmApprovedAt ? new Date(request.pmApprovedAt).toLocaleDateString() : 'N/A'}
                            </span>
                          </div>
                          
                          {/* Connector 2 */}
                          <div style={{ 
                            width: '16px',
                            height: '2px',
                            background: (request.status?.includes('pm') || request.status?.includes('project manager')) && !request.status?.includes('denied') ? 
                                          'linear-gradient(90deg, #10b981 0%, #d1fae5 100%)' : 
                                          'linear-gradient(90deg, #e5e7eb 0%, #f3f4f6 100%)',
                            margin: '0 3px'
                          }}></div>
                          
                          {/* AM Stage */}
                          <div style={{ 
                            display: 'flex', 
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '3px',
                            minWidth: '75px'
                          }}>
                            <div style={{ 
                              width: '28px',
                              height: '28px',
                              borderRadius: '50%',
                              background: (request.status?.includes('am') || request.status?.includes('area manager')) ? 
                                            (request.status?.includes('denied') ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)') : 
                                            'linear-gradient(135deg, #e5e7eb 0%, #d1d5db 100%)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'white',
                              fontSize: '12px',
                              fontWeight: 'bold'
                            }}>
                              {(request.status?.includes('am') || request.status?.includes('area manager')) ? 
                                (request.status?.includes('denied') ? '✗' : '✓') : '○'}
                    </div>
                            <span style={{ 
                              fontSize: '10px', 
                              fontWeight: '600',
                              color: '#1f2937',
                              textAlign: 'center'
                            }}>
                              Area Manager
                            </span>
                            <span style={{ 
                              fontSize: '9px', 
                              color: (request.status?.includes('am') || request.status?.includes('area manager')) ? 
                                     (request.status?.includes('denied') ? '#ef4444' : '#10b981') : '#6b7280',
                              fontWeight: '500'
                            }}>
                              {(request.status?.includes('am') || request.status?.includes('area manager')) ? 
                                (request.status?.includes('denied') ? 'Rejected' : 'Approved') : 'Pending'}
                            </span>
                            <span style={{ 
                              fontSize: '8px', 
                              color: '#6b7280'
                            }}>
                              {request.amApprovedAt ? new Date(request.amApprovedAt).toLocaleDateString() : 'N/A'}
                            </span>
                      </div>
                          
                          {/* Connector 3 */}
                          <div style={{ 
                            width: '16px',
                            height: '2px',
                            background: (request.status?.includes('am') || request.status?.includes('area manager')) && !request.status?.includes('denied') ? 
                                          'linear-gradient(90deg, #10b981 0%, #d1fae5 100%)' : 
                                          'linear-gradient(90deg, #e5e7eb 0%, #f3f4f6 100%)',
                            margin: '0 3px'
                          }}></div>
                          
                          {/* Received Stage */}
                          <div style={{ 
                            display: 'flex', 
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '3px',
                            minWidth: '75px'
                          }}>
                            <div style={{ 
                              width: '28px',
                              height: '28px',
                              borderRadius: '50%',
                              background: request.receivedByPIC ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'linear-gradient(135deg, #e5e7eb 0%, #d1d5db 100%)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'white',
                              fontSize: '12px',
                              fontWeight: 'bold'
                            }}>
                              {request.receivedByPIC ? '✓' : '○'}
                    </div>
                            <span style={{ 
                              fontSize: '10px', 
                              fontWeight: '600',
                              color: '#1f2937',
                              textAlign: 'center'
                            }}>
                              Received
                            </span>
                            <span style={{ 
                              fontSize: '9px', 
                              color: request.receivedByPIC ? '#10b981' : '#6b7280',
                              fontWeight: '500'
                            }}>
                              {request.receivedByPIC ? 'Received' : 'Pending'}
                            </span>
                            <span style={{ 
                              fontSize: '8px', 
                              color: '#6b7280'
                            }}>
                              {request.receivedByPIC ? new Date(request.receivedByPIC).toLocaleDateString() : 'N/A'}
                            </span>
                      </div>
                    </div>
                  </div>
                      
                      {/* Request Details */}
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        marginBottom: '8px'
                      }}>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                          <span style={{ fontWeight: '500' }}>{request.createdBy?.name || 'Unknown'}</span> • {new Date(request.createdAt).toLocaleDateString()}
                          {request.project?.projectName && (
                            <span> • Project: {request.project.projectName}</span>
                          )}
                        </div>
                      </div>
                      
                      {/* Action Buttons */}
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <Link to={`/am/material-request/${request._id}`} className="view-details-btn">View Details</Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {filteredRequests.length > 0 && (
              <div className="pagination-section">
                <div className="pagination-info">
                  Showing {startIndex + 1} to {Math.min(startIndex + ITEMS_PER_PAGE, filteredRequests.length)} of {filteredRequests.length} entries
                </div>
                <div className="pagination-controls">
                  <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="pagination-btn">Previous</button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button key={page} className={`pagination-btn ${page === currentPage ? 'active' : ''}`} onClick={() => setCurrentPage(page)}>{page}</button>
                  ))}
                  <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} className="pagination-btn">Next</button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AreaMaterialList;
