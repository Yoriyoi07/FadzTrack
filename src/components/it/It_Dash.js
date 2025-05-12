import React, { useState } from 'react';
import '../style/it_style/It_Dash.css'; // Import your CSS file for styling

const FadzTrackDashboard = () => {
  // Sample data for accounts
  const [accounts, setAccounts] = useState([
    { id: 1, name: 'Jane Cooper', position: 'PM', phone: '(225) 555-0118', email: 'jane@microsoft.com', notes: '2316dzjc', status: 'Active' },
    { id: 2, name: 'Floyd Miles', position: 'AM', phone: '(205) 555-0100', email: 'floyd@yahoo.com', notes: 'nghagfkufi', status: 'Inactive' },
    { id: 3, name: 'Ronald Richards', position: 'PIC', phone: '(302) 555-0107', email: 'ronald@adobe.com', notes: '3lsfynqb', status: 'Inactive' },
    { id: 4, name: 'Marvin McKinney', position: 'PIC', phone: '(252) 555-0126', email: 'marvin@tesla.com', notes: 'happylert today', status: 'Active' },
    { id: 5, name: 'Jerome Bell', position: 'PIC', phone: '(629) 555-0129', email: 'jerome@google.com', notes: 'esdgj63', status: 'Active' },
    { id: 6, name: 'Kathryn Murphy', position: 'PIC', phone: '(406) 555-0120', email: 'kathryn@microsoft.com', notes: 'dsaufhgh as6', status: 'Active' },
    { id: 7, name: 'Jacob Jones', position: 'PIC', phone: '(208) 555-0112', email: 'jacob@yahoo.com', notes: 'sddbwng hk3', status: 'Active' },
    { id: 8, name: 'Kristin Watson', position: 'PIC', phone: '(704) 555-0127', email: 'kristin@facebook.com', notes: 'epdhfhysjs', status: 'Inactive' },
  ]);

  const [currentPage, setCurrentPage] = useState(1);
  const [sortOption, setSortOption] = useState('Newest');
  const [searchTerm, setSearchTerm] = useState('');
  const itemsPerPage = 8;

  // Filter accounts based on search term
  const filteredAccounts = accounts.filter(account => {
    return account.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
           account.email.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // Calculate pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentAccounts = filteredAccounts.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredAccounts.length / itemsPerPage);

  // Handle page change
  const goToPage = (pageNumber) => {
    if (pageNumber > 0 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  return (
    <div className="fadztrack-app">
      {/* Header */}
      <header className="app-header">
        <div className="logo-container">
          <img src="/logo.png" alt="FadzTrack Logo" className="logo" />
          <h1>FadzTrack</h1>
        </div>
        <nav className="main-nav">
          <ul>
            <li className="active">Requests</li>
            <li>Projects</li>
            <li>Chat</li>
            <li>Logs</li>
            <li>Reports</li>
          </ul>
        </nav>
        <div className="search-container">
          <input type="text" placeholder="Search in site" />
          <button className="search-button">🔍</button>
        </div>
        <div className="user-profile">
          <div className="avatar">Z</div>
        </div>
      </header>

      {/* Main Content */}
      <div className="main-content">
        {/* Sidebar */}
        <aside className="sidebar">
          <h2>Dashboard</h2>
          <button className="new-account-btn">Create New Account</button>
          
          <div className="user-profile-large">
            <div className="profile-avatar">J</div>
            <h3>Jane Cooper</h3>
            <p className="user-email">jane@microsoft.com</p>
            <p className="user-position">PM</p>
            <div className="status-indicator">
              <span className="status active">Active</span>
            </div>
          </div>
        </aside>

        {/* Dashboard Content */}
        <main className="dashboard-content">
          <div className="dashboard-card">
            <div className="welcome-header">
              <h2>Good Morning, ALECK!</h2>
              
              <div className="stats-container">
                <div className="stat-card">
                  <div className="stat-icon users">👥</div>
                  <div className="stat-info">
                    <div className="stat-label">Total Accounts</div>
                    <div className="stat-number">123</div>
                  </div>
                </div>
                
                <div className="stat-card">
                  <div className="stat-icon devices">💻</div>
                  <div className="stat-info">
                    <div className="stat-label">Total Active</div>
                    <div className="stat-number">189</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="accounts-section">
              <div className="accounts-header">
                <h3>Accounts:</h3>
                <div className="accounts-tools">
                  <div className="search-box">
                    <input 
                      type="text" 
                      placeholder="Search" 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <span className="search-icon">🔍</span>
                  </div>
                  <div className="sort-dropdown">
                    <span>Sort by: </span>
                    <select 
                      value={sortOption}
                      onChange={(e) => setSortOption(e.target.value)}
                    >
                      <option value="Newest">Newest</option>
                      <option value="Oldest">Oldest</option>
                      <option value="A-Z">A-Z</option>
                      <option value="Z-A">Z-A</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="accounts-table">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Position</th>
                      <th>Phone Number</th>
                      <th>Email</th>
                      <th>Notes</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentAccounts.map(account => (
                      <tr key={account.id}>
                        <td>{account.name}</td>
                        <td>{account.position}</td>
                        <td>{account.phone}</td>
                        <td>{account.email}</td>
                        <td>{account.notes}</td>
                        <td>
                          <span className={`status-badge ${account.status.toLowerCase()}`}>
                            {account.status}
                          </span>
                        </td>
                        <td>
                          <button className="edit-button">✏️</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="pagination">
                <span className="pagination-info">
                  Showing data 1 to {currentAccounts.length} of {filteredAccounts.length} entries.
                </span>
                <div className="pagination-controls">
                  <button 
                    className="pagination-btn prev" 
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    &lt;
                  </button>
                  
                  {Array.from({ length: Math.min(5, totalPages) }, (_, index) => {
                    // Show different page numbers based on current page
                    let pageNum = index + 1;
                    if (currentPage > 3 && totalPages > 5) {
                      // Adjust which page numbers to show
                      if (currentPage + 2 <= totalPages) {
                        pageNum = (currentPage - 2) + index;
                      } else {
                        pageNum = (totalPages - 4) + index;
                      }
                    }
                    
                    return (
                      <button 
                        key={index}
                        className={`pagination-btn ${pageNum === currentPage ? 'active' : ''}`}
                        onClick={() => goToPage(pageNum)}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  
                  <button 
                    className="pagination-btn next" 
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    &gt;
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default FadzTrackDashboard;