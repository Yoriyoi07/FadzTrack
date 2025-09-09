import React, { useEffect, useState } from "react";
import api from '../../api/axiosInstance';
import { useNavigate, Link } from 'react-router-dom';
import '../style/it_style/It_Dash.css';
// Nav icons
import { FaTachometerAlt, FaComments, FaBoxes, FaUsers, FaClipboardList, FaFileExport, FaDownload } from 'react-icons/fa';
// PDF export
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import AppHeader from '../layout/AppHeader';

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
  const [expandedRow, setExpandedRow] = useState(null); // which log _id is expanded

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

  // Toggle details row
  const toggleRow = (id) => {
    setExpandedRow(prev => prev === id ? null : id);
  };

  // Render meta details nicely
  const renderMeta = (log) => {
    const meta = log.meta || {};
    // Changed fields diff
    if (Array.isArray(meta.changedFields) && meta.changedFields.length) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Changed Fields ({meta.changedFields.length})</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f1f5f9' }}>
                  <th style={metaTh}>Field</th>
                  <th style={metaTh}>Before</th>
                  <th style={metaTh}>After</th>
                </tr>
              </thead>
              <tbody>
                {meta.changedFields.map((f,i) => {
                  const changed = f.before !== f.after;
                  return (
                    <tr key={i} style={{ background: i % 2 ? '#ffffff' : '#f8fafc' }}>
                      <td style={metaTd}>{f.field}</td>
                      <td style={{ ...metaTd, color: changed ? '#dc2626' : '#475569' }}>
                        {formatValue(f.before)}
                      </td>
                      <td style={{ ...metaTd, color: changed ? '#16a34a' : '#475569' }}>
                        {formatValue(f.after)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    // File uploads (chat / project)
    if (meta.fileNames || meta.filesCount) {
      return (
        <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {meta.filesCount != null && <div><b>Files Count:</b> {meta.filesCount}</div>}
          {Array.isArray(meta.fileNames) && meta.fileNames.length > 0 && (
            <div>
              <b>Files:</b>
              <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                {meta.fileNames.map((n,i) => <li key={i} style={{ fontFamily: 'monospace' }}>{n}</li>)}
              </ul>
            </div>
          )}
          {meta.fileTypes && (
            <div><b>Types:</b> {Array.isArray(meta.fileTypes) ? meta.fileTypes.join(', ') : meta.fileTypes}</div>
          )}
          {meta.totalSize && <div><b>Total Size:</b> {meta.totalSize} bytes</div>}
        </div>
      );
    }

    // Generic fallback JSON
    return (
      <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, margin: 0 }}>
        {JSON.stringify(meta, null, 2)}
      </pre>
    );
  };

  const formatValue = (v) => {
    if (v === null || v === undefined) return '';
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
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
      case 'login_trusted':
        return '#10b981'; // Green
      case 'logout':
        return '#ef4444'; // Red
      case 'create_material_request':
      case 'create_manpower_request':
      case 'add_project':
        return '#3b82f6'; // Blue
      case 'update_material_request':
      case 'update_manpower_request':
      case 'update_project':
      case 'update_project_tasks':
        return '#f59e0b'; // Yellow
      case 'delete_material_request':
      case 'delete_manpower_request':
      case 'delete_project':
      case 'delete_project_document':
        return '#dc2626'; // Red
      case 'approve_material_request':
      case 'approve_manpower_request':
        return '#059669'; // Green
      case 'complete_manpower_request':
        return '#10b981'; // Green
      case 'add_project_documents':
        return '#8b5cf6'; // Purple
      case 'submit_daily_report':
        return '#06b6d4'; // Cyan
      case 'generate_attendance_report':
        return '#8b5cf6'; // Purple
      case 'submit_attendance_report':
        return '#06b6d4'; // Cyan
      case 'upload_project_discussion':
        return '#8b5cf6'; // Purple
      case 'upload_project_files':
        return '#8b5cf6'; // Purple
      case 'generate_dss_report':
        return '#06b6d4'; // Cyan
      case 'upload_chat_files':
        return '#8b5cf6'; // Purple
      default:
        return '#6b7280'; // Gray
    }
  };

  // Export functions
  const handleExport = async () => {
    setExportLoading(true);
    try {
      await exportToPDF(filteredLogs);
      setExportModalOpen(false);
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export PDF. Please try again.');
    } finally {
      setExportLoading(false);
    }
  };

  const exportToPDF = async (data) => {
    try {
      // Create new PDF document
      const doc = new jsPDF();
      
      // Add company logo
      const logoImg = new Image();
      logoImg.src = '/images/Fadz-logo.png';
      
      await new Promise((resolve, reject) => {
        logoImg.onload = () => {
          try {
            // Add logo to top left (increased size)
            doc.addImage(logoImg, 'PNG', 20, 20, 50, 50);
            resolve();
          } catch (error) {
            console.warn('Could not add logo to PDF:', error);
            resolve();
          }
        };
        logoImg.onerror = () => {
          console.warn('Could not load logo for PDF');
          resolve();
        };
      });

      // Add company name and title
      doc.setFontSize(26); // increased font size
      doc.setFont('helvetica', 'bold');
      doc.text('FadzTrack', 80, 40); // adjusted position for larger logo
      
      doc.setFontSize(20); // increased font size
      doc.setFont('helvetica', 'bold');
      doc.text('IT Audit Logs Report', 80, 55); // adjusted position
      
      // Add export details
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Exported by: ${userName} (${userRole})`, 20, 70);
      doc.text(`Export Date: ${new Date().toLocaleString()}`, 20, 80);
      
      // Add active filters
      let filterY = 95;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Active Filters:', 20, filterY);
      
      filterY += 10;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      
      if (search) {
        doc.text(`Search: "${search}"`, 20, filterY);
        filterY += 8;
      }
      if (roleFilter) {
        doc.text(`Role: ${roleFilter}`, 20, filterY);
        filterY += 8;
      }
      if (actionFilter) {
        doc.text(`Action: ${actionFilter}`, 20, filterY);
        filterY += 8;
      }
      if (startDate) {
        doc.text(`Start Date: ${startDate}`, 20, filterY);
        filterY += 8;
      }
      if (endDate) {
        doc.text(`End Date: ${endDate}`, 20, filterY);
        filterY += 8;
      }
      
      // Add summary
      filterY += 5;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(`Total Records: ${data.length}`, 20, filterY);
      
      // Add table
      const tableY = filterY + 20;
      
      const headers = [
        'Date/Time',
        'Action', 
        'Performed By',
        'Role',
        'Description'
      ];
      
      const rows = data.map(log => [
        new Date(log.timestamp).toLocaleString(),
        log.action || '',
        log.performedBy?.name || 'Unknown',
        log.performedByRole || '',
        log.description || ''
      ]);
      
      // Use autoTable for better table formatting
      autoTable(doc, {
        head: [headers],
        body: rows,
        startY: tableY,
        margin: { top: 20, right: 20, bottom: 20, left: 20 },
        styles: {
          fontSize: 8,
          cellPadding: 2,
          overflow: 'linebreak'
        },
        headStyles: {
          fillColor: [59, 130, 246],
          textColor: 255,
          fontStyle: 'bold'
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        },
        columnStyles: {
          0: { cellWidth: 35 }, // Date/Time
          1: { cellWidth: 30 }, // Action
          2: { cellWidth: 35 }, // Performed By
          3: { cellWidth: 25 }, // Role
          4: { cellWidth: 50 }  // Description
        }
      });
      
      // Save the PDF
      const fileName = `audit-logs-${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      throw new Error('Failed to generate PDF');
    }
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
      <AppHeader roleSegment="it" />
      <main className="dashboard-main" style={{marginTop:'1rem'}}>
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
              Export PDF
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
                 <option value="login_trusted">Login (Trusted Device)</option>
                 <option value="logout">Logout</option>
                 <option value="CREATE_MATERIAL_REQUEST">Create Material Request</option>
                 <option value="CEO_CREATE_MATERIAL_REQUEST">CEO Create Material Request</option>
                 <option value="UPDATE_MATERIAL_REQUEST">Update Material Request</option>
                 <option value="CEO_UPDATE_MATERIAL_REQUEST">CEO Update Material Request</option>
                 <option value="DELETE_MATERIAL_REQUEST">Delete Material Request</option>
                 <option value="CEO_DELETE_MATERIAL_REQUEST">CEO Delete Material Request</option>
                 <option value="APPROVE_MATERIAL_REQUEST">Approve Material Request</option>
                 <option value="CEO_APPROVE_MATERIAL_REQUEST">CEO Approve Material Request</option>
                 <option value="CREATED_MANPOWER_REQUEST">Create Manpower Request</option>
                 <option value="CEO_CREATED_MANPOWER_REQUEST">CEO Create Manpower Request</option>
                 <option value="UPDATE_MANPOWER_REQUEST">Update Manpower Request</option>
                 <option value="CEO_UPDATED_MANPOWER_REQUEST">CEO Update Manpower Request</option>
                 <option value="DELETE_MANPOWER_REQUEST">Delete Manpower Request</option>
                 <option value="CEO_DELETED_MANPOWER_REQUEST">CEO Delete Manpower Request</option>
                 <option value="APPROVE_MANPOWER_REQUEST">Approve Manpower Request</option>
                 <option value="COMPLETE_MANPOWER_REQUEST">Complete Manpower Request</option>
                 <option value="ADD_PROJECT">Add Project</option>
                 <option value="CEO_ADD_PROJECT">CEO Add Project</option>
                 <option value="UPDATE_PROJECT">Update Project</option>
                 <option value="CEO_UPDATE_PROJECT">CEO Update Project</option>
                 <option value="DELETE_PROJECT">Delete Project</option>
                 <option value="CEO_DELETE_PROJECT">CEO Delete Project</option>
                 <option value="UPDATE_PROJECT_TASKS">Update Project Tasks</option>
                 <option value="ADD_PROJECT_DOCUMENTS">Add Project Documents</option>
                 <option value="DELETE_PROJECT_DOCUMENT">Delete Project Document</option>
                 <option value="CEO_DELETE_PROJECT_DOCUMENT">CEO Delete Project Document</option>
                 <option value="SUBMIT_DAILY_REPORT">Submit Daily Report</option>
                 <option value="GENERATE_ATTENDANCE_REPORT">Generate Attendance Report</option>
                 <option value="SUBMIT_ATTENDANCE_REPORT">Submit Attendance Report</option>
                 <option value="UPLOAD_PROJECT_DISCUSSION">Upload Project Discussion</option>
                 <option value="UPLOAD_PROJECT_FILES">Upload Project Files</option>
                 <option value="GENERATE_DSS_REPORT">Generate DSS Report</option>
                 <option value="UPLOAD_CHAT_FILES">Upload Chat Files</option>
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
                    <React.Fragment key={log._id || i}>
                      <tr style={{ 
                        background: i % 2 ? "#fafbfc" : "#fff",
                        transition: 'all 0.2s ease',
                        borderBottom: expandedRow === (log._id || i) ? 'none' : '1px solid #f3f4f6'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#f0f9ff';
                        e.currentTarget.style.transform = 'scale(1.01)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = i % 2 ? "#fafbfc" : "#fff";
                        e.currentTarget.style.transform = 'scale(1)';
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
                          <button onClick={() => toggleRow(log._id || i)}
                            style={{
                              cursor: 'pointer',
                              color: '#3b82f6',
                              fontWeight: 500,
                              fontSize: 13,
                              padding: '6px 12px',
                              borderRadius: 6,
                              backgroundColor: expandedRow === (log._id || i) ? '#dbeafe' : '#eff6ff',
                              border: '1px solid #dbeafe',
                              transition: 'all .2s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#dbeafe';
                            }}
                            onMouseLeave={(e) => {
                              if (expandedRow !== (log._id || i)) e.currentTarget.style.backgroundColor = '#eff6ff';
                            }}
                          >
                            {expandedRow === (log._id || i) ? 'Hide' : 'View'} Details
                          </button>
                        </td>
                      </tr>
                      {expandedRow === (log._id || i) && (
                        <tr style={{ background: '#f8fafc' }}>
                          <td colSpan={6} style={{ padding: '20px 24px', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f3f4f6' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                              {renderMeta(log)}
                              <div style={{ fontSize: 11, color: '#64748b' }}>
                                Log ID: {log._id} | Source: {log.source || 'N/A'}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
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
                  Export to PDF
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
                  Export the filtered audit logs to PDF format with company branding.
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
                    <span style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937' }}>PDF</span>
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
                      Export {filteredLogs.length} Records to PDF
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
const metaTh = {
  textAlign: 'left',
  padding: '6px 8px',
  fontWeight: 600,
  fontSize: 12,
  borderBottom: '1px solid #e2e8f0',
  color: '#334155'
};
const metaTd = {
  padding: '6px 8px',
  borderBottom: '1px solid #f1f5f9',
  fontSize: 12,
  verticalAlign: 'top',
  fontFamily: 'system-ui, sans-serif'
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
