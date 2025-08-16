import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../api/axiosInstance';
import NotificationBell from '../NotificationBell';
import '../style/pm_style/Pm_ViewRequest.css';
import {
  FaTachometerAlt, FaComments, FaBoxes, FaUsers, FaEye,
  FaClipboardList, FaChartBar, FaCalendarAlt, FaSearch
} from 'react-icons/fa';

const chats = [
  { id: 1, name: 'Rychea Miralles', initial: 'R', message: 'Hello Good Morning po! As...', color: '#4A6AA5' },
  { id: 2, name: 'Third Castellar', initial: 'T', message: 'Hello Good Morning po! As...', color: '#2E7D32' },
  { id: 3, name: 'Zenarose Miranda', initial: 'Z', message: 'Hello Good Morning po! As...', color: '#9C27B0' }
];

const ITEMS_PER_PAGE = 5;

export default function PmManpowerList() {
  const navigate = useNavigate();

  // Read the user before any state depends on it (avoid TDZ)
  const token = localStorage.getItem('token');
  const stored = localStorage.getItem('user');
  const user = stored ? JSON.parse(stored) : null;
  const userId = user?._id || user?.id || null;

  const [userName] = useState(() => user?.name || 'ALECK');
  const [project, setProject] = useState(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  // View mode: 'mine' | 'others'
  const [viewMode, setViewMode] = useState('mine');

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Fetch list depending on viewMode
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        if (viewMode === 'mine') {
          const { data } = await api.get('/manpower-requests/mine');
          setRequests(Array.isArray(data) ? data : []);
        } else {
          const { data } = await api.get('/manpower-requests/pm');
          const arr = Array.isArray(data) ? data : [];
          const othersOnly = arr.filter(r => {
            const creatorId = r.createdBy?._id || r.createdBy?.id || r.createdBy;
            return !userId || (creatorId && creatorId !== userId);
          });
          setRequests(othersOnly);
        }
      } catch (err) {
        console.error('Load error:', err);
        if (err.response && (err.response.status === 403 || err.response.status === 401)) {
          setError('Session expired or unauthorized. Please login.');
        } else {
          setError('Failed to load manpower requests');
        }
        setRequests([]);
      } finally {
        setLoading(false);
        setCurrentPage(1);
      }
    };
    fetchData();
  }, [viewMode]);

  // Close profile dropdown on outside click
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

  // Fetch assigned project
  useEffect(() => {
    if (!token || !userId) return;
    const fetchAssignedPMProject = async () => {
      try {
        const { data } = await api.get(`/projects/assigned/projectmanager/${userId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setProject(data);
      } catch {
        setProject(null);
      }
    };
    fetchAssignedPMProject();
  }, [token, userId]);

  const getStatusClass = (s) => {
    if (!s) return '';
    const x = s.toLowerCase();
    if (x.includes('pending')) return 'pending';
    if (x.includes('approved')) return 'approved';
    if (x.includes('declined') || x.includes('denied') || x.includes('rejected')) return 'declined';
    return x.replace(/\s/g, '');
  };

  // Filter + search + paginate
  const filteredRequests = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return requests.filter(request => {
      const st = (request.status || '').toLowerCase();
      const matchesStatus =
        status === 'All' ||
        (status === 'Pending' && st.includes('pending')) ||
        (status === 'Approved' && st.includes('approved')) ||
        (status === 'Declined' && (st.includes('declined') || st.includes('denied') || st.includes('rejected')));
      if (!matchesStatus) return false;

      if (!term) return true;
      const searchTarget = [
        request.description,
        request.createdBy?.name,
        request.project?.projectName,
        ...(Array.isArray(request.manpowers) ? request.manpowers.map(mp => `${mp.type} ${mp.quantity ?? ''}`) : []),
      ].filter(Boolean).join(' ').toLowerCase();
      return searchTarget.includes(term);
    });
  }, [requests, status, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedRequests = filteredRequests.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  return (
    <div>
      {/* Header */}
      <header className="header">
        <div className="logo-container">
          <img
            src={require('../../assets/images/FadzLogo1.png')}
            alt="FadzTrack Logo"
            className="logo-img"
          />
          <h1 className="brand-name">FadzTrack</h1>
        </div>

        <nav className="nav-menu">
          <Link to="/pm" className="nav-link"><FaTachometerAlt /> Dashboard</Link>
          <Link to="/pm/chat" className="nav-link"><FaComments /> Chat</Link>
          <Link to="/pm/request/:id" className="nav-link"><FaBoxes /> Material</Link>
          <Link to="/pm/manpower-list" className="nav-link"><FaUsers /> Manpower</Link>
          {project && (
            <Link to={`/pm/viewprojects/${project._id || project.id}`} className="nav-link">
              <FaEye /> View Project
            </Link>
          )}
          <Link to="/pm/daily-logs" className="nav-link"><FaClipboardList /> Logs</Link>
          {project && (
            <Link to={`/pm/progress-report/${project._id}`} className="nav-link">
              <FaChartBar /> Reports
            </Link>
          )}
          <Link to="/pm/daily-logs-list" className="nav-link"><FaCalendarAlt /> Daily Logs</Link>
        </nav>

        <div className="profile-menu-container" style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <NotificationBell />
          <div className="profile-circle" onClick={() => setProfileMenuOpen(!profileMenuOpen)}>
            {userName ? userName.charAt(0).toUpperCase() : 'Z'}
          </div>
          {profileMenuOpen && (
            <div className="profile-menu">
              <button onClick={handleLogout}>Logout</button>
            </div>
          )}
        </div>
      </header>

      {/* Layout with Sidebar */}
      <div className="dashboard-layout">
        <div className="sidebar">
          <div className="chats-section">
            <h3 className="chats-title">Chats</h3>
            <div className="chats-list">
              {chats.map(chat => (
                <div key={chat.id} className="chat-item">
                  <div className="chat-avatar" style={{ backgroundColor: chat.color }}>
                    {chat.initial}
                  </div>
                  <div className="chat-info">
                    <div className="chat-name">{chat.name}</div>
                    <div className="chat-message">{chat.message}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="main-content">
          <div className="requests-container">
            <div className="requests-header">
              <h2 className="page-title">Manpower Requests</h2>

              {/* Controls bar */}
              <div className="controls-bar">
                {/* Segmented control: My vs Others */}
                <div className="segmented" role="tablist" aria-label="View mode">
                  <button
                    role="tab"
                    aria-selected={viewMode === 'mine'}
                    className={`seg-btn ${viewMode === 'mine' ? 'active' : ''}`}
                    onClick={() => setViewMode('mine')}
                  >
                    My Requests
                  </button>
                  <button
                    role="tab"
                    aria-selected={viewMode === 'others'}
                    className={`seg-btn ${viewMode === 'others' ? 'active' : ''}`}
                    onClick={() => setViewMode('others')}
                  >
                    Others’ Requests
                  </button>
                </div>

                {/* Search */}
                <div className="search-wrap">
                  <FaSearch className="search-ico" />
                  <input
                    className="search-input tidy"
                    placeholder="Search project, requestor, items, description…"
                    value={searchTerm}
                    onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                  />
                </div>

                {/* Status dropdown (replaces multiple buttons) */}
                <select
                  className="status-select"
                  value={status}
                  onChange={(e) => { setStatus(e.target.value); setCurrentPage(1); }}
                >
                  <option value="All">All statuses</option>
                  <option value="Pending">Pending</option>
                  <option value="Approved">Approved</option>
                  <option value="Declined">Declined</option>
                </select>

                {/* Primary CTA */}
                <button
                  className="primary-cta"
                  onClick={() => navigate('/pm/request-manpower')}
                >
                  + Request Manpower
                </button>
              </div>
            </div>

            <div className="requests-list">
              {loading ? (
                <div>Loading manpower requests...</div>
              ) : error ? (
                <div style={{ color: 'red', marginBottom: 20 }}>{error}</div>
              ) : filteredRequests.length === 0 ? (
                <div className="no-requests">
                  <p>No manpower requests found.</p>
                </div>
              ) : (
                paginatedRequests.map(request => (
                  <Link
                    to={`/pm/manpower-request/${request._id}`}
                    className="request-item card-clean"
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
                                {mp.type} {mp.quantity ? `(${mp.quantity})` : ''}
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
                          <p className="request-approver">
                            <strong>Area Manager:</strong> {request.project.areamanager.name}
                          </p>
                        )}
                        {request.status?.toLowerCase().includes('declined') && (
                          <p className="request-approver">
                            <strong>Declined by:</strong> {request.approvedBy || 'Unknown'}
                          </p>
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
            {filteredRequests.length > 0 && (
              <div className="pagination neat">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                  ‹
                </button>
                <span>Page {currentPage} of {totalPages}</span>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                  ›
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
