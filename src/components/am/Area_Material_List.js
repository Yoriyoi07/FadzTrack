import { Search, List, LayoutGrid, ChevronLeft, ChevronRight } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../style/am_style/Area_Material_List.css';

export default function Area_Material_List() {
  const [filterStatus, setFilterStatus] = useState('All');
  const [viewMode, setViewMode] = useState('list'); 
  const navigate = useNavigate();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  // Sample data – first item follows Calatagan Towhomes design
  const [requests] = useState([
    {
      id: 1,
      type: 'Cement',
      project: 'Building A',
      requester: 'John Doe',
      date: '09/15/2022',
      status: 'Pending',
      icon: '📦'
    },
    {
      id: 2,
      type: 'Cement',
      project: 'Building A',
      requester: 'John Doe',
      date: '09/15/2022',
      status: 'Pending',
      icon: '📦'
    },
    {
      id: 3,
      type: 'Cement',
      project: 'Building A',
      requester: 'John Doe',
      date: '09/15/2022',
      status: 'Pending',
      icon: '📦'
    },
    {
      id: 4,
      type: 'Steel Bars',
      project: 'Infrastructure Project B',
      requester: 'Jane Smith',
      date: '09/20/2022',
      status: 'Rejected',
      icon: '🔧'
    },
    {
      id: 5,
      type: 'Steel Bars',
      project: 'Infrastructure Project B',
      requester: 'Jane Smith',
      date: '09/20/2022',
      status: 'Approved',
      icon: '🔧'
    },
    {
      id: 6,
      type: 'Bricks',
      project: 'Residential Development C',
      requester: 'Emily Brown',
      date: '09/25/2022',
      status: 'Rejected',
      icon: '🧱'
    },
    {
      id: 7,
      type: 'Bricks',
      project: 'Residential Development C',
      requester: 'Emily Brown',
      date: '09/25/2022',
      status: 'Approved',
      icon: '🧱'
    },
  ]);

  // Filter items based on selection
  const filteredRequests = requests.filter(request =>
    filterStatus === 'All' ? true : request.status === filterStatus
  );

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


  // Navigation items
  const navItems = ['Requests', 'Projects', 'Chat', 'Logs', 'Reports'];

  return (
    <div className="header-container">
      {/* Header with Navigation */}
      <header className="header">
        <div className="logo-container">
          <div className="logo">
            <div className="logo-building"></div>
            <div className="logo-flag"></div>
          </div>
          <h1 className="brand-name">FadzTrack</h1>
        </div>
        <nav className="nav-menu">
          <a href="#" className="nav-link">Requests</a>
          <a href="#" className="nav-link">Projects</a>
          <a href="#" className="nav-link">Chat</a>
          <a href="#" className="nav-link">Logs</a>
          <a href="#" className="nav-link">Reports</a>
        </nav>
        <div className="search-profile">
          <div className="search-container">
            <input type="text" placeholder="Search in site" className="search-input" />
            <button className="search-button">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </button>
          </div>
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
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        <div className="content-card">
          {/* Filters & View Toggle */}
          <div className="filters-container">
            <div className="filter-options">
              <span className="filter-label">
                <svg xmlns="http://www.w3.org/2000/svg" className="filter-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                </svg>
                Date Filter
              </span>
              {['All', 'Pending', 'Rejected', 'Approved'].map((status, index) => (
                <button
                  key={index}
                  className={`filter-button ${filterStatus === status ? 'active' : 'inactive'}`}
                  onClick={() => setFilterStatus(status)}
                >
                  {status}
                </button>
              ))}
            </div>
            <div className="view-options">
              <button 
                className={`view-button ${viewMode === 'list' ? 'active' : ''}`} 
                onClick={() => setViewMode('list')}
              >
                <List className="view-icon" />
              </button>
              <button 
                className={`view-button ${viewMode === 'grid' ? 'active' : ''}`} 
                onClick={() => setViewMode('grid')}
              >
                <LayoutGrid className="view-icon" />
              </button>
            </div>
          </div>

          {/* Scrollable Request List */}
          <div className="scrollable-list">
            <div className="request-list">
              {filteredRequests.map((request) => (
                <div key={request.id} className="request-item-card">
                  <div className="request-icon-circle">{request.icon}</div>
                  <div className="request-content">
                    <div className="request-info">
                      <h3 className="request-title">Request for {request.type}</h3>
                      <p className="project-name">Project: {request.project}</p>
                    </div>
                    <div className="request-meta">
                      <p className="requester-name">{request.requester}</p>
                      <p className="request-date">{request.date}</p>
                      <div className="request-actions">
                        {request.status === 'Pending' && (
                          <div className="action-buttons">
                            <button className="approve-button-circle">✓</button>
                            <button className="reject-button-circle">✕</button>
                          </div>
                        )}
                        {request.status === 'Approved' && (
                          <div className="status-badge approved">Approved</div>
                        )}
                        {request.status === 'Rejected' && (
                          <div className="status-badge rejected">Declined</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pagination */}
          <div className="pagination">
            <button className="pagination-arrow">
              <ChevronLeft className="pagination-arrow-icon" />
            </button>
            <button className="pagination-number active">1</button>
            <button className="pagination-number">2</button>
            <button className="pagination-number">3</button>
            <button className="pagination-number">4</button>
            <span className="pagination-ellipsis">...</span>
            <button className="pagination-number">40</button>
            <button className="pagination-arrow">
              <ChevronRight className="pagination-arrow-icon" />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}