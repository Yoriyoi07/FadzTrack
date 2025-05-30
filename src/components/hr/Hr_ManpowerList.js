import React, { useState, useMemo, useRef, useEffect } from 'react';
import axios from 'axios';
import Papa from 'papaparse';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Calendar, Grid, List, Upload, Filter } from 'lucide-react';
import '../style/hr_style/Hr_ManpowerList.css';
import FadzLogo1 from '../../assets/images/FadzLogo1.png';

const ITEMS_PER_PAGE = 7;

function ManpowerRow({ manpower }) {
  return (
    <div className="employee-row">
      <div className="employee-info-cell">
        <img src={manpower.avatar} alt={manpower.name} className="employee-avatar" />
        <div className="employee-details">
          <h4 className="employee-name">{manpower.name}</h4>
          <p className="employee-position">Position: {manpower.position}</p>
        </div>
      </div>
      
      <div className="project-cell">
        <span className="project-name">{manpower.project}</span>
      </div>
      
      <div className="status-cell">
        <span className={`status-badge status-${manpower.status.toLowerCase()}`}>
          {manpower.status}
        </span>
      </div>
    </div>
  );
}

function Pagination({ currentPage, totalPages, onPageChange }) {
  const getVisiblePages = () => {
    const delta = 2;
    const range = [];
    const rangeWithDots = [];
    
    for (let i = Math.max(2, currentPage - delta); 
         i <= Math.min(totalPages - 1, currentPage + delta); 
         i++) {
      range.push(i);
    }

    if (currentPage - delta > 2) {
      rangeWithDots.push(1, '...');
    } else {
      rangeWithDots.push(1);
    }

    rangeWithDots.push(...range);

    if (currentPage + delta < totalPages - 1) {
      rangeWithDots.push('...', totalPages);
    } else {
      rangeWithDots.push(totalPages);
    }

    return rangeWithDots;
  };

  if (totalPages <= 1) return null;

  const visiblePages = getVisiblePages();

  return (
    <div className="pagination-wrapper">
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
            className={`pagination-btn ${
              page === '...' ? 'dots' : ''
            } ${page === currentPage ? 'active' : ''}`}
            onClick={() => typeof page === 'number' ? onPageChange(page) : null}
            disabled={page === '...'}
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


export default function Hr_ManpowerList() {
  const [manpowers, setManpowers] = useState();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    axios.get('http://localhost:5000/api/manpower')
      .then(response => {
        setManpowers(response.data);
      })
      .catch(error => {
        console.error('Error fetching manpower:', error);
      });
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
            .then(response => {
              setManpowers(prev => [...prev, ...response.data]);
            })
            .catch(error => {
              console.error('Error uploading manpower CSV data:', error);
            });
        }
      });
    }
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

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest(".profile-menu-container")) {
        setProfileMenuOpen(false);
      }
    };
    
    document.addEventListener("click", handleClickOutside);
    
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  return (
   <div className="fadztrack-container">
      {/* Header with Navigation */}
      <header className="header">
        <div className="logo-container">
          <img src={require('../../assets/images/FadzLogo1.png')} alt="FadzTrack Logo" className="logo-img" />
          <h1 className="brand-name">FadzTrack</h1>
        </div>
          <nav className="nav-menu">
            <Link to="/hr/dash" className="nav-link">Dashboard</Link>
            <Link to="/hr/mlist" className="nav-link">Manpower</Link>
            <Link to="/requests" className="nav-link">Movement</Link>
            <Link to="/ceo/proj" className="nav-link">Projects</Link>
            <Link to="/chat" className="nav-link">Chat</Link>
            <Link to="/logs" className="nav-link">Logs</Link>
          </nav>
          <div className="profile-menu-container">
            <div 
              className="profile-circle" 
              onClick={() => setProfileMenuOpen(!profileMenuOpen)}
            >
              Z
            </div>
            {profileMenuOpen && (
              <div className="profile-menu">
                <button onClick={handleLogout}>Logout</button>
              </div>
            )}
          </div>
      </header>


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
                placeholder="Search Manpower"
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
              {currentManpower.length === 0 ? (
                <div className="empty-state">
                  <h3>No manpower found</h3>
                  <p>Try adjusting your search criteria</p>
                </div>
              ) : (
                currentManpower.map(manpower => (
                  <ManpowerRow key={manpower._id} manpower={manpower} />
                ))
              )}
            </div>
          </div>

          <Pagination 
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        </div>
      </main>
    </div>
  );
}
