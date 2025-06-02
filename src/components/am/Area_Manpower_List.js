import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { List, LayoutGrid, ChevronLeft, ChevronRight } from 'lucide-react';
import '../style/am_style/Area_Manpower_List.css';
import api from '../../api/axiosInstance'; // <-- import your axios instance

export default function Area_Manpower_List() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('All');
  const [viewMode, setViewMode] = useState('list');
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    if (!user._id) return;
    setLoading(true);
    api
      .get(`/manpower-requests/area`, {
        params: { areaManager: user._id },
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      .then(res => setRequests(Array.isArray(res.data) ? res.data : []))
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

  const filteredRequests = requests.filter((request) =>
    filterStatus === 'All' ? true : request.status === filterStatus
  );

  const totalPages = Math.ceil(filteredRequests.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedRequests = filteredRequests.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const goToPage = (pageNumber) => {
    if (pageNumber >= 1 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
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
          <Link to="/am" className="nav-link">Dashboard</Link>
          <Link to="/am/matreq" className="nav-link">Material</Link>
          <Link to="/am/manpower-requests" className="nav-link">Manpower</Link>
          <Link to="/am/addproj" className="nav-link">Projects</Link>
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

      <main className="am-manpower-main-content">
        <div className="am-manpower-content-card">
          <div className="am-manpower-filters-container">
            <div className="am-manpower-filter-options">
              <span className="am-manpower-filter-label">Date Filter</span>
              {['All', 'Pending', 'Rejected', 'Approved'].map((status, index) => (
                <button
                  key={index}
                  className={`am-manpower-filter-button ${filterStatus === status ? 'active' : 'inactive'}`}
                  onClick={() => setFilterStatus(status)}>
                  {status}
                </button>
              ))}
            </div>
            <div className="am-manpower-view-options">
              <button
                className={`am-manpower-view-button ${viewMode === 'list' ? 'active' : ''}`}
                onClick={() => setViewMode('list')}>
                <List className="am-manpower-view-icon" />
              </button>
              <button
                className={`am-manpower-view-button ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => setViewMode('grid')}>
                <LayoutGrid className="am-manpower-view-icon" />
              </button>
            </div>
          </div>

          <div className="am-manpower-request-list am-manpower-scrollable">
            {loading ? (
              <div>Loading...</div>
            ) : paginatedRequests.length === 0 ? (
              <div>No requests found.</div>
            ) : (
              paginatedRequests.map((request) => (
                <div
                  key={request._id}
                  className="am-manpower-request-item"
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/am/manpower-requests/${request._id}`)}
                >
                  <div className="am-manpower-request-info">
                    <div className="am-manpower-request-details">
                      <h3 className="am-manpower-request-title">Request for {request.manpowers && request.manpowers.map(mp => `${mp.quantity} ${mp.type}`).join(', ')}</h3>
                      <p className="am-manpower-request-project">Project: {request.project?.projectName || 'N/A'}</p>
                      <p className="am-manpower-request-date">
                        {request.acquisitionDate ? new Date(request.acquisitionDate).toLocaleDateString() : ''}
                      </p>
                    </div>
                  </div>
                  <div className="am-manpower-request-meta">
                    <div className="am-manpower-requester-info">
                      <p className="am-manpower-requester-name">
                        Requested by: {request.createdBy?.name || 'N/A'}
                      </p>
                    </div>
                    <div className={`am-manpower-status-badge am-manpower-status-${(request.status || '').toLowerCase()}`}>{request.status}</div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="am-manpower-pagination">
            <span className="am-manpower-pagination-info">
              Showing {startIndex + 1} to {Math.min(startIndex + ITEMS_PER_PAGE, filteredRequests.length)} of {filteredRequests.length} entries.
            </span>
            <div className="am-manpower-pagination-controls">
              <button
                className="am-manpower-pagination-btn"
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <ChevronLeft size={16} />
              </button>
              {Array.from({ length: totalPages }, (_, index) => index + 1).map(page => (
                <button
                  key={page}
                  className={`am-manpower-pagination-btn ${page === currentPage ? 'active' : ''}`}
                  onClick={() => goToPage(page)}
                >
                  {page}
                </button>
              ))}
              <button
                className="am-manpower-pagination-btn"
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
