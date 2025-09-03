// Hr_ManpowerList.jsx
// This is your updated React component with fixed layout, horizontal pagination, and visible controls

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AppHeader from '../layout/AppHeader';
import { Search, Filter, Download, Upload, Plus, RefreshCw, X } from 'lucide-react';
import api from '../../api/axiosInstance';
import '../style/hr_style/Hr_ManpowerList.css';
// Nav icons
import {
  FaTachometerAlt,
  FaComments,
  FaUsers,
  FaExchangeAlt,
  FaProjectDiagram,
  FaClipboardList,
  FaChartBar,
  FaCalendarAlt,
  FaArrowRight,
  FaUserPlus,
  FaUserCheck,
  FaUserClock,
  FaExclamationTriangle,
  FaSync,
  FaProjectDiagram as FaReassign
} from 'react-icons/fa';

const ITEMS_PER_PAGE = 10;

function ManpowerRow({ manpower, onReassignClick }) {
  // Determine if manpower is on loan
  const isOnLoan = manpower.currentLoan && manpower.currentLoan.returnDate && new Date(manpower.currentLoan.returnDate) > new Date();
  
  // Get status display
  const getStatusDisplay = () => {
    if (isOnLoan) {
      return {
        status: 'On Loan',
        className: 'status-on-loan',
        tooltip: `Lent to ${manpower.currentLoan.projectName} until ${new Date(manpower.currentLoan.returnDate).toLocaleDateString()}`
      };
    }
    
    return {
      status: manpower.status || 'Unknown',
      className: manpower.status?.toLowerCase() === 'active' ? 'status-active' : 'status-inactive',
      tooltip: manpower.status || 'Unknown'
    };
  };

  const statusInfo = getStatusDisplay();

  return (
    <div className="manpower-row">
      <div className="manpower-info">
        <div className="manpower-details">
          <h4 className="manpower-name">{manpower.name}</h4>
          <p className="manpower-position">{manpower.position}</p>
        </div>
      </div>
      <div className="manpower-project">
        {isOnLoan ? (
          <div className="loan-project-info">
            <span className="project-name loan-project">{manpower.currentLoan.projectName}</span>
            <span className="loan-duration">Until {new Date(manpower.currentLoan.returnDate).toLocaleDateString()}</span>
          </div>
        ) : (
          <div className="assigned-project-info">
            <span className="project-name">{manpower.project || 'Unassigned'}</span>
            {manpower.project && (
              <span className="project-location">{manpower.location || 'Location N/A'}</span>
            )}
          </div>
        )}
      </div>
      <div className="manpower-status">
        <span 
          className={`status-badge ${statusInfo.className}`}
          title={statusInfo.tooltip}
        >
          {statusInfo.status}
        </span>
      </div>
      <div className="manpower-actions">
        <button 
          className="action-btn reassign-btn" 
          title="Reassign to Project"
          onClick={() => onReassignClick(manpower)}
          disabled={isOnLoan}
        >
          <FaReassign />
        </button>
        <button className="action-btn edit-btn" title="Edit">
          <FaUserPlus />
        </button>
      </div>
    </div>
  );
}

function Pagination({ currentPage, totalPages, totalEntries, onPageChange, showingRange }) {
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
    <div className="pagination-wrapper">
      <span className="pagination-info">
        Showing {showingRange.start} to {showingRange.end} of {totalEntries} entries
      </span>
      <div className="pagination">
        <button 
          className="pagination-btn" 
          onClick={() => onPageChange(currentPage - 1)} 
          disabled={currentPage === 1}
        >
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
        <button 
          className="pagination-btn" 
          onClick={() => onPageChange(currentPage + 1)} 
          disabled={currentPage === totalPages}
        >
          &gt;
        </button>
      </div>
    </div>
  );
}

