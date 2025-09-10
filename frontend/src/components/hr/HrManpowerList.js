// Hr_ManpowerList.jsx
// This is your updated React component with fixed layout, horizontal pagination, and visible controls

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AppHeader from '../layout/AppHeader';
import { Search, Filter, Download, Upload, Plus, RefreshCw, X } from 'lucide-react';
import api from '../../api/axiosInstance';
import Papa from 'papaparse';
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

function ManpowerRow({ manpower, onReassignClick, onEditClick }) {
  const isOnLoan = manpower.currentLoan && manpower.currentLoan.returnDate && new Date(manpower.currentLoan.returnDate) > new Date();
  const locationDisplay = typeof manpower.location === 'string' ? manpower.location : (manpower.location && manpower.location.name ? manpower.location.name : '');
  return (
    <tr className="mp-row">
      <td className="col-emp">
        <div className="emp-name">{manpower.name}</div>
        <div className="emp-pos">{manpower.position}</div>
      </td>
      <td className="col-project">
        {isOnLoan ? (
          <div className="loan-wrapper">
            <span className="loan-project">{manpower.currentLoan.projectName}</span>
            <span className="loan-until">Until {new Date(manpower.currentLoan.returnDate).toLocaleDateString()}</span>
          </div>
        ) : manpower.project ? (
          <div className="project-wrapper">
            <Link
              to={`/hr/project-records/${manpower.assignedProject?._id || manpower.assignedProject || ''}`}
              className="project-name project-link"
              onClick={e => { if(!manpower.assignedProject) e.preventDefault(); }}
            >{manpower.project}</Link>
            {locationDisplay && <span className="project-location">{locationDisplay}</span>}
          </div>
        ) : (
          <span className="project-name unassigned">Unassigned</span>
        )}
      </td>
      <td className="col-actions">
        <div className="manpower-actions">
          <button className="action-btn reassign-btn" title="Reassign to Project" onClick={() => onReassignClick(manpower)} disabled={isOnLoan}>
            <FaReassign />
          </button>
          <button className="action-btn edit-btn" title="Edit Manpower" onClick={() => onEditClick(manpower)}>
            <FaUserPlus />
          </button>
        </div>
      </td>
    </tr>
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
  // Removed status filter (UI shows no status column)
  const [positionFilter, setPositionFilter] = useState('all');
  // Assignment sort: none | assignedFirst | unassignedFirst
  const [assignmentSort, setAssignmentSort] = useState('none');
  // Removed local header collapse/profile state (handled by AppHeader)
  const [reassignModalOpen, setReassignModalOpen] = useState(false);
  const [selectedManpower, setSelectedManpower] = useState(null);
  const [editingManpower, setEditingManpower] = useState(null);
  const [editForm, setEditForm] = useState({ name:'', position:'' });
  const [savingEdit, setSavingEdit] = useState(false);
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

  // assignedProject presence (non-null) now drives Assigned/Unassigned logic on UI
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

  // Open edit modal
  useEffect(() => {
    if (editingManpower) {
      setEditForm({
        name: editingManpower.name || '',
        position: editingManpower.position || ''
      });
    }
  }, [editingManpower]);

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm(f => ({ ...f, [name]: value }));
  };

  const saveEdit = async () => {
    if (!editingManpower) return;
    if (!editForm.name.trim() || !editForm.position.trim()) {
      alert('Name and Position are required');
      return;
    }
    setSavingEdit(true);
    try {
      await api.put(`/manpower/${editingManpower._id}`, {
        name: editForm.name.trim(),
        position: editForm.position.trim()
      }, { headers: { Authorization: `Bearer ${token}` } });
      // Refresh list quickly in memory
      setManpowers(prev => prev.map(mp => mp._id === editingManpower._id ? { ...mp, ...editForm } : mp));
      setEditingManpower(null);
    } catch (err) {
      console.error('Edit manpower failed:', err);
      alert('Failed to save changes');
    } finally {
      setSavingEdit(false);
    }
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

    // Position filter
    if (positionFilter !== 'all') {
      filtered = filtered.filter(mp => mp.position?.toLowerCase() === positionFilter.toLowerCase());
    }

    // Assignment sort (pure sort, does not filter)
    if (assignmentSort !== 'none') {
      filtered = [...filtered].sort((a, b) => {
        const aAssigned = !!a.assignedProject;
        const bAssigned = !!b.assignedProject;
        if (assignmentSort === 'assignedFirst') {
          // Return assigned before unassigned
            if (aAssigned === bAssigned) return 0;
            return aAssigned ? -1 : 1;
        } else if (assignmentSort === 'unassignedFirst') {
            if (aAssigned === bAssigned) return 0;
            return aAssigned ? 1 : -1;
        }
        return 0;
      });
    }

    return filtered;
  }, [manpowers, searchTerm, positionFilter, assignmentSort]);

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
    const counts = { assigned: 0, unassigned: 0, total: manpowers.length };
    manpowers.forEach(mp => {
      if (mp.assignedProject) counts.assigned++; else counts.unassigned++;
    });
    return counts;
  }, [manpowers]);

  // Removed enrichment & fallback logic per request (project must come from backend directly)

  // Handle page change
  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Handle CSV upload
  const handleCSVUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async function(results) {
          const parsedData = results.data;
          const errors = results.errors;

          if (errors.length > 0) {
            alert(`CSV Upload Error: ${errors[0].message}`);
            return;
          }

          if (parsedData.length === 0) {
            alert('No data found in CSV file.');
            return;
          }

          const newManpowers = [];
          const invalidRows = [];

          parsedData.forEach(row => {
            const name = row['Name'] || row['name'] || '';
            const position = row['Position'] || row['position'] || '';
            const status = row['Status'] || row['status'] || 'Active';
            const project = row['Project'] || row['project'] || '';

            if (!name || !position) {
              invalidRows.push(row);
              return;
            }

            newManpowers.push({
              name: name,
              position: position,
              status: status,
              project: project,
              location: '', // Default to empty for now
              employeeId: '', // Default to empty for now
              assignedProject: project, // Assign project as default
              currentLoan: null, // No loan information for new manpowers
            });
          });

          if (invalidRows.length > 0) {
            alert(`Skipped ${invalidRows.length} rows due to missing 'Name' or 'Position':\n${invalidRows.map(row => JSON.stringify(row)).join('\n')}`);
          }

          if (newManpowers.length > 0) {
            setLoading(true);
            setError(null);
            try {
              // Create manpower entries individually
              const createdManpowers = [];
              for (const mp of newManpowers) {
                const { data } = await api.post('/manpower', {
                  name: mp.name,
                  position: mp.position,
                  status: mp.status || 'Active',
                  assignedProject: null // Will be handled separately if project assignment is needed
                }, {
                  headers: { Authorization: `Bearer ${token}` }
                });
                createdManpowers.push(data);
              }
              
              alert(`Successfully imported ${createdManpowers.length} manpowers.`);
              window.location.reload(); // Refresh the page to show updated data
            } catch (err) {
              console.error('Error importing manpowers:', err);
              setError('Failed to import manpowers. Please try again.');
            } finally {
              setLoading(false);
            }
          } else {
            alert('No valid manpower data found in CSV file.');
          }
        },
        error: function(err) {
          console.error('CSV Parsing Error:', err);
          alert('Error parsing CSV file. Please ensure it is a valid CSV and try again.');
        }
      });
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
          { to:'/hr/dash', label:'Dashboard', icon:<FaTachometerAlt/>, match:'/hr/dash' },
          { to:'/hr/chat', label:'Chat', icon:<FaComments/>, match:'/hr/chat' },
          { to:'/hr/mlist', label:'Manpower', icon:<FaUsers/>, match:'/hr/mlist' },
          { to:'/hr/movement', label:'Movement', icon:<FaExchangeAlt/>, match:'/hr/movement' },
          { to:'/hr/project-records', label:'Projects', icon:<FaProjectDiagram/>, match:'/hr/project-records' },
          { to:'/hr/attendance', label:'Attendance', icon:<FaCalendarAlt/>, match:'/hr/attendance' }
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
              <button 
                className="action-button info" 
                onClick={() => alert('CSV Format:\n\nRequired columns:\n- Name (required)\n- Position (required)\n\nOptional columns:\n- Status (defaults to "Active" if empty)\n- Project (defaults to "Unassigned" if empty)\n\nExample:\nName,Position,Status,Project\nJohn Doe,Engineer,Active,Project A\nJane Smith,Manager,,Project B')}
                style={{ marginLeft: '10px', backgroundColor: '#17a2b8', borderColor: '#17a2b8' }}
              >
                <span>CSV Format</span>
              </button>
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
                <span className="stat-label">Total Manpower</span>
              </div>
            </div>
            <div className="stat-card active">
              <div className="stat-icon">
                <FaUserCheck />
              </div>
              <div className="stat-content">
                <span className="stat-value">{statusCounts.assigned}</span>
                <span className="stat-label">Assigned</span>
              </div>
            </div>
            <div className="stat-card inactive">
              <div className="stat-icon">
                <FaUserClock />
              </div>
              <div className="stat-content">
                <span className="stat-value">{statusCounts.unassigned}</span>
                <span className="stat-label">Unassigned</span>
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
              {/* Status filter removed */}
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
              <select
                value={assignmentSort}
                onChange={(e) => setAssignmentSort(e.target.value)}
                className="filter-select"
                style={{ minWidth:'150px' }}
              >
                <option value="none">No Sort</option>
                <option value="assignedFirst">Assigned First</option>
                <option value="unassignedFirst">Unassigned First</option>
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
                <div className="manpower-table-wrapper">
                  <table className="manpower-table">
                    <thead>
                      <tr>
                        <th>Employee</th>
                        <th>Project / Loan</th>
                        <th style={{textAlign:'center'}}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentManpowers.map(mp => (
                        <ManpowerRow key={mp._id} manpower={mp} onReassignClick={handleReassignClick} onEditClick={setEditingManpower} />
                      ))}
                    </tbody>
                  </table>
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
                {(() => { const loc = selectedManpower.location; const disp = typeof loc === 'string' ? loc : (loc && loc.name ? loc.name : ''); return disp ? <p className="location">Location: {disp}</p> : null; })()}
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
                        <span className="project-description">{ (typeof project.location === 'string' ? project.location : (project.location && project.location.name ? project.location.name : 'No location specified')) || 'No location specified'}</span>
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
      {/* Edit Manpower Modal */}
      {editingManpower && (
        <div className="reassign-modal-overlay" onClick={() => !savingEdit && setEditingManpower(null)}>
          <div className="reassign-modal" onClick={(e) => e.stopPropagation()}>
            <div className="reassign-modal-header">
              <h3>Edit {editingManpower.name}</h3>
              <button className="reassign-modal-close" onClick={() => !savingEdit && setEditingManpower(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="reassign-modal-content">
              <div className="current-assignment" style={{ marginBottom:'1rem' }}>
                <h4>Details</h4>
                <div className="edit-field-group">
                  <label>Name</label>
                  <input name="name" value={editForm.name} onChange={handleEditChange} />
                </div>
                <div className="edit-field-group">
                  <label>Position</label>
                  <input name="position" value={editForm.position} onChange={handleEditChange} />
                </div>
              </div>
              <div style={{ display:'flex', gap:'0.75rem', justifyContent:'flex-end' }}>
                <button className="action-button secondary" disabled={savingEdit} onClick={() => setEditingManpower(null)}>Cancel</button>
                <button className="action-button primary" disabled={savingEdit} onClick={saveEdit}>{savingEdit ? 'Saving...' : 'Save Changes'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
