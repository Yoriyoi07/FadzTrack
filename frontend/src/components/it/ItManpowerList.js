import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import '../style/am_style/Area_Material_List.css'; // Use your material card style
import api from '../../api/axiosInstance';

const ITEMS_PER_PAGE = 5;

const ItManpowerList = () => {
  const navigate = useNavigate();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isIT = user.role && user.role.toUpperCase() === 'IT';

  useEffect(() => {
    if (!isIT) {
      setError('Forbidden: IT only.');
      setLoading(false);
      return;
    }
    setLoading(true);
    api.get('/manpower-requests', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    })
      .then(res => {
        setRequests(Array.isArray(res.data) ? res.data : []);
        setError('');
      })
      .catch(err => {
        setRequests([]);
        setError('Failed to load requests');
      })
      .finally(() => setLoading(false));
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

  // List filters and search
  const filteredRequests = requests.filter(request => {
    const status = (request.status || '').toLowerCase();
    const matchesFilter =
      filter === 'All' ||
      (filter === 'Pending' && status.includes('pending')) ||
      (filter === 'Approved' && status.includes('approved')) ||
      (filter === 'Cancelled' && (status.includes('cancel') || status.includes('denied')));

    const searchTarget = [
      request.manpowers && request.manpowers.map(mp => mp.type).join(', '),
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

  // Card Status style (copy your material list!)
  const getStatusStyle = (status) =>
    `status-badge ${(status || '').replace(/\s/g, '').toLowerCase()}`;

  return (
    <div>
      <header className="header">
        <div className="logo-container">
          <img src={require('../../assets/images/FadzLogo1.png')} alt="FadzTrack Logo" className="logo-img" />
          <h1 className="brand-name">FadzTrack</h1>
        </div>
        <nav className="nav-menu">
          <Link to="/it" className="nav-link">Dashboard</Link>
          <Link to="/chat" className="nav-link">Chat</Link>
          <Link to="/it/material-list" className="nav-link">Materials</Link>
          <Link to="/it/manpower-list" className="nav-link active">Manpower</Link>
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
            <h2 className="page-title">All Manpower Requests</h2>
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
                <div
                  className="request-item"
                  key={request._id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: '#fff',
                    borderRadius: 16,
                    boxShadow: '0 2px 8px #0001',
                    marginBottom: 24,
                    padding: 24,
                    gap: 32
                  }}
                  onClick={() => navigate(`/it/manpower-request/${request._id}`)}
                >
                  {/* Left icon and details */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 20 }}>
                        {request.manpowers && request.manpowers.length > 0
                          ? request.manpowers.map(mp => `${mp.type} (${mp.quantity})`).join(', ')
                          : 'Manpower Request'}
                      </div>
                      <div style={{ color: '#555', marginTop: 4 }}>
                        {request.description}
                      </div>
                    </div>
                  </div>
                  {/* Right meta */}
                  <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
                    minWidth: 220, gap: 2
                  }}>
                    <div style={{ fontWeight: 600 }}>{request.createdBy?.name || '-'}</div>
                    <div>{request.project?.projectName || '-'}</div>
                    <div style={{ fontWeight: 500 }}>
                      <span className={getStatusStyle(request.status)}>
                        {request.status}
                      </span>
                    </div>
                    <div style={{ fontSize: 14, color: '#555' }}>
                      {request.createdAt ? new Date(request.createdAt).toLocaleDateString() : ''}
                    </div>
                  </div>
                </div>
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
    </div>
  );
};

export default ItManpowerList;
