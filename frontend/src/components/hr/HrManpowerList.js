// Hr_ManpowerList.jsx
// This is your updated React component with fixed layout, horizontal pagination, and visible controls

import React, { useState, useMemo, useRef, useEffect } from 'react';
import axios from 'axios';
import Papa from 'papaparse';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Filter } from 'lucide-react';
import '../style/hr_style/Hr_ManpowerList.css';

const ITEMS_PER_PAGE = 7;

function ManpowerRow({ manpower }) {
  return (
    <div className="hr-mlist-employee-row">
      <div className="hr-mlist-employee-info-cell">
        <img src={manpower.avatar} alt={manpower.name} className="hr-mlist-employee-avatar" />
        <div className="hr-mlist-employee-details">
          <h4 className="hr-mlist-employee-name">{manpower.name}</h4>
          <p className="hr-mlist-employee-position">Position: {manpower.position}</p>
        </div>
      </div>
      <div className="hr-mlist-project-cell">
        <span className="hr-mlist-project-name">{manpower.project}</span>
      </div>
      <div className="hr-mlist-status-cell">
      <span className={`status-badge ${manpower.status.toLowerCase() === 'active' ? 'status-active' : 'status-inactive'}`}>
        {manpower.status}
      </span>
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
    <div className="hr-mlist-pagination-wrapper">
      <span className="hr-mlist-pagination-info">
        Showing {showingRange.start} to {showingRange.end} of {totalEntries} entries.
      </span>
      <div className="hr-mlist-pagination">
        <button className="pagination-btn" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1}>
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
        <button className="pagination-btn" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages}>
          &gt;
        </button>
      </div>
    </div>
  );
}

export default function Hr_ManpowerList() {
  const [manpowers, setManpowers] = useState();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    axios.get('http://localhost:5000/api/manpower')
      .then(response => setManpowers(response.data))
      .catch(error => console.error('Error fetching manpower:', error));
  }, []);

  const handleCSVUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: function (results) {
          const parsedManpower = results.data.map(item => ({
            name: item.name,
            position: item.position,
            status: item.status,
            project: item.project || 'N/A',
            avatar: item.avatar
          }));
          axios.post('http://localhost:5000/api/manpower/bulk', { manpowers: parsedManpower })
            .then(response => setManpowers(prev => [...prev, ...response.data]))
            .catch(error => console.error('Error uploading manpower CSV data:', error));
        }
      });
    }
  };

  const handleExportCSV = () => {
    const csvData = (manpowers || []).map(mp => ({
      name: mp.name,
      position: mp.position,
      status: mp.status,
      project: mp.project,
      avatar: mp.avatar
    }));
    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'manpower_export.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredManpower = useMemo(() => {
    if (!manpowers) return [];
    return manpowers.filter(manpower =>
      manpower.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      manpower.position.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, manpowers]);

  const totalPages = Math.ceil(filteredManpower.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentManpower = filteredManpower.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const handlePageChange = (page) => setCurrentPage(page);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.profile-menu-container')) setProfileMenuOpen(false);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  return (
    <div className="fadztrack-container">
      <header className="header">
        <div className="logo-container">
          <img src={require('../../assets/images/FadzLogo1.png')} alt="FadzTrack Logo" className="logo-img" />
          <h1 className="brand-name">FadzTrack</h1>
        </div>
        <nav className="nav-menu">
          <Link to="/hr/dash" className="nav-link">Dashboard</Link>
          <Link to="/hr/mlist" className="nav-link">Manpower</Link>
          <Link to="/hr/movement" className="nav-link">Movement</Link>
          <Link to="/ceo/proj" className="nav-link">Projects</Link>
          <Link to="/chat" className="nav-link">Chat</Link>
          <Link to="/logs" className="nav-link">Logs</Link>
        </nav>
        <div className="profile-menu-container">
          <div className="profile-circle" onClick={() => setProfileMenuOpen(!profileMenuOpen)}>Z</div>
          {profileMenuOpen && (
            <div className="profile-menu">
              <button onClick={handleLogout}>Logout</button>
            </div>
          )}
        </div>
      </header>

      <main className="hr-mlist-main-content">
        <div className="hr-mlist-top-section">
          <div className="hr-mlist-content-header">
            <button className="hr-mlist-filter-btn"><Filter size={16} /> Date Filter</button>
            <button className="hr-mlist-upload-btn" onClick={() => fileInputRef.current?.click()}>Upload CSV</button>
            <input type="file" ref={fileInputRef} accept=".csv" style={{ display: 'none' }} onChange={handleCSVUpload} />
            <button className="hr-mlist-upload-btn" onClick={handleExportCSV}>Export CSV</button>
            <div className="hr-mlist-search-container">
              <input
                type="text"
                className="hr-mlist-search-input"
                placeholder="Search Manpower"
                value={searchTerm}
                onChange={handleSearchChange}
              />
              <Search className="hr-mlist-search-icon" size={20} />
            </div>
          </div>
        </div>

        <div className="hr-mlist-bottom-section">
          <div className="hr-mlist-employee-list-container">
            <div className="hr-mlist-employee-list">
              {currentManpower.length === 0 ? (
                <div className="hr-mlist-empty-state">
                  <h3>No manpower found</h3>
                  <p>Try adjusting your search criteria</p>
                </div>
              ) : (
                currentManpower.map(manpower => (
                  <ManpowerRow key={manpower._id || manpower.name} manpower={manpower} />
                ))
              )}
            </div>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalEntries={filteredManpower.length}
              showingRange={{
                start: startIndex + 1,
                end: Math.min(startIndex + ITEMS_PER_PAGE, filteredManpower.length)
              }}
              onPageChange={handlePageChange}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
