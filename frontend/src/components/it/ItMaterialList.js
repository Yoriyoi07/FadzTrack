import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import '../style/am_style/Area_Material_List.css';
import api from '../../api/axiosInstance';

const ITEMS_PER_PAGE = 5;

const ItMaterialList = () => {
  const navigate = useNavigate();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // GET user role from localStorage
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isIT = user.role === 'IT';

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Session expired. Please log in.');
      setLoading(false);
      return;
    }

    // IT: fetch all material requests
    if (isIT) {
      api.get('/requests/all')
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
    } else {
      setError('Forbidden: IT only.');
      setLoading(false);
    }
  }, [isIT]);

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
      request.materials && request.materials.map(m => m.materialName).join(', '),
      request.description,
      request.createdBy?.name,
      request.project?.projectName,
    ].join(' ').toLowerCase();
    const matchesSearch = searchTarget.includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const totalPages = Math.ceil(filteredRequests.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedRequests = filteredRequests.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  return (
    <div>
      <header className="header">
        <div className="logo-container">
          <img src={require('../../assets/images/FadzLogo1.png')} alt="FadzTrack Logo" className="logo-img" />
          <h1 className="brand-name">FadzTrack</h1>
        </div>
        <nav className="nav-menu">
            <Link to="/it" className="nav-link">Dashboard</Link>
            <Link to="/it/chat" className="nav-link">Chat</Link>
            <Link to='/it/material-list' className="nav-link">Materials</Link>
            <Link to='/it/manpower-list' className="nav-link">Manpower</Link>
            <Link to="/it/auditlogs" className="nav-link">Audit Logs</Link>
        </nav>
        <div className="profile-menu-container">
          <div
            className="profile-circle"
            onClick={() => setProfileMenuOpen(!profileMenuOpen)}
          >
            {user.name ? user.name[0] : 'I'}
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
            <h2 className="page-title">All Material Requests</h2>
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
              type="text"
              placeholder="Search..."
              className="search-bar"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ marginLeft: 16, padding: 6, borderRadius: 8, border: '1px solid #ccc' }}
            />
          </div>

          <div className="requests-list">
            {loading ? (
              <div>Loading requests...</div>
            ) : error ? (
              <div style={{ color: 'red', marginBottom: 20 }}>{error}</div>
            ) : paginatedRequests.length === 0 ? (
              <div className="no-requests">
                <p>No requests found matching your criteria.</p>
              </div>
            ) : (
              paginatedRequests.map(request => (
                <Link
                  to={`/it/material-request/${request._id}`}
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
                      className={`status-badge ${(request.status || '').replace(/\s/g, '').toLowerCase()}`}
                    >
                      {request.status}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>

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
    </div>
  );
};

export default ItMaterialList;
