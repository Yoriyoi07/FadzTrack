import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import '../style/pm_style/Pm_ViewRequest.css';

const Pm_Manpower_List = () => {
  const navigate = useNavigate();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  // State for requests
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch all manpower requests for this PM
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Session expired. Please log in.');
      setLoading(false);
      return;
    }

    fetch('http://localhost:5000/api/manpower-requests/mine', {
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
          throw new Error('Failed to fetch manpower requests');
        }
        const data = await res.json();
        setRequests(Array.isArray(data) ? data : []);
        setLoading(false);
        setError('');
      })
      .catch(err => {
        setError('Failed to load manpower requests');
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

  // Utility: Show an emoji/icon for manpower type
  const getIconForType = (request) => {
    if (!request.manpowerType) return '👷';
    const type = request.manpowerType.toLowerCase();
    if (type.includes('engineer')) return '👨‍💼';
    if (type.includes('worker')) return '👷';
    if (type.includes('supervisor')) return '👨‍💼';
    if (type.includes('technician')) return '🔧';
    if (type.includes('operator')) return '⚙️';
    return '👥';
  };

  // Get status color class
  const getStatusClass = (status) => {
    if (!status) return '';
    const statusLower = status.toLowerCase();
    if (statusLower.includes('pending')) return 'pending';
    if (statusLower.includes('approved')) return 'approved';
    if (statusLower.includes('declined') || statusLower.includes('denied')) return 'declined';
    return statusLower.replace(/\s/g, '');
  };

  // Filtering and searching
  const filteredRequests = requests.filter(request => {
    // Status filter
    const status = (request.status || '').toLowerCase();
    const matchesFilter =
      filter === 'All' ||
      (filter === 'Pending' && status.includes('pending')) ||
      (filter === 'Approved' && status.includes('approved')) ||
      (filter === 'Declined' && (status.includes('declined') || status.includes('denied')));
    
    // Search
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
          <Link to="/pm/dash" className="nav-link">Dashboard</Link>
          <Link to="/pm/requests" className="nav-link">Requests</Link>
          <Link to="/pm/projects" className="nav-link">Projects</Link>
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
            <h2 className="page-title">Manpower Requests</h2>
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

          {/* Request List */}
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
              filteredRequests.map(request => (
                <Link
                  to={`/pm/manpower-request/${request._id}`}
                  className="request-item"
                  key={request._id}
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <div className="request-icon">{getIconForType(request)}</div>
                  <div className="request-details">
                    <h3 className="request-title">
                      Manpower Request {request.requestNumber || request._id?.slice(-3)}
                    </h3>
                    <p className="request-description">
                      {request.manpowerType} {request.quantity && `(${request.quantity})`}
                    </p>
                    <div className="request-date">
                      {request.createdAt ? new Date(request.createdAt).toLocaleDateString() : ''}
                    </div>
                  </div>
                  <div className="request-meta">
                    <div className="approval-status">
                      {request.status?.toLowerCase().includes('pending') && (
                        <span>to be approved by</span>
                      )}
                      {request.status?.toLowerCase().includes('declined') && (
                        <span>Declined by</span>
                      )}
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

          {/* Pagination */}
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

export default Pm_Manpower_List;