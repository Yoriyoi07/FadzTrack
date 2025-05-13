import React, { useState,useEffect } from 'react';
import '../style/it_style/It_Dash.css';

const It_Dash = () => {
  const [accounts, setAccounts] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortOption, setSortOption] = useState('Newest');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateAccount, setShowCreateAccount] = useState(false);

  const itemsPerPage = 8;

  const [newAccount, setNewAccount] = useState({
    name: '',
    position: '',
    phone: '',
    email: '',
    password: ''
  });

  useEffect(() => {
  const fetchAccounts = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/auth/all-users');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.msg || 'Failed to fetch accounts');
      }

      // Convert backend user data to match frontend table structure
      const formattedAccounts = data.map(user => ({
        id: user._id,
        name: user.name,
        position: user.role,
        phone: user.phone,
        email: user.email,
        status: user.status || 'Active' 
      }));

      setAccounts(formattedAccounts);
    } catch (error) {
      console.error('Error fetching accounts:', error);
    }
  };

  fetchAccounts();
}, []);


  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewAccount({
      ...newAccount,
      [name]: value
    });
  };

const handleCreateAccount = async () => {
  try {
    const response = await fetch('http://localhost:5000/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: newAccount.name,
        role: newAccount.position,
        phone: newAccount.phone,
        email: newAccount.email,
        password: newAccount.password
      })
    });

    const data = await response.json();

    if (!response.ok) {
      alert(`Error: ${data.msg}`);
      return;
    }

    // Update the local state
    setAccounts([...accounts, {
      id: data.user._id,
      name: data.user.name,
      position: data.user.role,
      phone: data.user.phone,
      email: data.user.email,
      status: data.user.status  // Use status from the backend
    }]);

    // Clear the form
    setNewAccount({
      name: '',
      position: '',
      phone: '',
      email: '',
      password: ''
    });

    setShowCreateAccount(false);
    alert('Account created successfully!');
  } catch (error) {
    console.error('Error creating account:', error);
    alert('Failed to create account. Please try again.');
  }
};

  const filteredAccounts = accounts.filter(account => {
    return account.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
           account.email.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentAccounts = filteredAccounts.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredAccounts.length / itemsPerPage);

  const goToPage = (pageNumber) => {
    if (pageNumber > 0 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  const renderSidebar = () => {
    if (!showCreateAccount) {
      return (
        <>
          <h2>Dashboard</h2>
          <button className="new-account-btn" onClick={() => setShowCreateAccount(true)}>
            Create New Account
          </button>

          <div className="user-profile-large">
            <div className="profile-avatar">J</div>
            <h3>Jane Cooper</h3>
            <p className="user-email">jane@microsoft.com</p>
            <p className="user-position">PM</p>
            <div className="status-indicator">
              <span className="status active">Active</span>
            </div>
          </div>
        </>
      );
    } else {
      return (
        <div className="create-account-sidebar">
          <h2>Create New Account</h2>

          <div className="form-group">
            <input
              type="text"
              name="name"
              placeholder="Enter Name"
              value={newAccount.name}
              onChange={handleInputChange}
              className="form-control"
            />
          </div>

          <div className="form-group">
            <select
              name="position"
              value={newAccount.position}
              onChange={handleInputChange}
              className="form-control"
            >
              <option value="">Position</option>
              <option value="PM">PM</option>
              <option value="AM">AM</option>
              <option value="PIC">PIC</option>
            </select>
          </div>

          <div className="form-group">
            <input
              type="text"
              name="phone"
              placeholder="Enter Phone Number"
              value={newAccount.phone}
              onChange={handleInputChange}
              className="form-control"
            />
          </div>

          <div className="form-group">
            <input
              type="email"
              name="email"
              placeholder="Enter Email"
              value={newAccount.email}
              onChange={handleInputChange}
              className="form-control"
            />
          </div>

          <div className="form-group">
            <input
              type="password"
              name="password"
              placeholder="Enter Password"
              value={newAccount.password}
              onChange={handleInputChange}
              className="form-control"
            />
          </div>

          <div className="form-group button-group">
            <button className="create-account-btn" onClick={handleCreateAccount}>
              Create New Account
            </button>
            <button className="back-btn" onClick={() => setShowCreateAccount(false)}>
              <span className="back-arrow">←</span> Back
            </button>
          </div>
        </div>
      );
    }
  };

  return (
    <div className="fadztrack-app">
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

      <div className="main-content">
        <aside className="sidebar">
          {renderSidebar()}
        </aside>

        <main className="dashboard-content">
          <div className="dashboard-card">
            <div className="welcome-header">
              <h2>Good Morning, ALECK!</h2>

              <div className="stats-container">
                <div className="stat-card">
                  <div className="stat-icon users">👥</div>
                  <div className="stat-info">
                    <div className="stat-label">Total Accounts</div>
                    <div className="stat-number">{accounts.length}</div>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon devices">💻</div>
                  <div className="stat-info">
                    <div className="stat-label">Total Active</div>
                    <div className="stat-number">{accounts.filter(a => a.status === 'Active').length}</div>
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
                        <td>{account.status}</td>
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
                    let pageNum = index + 1;
                    if (currentPage > 3 && totalPages > 5) {
                      pageNum = (currentPage + index) - 2;
                      if (pageNum > totalPages) pageNum = totalPages - 4 + index;
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

export default It_Dash;