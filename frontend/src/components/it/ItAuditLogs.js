import React, { useEffect, useState } from "react";
import api from '../../api/axiosInstance';
import { useNavigate, Link } from 'react-router-dom';
import '../style/it_style/It_Dash.css';
// Nav icons
import { FaTachometerAlt, FaComments, FaBoxes, FaUsers, FaClipboardList, FaFileExport, FaDownload } from 'react-icons/fa';

const ItAuditLog = () => {
  const navigate = useNavigate();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  // User state
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('token') || "");
  const [userId, setUserId] = useState(() => user?._id);
  const [userName, setUserName] = useState(user?.name || 'IT Manager');
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
    setUserName(user?.name || 'IT Manager');
    setUserRole(user?.role || '');
  }, [user]);

  // Scroll handler for header collapse
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const shouldCollapse = scrollTop > 50;
      setIsHeaderCollapsed(shouldCollapse);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isHeaderCollapsed]);

  useEffect(() => {
    api.get('/audit-logs') // Adjust endpoint if you have a specific IT audit logs endpoint
      .then((res) => {
        setLogs(res.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest(".user-profile")) {
        setProfileMenuOpen(false);
      }
    };

    document.addEventListener("click", handleClickOutside);

    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, []);

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

  // Filter logic
  const filteredLogs = logs.filter((log) => {
    const logDate = new Date(log.timestamp);
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate + 'T23:59:59') : null; // Include the entire end date
    
    // Date filter logic
    const dateFilter = (!start || logDate >= start) && (!end || logDate <= end);
    
    return (
      dateFilter &&
      (!roleFilter || log.performedByRole?.toLowerCase().includes(roleFilter.toLowerCase())) &&
      (!actionFilter || log.action?.toLowerCase().includes(actionFilter.toLowerCase())) &&
      (
        !search ||
        log.description?.toLowerCase().includes(search.toLowerCase()) ||
        log.performedBy?.name?.toLowerCase().includes(search.toLowerCase()) ||
        log.performedByRole?.toLowerCase().includes(search.toLowerCase()) ||
        log.action?.toLowerCase().includes(search.toLowerCase())
      )
    );
  });

  // Helper function for action colors
  const getActionColor = (action) => {
    const actionLower = action?.toLowerCase();
    switch (actionLower) {
      case 'login':
        return '#10b981'; // Green
      case 'logout':
        return '#ef4444'; // Red
      case 'upload file':
        return '#8b5cf6'; // Purple
      case 'submit report':
        return '#06b6d4'; // Cyan
      case 'submit material request':
      case 'submit manpower request':
        return '#3b82f6'; // Blue
      case 'edit material request':
      case 'edit manpower request':
        return '#f59e0b'; // Yellow
      case 'delete material request':
      case 'delete manpower request':
      case 'delete project':
        return '#dc2626'; // Red
      case 'create new project':
      case 'add new project':
        return '#059669'; // Green
      case 'approve':
        return '#059669'; // Green
      case 'reject':
        return '#dc2626'; // Red
      default:
        return '#6b7280'; // Gray
    }
  };

  // Export functions
  const handleExport = async () => {
    setExportLoading(true);
    try {
      await exportToCSV(filteredLogs);
      setExportModalOpen(false);
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export data. Please try again.');
    } finally {
      setExportLoading(false);
    }
  };

  const exportToCSV = async (data) => {
    const headers = [
      'Date/Time',
      'Action', 
      'Performed By',
      'Role',
      'Description',
      'Details'
    ];
    
    const rows = data.map(log => [
      new Date(log.timestamp).toLocaleString(),
      log.action || '',
      log.performedBy?.name || 'Unknown',
      log.performedByRole || '',
      log.description || '',
      JSON.stringify(log.meta || {})
    ]);
    
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Clear all filters
  const clearAllFilters = () => {
    setSearch("");
    setRoleFilter("");
    setActionFilter("");
    setStartDate("");
    setEndDate("");
  };

  return (
    <div className="dashboard-container">
      {/* Header */}
      <header className={`dashboard-header ${isHeaderCollapsed ? 'collapsed' : ''}`}>
        {/* Top Row: Logo, User Info, and Profile */}
        <div className="header-top">
          <div className="header-left">
            <div className="logo-container">
              <img src="/images/Fadz-logo.png" alt="FadzTrack Logo" className="logo-img" />
              <span className="brand-name">FadzTrack</span>
            </div>
          </div>

          <div className="header-right">
            <div className="user-profile">
              <div className="profile-info">
                <span className="user-name">{userName}</span>
                <span className="user-role">{userRole}</span>
              </div>
              <div className="profile-avatar" onClick={() => setProfileMenuOpen(!profileMenuOpen)}>
                {userName ? userName.charAt(0).toUpperCase() : 'I'}
              </div>
              {profileMenuOpen && (
                <div className="profile-dropdown">
                  <button onClick={handleLogout} className="dropdown-item">
                    <span>Logout</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Row: Navigation and Notifications */}
        <div className="header-bottom">
          <nav className="header-nav">
            <Link to="/it" className="nav-item">
              <FaTachometerAlt />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Dashboard</span>
            </Link>
            <Link to="/it/chat" className="nav-item">
              <FaComments />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Chat</span>
            </Link>
            <Link to="/it/material-list" className="nav-item">
              <FaBoxes />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Materials</span>
            </Link>
            <Link to="/it/manpower-list" className="nav-item">
              <FaUsers />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Manpower</span>
            </Link>
            <Link to="/it/auditlogs" className="nav-item active">
              <FaClipboardList />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Audit Logs</span>
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="dashboard-main">
        <div style={{ maxWidth: 1200, margin: "30px auto", padding: 24, background: "#fff", borderRadius: 12, boxShadow: "0 2px 16px #0001" }}>
          {/* Page Header */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginBottom: 24,
            borderBottom: '2px solid #f0f0f0',
            paddingBottom: 16
          }}>
            <div>
              <h2 style={{ 
                margin: 0, 
                fontSize: '28px', 
                fontWeight: '600', 
                color: '#1f2937',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <FaClipboardList style={{ color: '#3b82f6' }} />
                IT Audit Log
              </h2>
              <p style={{ 
                margin: '8px 0 0 0', 
                color: '#6b7280', 
                fontSize: '14px',
                fontWeight: '500'
              }}>
                Monitor and track all system activities and user actions
              </p>
            </div>
            <button 
              onClick={() => setExportModalOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 2px 4px rgba(59, 130, 246, 0.2)'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = '#2563eb';
                e.target.style.transform = 'translateY(-1px)';
                e.target.style.boxShadow = '0 4px 8px rgba(59, 130, 246, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = '#3b82f6';
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 2px 4px rgba(59, 130, 246, 0.2)';
              }}
            >
              <FaFileExport />
              Export Logs
            </button>
          </div>

                     {/* Search and Filters */}
           <div style={{ 
             display: "flex", 
             gap: 16, 
             marginBottom: 24, 
             flexWrap: "wrap",
             padding: '20px',
             backgroundColor: '#f8fafc',
             borderRadius: '12px',
             border: '1px solid #e2e8f0'
           }}>
             <div style={{ flex: 2, minWidth: 250 }}>
               <label style={{ 
                 display: 'block', 
                 marginBottom: '6px', 
                 fontSize: '14px', 
                 fontWeight: '500', 
                 color: '#374151' 
               }}>
                 Search
               </label>
               <input
                 placeholder="Search by description, user, role, or action..."
                 value={search}
                 onChange={e => setSearch(e.target.value)}
                 style={{ 
                   width: '100%',
                   padding: '12px 16px', 
                   borderRadius: '8px', 
                   border: "1px solid #d1d5db",
                   fontSize: '14px',
                   transition: 'all 0.2s ease',
                   outline: 'none'
                 }}
                 onFocus={(e) => {
                   e.target.style.borderColor = '#3b82f6';
                   e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                 }}
                 onBlur={(e) => {
                   e.target.style.borderColor = '#d1d5db';
                   e.target.style.boxShadow = 'none';
                 }}
               />
             </div>
             <div style={{ flex: 1, minWidth: 150 }}>
               <label style={{ 
                 display: 'block', 
                 marginBottom: '6px', 
                 fontSize: '14px', 
                 fontWeight: '500', 
                 color: '#374151' 
               }}>
                 Start Date
               </label>
               <input
                 type="date"
                 value={startDate}
                 onChange={e => setStartDate(e.target.value)}
                 style={{ 
                   width: '100%',
                   padding: '12px 16px', 
                   borderRadius: '8px', 
                   border: "1px solid #d1d5db",
                   fontSize: '14px',
                   transition: 'all 0.2s ease',
                   outline: 'none',
                   backgroundColor: 'white',
                   cursor: 'pointer'
                 }}
                 onFocus={(e) => {
                   e.target.style.borderColor = '#3b82f6';
                   e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                 }}
                 onBlur={(e) => {
                   e.target.style.borderColor = '#d1d5db';
                   e.target.style.boxShadow = 'none';
                 }}
               />
             </div>
             <div style={{ flex: 1, minWidth: 150 }}>
               <label style={{ 
                 display: 'block', 
                 marginBottom: '6px', 
                 fontSize: '14px', 
                 fontWeight: '500', 
                 color: '#374151' 
               }}>
                 End Date
               </label>
               <input
                 type="date"
                 value={endDate}
                 onChange={e => setEndDate(e.target.value)}
                 style={{ 
                   width: '100%',
                   padding: '12px 16px', 
                   borderRadius: '8px', 
                   border: "1px solid #d1d5db",
                   fontSize: '14px',
                   transition: 'all 0.2s ease',
                   outline: 'none',
                   backgroundColor: 'white',
                   cursor: 'pointer'
                 }}
                 onFocus={(e) => {
                   e.target.style.borderColor = '#3b82f6';
                   e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                 }}
                 onBlur={(e) => {
                   e.target.style.borderColor = '#d1d5db';
                   e.target.style.boxShadow = 'none';
                 }}
               />
             </div>
                         <div style={{ flex: 1, minWidth: 150 }}>
               <label style={{ 
                 display: 'block', 
                 marginBottom: '6px', 
                 fontSize: '14px', 
                 fontWeight: '500', 
                 color: '#374151' 
               }}>
                 Role Filter
               </label>
               <select
                 value={roleFilter}
                 onChange={e => setRoleFilter(e.target.value)}
                 style={{ 
                   width: '100%',
                   padding: '12px 16px', 
                   borderRadius: '8px', 
                   border: "1px solid #d1d5db",
                   fontSize: '14px',
                   transition: 'all 0.2s ease',
                   outline: 'none',
                   backgroundColor: 'white',
                   cursor: 'pointer'
                 }}
                 onFocus={(e) => {
                   e.target.style.borderColor = '#3b82f6';
                   e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                 }}
                 onBlur={(e) => {
                   e.target.style.borderColor = '#d1d5db';
                   e.target.style.boxShadow = 'none';
                 }}
               >
                 <option value="">All Roles</option>
                 <option value="IT">IT</option>
                 <option value="HR">HR</option>
                 <option value="Project Manager">Project Manager</option>
                 <option value="Area Manager">Area Manager</option>
                 <option value="Person in Charge">Person in Charge</option>
                 <option value="CEO">CEO</option>
                 <option value="Admin">Admin</option>
               </select>
             </div>
             <div style={{ flex: 1, minWidth: 150 }}>
               <label style={{ 
                 display: 'block', 
                 marginBottom: '6px', 
                 fontSize: '14px', 
                 fontWeight: '500', 
                 color: '#374151' 
               }}>
                 Action Filter
               </label>
               <select
                 value={actionFilter}
                 onChange={e => setActionFilter(e.target.value)}
                 style={{ 
                   width: '100%',
                   padding: '12px 16px', 
                   borderRadius: '8px', 
                   border: "1px solid #d1d5db",
                   fontSize: '14px',
                   transition: 'all 0.2s ease',
                   outline: 'none',
                   backgroundColor: 'white',
                   cursor: 'pointer'
                 }}
                 onFocus={(e) => {
                   e.target.style.borderColor = '#3b82f6';
                   e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                 }}
                 onBlur={(e) => {
                   e.target.style.borderColor = '#d1d5db';
                   e.target.style.boxShadow = 'none';
                 }}
               >
                 <option value="">All Actions</option>
                 <option value="login">Login</option>
                 <option value="upload file">Upload File</option>
                 <option value="submit report">Submit Report</option>
                 <option value="delete material request">Delete Material Request</option>
                 <option value="submit material request">Submit Material Request</option>
                 <option value="edit material request">Edit Material Request</option>
                 <option value="delete manpower request">Delete Manpower Request</option>
                 <option value="submit manpower request">Submit Manpower Request</option>
                 <option value="edit manpower request">Edit Manpower Request</option>
                 <option value="create new project">Create New Project</option>
                 <option value="delete project">Delete Project</option>
                                  <option value="add new project">Add New Project</option>
               </select>
             </div>
             <div style={{ flex: 1, minWidth: 150, display: 'flex', alignItems: 'end' }}>
               <button
                 onClick={clearAllFilters}
                 style={{
                   width: '100%',
                   padding: '12px 16px',
                   backgroundColor: '#f3f4f6',
                   color: '#374151',
                   border: '1px solid #d1d5db',
                   borderRadius: '8px',
                   fontSize: '14px',
                   fontWeight: '500',
                   cursor: 'pointer',
                   transition: 'all 0.2s ease',
                   marginTop: '24px'
                 }}
                 onMouseEnter={(e) => {
                   e.target.style.backgroundColor = '#e5e7eb';
                   e.target.style.borderColor = '#adb5bd';
                 }}
                 onMouseLeave={(e) => {
                   e.target.style.backgroundColor = '#f3f4f6';
                   e.target.style.borderColor = '#d1d5db';
                 }}
               >
                 Clear Filters
               </button>
             </div>
                      </div>

           {/* Active Filters Summary */}
           {(search || roleFilter || actionFilter || startDate || endDate) && (
             <div style={{
               display: 'flex',
               alignItems: 'center',
               gap: '12px',
               marginBottom: '16px',
               padding: '12px 16px',
               backgroundColor: '#eff6ff',
               border: '1px solid #dbeafe',
               borderRadius: '8px',
               fontSize: '14px',
               color: '#1e40af'
             }}>
               <span style={{ fontWeight: '500' }}>Active Filters:</span>
               {search && (
                 <span style={{
                   backgroundColor: '#dbeafe',
                   padding: '4px 8px',
                   borderRadius: '4px',
                   fontSize: '12px'
                 }}>
                   Search: "{search}"
                 </span>
               )}
               {roleFilter && (
                 <span style={{
                   backgroundColor: '#dbeafe',
                   padding: '4px 8px',
                   borderRadius: '4px',
                   fontSize: '12px'
                 }}>
                   Role: {roleFilter}
                 </span>
               )}
               {actionFilter && (
                 <span style={{
                   backgroundColor: '#dbeafe',
                   padding: '4px 8px',
                   borderRadius: '4px',
                   fontSize: '12px'
                 }}>
                   Action: {actionFilter}
                 </span>
               )}
               {startDate && (
                 <span style={{
                   backgroundColor: '#dbeafe',
                   padding: '4px 8px',
                   borderRadius: '4px',
                   fontSize: '12px'
                 }}>
                   From: {new Date(startDate).toLocaleDateString()}
                 </span>
               )}
               {endDate && (
                 <span style={{
                   backgroundColor: '#dbeafe',
                   padding: '4px 8px',
                   borderRadius: '4px',
                   fontSize: '12px'
                 }}>
                   To: {new Date(endDate).toLocaleDateString()}
                 </span>
               )}
               <span style={{ marginLeft: 'auto', fontSize: '12px', opacity: 0.8 }}>
                 {filteredLogs.length} of {logs.length} records
               </span>
             </div>
           )}

         {loading ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '60px 20px',
            color: '#6b7280'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              border: '3px solid #e5e7eb',
              borderTop: '3px solid #3b82f6',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              marginBottom: '16px'
            }}></div>
            <span style={{ fontSize: '16px', fontWeight: '500' }}>Loading audit logs...</span>
          </div>
        ) : (
          <div style={{ 
            overflowX: "auto",
            backgroundColor: 'white',
            borderRadius: '12px',
            border: '1px solid #e5e7eb',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
          }}>
            <table style={{ 
              width: "100%", 
              borderCollapse: "collapse", 
              fontSize: 14,
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
            }}>
              <thead>
                <tr style={{ 
                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  color: 'white'
                }}>
                  <th style={{
                    ...th,
                    background: 'transparent',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    padding: '16px 12px'
                  }}>Date/Time</th>
                  <th style={{
                    ...th,
                    background: 'transparent',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    padding: '16px 12px'
                  }}>Action</th>
                  <th style={{
                    ...th,
                    background: 'transparent',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    padding: '16px 12px'
                  }}>Performed By</th>
                  <th style={{
                    ...th,
                    background: 'transparent',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    padding: '16px 12px'
                  }}>Role</th>
                  <th style={{
                    ...th,
                    background: 'transparent',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    padding: '16px 12px'
                  }}>Description</th>
                  <th style={{
                    ...th,
                    background: 'transparent',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    padding: '16px 12px'
                  }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ 
                      textAlign: "center", 
                      color: "#9ca3af", 
                      padding: '40px 20px',
                      fontSize: '16px',
                      fontStyle: 'italic'
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                        <FaClipboardList style={{ fontSize: '24px', opacity: 0.5 }} />
                        No audit logs found matching your criteria
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log, i) => (
                    <tr key={log._id || i} style={{ 
                      background: i % 2 ? "#fafbfc" : "#fff",
                      transition: 'all 0.2s ease',
                      borderBottom: '1px solid #f3f4f6'
                    }}
                    onMouseEnter={(e) => {
                      e.target.closest('tr').style.backgroundColor = '#f0f9ff';
                      e.target.closest('tr').style.transform = 'scale(1.01)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.closest('tr').style.backgroundColor = i % 2 ? "#fafbfc" : "#fff";
                      e.target.closest('tr').style.transform = 'scale(1)';
                    }}
                    >
                      <td style={{
                        ...td,
                        padding: '16px 12px',
                        fontWeight: '500',
                        color: '#374151'
                      }}>
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td style={{
                        ...td,
                        padding: '16px 12px'
                      }}>
                        <span style={{ 
                          background: getActionColor(log.action),
                          color: 'white',
                          borderRadius: '20px', 
                          padding: "6px 12px",
                          fontSize: '12px',
                          fontWeight: '600',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          display: 'inline-block',
                          minWidth: '80px',
                          textAlign: 'center'
                        }}>
                          {log.action}
                        </span>
                      </td>
                      <td style={{
                        ...td,
                        padding: '16px 12px',
                        fontWeight: '500',
                        color: '#1f2937'
                      }}>
                        {log.performedBy?.name || "Unknown"}
                      </td>
                      <td style={{
                        ...td,
                        padding: '16px 12px',
                        color: '#6b7280'
                      }}>
                        {log.performedByRole}
                      </td>
                      <td style={{
                        ...td,
                        padding: '16px 12px',
                        color: '#374151',
                        maxWidth: '300px'
                      }}>
                        <div style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {log.description}
                        </div>
                      </td>
                      <td style={{
                        ...td,
                        padding: '16px 12px'
                      }}>
                        <details style={{ cursor: 'pointer' }}>
                          <summary style={{ 
                            cursor: "pointer",
                            color: '#3b82f6',
                            fontWeight: '500',
                            fontSize: '13px',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            backgroundColor: '#eff6ff',
                            border: '1px solid #dbeafe',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.backgroundColor = '#dbeafe';
                            e.target.style.borderColor = '#93c5fd';
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.backgroundColor = '#eff6ff';
                            e.target.style.borderColor = '#dbeafe';
                          }}
                          >
                            View Details
                          </summary>
                          <pre style={{ 
                            whiteSpace: "pre-wrap", 
                            fontSize: 12, 
                            background: "#f8fafc", 
                            padding: 12, 
                            borderRadius: 8,
                            border: '1px solid #e2e8f0',
                            marginTop: '8px',
                            color: '#374151',
                            fontFamily: 'monospace',
                            lineHeight: '1.5'
                          }}>
                            {JSON.stringify(log.meta, null, 2)}
                          </pre>
                        </details>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
          </div>
        </main>

        {/* Export Modal */}
        {exportModalOpen && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }} onClick={() => setExportModalOpen(false)}>
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '400px',
              width: '90%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
            }} onClick={(e) => e.stopPropagation()}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px'
              }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#1f2937' }}>
                  Export Audit Logs
                </h3>
                <button
                  onClick={() => setExportModalOpen(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '20px',
                    cursor: 'pointer',
                    color: '#9ca3af',
                    padding: '4px'
                  }}
                >
                  ×
                </button>
              </div>
              
              <div style={{ marginBottom: '24px' }}>
                <p style={{ margin: '0 0 16px 0', color: '#6b7280', fontSize: '14px' }}>
                  Export the filtered audit logs to CSV format.
                </p>
                <div style={{
                  padding: '16px',
                  backgroundColor: '#f8fafc',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '14px', color: '#374151' }}>Total Records:</span>
                    <span style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937' }}>
                      {filteredLogs.length}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '14px', color: '#374151' }}>Format:</span>
                    <span style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937' }}>CSV</span>
                  </div>
                </div>
              </div>

              <div style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'flex-end'
              }}>
                <button
                  onClick={() => setExportModalOpen(false)}
                  style={{
                    padding: '10px 16px',
                    backgroundColor: '#f3f4f6',
                    color: '#374151',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.backgroundColor = '#e5e7eb';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor = '#f3f4f6';
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleExport}
                  disabled={exportLoading || filteredLogs.length === 0}
                  style={{
                    padding: '10px 16px',
                    backgroundColor: filteredLogs.length === 0 ? '#9ca3af' : '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: filteredLogs.length === 0 ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                  onMouseEnter={(e) => {
                    if (filteredLogs.length > 0) {
                      e.target.style.backgroundColor = '#2563eb';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (filteredLogs.length > 0) {
                      e.target.style.backgroundColor = '#3b82f6';
                    }
                  }}
                >
                  {exportLoading ? (
                    <>
                      <div style={{
                        width: '16px',
                        height: '16px',
                        border: '2px solid #ffffff',
                        borderTop: '2px solid transparent',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                      }}></div>
                      Exporting...
                    </>
                  ) : (
                    <>
                      <FaDownload />
                      Export {filteredLogs.length} Records
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

const th = {
  textAlign: "left",
  padding: "10px 8px",
  fontWeight: 600,
  borderBottom: "2px solid #eee",
};
const td = {
  padding: "8px 8px",
  borderBottom: "1px solid #eee",
};

export default ItAuditLog;

// Add CSS for loading animation
const style = document.createElement('style');
style.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
document.head.appendChild(style);
