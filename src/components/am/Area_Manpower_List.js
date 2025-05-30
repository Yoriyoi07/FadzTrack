import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { List, LayoutGrid, ChevronLeft, ChevronRight } from 'lucide-react';
import '../style/am_style/Area_Manpower_List.css';

export default function Area_Manpower_List() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('All');
  const [viewMode, setViewMode] = useState('list');
  const navigate = useNavigate();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    if (!user._id) return;
    setLoading(true);
    fetch(`http://localhost:5000/api/manpower-requests/area?areaManager=${user._id}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    })
      .then(res => res.json())
      .then(data => setRequests(Array.isArray(data) ? data : []))
      .catch(() => setRequests([]))
      .finally(() => setLoading(false));
  }, [user._id]);

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

  // Optionally filter by status (if you have a status field)
  const filteredRequests = requests.filter((request) =>
    filterStatus === 'All' ? true : request.status === filterStatus
  );

  return (
    <div className="app-container">
      {/* Header with Navigation */}
      <header className="header">
        {/* ...same header code... */}
        <div className="logo-container">
          <div className="logo">
            <div className="logo-building"></div>
            <div className="logo-flag"></div>
          </div>
          <h1 className="brand-name">FadzTrack</h1>
        </div>
           <nav className="nav-menu">
            <Link to="/am" className="nav-link">Dashboard</Link>
            <Link to="/am/matreq" className="nav-link">Material</Link>
            <Link to="/am/manpower-requests" className="nav-link">Manpower</Link>
            <Link to="/ceo/proj" className="nav-link">Projects</Link>
            <Link to="/chat" className="nav-link">Chat</Link>
            <Link to="/logs" className="nav-link">Logs</Link>
            <Link to="/reports" className="nav-link">Reports</Link>
          </nav>
        <div className="search-profile">
          <div className="search-container">
            <input type="text" placeholder="Search in site" className="search-input" />
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
              {user?.name?.charAt(0).toUpperCase() || 'U'}
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
        <div className="content-card">
          {/* Filters */}
          <div className="filters-container">
            <div className="filter-options">
              <span className="filter-label">Date Filter</span>
              {['All', 'Pending', 'Rejected', 'Approved'].map((status, index) => (
                <button
                  key={index}
                  className={`filter-button ${filterStatus === status ? 'active' : 'inactive'}`}
                  onClick={() => setFilterStatus(status)}>
                  {status}
                </button>
              ))}
            </div>
            <div className="view-options">
              <button
                className={`view-button ${viewMode === 'list' ? 'active' : ''}`}
                onClick={() => setViewMode('list')}>
                <List className="view-icon" />
              </button>
              <button
                className={`view-button ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => setViewMode('grid')}>
                <LayoutGrid className="view-icon" />
              </button>
            </div>
          </div>

          {/* Request List */}
          <div className="request-list scrollable">
            {loading ? (
              <div>Loading...</div>
            ) : filteredRequests.length === 0 ? (
              <div>No requests found.</div>
            ) : (
              filteredRequests.map((request) => (
                <div
                  key={request._id}
                  className="request-item"
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/am/manpower-requests/${request._id}`)}
                >
                  <div className="request-info">
                    <div className="request-details">
                      <h3 className="request-title">Request for {request.manpowers && request.manpowers.map(mp => `${mp.quantity} ${mp.type}`).join(', ')}</h3>
                      <p className="request-project">Project: {request.project?.projectName || 'N/A'}</p>
                      <p className="request-date">
                        {request.acquisitionDate ? new Date(request.acquisitionDate).toLocaleDateString() : ''}
                      </p>
                    </div>
                  </div>
                  <div className="request-meta">
                    <div className="requester-info">
                      <p className="requester-name">
                        Requested by: {request.createdBy?.name || 'N/A'}
                      </p>
                    </div>
                    {request.status === 'Pending' && (
                      <div className="status-badge status-pending">Pending</div>
                    )}
                    {request.status === 'Approved' && (
                      <div className="status-badge status-approved">Approved</div>
                    )}
                    {request.status === 'Rejected' && (
                      <div className="status-badge status-declined">Declined</div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Pagination - keep as is if you plan to use later */}
          <div className="pagination">
            <button className="pagination-arrow">
              <ChevronLeft className="pagination-arrow-icon" />
            </button>
            <button className="pagination-number active">1</button>
            <button className="pagination-number">2</button>
            <button className="pagination-number">3</button>
            <button className="pagination-number">4</button>
            <span className="pagination-ellipsis">...</span>
            <button className="pagination-number">40</button>
            <button className="pagination-arrow">
              <ChevronRight className="pagination-arrow-icon" />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
