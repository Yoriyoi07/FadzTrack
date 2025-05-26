import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import '../style/pm_style/Pm_ViewRequest.css';

const Ceo_Material_List = () => {
  const navigate = useNavigate();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  // State for requests
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch all requests for this PM
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Session expired. Please log in.');
      setLoading(false);
      return;
    }

    fetch('http://localhost:5000/api/requests/mine', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(async res => {
        if (!res.ok) {
          if (res.status === 403 || res.status === 401) {
            setError('Session expired or unauthorized. Please login.');
            setRequests([]);
            setLoading(false);
            return;
          }
          throw new Error('Failed to fetch requests');
        }
        const data = await res.json();
        setRequests(Array.isArray(data) ? data : []);
        setLoading(false);
        setError('');
      })
      .catch(err => {
        setError('Failed to load requests');
        setRequests([]);
        setLoading(false);
        console.error(err);
      });
  }, []);

  // Profile dropdown
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

  // Utility: Show an emoji for the first material type
  const getIconForType = (request) => {
    if (!request.materials || request.materials.length === 0) return '📄';
    const name = request.materials[0].materialName?.toLowerCase() || '';
    if (name.includes('steel')) return '🔧';
    if (name.includes('brick')) return '🧱';
    if (name.includes('cement')) return '🪨';
    if (name.includes('sand')) return '🏖️';
    return '📦';
  };

  // Filtering and searching
  const filteredRequests = requests.filter(request => {
    // Status filter
    const status = (request.status || '').toLowerCase();
    const matchesFilter =
      filter === 'All' ||
      (filter === 'Pending' && status.includes('pending')) ||
      (filter === 'Approved' && status.includes('approved')) ||
      (filter === 'Cancelled' && status.includes('denied')) ||
      (filter === 'Cancelled' && status.includes('cancel'));
    // Search
    const searchTarget = [
      request.materials && request.materials.map(m => m.materialName).join(', '),
      request.description,
      request.createdBy?.name,
      request.project?.projectName,
    ].join(' ').toLowerCase();
    const matchesSearch = searchTarget.includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header">
        <div className="logo-container">
          <div className="logo">
            <div className="logo-building"></div>
            <div className="logo-flag"></div>
          </div>
          <h1 className="brand-name">FadzTrack</h1>
        </div>
        <nav className="nav-menu">
          <Link to="/ceo/dash" className="nav-link">Dashboard</Link>
          <Link to="/pm/requests" className="nav-link active">Requests</Link>
          <Link to="/ceo/proj" className="nav-link">Projects</Link>
          <Link to="/chat" className="nav-link">Chat</Link>
          <Link to="/logs" className="nav-link">Logs</Link>
          <Link to="/reports" className="nav-link">Reports</Link>
        </nav>
        <div className="search-profile">
          <div className="search-container">
            <input
              type="text"
              placeholder="Search in requests"
              className="search-input"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
            <button className="search-button">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </button>
          </div>
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
        </div>
      </header>

      {/* Main Content */}
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

          {/* Request List */}
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
                filteredRequests.map(request => (
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
                    <div>Requested: {request.createdAt ? new Date(request.createdAt).toLocaleString() : ''}</div>
                    {request.approvals && request.approvals.find(a => a.role === 'PM' && a.decision === 'approved') && (
                        <div>
                       PM Approved: {new Date(request.approvals.find(a => a.role === 'PM' && a.decision === 'approved').timestamp).toLocaleString()}
                        </div>
                    )}
                    {request.approvals && request.approvals.find(a => a.role === 'AM' && a.decision === 'approved') && (
                        <div>
                        AM Approved: {new Date(request.approvals.find(a => a.role === 'AM' && a.decision === 'approved').timestamp).toLocaleString()}
                        </div>
                    )}
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

          {/* Pagination Placeholder */}
          <div className="pagination">
            <div className="pagination-dots">
              <span className="dot active"></span>
              <span className="dot"></span>
              <span className="dot"></span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Ceo_Material_List;
