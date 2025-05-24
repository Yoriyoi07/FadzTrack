import React, { useState, useMemo, useRef } from 'react';
import Papa from 'papaparse';
import { Search, Calendar, Grid, List, Upload, Filter } from 'lucide-react';
import '../style/hr_style/Hr_ManpowerList.css';
import FadzLogo from '../../assets/images/FadzLogo1.png';

const initialEmployeeData = [
  { id: 1, name: 'Carlo Villamin', position: 'PIC', status: 'Unassigned', project: 'N/A', avatar: '📦' },
  { id: 2, name: 'Lorenz Nicolai Laddaran', position: 'Architect', status: 'Assigned', project: 'BGC Hotel', avatar: '📦' },
  { id: 3, name: 'John Lloyd Hita', position: 'Engineer', status: 'Assigned', project: 'BGC Tower', avatar: '📦' },
  { id: 4, name: 'Kelvy Doria', position: 'Construction Worker', status: 'Assigned', project: 'Calatagan Townhomes', avatar: '🔧' },
  { id: 5, name: 'Ethann Jharnes Romualdez', position: 'Construction Worker', status: 'Assigned', project: 'NU MOA', avatar: '🔧' },
  { id: 6, name: 'Iaron Lloyd Monge', position: 'Construction Worker', status: 'Unassigned', project: 'N/A', avatar: '⛑️' },
  { id: 7, name: 'Denver Teodoro', position: 'Construction Worker', status: 'Inactive', project: 'N/A', avatar: '⛑️' },
  { id: 8, name: 'Maria Santos', position: 'Site Manager', status: 'Assigned', project: 'BGC Hotel', avatar: '📦' },
  { id: 9, name: 'Pedro Reyes', position: 'Safety Officer', status: 'Assigned', project: 'BGC Tower', avatar: '🔧' },
  { id: 10, name: 'Ana Garcia', position: 'Quality Inspector', status: 'Inactive', project: 'N/A', avatar: '⛑️' },
  { id: 11, name: 'Luis Martinez', position: 'Foreman', status: 'Assigned', project: 'Calatagan Townhomes', avatar: '📦' },
  { id: 12, name: 'Sofia Rodriguez', position: 'Project Coordinator', status: 'Assigned', project: 'NU MOA', avatar: '🔧' },
  { id: 13, name: 'Miguel Torres', position: 'Heavy Equipment Operator', status: 'Inactive', project: 'N/A', avatar: '⛑️' },
  { id: 14, name: 'Carmen Flores', position: 'Administrative Assistant', status: 'Assigned', project: 'BGC Hotel', avatar: '📦' },
  { id: 15, name: 'Roberto Cruz', position: 'Electrician', status: 'Assigned', project: 'BGC Tower', avatar: '🔧' },
  { id: 16, name: 'Isabella Morales', position: 'Civil Engineer', status: 'Inactive', project: 'N/A', avatar: '⛑️' },
  { id: 17, name: 'Diego Herrera', position: 'Plumber', status: 'Assigned', project: 'Calatagan Townhomes', avatar: '📦' },
  { id: 18, name: 'Valentina Jimenez', position: 'Surveyor', status: 'Assigned', project: 'NU MOA', avatar: '🔧' },
  { id: 19, name: 'Alejandro Silva', position: 'Welder', status: 'Inactive', project: 'N/A', avatar: '⛑️' },
  { id: 20, name: 'Camila Vargas', position: 'Environmental Specialist', status: 'Assigned', project: 'BGC Hotel', avatar: '📦' }
];

const ITEMS_PER_PAGE = 7;

