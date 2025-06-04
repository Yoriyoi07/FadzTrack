import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../api/axiosInstance'; // Make sure this path matches your project
import '../style/pm_style/Pm_ViewRequest.css';

const PmManpowerList = () => {
  const navigate = useNavigate();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const token = localStorage.getItem('token');
  const stored = localStorage.getItem('user');
  const user = stored ? JSON.parse(stored) : null;
  const userId = user?._id;
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('All');
  const [searchTerm, ] = useState('');
  const [projects, setProjects] = useState([]);
  const [, setProject] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  // --- FILTERED REQUESTS ---
  const filteredRequests = requests.filter(request => {
    const status = (request.status || '').toLowerCase();
    const matchesFilter =
      filter === 'All' ||
      (filter === 'Pending' && status.includes('pending')) ||
      (filter === 'Approved' && status.includes('approved')) ||
      (filter === 'Declined' && (status.includes('declined') || status.includes('denied')));

    const searchTarget = [
      request.manpowerType,
      request.description,
      request.createdBy?.name,
      request.project?.projectName,
      request.quantity?.toString(),
    ].join(' ').toLowerCase();
    const matchesSearch = searchTarget.includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const totalPages = Math.ceil(filteredRequests.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedRequests = filteredRequests.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  useEffect(() => {
    api.get('/manpower-requests')
      .then(res => {
        console.log("SAMPLE REQUEST >>>", res.data[0]);
        setRequests(Array.isArray(res.data) ? res.data : []);
        setLoading(false);
        setError('');
      })
      .catch(err => {
        if (err.response && (err.response.status === 403 || err.response.status === 401)) {
          setError('Session expired or unauthorized. Please login.');
        } else {
          setError('Failed to load manpower requests');
        }
        setRequests([]);
        setLoading(false);
        console.error(err);
      });
  }, []);

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

  useEffect(() => {
    if (!token || !user) return;
    const fetchProjects = async () => {
      try {
        const { data } = await api.get('/projects');
        const filtered = data.filter(p =>
          (typeof p.projectmanager === 'object' &&
            (p.projectmanager._id === userId || p.projectmanager.id === userId)) ||
          p.projectManager === userId
        );
        setProjects(filtered);
      } catch (err) {
        setProjects([]);
      }
    };
    fetchProjects();
  }, [token, user, userId]);

  // Fetch assigned project
  useEffect(() => {
    if (!token || !userId) return;
    const fetchAssigned = async () => {
      try {
        const { data } = await api.get(`/projects/assigned/${userId}`);
        console.log('Assigned project data:', data);
        setProject(data[0] || null);
      } catch (err) {
        setProject(null);
      }
    };
    fetchAssigned();
  }, [token, userId]);

  const getStatusClass = (status) => {
    if (!status) return '';
    const statusLower = status.toLowerCase();
    if (statusLower.includes('pending')) return 'pending';
    if (statusLower.includes('approved')) return 'approved';
    if (statusLower.includes('declined') || statusLower.includes('denied')) return 'declined';
    return statusLower.replace(/\s/g, '');
  };

  return (
    <div>
      {/* Header with Navigation */}
      <header className="header">
        <div className="logo-container">
          <img src={require('../../assets/images/FadzLogo1.png')} alt="FadzTrack Logo" className="logo-img" />
          <h1 className="brand-name">FadzTrack</h1>
        </div>
        <nav className="nav-menu">
          <Link to="/pm" className="nav-link">Dashboard</Link>
          <Link to="/pm/request/:id" className="nav-link">Material</Link>
          <Link to="/pm/manpower-list" className="nav-link">Manpower</Link>
          {projects.length > 0 && (
            <Link to={`/pm/viewprojects/${projects[0]._id || projects[0].id}`} className="nav-link">View Project</Link>
          )}
          <Link to="/chat" className="nav-link">Chat</Link>
          <Link to="/logs" className="nav-link">Logs</Link>
          <Link to="/reports" className="nav-link">Reports</Link>
        </nav>
        <div className="profile-menu-container">
          <div 
            className="profile-circle" 
            onClick={() => setProfileMenuOpen(!profileMenuOpen)}
          >
            Z
          </div>
          {profileMenuOpen && (
            <div className="profile-menu">
              <button onClick={handleLogout}>Logout</button>
            </div>
          )}
        </div>
      </header>

      <main className="main-content">
        <div className="requests-container">
          <div className="requests-header">
            <h2 className="page-title">Manpower Requests</h2>
            <button
              className="request-manpower-btn"
              onClick={() => navigate('/pm/request-manpower')}
            >
              + Request Manpower
            </button>
            <div className="filter-tabs">
              {['All', 'Pending', 'Approved', 'Declined'].map(tab => (
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

          <div className="requests-list">
            {loading ? (
              <div>Loading manpower requests...</div>
            ) : error ? (
              <div style={{ color: 'red', marginBottom: 20 }}>{error}</div>
            ) : filteredRequests.length === 0 ? (
              <div className="no-requests">
                <p>No manpower requests found matching your criteria.</p>
              </div>
            ) : (
              paginatedRequests.map(request => (
                <Link
                  to={`/pm/manpower-request/${request._id}`}
                  className="request-item"
                  key={request._id}
                >
                  <div className="request-icon">👷</div>
                  <div className="request-details">
                    <h3 className="request-title">
                      Manpower Request {request.requestNumber || request._id?.slice(-3)}
                    </h3>
                    <p className="request-description">
                      {Array.isArray(request.manpowers)
                        ? request.manpowers.map((mp, i) => (
                          <span key={i}>
                            {mp.type} {mp.quantity && `(${mp.quantity})`}
                            {i < request.manpowers.length - 1 ? ', ' : ''}
                          </span>
                        ))
                        : 'No manpowers'}
                    </p>
                    <div className="request-date">
                      {request.createdAt ? new Date(request.createdAt).toLocaleDateString() : ''}
                    </div>
                  </div>
                  <div className="request-meta">
                    <div className="approval-status">
                      {request.project?.areamanager?.name && (
                        <p className="request-approver"><strong>Area Manager:</strong> {request.project.areamanager.name}</p>)}
                      {request.status?.toLowerCase().includes('declined') && (
                        <p className="request-approver"><strong>Declined by:</strong> {request.approvedBy || 'Unknown'}</p>)}
                      {request.status?.toLowerCase().includes('approved') && request.approvals && (
                        <div className="approval-checkmark">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="20,6 9,17 4,12"></polyline>
                          </svg>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="request-actions">
                    <span className={`status-badge ${getStatusClass(request.status)}`}>
                      {request.status || 'Pending'}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>

          {/* Pagination UI */}
          {filteredRequests.length > 0 && (
            <div className="pagination">
              <span className="pagination-info">
                Showing {startIndex + 1} to {Math.min(startIndex + ITEMS_PER_PAGE, filteredRequests.length)} of {filteredRequests.length} entries
              </span>
              <div className="pagination-controls">
                <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1}>
                  &lt;
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    className={page === currentPage ? 'active' : ''}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </button>
                ))}
                <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages}>
                  &gt;
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default PmManpowerList;
