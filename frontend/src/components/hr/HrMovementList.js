import React, { useState, useEffect } from 'react';
import AppHeader from '../layout/AppHeader';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Filter, Download, Upload, Plus, RefreshCw, Calendar, MapPin, X, FileText, FileDown } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import api from '../../api/axiosInstance';
import '../style/hr_style/Hr_MovementList.css';
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
  FaCheckCircle,
  FaTimesCircle,
  FaClock,
  FaFileExport,
  FaPrint
} from 'react-icons/fa';

export default function HrMovementList() {
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  // Removed local header state (handled by AppHeader)
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportFilters, setExportFilters] = useState({
    user: 'all',
    timeRange: 'all',
    status: 'all',
    format: 'pdf'
  });
  const [exportLoading, setExportLoading] = useState(false);
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

  // Fetch movement data
  useEffect(() => {
    const fetchMovements = async () => {
      try {
        setLoading(true);
        
        const { data } = await api.get('/manpower-requests', {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (Array.isArray(data)) {
          setMovements(data);
          setError(null);
        } else {
          setError('Invalid data format received from server');
          setMovements([]);
        }
      } catch (err) {
        console.error('Error fetching movements:', err);
        setError(`Failed to load movement data: ${err.response?.data?.message || err.message}`);
        setMovements([]);
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchMovements();
    }
  }, [token]);

  // Filtered movements
  const filteredMovements = movements.filter(movement => {
    const matchesSearch = 
      movement.createdBy?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      movement.project?.projectName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (movement.manpowers?.[0]?.type?.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || movement.status?.toLowerCase() === statusFilter.toLowerCase();

    const matchesDate = dateFilter === 'all' || 
      (dateFilter === 'today' && isToday(new Date(movement.createdAt))) ||
      (dateFilter === 'week' && isThisWeek(new Date(movement.createdAt))) ||
      (dateFilter === 'month' && isThisMonth(new Date(movement.createdAt)));

    return matchesSearch && matchesStatus && matchesDate;
  });



  // Helper functions for date filtering
  const isToday = (date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isThisWeek = (date) => {
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    return date >= weekAgo;
  };

  const isThisMonth = (date) => {
    const today = new Date();
    return date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
  };

  // Get movement counts
  const movementCounts = {
    total: movements.length,
    pending: movements.filter(m => m.status === 'Pending').length,
    approved: movements.filter(m => m.status === 'Approved').length,
    overdue: movements.filter(m => m.status === 'Overdue').length,
    completed: movements.filter(m => m.status === 'Completed').length,
    today: movements.filter(m => isToday(new Date(m.createdAt))).length
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

  // Removed legacy profile dropdown outside click

  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get status icon and color
  const getStatusInfo = (status) => {
    switch (status?.toLowerCase()) {
      case 'approved':
        return { icon: FaCheckCircle, color: 'status-approved', bgColor: '#dcfce7' };
      case 'overdue':
        return { icon: FaExclamationTriangle, color: 'status-overdue', bgColor: '#fef2f2' };
      case 'completed':
        return { icon: FaCheckCircle, color: 'status-completed', bgColor: '#f0fdf4' };
      case 'pending':
        return { icon: FaClock, color: 'status-pending', bgColor: '#fef3c7' };
      default:
        return { icon: FaClock, color: 'status-pending', bgColor: '#fef3c7' };
    }
  };

  // Get unique users for export filter
  const getUniqueUsers = () => {
    const users = movements
      .map(m => m.createdBy?.name)
      .filter((name, index, arr) => name && arr.indexOf(name) === index);
    return users;
  };

  // Filter movements for export
  const getFilteredMovementsForExport = () => {
    let filtered = [...movements];

    // Filter by user
    if (exportFilters.user !== 'all') {
      filtered = filtered.filter(m => m.createdBy?.name === exportFilters.user);
    }

    // Filter by status
    if (exportFilters.status !== 'all') {
      filtered = filtered.filter(m => m.status?.toLowerCase() === exportFilters.status.toLowerCase());
    }

    // Filter by time range
    if (exportFilters.timeRange !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      switch (exportFilters.timeRange) {
        case 'today':
          filtered = filtered.filter(m => isToday(new Date(m.createdAt)));
          break;
        case 'week':
          filtered = filtered.filter(m => isThisWeek(new Date(m.createdAt)));
          break;
        case 'month':
          filtered = filtered.filter(m => isThisMonth(new Date(m.createdAt)));
          break;
        case 'quarter':
          const quarterAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          filtered = filtered.filter(m => new Date(m.createdAt) >= quarterAgo);
          break;
        case 'year':
          const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          filtered = filtered.filter(m => new Date(m.createdAt) >= yearAgo);
          break;
      }
    }

    return filtered;
  };

  // Handle export
  const handleExport = async () => {
    setExportLoading(true);
    try {
      const filteredMovements = getFilteredMovementsForExport();
      
      if (exportFilters.format === 'pdf') {
        await exportToPDF(filteredMovements);
      } else {
        await exportToCSV(filteredMovements);
      }
      
      setExportModalOpen(false);
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export data. Please try again.');
    } finally {
      setExportLoading(false);
    }
  };

  // Export to PDF
  const exportToPDF = async (data) => {
    try {
      // Create new PDF document
      const doc = new jsPDF();
      
      // Get current date and time
      const now = new Date();
      const exportDate = now.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      const exportTime = now.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });

      // Add company logo
      const logoImg = new Image();
      logoImg.src = '/images/Fadz-logo.png';
      
      await new Promise((resolve) => {
        logoImg.onload = () => {
          // Add logo to PDF (top left)
          doc.addImage(logoImg, 'PNG', 15, 15, 30, 30);
          resolve();
        };
        logoImg.onerror = () => {
          // If logo fails to load, continue without it
          resolve();
        };
      });

      // Add company name and title
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('Fadz Construction Inc.', 50, 25);
      
      doc.setFontSize(16);
      doc.setFont('helvetica', 'normal');
      doc.text('Manpower Movement Requests Report', 50, 35);

      // Add export details
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Exported on: ${exportDate} at ${exportTime}`, 15, 55);
      doc.text(`Exported by: ${userName} (${userRole})`, 15, 62);

      // Add filter information
      let filterInfo = 'Filters Applied: ';
      const filters = [];
      
      if (exportFilters.user !== 'all') {
        filters.push(`User: ${exportFilters.user}`);
      }
      if (exportFilters.timeRange !== 'all') {
        filters.push(`Time: ${exportFilters.timeRange}`);
      }
      if (exportFilters.status !== 'all') {
        filters.push(`Status: ${exportFilters.status}`);
      }
      
      if (filters.length > 0) {
        filterInfo += filters.join(', ');
      } else {
        filterInfo += 'None (All records)';
      }
      
      doc.text(filterInfo, 15, 69);

      // Add summary
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(`Total Records: ${data.length}`, 15, 80);

      // Create main summary table
      const tableData = data.map((m, index) => [
        index + 1,
        m.createdBy?.name || 'Unknown',
        m.project?.projectName || 'Unknown',
        m.manpowers?.[0]?.type || 'Unknown',
        m.manpowers?.[0]?.quantity || 1,
        m.status || 'Pending',
        formatDate(m.createdAt),
        m.description || ''
      ]);

      // Add main summary table
      autoTable(doc, {
        startY: 90,
        head: [['#', 'Requester', 'Project', 'Position', 'Quantity', 'Status', 'Date', 'Description']],
        body: tableData,
        theme: 'grid',
        headStyles: {
          fillColor: [59, 130, 246],
          textColor: 255,
          fontStyle: 'bold'
        },
        styles: {
          fontSize: 8,
          cellPadding: 2
        },
        columnStyles: {
          0: { cellWidth: 10 }, // #
          1: { cellWidth: 25 }, // Requester
          2: { cellWidth: 30 }, // Project
          3: { cellWidth: 20 }, // Position
          4: { cellWidth: 15 }, // Quantity
          5: { cellWidth: 20 }, // Status
          6: { cellWidth: 20 }, // Date
          7: { cellWidth: 'auto' } // Description
        },
        margin: { top: 10 }
      });

      // Get the Y position after the main table
      const mainTableEndY = doc.lastAutoTable.finalY || 150;
      let currentY = mainTableEndY + 20;

      // Add detailed sections for approved and completed requests
      const approvedRequests = data.filter(m => m.status === 'Approved');
      const completedRequests = data.filter(m => m.status === 'Completed');

      // Approved Requests Details Section
      if (approvedRequests.length > 0) {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Approved Requests Details', 15, currentY);
        currentY += 10;

        const approvedTableData = approvedRequests.map((m, index) => [
          index + 1,
          m.createdBy?.name || 'Unknown',
          m.project?.projectName || 'Unknown',
          m.manpowers?.[0]?.type || 'Unknown',
          m.manpowers?.[0]?.quantity || 1,
          m.approvedBy || 'Unknown',
          formatDate(m.updatedAt || m.createdAt),
          formatDate(m.createdAt)
        ]);

        autoTable(doc, {
          startY: currentY,
          head: [['#', 'Requester', 'Project', 'Position', 'Quantity', 'Approved By', 'Approved On', 'Requested On']],
          body: approvedTableData,
          theme: 'grid',
          headStyles: {
            fillColor: [34, 197, 94],
            textColor: 255,
            fontStyle: 'bold'
          },
          styles: {
            fontSize: 7,
            cellPadding: 2
          },
          columnStyles: {
            0: { cellWidth: 8 },
            1: { cellWidth: 22 },
            2: { cellWidth: 25 },
            3: { cellWidth: 18 },
            4: { cellWidth: 12 },
            5: { cellWidth: 20 },
            6: { cellWidth: 20 },
            7: { cellWidth: 20 }
          }
        });

        currentY = doc.lastAutoTable.finalY + 15;
      }

      // Completed Requests Details Section
      if (completedRequests.length > 0) {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Completed Requests Details', 15, currentY);
        currentY += 10;

        const completedTableData = completedRequests.map((m, index) => {
          const arrivalTime = m.updatedAt ? new Date(m.updatedAt).toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit' 
          }) : 'N/A';
          
          const returnTime = m.returnDate ? new Date(m.returnDate).toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit' 
          }) : 'N/A';

          return [
            index + 1,
            m.createdBy?.name || 'Unknown',
            m.project?.projectName || 'Unknown',
            m.manpowers?.[0]?.type || 'Unknown',
            m.manpowers?.[0]?.quantity || 1,
            m.approvedBy || 'Unknown',
            formatDate(m.updatedAt || m.createdAt),
            formatDate(m.returnDate || m.updatedAt),
            `${arrivalTime} | ${returnTime}`
          ];
        });

        autoTable(doc, {
          startY: currentY,
          head: [['#', 'Requester', 'Project', 'Position', 'Quantity', 'Approved By', 'Approved On', 'Returned On', 'Arrival | Return Time']],
          body: completedTableData,
          theme: 'grid',
          headStyles: {
            fillColor: [16, 185, 129],
            textColor: 255,
            fontStyle: 'bold'
          },
          styles: {
            fontSize: 7,
            cellPadding: 2
          },
          columnStyles: {
            0: { cellWidth: 8 },
            1: { cellWidth: 20 },
            2: { cellWidth: 22 },
            3: { cellWidth: 16 },
            4: { cellWidth: 10 },
            5: { cellWidth: 18 },
            6: { cellWidth: 18 },
            7: { cellWidth: 18 },
            8: { cellWidth: 25 }
          }
        });
      }

      // Add footer
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.text(
          `Page ${i} of ${pageCount} | Generated by FadzTrack HR System`,
          doc.internal.pageSize.width / 2,
          doc.internal.pageSize.height - 10,
          { align: 'center' }
        );
      }

      // Save the PDF
      const fileName = `manpower-movement-requests-${now.toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  // Export to CSV
  const exportToCSV = async (data) => {
    const csvContent = generateExportContent(data, 'csv');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `movement-requests-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Generate export content
  const generateExportContent = (data, format) => {
    if (format === 'csv') {
      // Enhanced CSV with additional details for approved and completed requests
      const headers = [
        'Requester', 'Project', 'Position', 'Quantity', 'Status', 'Date', 'Description',
        'Approved By', 'Approved On', 'Returned On', 'Arrival Time', 'Return Time'
      ];
      
      const rows = data.map(m => {
        const arrivalTime = m.updatedAt ? new Date(m.updatedAt).toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit' 
        }) : '';
        
        const returnTime = m.returnDate ? new Date(m.returnDate).toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit' 
        }) : '';

        return [
          m.createdBy?.name || 'Unknown',
          m.project?.projectName || 'Unknown',
          m.manpowers?.[0]?.type || 'Unknown',
          m.manpowers?.[0]?.quantity || 1,
          m.status || 'Pending',
          formatDate(m.createdAt),
          m.description || '',
          m.approvedBy || '',
          formatDate(m.updatedAt || ''),
          formatDate(m.returnDate || ''),
          arrivalTime,
          returnTime
        ];
      });
      
      return [headers, ...rows]
        .map(row => row.map(cell => `"${cell}"`).join(','))
        .join('\n');
    } else {
      // Simple text format for PDF simulation
      let content = 'MOVEMENT REQUESTS REPORT\n';
      content += 'Generated on: ' + new Date().toLocaleDateString() + '\n\n';
      
      data.forEach((m, index) => {
        content += `${index + 1}. Requester: ${m.createdBy?.name || 'Unknown'}\n`;
        content += `   Project: ${m.project?.projectName || 'Unknown'}\n`;
        content += `   Position: ${m.manpowers?.[0]?.type || 'Unknown'}\n`;
        content += `   Quantity: ${m.manpowers?.[0]?.quantity || 1}\n`;
        content += `   Status: ${m.status || 'Pending'}\n`;
        content += `   Date: ${formatDate(m.createdAt)}\n`;
        content += `   Description: ${m.description || ''}\n`;
        
        // Add approval details for approved requests
        if (m.status === 'Approved' && m.approvedBy) {
          content += `   Approved by: ${m.approvedBy}\n`;
          content += `   Approved on: ${formatDate(m.updatedAt || m.createdAt)}\n`;
        }
        
        // Add completion details for completed requests
        if (m.status === 'Completed') {
          if (m.approvedBy) {
            content += `   Approved by: ${m.approvedBy}\n`;
            content += `   Approved on: ${formatDate(m.updatedAt || m.createdAt)}\n`;
          }
          if (m.returnDate) {
            content += `   Returned on: ${formatDate(m.returnDate)}\n`;
          }
          const arrivalTime = m.updatedAt ? new Date(m.updatedAt).toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit' 
          }) : 'N/A';
          const returnTime = m.returnDate ? new Date(m.returnDate).toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit' 
          }) : 'N/A';
          content += `   Arrival time: ${arrivalTime}\n`;
          content += `   Return time: ${returnTime}\n`;
        }
        
        content += '\n';
      });
      
      return content;
    }
  };

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
        <div className="movement-container">
          {/* Page Header */}
          <div className="page-header">
            <div className="page-title-section">
              <h1 className="page-title">Movement Tracking</h1>
              <p className="page-subtitle">Monitor and manage staff movements and transfers across projects</p>
            </div>
            <div className="page-actions">
              <button className="action-button secondary" onClick={() => setExportModalOpen(true)}>
                <FaFileExport />
                <span>Export</span>
              </button>
            </div>
          </div>

          {/* Stats Overview */}
          <div className="stats-overview">
            <div className="stat-card">
              <div className="stat-icon total">
                <FaExchangeAlt />
              </div>
              <div className="stat-content">
                <span className="stat-value">{movementCounts.total}</span>
                <span className="stat-label">Total Movements</span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon today">
                <FaCalendarAlt />
              </div>
              <div className="stat-content">
                <span className="stat-value">{movementCounts.today}</span>
                <span className="stat-label">Today</span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon pending">
                <FaClock />
              </div>
              <div className="stat-content">
                <span className="stat-value">{movementCounts.pending}</span>
                <span className="stat-label">Pending</span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon approved">
                <FaCheckCircle />
              </div>
              <div className="stat-content">
                <span className="stat-value">{movementCounts.approved}</span>
                <span className="stat-label">Approved</span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon overdue">
                <FaExclamationTriangle />
              </div>
              <div className="stat-content">
                <span className="stat-value">{movementCounts.overdue}</span>
                <span className="stat-label">Overdue</span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon completed">
                <FaCheckCircle />
              </div>
              <div className="stat-content">
                <span className="stat-value">{movementCounts.completed}</span>
                <span className="stat-label">Completed</span>
              </div>
            </div>
          </div>

          {/* Filters and Search */}
          <div className="filters-section">
            <div className="search-box">
              <Search className="search-icon" />
              <input
                type="text"
                placeholder="Search by requester, project, or position..."
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
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="overdue">Overdue</option>
                <option value="completed">Completed</option>
              </select>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="filter-select"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
              </select>
              <button className="refresh-btn" onClick={() => window.location.reload()}>
                <RefreshCw />
              </button>
            </div>
          </div>

          {/* Movement List */}
          <div className="movement-list-container">
            {loading ? (
              <div className="loading-state">
                <div className="loading-spinner"></div>
                <span>Loading movement data...</span>
              </div>
            ) : error ? (
              <div className="error-state">
                <FaExclamationTriangle />
                <span>{error}</span>
              </div>
            ) : filteredMovements.length === 0 ? (
              <div className="empty-state">
                <FaExchangeAlt />
                <span>No movements found matching your criteria</span>
            </div>
          ) : (
              <div className="movement-list">
                {filteredMovements.map((movement) => {
                  const statusInfo = getStatusInfo(movement.status);
                  const StatusIcon = statusInfo.icon;
                  
                  return (
                    <div 
                      key={movement._id} 
                      className="movement-item"
                      onClick={() => navigate(`/hr/manpower-request/${movement._id}`)}
                    >
                      <div className="movement-requester">
                        <div className="requester-avatar">
                          {movement.createdBy?.name ? movement.createdBy.name.charAt(0).toUpperCase() : 'U'}
                        </div>
                        <div className="requester-info">
                          <h4 className="requester-name">{movement.createdBy?.name || 'Unknown'}</h4>
                          <p className="requester-role">{movement.createdBy?.role || 'Unknown Role'}</p>
                        </div>
                      </div>
                      
                      <div className="movement-project">
                        <MapPin className="detail-icon" />
                        <span className="detail-value">{movement.project?.projectName || 'Unknown Project'}</span>
                      </div>
                      
                      <div className="movement-position">
                        <FaUserPlus className="detail-icon" />
                        <span className="detail-value">{movement.manpowers?.[0]?.type || 'Unknown Position'}</span>
                      </div>
                      
                      <div className="movement-quantity">
                        <FaUsers className="detail-icon" />
                        <span className="detail-value">{movement.manpowers?.[0]?.quantity || 1} needed</span>
                      </div>
                      
                      <div className="movement-date">
                        <Calendar className="detail-icon" />
                        <span className="detail-value">{formatDate(movement.createdAt)}</span>
                      </div>
                      
                      <div className="movement-status">
                        <span className={`status-badge ${statusInfo.color}`}>
                          <StatusIcon />
                          {movement.status || 'Pending'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Export Modal */}
      {exportModalOpen && (
        <div className="export-modal-overlay" onClick={() => setExportModalOpen(false)}>
          <div className="export-modal" onClick={(e) => e.stopPropagation()}>
            <div className="export-modal-header">
              <h3>Export Movement Requests</h3>
              <button 
                className="export-modal-close" 
                onClick={() => setExportModalOpen(false)}
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="export-modal-content">
              <div className="export-filters">
                <div className="export-filter-group">
                  <label>Filter by User:</label>
                  <select 
                    value={exportFilters.user} 
                    onChange={(e) => setExportFilters(prev => ({ ...prev, user: e.target.value }))}
                  >
                    <option value="all">All Users</option>
                    {getUniqueUsers().map(user => (
                      <option key={user} value={user}>{user}</option>
                    ))}
                  </select>
                </div>

                <div className="export-filter-group">
                  <label>Filter by Time Range:</label>
                  <select 
                    value={exportFilters.timeRange} 
                    onChange={(e) => setExportFilters(prev => ({ ...prev, timeRange: e.target.value }))}
                  >
                    <option value="all">All Time</option>
                    <option value="today">Today</option>
                    <option value="week">This Week</option>
                    <option value="month">This Month</option>
                    <option value="quarter">Last 3 Months</option>
                    <option value="year">Last Year</option>
                  </select>
                </div>

                <div className="export-filter-group">
                  <label>Filter by Status:</label>
                  <select 
                    value={exportFilters.status} 
                    onChange={(e) => setExportFilters(prev => ({ ...prev, status: e.target.value }))}
                  >
                    <option value="all">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="overdue">Overdue</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>

                <div className="export-filter-group">
                  <label>Export Format:</label>
                  <div className="format-options">
                    <label className="format-option">
                      <input
                        type="radio"
                        name="format"
                        value="pdf"
                        checked={exportFilters.format === 'pdf'}
                        onChange={(e) => setExportFilters(prev => ({ ...prev, format: e.target.value }))}
                      />
                      <span className="format-label">
                        <FileText size={16} />
                        PDF Report (Recommended)
                      </span>
                    </label>
                    <label className="format-option">
                      <input
                        type="radio"
                        name="format"
                        value="csv"
                        checked={exportFilters.format === 'csv'}
                        onChange={(e) => setExportFilters(prev => ({ ...prev, format: e.target.value }))}
                      />
                      <span className="format-label">
                        <FileDown size={16} />
                        CSV File
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="export-summary">
                <h4>Export Summary</h4>
                <p>Total records to export: <strong>{getFilteredMovementsForExport().length}</strong></p>
                <p>Format: <strong>{exportFilters.format.toUpperCase()}</strong></p>
              </div>

              <div className="export-actions">
                <button 
                  className="export-btn cancel" 
                  onClick={() => setExportModalOpen(false)}
                  disabled={exportLoading}
                >
                  Cancel
                </button>
                <button 
                  className="export-btn primary" 
                  onClick={handleExport}
                  disabled={exportLoading || getFilteredMovementsForExport().length === 0}
                >
                  {exportLoading ? (
                    <>
                      <div className="loading-spinner"></div>
                      Exporting...
                    </>
                  ) : (
                    <>
                      <FileDown size={16} />
                      Export {getFilteredMovementsForExport().length} Records
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
