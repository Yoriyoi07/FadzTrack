import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../api/axiosInstance'; // Adjust if needed
import '../style/pm_style/Pm_ViewRequest.css';

const Pm_MatRequestList = () => {
  const navigate = useNavigate();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const stored = localStorage.getItem('user');
  const user = stored ? JSON.parse(stored) : null;
  const userId = user?._id;
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [projects, setProjects] = useState([]);
  const [project, setProject] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  // --- MUST COME FIRST ---
  const filteredRequests = requests.filter(request => {
    const status = (request.status || '').toLowerCase();
    const matchesFilter =
      filter === 'All' ||
      (filter === 'Pending' && status.includes('pending')) ||
      (filter === 'Approved' && status.includes('approved')) ||
      (filter === 'Cancelled' && (status.includes('denied') || status.includes('cancel')));

    const searchTarget = [
      request.materials?.map(m => m.materialName).join(', ') || '',
      request.description || '',
      request.createdBy?.name || '',
      request.project?.projectName || '',
    ].join(' ').toLowerCase();

    return matchesFilter && searchTarget.includes(searchTerm.toLowerCase());
  });

  const totalPages = Math.ceil(filteredRequests.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedRequests = filteredRequests.slice(startIndex, startIndex + ITEMS_PER_PAGE);

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
        } else {
          setError('Failed to load requests');
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
    if (!user) return;
    const fetchProjects = async () => {
      try {
        const res = await api.get('/projects');
        const data = res.data;
        const filtered = data.filter(
          (p) => p.projectManager && (
            (typeof p.projectManager === 'object' && (p.projectManager._id === userId || p.projectManager.id === userId)) ||
            p.projectManager === userId
          )
        );
        setProjects(filtered);
      } catch (err) {
        console.error('Failed to fetch projects:', err);
      }
    };
    fetchProjects();
  }, [user, userId]);

  useEffect(() => {
    if (!userId) return;
    const fetchAssigned = async () => {
      try {
        const res = await api.get(`/projects/assigned/${userId}`);
        const data = res.data;
        setProject(data[0] || null);
      } catch (err) {
        console.error('Failed to fetch assigned project:', err);
        setProject(null);
      }
    };
    fetchAssigned();
  }, [userId]);

  const getIconForType = (request) => {
    if (!request.materials || request.materials.length === 0) return '📄';
    const name = request.materials[0].materialName?.toLowerCase() || '';
    if (name.includes('steel')) return '🔧';
    if (name.includes('brick')) return '🧱';
    if (name.includes('cement')) return '🪨';
    if (name.includes('sand')) return '🏖️';
    return '📦';
  };

  return (
    <div className="app-container">
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
            <Link to={`/pm/viewprojects/${projects[0].id || projects[0]._id}`} className="nav-link">View Project</Link>
          )}
          <Link to="/chat" className="nav-link">Chat</Link>
          <Link to="/logs" className="nav-link">Logs</Link>
          <Link to="/reports" className="nav-link">Reports</Link>
        </nav>
        <div className="profile-menu-container">
          <div className="profile-circle" onClick={() => setProfileMenuOpen(!profileMenuOpen)}>Z</div>
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
          </div>

          <div className="requests-list">
            {loading ? (
              <div>Loading requests...</div>
            ) : error ? (
              <div style={{ color: 'red', marginBottom: 20 }}>{error}</div>
            ) : filteredRequests.length === 0 ? (
              <div className="no-requests">
                <p>No requests found matching your criteria.</p>
              </div>
            ) : (
              paginatedRequests.map(request => (
                <Link
                  to={`/pm/material-request/${request._id}`}
                  className="request-item"
                  key={request._id}
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <div className="request-icon">{getIconForType(request)}</div>
                  <div className="request-details">
                    <h3 className="request-title">
                      {request.materials && request.materials.length > 0
                        ? request.materials.map(m => `${m.materialName} (${m.quantity})`).join(', ')
                        : 'Material Request'}
                    </h3>
                    <p className="request-description">{request.description}</p>
                  </div>
                  <div className="request-meta">
                    <div className="request-author">{request.createdBy?.name || 'Unknown'}</div>
                    <div className="request-project">{request.project?.projectName || '-'}</div>
                    <div className="request-date">
                      {request.createdAt ? new Date(request.createdAt).toLocaleDateString() : ''}
                    </div>
                  </div>
                  <div className="request-actions">
                    <span
                      className={`status-badge ${
                        (request.status || '').replace(/\s/g, '').toLowerCase()
                      }`}
                    >
                      {request.status}
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

export default Pm_MatRequestList;