function EmployeeRow({ employee }) {
  const getStatusBadge = (status) => {
    const statusClass = status.toLowerCase().replace(/\s+/g, '-');
    return (
      <span className={`status-badge status-${statusClass}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="employee-row">
      <div className="employee-cell employee-info-cell">
        <div className="employee-avatar">
          <span>{employee.avatar}</span>
        </div>
        <div className="employee-details">
          <div className="employee-name">{employee.name}</div>
          <div className="employee-position">Position: {employee.position}</div>
        </div>
      </div>
      <div className="employee-cell project-cell">
        <span className="project-name">{employee.project}</span>
      </div>
      <div className="employee-cell status-cell">
        {getStatusBadge(employee.status)}
      </div>
    </div>
  );
}

function Pagination({ currentPage, totalPages, onPageChange }) {
  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, 4, '...', totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
      }
    }
    
    return pages;
  };

  return (
    <div className="pagination-wrapper">
      <div className="pagination">
        <button
          className="pagination-btn nav-btn"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          ‹
        </button>
        
        {getPageNumbers().map((page, index) => (
          <button
            key={index}
            className={`pagination-btn ${page === currentPage ? 'active' : ''} ${page === '...' ? 'dots' : ''}`}
            onClick={() => typeof page === 'number' ? onPageChange(page) : null}
            disabled={page === '...'}
          >
            {page}
          </button>
        ))}
        
        <button 
          className="pagination-btn nav-btn"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          ›
        </button>
      </div>
    </div>
  );
}

export default function FadzTrack() {
  const [employees, setEmployees] = useState(initialEmployeeData);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const fileInputRef = useRef(null);

  const handleCSVUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
          const newEmployees = results.data.map(item => ({
            id: Number(item.id),
            name: item.name,
            position: item.position,
            status: item.status,
            project: item.project || 'N/A',
            avatar: item.avatar
          }));
          setEmployees(prev => [...prev, ...newEmployees]);
        }
      });
    }
  };

  const filteredEmployees = useMemo(() => {
    return employees.filter(employee =>
      employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.position.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, employees]);

  const totalPages = Math.ceil(filteredEmployees.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentEmployees = filteredEmployees.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  return (
   <div className="fadztrack-container">
      <nav className="navbar">
        <div className="navbar-left">
          <div className="logo">
            <div className="logo-icon">
              <div className="logo-triangle"></div>
            </div>
            <span className="logo-text">FadzTrack</span>
          </div>
          <div className="nav-links">
            <a href="#" className="nav-link">Movement</a>
            <a href="#" className="nav-link">Projects</a>
            <a href="#" className="nav-link">Chat</a>
            <a href="#" className="nav-link">Logs</a>
            <a href="#" className="nav-link">Reports</a>
          </div>
        </div>
        <div className="profile-avatar">Z</div>
      </nav>

      <main className="main-content">
        <div className="top-section">
          <div className="content-header">
            <button className="filter-btn">
              <Filter size={16} />
              Date Filter
            </button>
            
            <button
              className="upload-btn"
              onClick={() => fileInputRef.current && fileInputRef.current.click()}
            >
              Upload CSV
            </button>
            <input
              type="file"
              ref={fileInputRef}
              accept=".csv"
              style={{ display: 'none' }}
              onChange={handleCSVUpload}
            />

            <div className="search-container">
              <input 
                type="text" 
                className="search-input" 
                placeholder="Search Employee"
                value={searchTerm}
                onChange={handleSearchChange}
              />
              <Search className="search-icon" size={20} />
            </div>

            <div className="view-controls">
              <button className="view-btn">
                <Grid size={18} />
              </button>
              <button className="view-btn">
                <List size={18} />
              </button>
            </div>
          </div>
        </div>

        <div className="bottom-section">
          <div className="employee-list-container">
            <div className="employee-list">
              {currentEmployees.length === 0 ? (
                <div className="empty-state">
                  <h3>No employees found</h3>
                  <p>Try adjusting your search criteria</p>
                </div>
              ) : (
                currentEmployees.map(employee => (
                  <EmployeeRow key={employee.id} employee={employee} />
                ))
              )}
            </div>
          </div>

          {totalPages > 1 && (
            <Pagination 
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
            />
          )}
        </div>
      </main>
    </div>
  );
}
