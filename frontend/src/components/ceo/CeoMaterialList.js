import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../api/axiosInstance'; // adjust the import path as needed
import '../style/ceo_style/Ceo_Material_List.css';

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
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

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
      (filter === 'Cancelled' && status.includes('denied')) ||
      (filter === 'Cancelled' && status.includes('cancel'));
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

  return (
    <div>
      <header className="header">
        <div className="logo-container">
          <img src={require('../../assets/images/FadzLogo1.png')} alt="FadzTrack Logo" className="logo-img" />
          <h1 className="brand-name">FadzTrack</h1>
        </div>
        <nav className="nav-menu">
          <Link to="/ceo/dash" className="nav-link">Dashboard</Link>
          <Link to="/ceo/material-list" className="nav-link">Material</Link>
          <Link to="/ceo/proj" className="nav-link">Projects</Link>
          <Link to="/chat" className="nav-link">Chat</Link>
          <Link to="/ceo/audit-logs" className="nav-link">Audit Logs</Link>
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
              <div className="loading-msg">Loading requests...</div>
            ) : error ? (
              <div className="error-msg">{error}</div>
            ) : currentRequests.length === 0 ? (
              <div className="no-requests">
                <p>No requests found matching your criteria.</p>
              </div>
            ) : (
              currentRequests.map(request => (
                <Link to={`/pm/material-request/${request._id}`} className="request-item" key={request._id}>
                  <div className="request-icon">{getIconForType(request)}</div>
                  <div className="request-details">
                    <h3 className="request-title">
                      {request.materials?.length > 0
                        ? request.materials.map(m => `${m.materialName} (${m.quantity})`).join(', ')
                        : 'Material Request'}
                    </h3>
                    <p className="request-description">{request.description}</p>
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
                  <div className="request-actions">
                    <span className={`status-badge ${request.status?.replace(/\s/g, '').toLowerCase()}`}>
                      {request.status}
                    </span>
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
  );
};

export default CeoMaterialList;
