import React, { useState } from 'react';
import { Search, List, LayoutGrid, ChevronLeft, ChevronRight } from 'lucide-react';
import '../style/am_style/Area_Manpower_List.css';

export default function Area_Manpower_List() {
  // State for filter selection and view mode
  const [filterStatus, setFilterStatus] = useState('All');
  const [viewMode, setViewMode] = useState('list');

  // Sample data
  const [requests] = useState([
    {
      id: 1,
      type: 'Calatagan Towhomes',
      project: 'Calatagan Towhomes',
      requester: 'Rychca Miralles',
      date: '09/15/2022',
      status: 'Pending',
      icon: '📦',
    },
    {
      id: 2,
      type: 'Cement',
      project: 'Building A',
      requester: 'John Doe',
      date: '09/15/2022',
      status: 'Approved',
      icon: '📦',
    },
    {
      id: 3,
      type: 'Cement',
      project: 'Building A',
      requester: 'John Doe',
      date: '09/15/2022',
      status: 'Rejected',
      icon: '📦',
    },
    {
      id: 4,
      type: 'Steel Bars',
      project: 'Infrastructure Project B',
      requester: 'Jane Smith',
      date: '09/20/2022',
      status: 'Rejected',
      icon: '🔧',
    },
    {
      id: 5,
      type: 'Steel Bars',
      project: 'Infrastructure Project B',
      requester: 'Jane Smith',
      date: '09/20/2022',
      status: 'Approved',
      icon: '🔧',
    },
    {
      id: 6,
      type: 'Bricks',
      project: 'Residential Development C',
      requester: 'Emily Brown',
      date: '09/25/2022',
      status: 'Rejected',
      icon: '🧱',
    },
    {
      id: 7,
      type: 'Bricks',
      project: 'Residential Development C',
      requester: 'Emily Brown',
      date: '09/25/2022',
      status: 'Approved',
      icon: '🧱',
    },
  ]);

  // Filter the items based on the selected status
  const filteredRequests = requests.filter((request) =>
    filterStatus === 'All' ? true : request.status === filterStatus
  );

  // Navigation items
  const navItems = ['Requests', 'Projects', 'Chat', 'Logs', 'Reports'];

  return (
    <div className="app-container">
      {/* Navbar */}
      <nav className="navbar">
        <div className="logo-container">
          <div className="logo">
            <div className="logo-base"></div>
            <div className="logo-top"></div>
          </div>
          <span className="brand-name">FadzTrack</span>
        </div>
        <ul className="nav-items">
          {navItems.map((item, idx) => (
            <li key={idx}>
              <button className={`nav-button ${item === 'Requests' ? 'active' : 'inactive'}`}>
                {item}
              </button>
            </li>
          ))}
        </ul>
        <div className="search-container">
          <input type="text" placeholder="Search in site" className="search-input" />
          <Search className="search-icon" />
        </div>
        <div className="user-avatar">Z</div>
      </nav>

      {/* Main Content */}
      <main className="main-content">
        <div className="content-card">
          {/* Filters */}
          <div className="filters-container">
            <div className="filter-options">
              <span className="filter-label">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="filter-icon"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"
                  />
                </svg>
                Date Filter
              </span>
              {['All', 'Pending', 'Rejected', 'Approved'].map((status, index) => (
                <button
                  key={index}
                  className={`filter-button ${filterStatus === status ? 'active' : 'inactive'}`}
                  onClick={() => setFilterStatus(status)}>
                  {status}
                </button>
              ))}
            </div>
            <div className="view-options">
              <button
                className={`view-button ${viewMode === 'list' ? 'active' : ''}`}
                onClick={() => setViewMode('list')}>
                <List className="view-icon" />
              </button>
              <button
                className={`view-button ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => setViewMode('grid')}>
                <LayoutGrid className="view-icon" />
              </button>
            </div>
          </div>

          {/* Request List - Wrapped in a scrollable container */}
          <div className="request-list scrollable">
            {filteredRequests.map((request) => (
              <div key={request.id} className="request-item">
                <div className="request-info">
                  <div className="request-icon">{request.icon}</div>
                  <div className="request-details">
                    <h3 className="request-title">Request for {request.type}</h3>
                    <p className="request-project">Project: {request.project}</p>
                  </div>
                </div>
                <div className="request-meta">
                  <div className="requester-info">
                    <p className="requester-name">{request.requester}</p>
                    <p className="request-date">{request.date}</p>
                  </div>
                  {request.status === 'Pending' && (
                    <div className="request-actions">
                      <button className="approve-button">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="approve-icon"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </button>
                      <button className="reject-button">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="reject-icon"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>
                  )}
                  {request.status === 'Approved' && (
                    <div className="status-badge status-approved">Approved</div>
                  )}
                  {request.status === 'Rejected' && (
                    <div className="status-badge status-declined">Declined</div>
                  )}
                </div>
              </div>
            ))}
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
