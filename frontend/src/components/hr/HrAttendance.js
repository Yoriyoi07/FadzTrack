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
  FaSort,
  FaSortUp,
  FaSortDown,
  FaFileExcel,
  FaUser,
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
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  // Redirect to login if not logged in
  useEffect(() => {
    if (!token || !userId) {
      navigate('/');
      return;
    }
  }, [token, userId, navigate]);

  // Fetch projects for dropdown
  const fetchProjects = useCallback(async () => {
    if (!token) return;

    try {
      const { data } = await api.get('/projects', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProjects(data || []);
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  }, [token]);

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
      if (selectedProject) params.append('projectId', selectedProject);
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
  }, [token, searchTerm, dateFrom, dateTo, selectedProject, sortBy, sortOrder]);

  useEffect(() => {
    console.log('HrAttendance component mounted, fetching reports...');
    fetchProjects();
    fetchAttendanceReports();
  }, [fetchProjects, fetchAttendanceReports]);

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
    setSelectedProject('');
    setDateFilter('');
    setSortBy('generatedAt');
    setSortOrder('desc');
  };

  // Handle date filter selection
  const handleDateFilter = (filter) => {
    setDateFilter(filter);
    const now = new Date();
    
    switch (filter) {
      case 'today':
        setDateFrom(now.toISOString().split('T')[0]);
        setDateTo(now.toISOString().split('T')[0]);
        break;
      case 'week':
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        setDateFrom(weekAgo.toISOString().split('T')[0]);
        setDateTo(now.toISOString().split('T')[0]);
        break;
      case 'month':
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        setDateFrom(monthAgo.toISOString().split('T')[0]);
        setDateTo(now.toISOString().split('T')[0]);
        break;
      case 'custom':
        // Keep existing dateFrom/dateTo values
        break;
      default:
        setDateFrom('');
        setDateTo('');
    }
  };

  // Handle sort by date (recent/oldest)
  const handleSortByDate = (order) => {
    setSortBy('generatedAt');
    setSortOrder(order);
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
            <div className="filters-row">
              <div className="search-bar">
                <FaSearch className="search-icon" />
                <input
                  type="text"
                  placeholder="Search anything in the list..."
                  value={searchTerm}
                  onChange={handleSearch}
                  className="search-input"
                />
              </div>
              
              <div className="filter-controls">
                {/* Recent/Oldest Filter */}
                <div className="date-sort-buttons">
                  <button
                    className={`sort-btn ${sortBy === 'generatedAt' && sortOrder === 'desc' ? 'active' : ''}`}
                    onClick={() => handleSortByDate('desc')}
                    title="Most Recent"
                  >
                    Recent
                  </button>
                  <button
                    className={`sort-btn ${sortBy === 'generatedAt' && sortOrder === 'asc' ? 'active' : ''}`}
                    onClick={() => handleSortByDate('asc')}
                    title="Oldest First"
                  >
                    Oldest
                  </button>
                </div>

                {/* Project Filter Dropdown */}
                <select
                  className="project-filter"
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                >
                  <option value="">All Projects</option>
                  {projects.map(project => (
                    <option key={project._id} value={project._id}>
                      {project.projectName}
                    </option>
                  ))}
                </select>

                {/* Date Range Filter */}
                <div className="date-filter-dropdown">
                  <select
                    className="date-filter-select"
                    value={dateFilter}
                    onChange={(e) => handleDateFilter(e.target.value)}
                  >
                    <option value="">All Time</option>
                    <option value="today">Today</option>
                    <option value="week">Last 7 Days</option>
                    <option value="month">Last 30 Days</option>
                    <option value="custom">Custom Range</option>
                  </select>
                </div>
                
                <button className="clear-filters" onClick={clearFilters}>
                  Clear All
                </button>
              </div>
            </div>

            {/* Custom Date Range (shown when custom is selected) */}
            {dateFilter === 'custom' && (
              <div className="custom-date-range">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="date-input"
                  placeholder="From"
                />
                <span>to</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="date-input"
                  placeholder="To"
                />
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
                              className="action-btn download-btn"
                              title="Download AI Attendance Report"
                              onClick={async () => {
                                try {
                                  const { data } = await api.get(`/projects/${report.projectId}/attendance-signed-url`, {
                                    params: { path: report.outputPath },
                                    headers: { Authorization: `Bearer ${token}` }
                                  });
                                  if (data?.signedUrl) {
                                    window.open(data.signedUrl, '_blank');
                                  }
                                } catch (error) {
                                  console.error('Error downloading report:', error);
                                  alert('Failed to download report');
                                }
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
