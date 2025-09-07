import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import '../style/hr_style/Hr_Dash.css';
import api from '../../api/axiosInstance';
import AppHeader from '../layout/AppHeader';
import {
  FaTachometerAlt,
  FaComments,
  FaUsers,
  FaExchangeAlt,
  FaProjectDiagram,
  FaCalendarAlt,
  FaSearch,
  FaFilter,
  FaDownload,
  FaEye,
  FaSort,
  FaSortUp,
  FaSortDown,
  FaFileExcel,
  FaUser,
  FaMapMarkerAlt,
  FaClock
} from 'react-icons/fa';

const HrAttendance = ({ forceUserUpdate }) => {
  const navigate = useNavigate();

  // User state
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('token') || "");
  const [userId, setUserId] = useState(() => user?._id);

  // Listen for storage changes
  useEffect(() => {
    const handleUserChange = () => {
      const stored = localStorage.getItem('user');
      setUser(stored ? JSON.parse(stored) : null);
      setUserId(stored ? JSON.parse(stored)._id : undefined);
      setToken(localStorage.getItem('token') || "");
    };
    window.addEventListener("storage", handleUserChange);
    return () => window.removeEventListener("storage", handleUserChange);
  }, []);

  // Page state
  const [attendanceReports, setAttendanceReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [totalReports, setTotalReports] = useState(0);

  // Filter and search state
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState('generatedAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [showFilters, setShowFilters] = useState(false);

  // Redirect to login if not logged in
  useEffect(() => {
    if (!token || !userId) {
      navigate('/');
      return;
    }
  }, [token, userId, navigate]);

  // Fetch attendance reports
  const fetchAttendanceReports = useCallback(async () => {
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);
      params.append('sortBy', sortBy);
      params.append('sortOrder', sortOrder);

      console.log('Fetching attendance reports from:', `/hr-site-attendance/all-reports?${params}`);
      console.log('Token:', token ? 'Present' : 'Missing');

      const { data } = await api.get(`/hr-site-attendance/all-reports?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      console.log('API Response:', data);

      setAttendanceReports(data.reports || []);
      setTotalReports(data.total || 0);
    } catch (error) {
      console.error('Error fetching attendance reports:', error);
      console.error('Error details:', error.response?.data || error.message);
      setError('Failed to load attendance reports');
      setAttendanceReports([]);
    } finally {
      setLoading(false);
    }
  }, [token, searchTerm, dateFrom, dateTo, sortBy, sortOrder]);

  useEffect(() => {
    console.log('HrAttendance component mounted, fetching reports...');
    fetchAttendanceReports();
  }, [fetchAttendanceReports]);

  // Handle search
  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
  };

  // Handle sort
  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  // Clear filters
  const clearFilters = () => {
    setSearchTerm('');
    setDateFrom('');
    setDateTo('');
    setSortBy('generatedAt');
    setSortOrder('desc');
  };

  // Format date
  const formatDate = (date) => {
    if (!date) return 'Unknown';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get sort icon
  const getSortIcon = (field) => {
    if (sortBy !== field) return <FaSort className="sort-icon" />;
    return sortOrder === 'asc' ? <FaSortUp className="sort-icon" /> : <FaSortDown className="sort-icon" />;
  };

  // Logout handler
  const handleLogout = useCallback(() => {
    api.post('/auth/logout', {}, { headers: { Authorization: `Bearer ${token}` } }).finally(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
      setUserId(undefined);
      setToken("");
      if (forceUserUpdate) forceUserUpdate();
      window.dispatchEvent(new Event('storage'));
      navigate('/');
    });
  }, [token, forceUserUpdate, navigate]);

  return (
    <div className="hr-dashboard dashboard-container">
      <AppHeader 
        roleSegment="hr"
        onLogout={handleLogout}
        overrideNav={[
          { to:'/hr/dash', label:'Dashboard', icon:<FaTachometerAlt/>, match:'/hr/dash' },
          { to:'/hr/chat', label:'Chat', icon:<FaComments/>, match:'/hr/chat' },
          { to:'/hr/mlist', label:'Manpower', icon:<FaUsers/>, match:'/hr/mlist' },
          { to:'/hr/movement', label:'Movement', icon:<FaExchangeAlt/>, match:'/hr/movement' },
          { to:'/hr/project-records', label:'Projects', icon:<FaProjectDiagram/>, match:'/hr/project-records' },
          { to:'/hr/attendance', label:'Attendance', icon:<FaCalendarAlt/>, match:'/hr/attendance' }
        ]}
      />
      <main className="dashboard-main">
        <div className="dashboard-content">
          {/* Header */}
          <div className="page-header">
            <div className="header-content">
              <h1 className="page-title">
                <FaCalendarAlt className="title-icon" />
                Attendance Reports
              </h1>
              <p className="page-subtitle">View and manage attendance reports across all projects</p>
            </div>
            <div className="header-stats">
              <div className="stat-card">
                <div className="stat-value">{totalReports}</div>
                <div className="stat-label">Total Reports</div>
              </div>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="filters-section">
            <div className="search-bar">
              <FaSearch className="search-icon" />
              <input
                type="text"
                placeholder="Search by project name, file name, or uploaded by..."
                value={searchTerm}
                onChange={handleSearch}
                className="search-input"
              />
            </div>
            
            <div className="filter-controls">
              <button
                className={`filter-toggle ${showFilters ? 'active' : ''}`}
                onClick={() => setShowFilters(!showFilters)}
              >
                <FaFilter />
                Filters
              </button>
              
              <button className="clear-filters" onClick={clearFilters}>
                Clear All
              </button>
            </div>

            {showFilters && (
              <div className="filter-panel">
                <div className="filter-row">
                  <div className="filter-group">
                    <label>Date From:</label>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="filter-input"
                    />
                  </div>
                  <div className="filter-group">
                    <label>Date To:</label>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="filter-input"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Reports Table */}
          <div className="reports-table-container">
            {loading ? (
              <div className="loading-state">
                <div className="loading-spinner"></div>
                <span>Loading attendance reports...</span>
              </div>
            ) : error ? (
              <div className="error-state">
                <span>⚠️ {error}</span>
                <button onClick={fetchAttendanceReports} className="retry-btn">
                  Try Again
                </button>
              </div>
            ) : attendanceReports.length === 0 ? (
              <div className="empty-state">
                <FaFileExcel className="empty-icon" />
                <h3>No Attendance Reports Found</h3>
                <p>No attendance reports match your current filters.</p>
                <button onClick={clearFilters} className="clear-filters-btn">
                  Clear Filters
                </button>
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="reports-table">
                  <thead>
                    <tr>
                      <th 
                        className="sortable"
                        onClick={() => handleSort('projectName')}
                      >
                        Project Name {getSortIcon('projectName')}
                      </th>
                      <th 
                        className="sortable"
                        onClick={() => handleSort('originalName')}
                      >
                        File Name {getSortIcon('originalName')}
                      </th>
                      <th 
                        className="sortable"
                        onClick={() => handleSort('location')}
                      >
                        Location {getSortIcon('location')}
                      </th>
                      <th 
                        className="sortable"
                        onClick={() => handleSort('uploadedByName')}
                      >
                        Uploaded By {getSortIcon('uploadedByName')}
                      </th>
                      <th 
                        className="sortable"
                        onClick={() => handleSort('generatedAt')}
                      >
                        Generated At {getSortIcon('generatedAt')}
                      </th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceReports.map((report) => (
                      <tr key={report._id} className="report-row">
                        <td className="project-name">
                          <div className="project-info">
                            <span className="project-title">{report.projectName}</span>
                            <div className="project-dates">
                              <small>
                                {formatDate(report.projectStartDate)} - {formatDate(report.projectEndDate)}
                              </small>
                            </div>
                          </div>
                        </td>
                        <td className="file-name">
                          <div className="file-info">
                            <FaFileExcel className="file-icon" />
                            <span>{report.originalName}</span>
                          </div>
                        </td>
                        <td className="location">
                          <div className="location-info">
                            <FaMapMarkerAlt className="location-icon" />
                            <span>{report.location}</span>
                          </div>
                        </td>
                        <td className="uploaded-by">
                          <div className="user-info">
                            <FaUser className="user-icon" />
                            <span>{report.uploadedByName || 'Unknown'}</span>
                          </div>
                        </td>
                        <td className="generated-at">
                          <div className="date-info">
                            <FaClock className="date-icon" />
                            <span>{formatDate(report.generatedAt)}</span>
                          </div>
                        </td>
                        <td className="actions">
                          <div className="action-buttons">
                            <button
                              className="action-btn view-btn"
                              title="View Report"
                              onClick={() => {
                                // TODO: Implement view functionality
                                console.log('View report:', report._id);
                              }}
                            >
                              <FaEye />
                            </button>
                            <button
                              className="action-btn download-btn"
                              title="Download Report"
                              onClick={() => {
                                // TODO: Implement download functionality
                                console.log('Download report:', report._id);
                              }}
                            >
                              <FaDownload />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default HrAttendance;