export default function HrManpowerList() {
  const [manpowers, setManpowers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [positionFilter, setPositionFilter] = useState('all');
  // Removed local header collapse/profile state (handled by AppHeader)
  const [reassignModalOpen, setReassignModalOpen] = useState(false);
  const [selectedManpower, setSelectedManpower] = useState(null);
  const [projects, setProjects] = useState([]);
  const [reassigning, setReassigning] = useState(false);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  // User state
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('token') || "");
  const [userId, setUserId] = useState(() => user?._id);
  const [userName, setUserName] = useState(user?.name || 'HR Manager');
  const [userRole, setUserRole] = useState(user?.role || '');

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

  useEffect(() => {
    setUserName(user?.name || 'HR Manager');
    setUserRole(user?.role || '');
  }, [user]);

  // Redirect to login if not logged in
  useEffect(() => {
    if (!token || !userId) {
      navigate('/');
      return;
    }
  }, [token, userId, navigate]);

  // Removed scroll collapse effect

  // Fetch manpower data with loan information
  useEffect(() => {
    const fetchManpower = async () => {
      try {
        setLoading(true);
        
        // Fetch manpower data
        const { data: manpowerData } = await api.get('/manpower', {
          headers: { Authorization: `Bearer ${token}` }
        });

        // Fetch active loan requests
        const { data: loanRequests } = await api.get('/manpower-requests', {
          headers: { Authorization: `Bearer ${token}` }
        });

        // Process manpower data with loan information
        const processedManpower = manpowerData.map(manpower => {
          // Find active loan for this manpower
          const activeLoan = loanRequests.find(loan => 
            loan.manpowerProvided && 
            loan.manpowerProvided.includes(manpower._id) &&
            loan.returnDate && 
            new Date(loan.returnDate) > new Date() &&
            loan.status === 'Approved'
          );

          return {
            ...manpower,
            currentLoan: activeLoan ? {
              projectName: activeLoan.project?.projectName || 'Unknown Project',
              returnDate: activeLoan.returnDate,
              requestId: activeLoan._id
            } : null
          };
        });

        setManpowers(processedManpower);
        setError(null);
      } catch (err) {
        console.error('Error fetching manpower:', err);
        setError('Failed to load manpower data');
        setManpowers([]);
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchManpower();
    }
  }, [token]);

  // Fetch projects for reassignment
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const { data } = await api.get('/projects', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setProjects(data);
      } catch (err) {
        console.error('Error fetching projects:', err);
      }
    };

    if (token) {
      fetchProjects();
    }
  }, [token]);

  // Handle reassign modal open
  const handleReassignClick = (manpower) => {
    setSelectedManpower(manpower);
    setReassignModalOpen(true);
  };

  // Handle reassign manpower
  const handleReassign = async (newProjectId) => {
    if (!selectedManpower || !newProjectId) return;

    setReassigning(true);
    try {
      // Update manpower assignment
      await api.put(`/manpower/${selectedManpower._id}`, {
        assignedProject: newProjectId === 'unassign' ? null : newProjectId
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Log the reassignment action
      const selectedProject = projects.find(p => p._id === newProjectId);
      await api.post('/audit-logs', {
        action: 'MANPOWER_REASSIGNED',
        performedBy: userId,
        performedByRole: userRole,
        description: `Reassigned ${selectedManpower.name} ${newProjectId === 'unassign' ? 'to unassigned' : `to ${selectedProject?.projectName || 'unknown project'}`}`,
        meta: {
          manpowerId: selectedManpower._id,
          manpowerName: selectedManpower.name,
          previousProject: selectedManpower.assignedProject,
          newProject: newProjectId === 'unassign' ? null : newProjectId
        }
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Refresh manpower data
      const refreshManpower = async () => {
        try {
          setLoading(true);
          
          const { data: manpowerData } = await api.get('/manpower', {
            headers: { Authorization: `Bearer ${token}` }
          });

          const { data: loanRequests } = await api.get('/manpower-requests', {
            headers: { Authorization: `Bearer ${token}` }
          });

          const processedManpower = manpowerData.map(manpower => {
            const activeLoan = loanRequests.find(loan => 
              loan.manpowerProvided && 
              loan.manpowerProvided.includes(manpower._id) &&
              loan.returnDate && 
              new Date(loan.returnDate) > new Date() &&
              loan.status === 'Approved'
            );

            return {
              ...manpower,
              currentLoan: activeLoan ? {
                projectName: activeLoan.project?.projectName || 'Unknown Project',
                returnDate: activeLoan.returnDate,
                requestId: activeLoan._id
              } : null
            };
          });

          setManpowers(processedManpower);
          setError(null);
        } catch (err) {
          console.error('Error fetching manpower:', err);
          setError('Failed to load manpower data');
          setManpowers([]);
        } finally {
          setLoading(false);
        }
      };

      await refreshManpower();
      setReassignModalOpen(false);
      setSelectedManpower(null);
    } catch (err) {
      console.error('Error reassigning manpower:', err);
      alert('Failed to reassign manpower. Please try again.');
    } finally {
      setReassigning(false);
    }
  };

  // Filtered and paginated data
  const filteredManpowers = useMemo(() => {
    let filtered = manpowers;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(mp => 
        mp.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        mp.position?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        mp.employeeId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        mp.project?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(mp => mp.status?.toLowerCase() === statusFilter.toLowerCase());
    }

    // Position filter
    if (positionFilter !== 'all') {
      filtered = filtered.filter(mp => mp.position?.toLowerCase() === positionFilter.toLowerCase());
    }

    return filtered;
  }, [manpowers, searchTerm, statusFilter, positionFilter]);

  const totalPages = Math.ceil(filteredManpowers.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentManpowers = filteredManpowers.slice(startIndex, endIndex);

  const showingRange = {
    start: filteredManpowers.length > 0 ? startIndex + 1 : 0,
    end: Math.min(endIndex, filteredManpowers.length)
  };

  // Get unique positions for filter
  const uniquePositions = useMemo(() => {
    const positions = [...new Set(manpowers.map(mp => mp.position).filter(Boolean))];
    return positions.sort();
  }, [manpowers]);

  // Get status counts
  const statusCounts = useMemo(() => {
    const counts = { active: 0, inactive: 0, total: manpowers.length };
    manpowers.forEach(mp => {
      if (mp.status?.toLowerCase() === 'active') counts.active++;
      else if (mp.status?.toLowerCase() === 'inactive') counts.inactive++;
    });
    return counts;
  }, [manpowers]);

  // Handle page change
  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Handle CSV upload
  const handleCSVUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Implementation for CSV upload
      console.log('CSV upload:', file);
      alert('CSV upload feature coming soon!');
    }
  };

  // Handle logout
  const handleLogout = () => {
    api.post('/auth/logout', {}, {
      headers: { Authorization: `Bearer ${token}` }
    }).finally(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
      setUser(null);
      setUserId(undefined);
      setToken("");
      window.dispatchEvent(new Event('storage'));
    navigate('/');
    });
  };

  // Removed legacy profile menu outside click

  return (
    <div className="dashboard-container">
      <AppHeader
        roleSegment="hr"
        onLogout={handleLogout}
        overrideNav={[
          { to:'/hr', label:'Dashboard', icon:<FaTachometerAlt/>, match:'/hr' },
          { to:'/hr/chat', label:'Chat', icon:<FaComments/>, match:'/hr/chat' },
          { to:'/hr/mlist', label:'Manpower', icon:<FaUsers/>, match:'/hr/mlist' },
          { to:'/hr/movement', label:'Movement', icon:<FaExchangeAlt/>, match:'/hr/movement' },
          { to:'/hr/project-records', label:'Projects', icon:<FaProjectDiagram/>, match:'/hr/project-records' },
          // Requests & Reports removed
        ]}
      />

      {/* Main Content */}
      <main className="dashboard-main">
        <div className="manpower-container">
          {/* Page Header */}
          <div className="page-header">
            <div className="page-title-section">
              <h1 className="page-title">Manpower Management</h1>
              <p className="page-subtitle">Manage and track all staff members across projects</p>
            </div>
            <div className="page-actions">
              <button className="action-button primary" onClick={() => alert('Add new staff feature coming soon!')}>
                <FaUserPlus />
                <span>Add Staff</span>
              </button>
              <button className="action-button secondary" onClick={() => fileInputRef.current?.click()}>
                <Upload />
                <span>Import CSV</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleCSVUpload}
                style={{ display: 'none' }}
              />
            </div>
          </div>

                    {/* Stats Overview */}
          <div className="stats-overview">
            <div className="stat-card total">
              <div className="stat-icon">
                <FaUsers />
              </div>
              <div className="stat-content">
                <span className="stat-value">{statusCounts.total}</span>
                <span className="stat-label">Total Staff</span>
              </div>
            </div>
            <div className="stat-card active">
              <div className="stat-icon">
                <FaUserCheck />
              </div>
              <div className="stat-content">
                <span className="stat-value">{statusCounts.active}</span>
                <span className="stat-label">Active</span>
              </div>
            </div>
            <div className="stat-card inactive">
              <div className="stat-icon">
                <FaUserClock />
              </div>
              <div className="stat-content">
                <span className="stat-value">{statusCounts.inactive}</span>
                <span className="stat-label">Available</span>
              </div>
            </div>
          </div>

          {/* Filters and Search */}
          <div className="filters-section">
            <div className="search-box">
              <Search className="search-icon" />
              <input
                type="text"
                placeholder="Search by name, position, ID, or project..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>
            <div className="filter-controls">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="filter-select"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <select
                value={positionFilter}
                onChange={(e) => setPositionFilter(e.target.value)}
                className="filter-select"
              >
                <option value="all">All Positions</option>
                {uniquePositions.map(position => (
                  <option key={position} value={position}>{position}</option>
                ))}
              </select>
              <button className="refresh-btn" onClick={() => window.location.reload()}>
                <RefreshCw />
              </button>
            </div>
          </div>

          {/* Manpower List */}
          <div className="manpower-list-container">
            {loading ? (
              <div className="loading-state">
                <div className="loading-spinner"></div>
                <span>Loading manpower data...</span>
              </div>
            ) : error ? (
              <div className="error-state">
                <FaExclamationTriangle />
                <span>{error}</span>
              </div>
            ) : currentManpowers.length === 0 ? (
              <div className="empty-state">
                <FaUsers />
                <span>No manpower found matching your criteria</span>
                </div>
              ) : (
              <>
                <div className="manpower-list">
                  {currentManpowers.map((manpower) => (
                    <ManpowerRow 
                      key={manpower._id} 
                      manpower={manpower} 
                      onReassignClick={handleReassignClick}
                    />
                  ))}
            </div>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
                  totalEntries={filteredManpowers.length}
              onPageChange={handlePageChange}
                  showingRange={showingRange}
            />
              </>
            )}
          </div>
        </div>
      </main>

      {/* Reassign Modal */}
      {reassignModalOpen && selectedManpower && (
        <div className="reassign-modal-overlay" onClick={() => setReassignModalOpen(false)}>
          <div className="reassign-modal" onClick={(e) => e.stopPropagation()}>
            <div className="reassign-modal-header">
              <h3>Reassign {selectedManpower.name}</h3>
              <button 
                className="reassign-modal-close" 
                onClick={() => setReassignModalOpen(false)}
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="reassign-modal-content">
              <div className="current-assignment">
                <h4>Current Assignment:</h4>
                <p>{selectedManpower.project || 'Unassigned'}</p>
                {selectedManpower.location && (
                  <p className="location">Location: {selectedManpower.location}</p>
                )}
              </div>

              <div className="new-assignment">
                <h4>Select New Project:</h4>
                <div className="project-options">
                  <button 
                    className="project-option unassign"
                    onClick={() => handleReassign('unassign')}
                    disabled={reassigning}
                  >
                    <div className="project-info">
                      <span className="project-name">Unassign</span>
                      <span className="project-description">Remove from current project</span>
                    </div>
                  </button>
                  
                  {projects.map(project => (
                    <button
                      key={project._id}
                      className={`project-option ${selectedManpower.assignedProject === project._id ? 'current' : ''}`}
                      onClick={() => handleReassign(project._id)}
                      disabled={reassigning || selectedManpower.assignedProject === project._id}
                    >
                      <div className="project-info">
                        <span className="project-name">{project.projectName}</span>
                        <span className="project-description">{project.location || 'No location specified'}</span>
                        {selectedManpower.assignedProject === project._id && (
                          <span className="current-badge">Current</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {reassigning && (
                <div className="reassigning-indicator">
                  <div className="loading-spinner"></div>
                  <span>Reassigning...</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
