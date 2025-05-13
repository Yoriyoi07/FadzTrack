import React, { useState,useEffect } from 'react';
import '../style/it_style/It_Dash.css';

const It_Dash = () => {
  const [accounts, setAccounts] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortOption, setSortOption] = useState('Newest');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateAccount, setShowCreateAccount] = useState(false);
  const [errors, setErrors] = useState({});
  const [editingAccount, setEditingAccount] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  const itemsPerPage = 10;

  const [newAccount, setNewAccount] = useState({
    name: '',
    position: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  const validateField = (name, value) => {
  let errorMsg = '';

  switch (name) {
    case 'name':
      if (!value.trim()) errorMsg = 'Name is required';
      break;
    case 'position':
      if (!value.trim()) errorMsg = 'Position is required';
      break;
    case 'phone':
      if (!/^\d{11}$/.test(value)) errorMsg = 'Phone must be 11 digits';
      break;
    case 'email':
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) errorMsg = 'Invalid email';
      break;
    case 'password':
      if (value.length < 6) errorMsg = 'Password must be at least 6 characters';
      break;
    case 'confirmPassword':
      if (value !== newAccount.password) errorMsg = 'Passwords do not match';
      break;
    default:
      break;
  }

  setErrors((prev) => ({ ...prev, [name]: errorMsg }));
};

  useEffect(() => {
  const fetchAccounts = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/auth/Users');
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
  setNewAccount((prev) => ({
    ...prev,
    [name]: value
  }));

  validateField(name, value);
};

const isFormValid = () => {
  const fieldNames = ['name', 'position', 'phone', 'email', 'password', 'confirmPassword'];
  let valid = true;

  fieldNames.forEach((field) => {
    validateField(field, newAccount[field]);
    if (newAccount[field] === '' || errors[field]) {
      valid = false;
    }
  });

  return valid;
};

const handleSaveAccount = async () => {
  if (!isFormValid()) {
    alert('Please correct the errors before submitting');
    return;
  }

  try {
    const method = isEditing ? 'PUT' : 'POST';
    const endpoint = isEditing 
      ? `http://localhost:5000/api/auth/users/${editingAccount.id}`
      : 'http://localhost:5000/api/auth/register';
    
    const response = await fetch(endpoint, {
      method: method,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: newAccount.name,
        role: newAccount.position,
        phone: newAccount.phone,
        email: newAccount.email,
        password: newAccount.password || undefined,
      })
    });

    const data = await response.json();

    if (!response.ok) {
      alert(`Error: ${data.msg}`);
      return;
    }

    if (isEditing) {
      // Update the local state
      setAccounts(accounts.map(account => 
        account.id === editingAccount.id 
          ? { ...account, ...data.user }
          : account
      ));
      alert('Account updated successfully!');
    } else {
      // Add the new account to the list
      setAccounts([...accounts, {
        id: data.user._id,
        name: data.user.name,
        position: data.user.role,
        phone: data.user.phone,
        email: data.user.email,
        status: data.user.status
      }]);
      alert('Account created successfully!');
    }

    // Clear the form
    setNewAccount({
      name: '',
      position: '',
      phone: '',
      email: '',
      password: '',
      confirmPassword: ''
    });

    setShowCreateAccount(false);
    setIsEditing(false);
    setEditingAccount(null);

  } catch (error) {
    console.error('Error saving account:', error);
    alert('Failed to save account. Please try again.');
  }
};


  const filteredAccounts = accounts.filter(account => {
    return account.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
           account.position.toLowerCase().includes(searchTerm.toLowerCase()) ||
           account.phone.toLowerCase().includes(searchTerm.toLowerCase()) ||
           account.email.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
const sortedAccounts = [...filteredAccounts].sort((a, b) => {
  switch (sortOption) {
    case 'Newest':
      return b.id.localeCompare(a.id); 
    case 'Oldest':
      return a.id.localeCompare(b.id);
    case 'A-Z':
      return a.name.localeCompare(b.name);
    case 'Z-A':
      return b.name.localeCompare(a.name);
    default:
      return 0;
  }
});
const currentAccounts = sortedAccounts.slice(indexOfFirstItem, indexOfLastItem);
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
          <h2>{isEditing ? 'Update Account' : 'Create New Account'}</h2>

          <div className="form-group">
            <input
              type="text"
              name="name"
              placeholder="Enter Name"
              value={newAccount.name}
              onChange={handleInputChange}
              className="form-control"
            />
            {errors.name && <div className="error-msg">{errors.name}</div>}
          </div>

          <div className="form-group">
            <select
              name="position"
              value={newAccount.position}
              onChange={handleInputChange}
              className="form-control"
            >
              <option value="">Position</option>
              <option value="Project Manager">Project Manager</option>
              <option value="Area Manager">Area Manager</option>
              <option value="Project in Charge">Project in Charge</option>
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
              maxLength="11"
            />
            {errors.phone && <div className="error-msg">{errors.phone}</div>}
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
            {errors.email && <div className="error-msg">{errors.email}</div>}
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
            {errors.password && <div className="error-msg">{errors.password}</div>}
          </div>

          <div className="form-group">
          <input
            type="password"
            name="confirmPassword"
            placeholder="Confirm Password"
            value={newAccount.confirmPassword}
            onChange={handleInputChange}
            className="form-control"
          />
          {errors.confirmPassword && <div className="error-msg">{errors.confirmPassword}</div>}
        </div>
          
          <div className="form-group button-group">
            <button className="create-account-btn" onClick={handleSaveAccount}>
            {isEditing ? 'Update Account' : 'Create New Account'}
            </button>
                      <button 
              className="back-btn" 
              onClick={() => {
                setShowCreateAccount(false);
                setIsEditing(false);
                setEditingAccount(null);
                setNewAccount({
                  name: '',
                  position: '',
                  phone: '',
                  email: '',
                  password: '',
                  confirmPassword: ''
                });
              }}
            >
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
              <h2>Hello, Admin!</h2>

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
                        <td>
                          <span className={`status-badge ${account.status.toLowerCase()}`}>
                            {account.status}
                          </span>
                        </td>
                        <td>
                           <button 
                            className="edit-button" 
                            onClick={() => {
                              setEditingAccount(account);
                              setIsEditing(true);
                              setShowCreateAccount(true);
                              setNewAccount({
                                name: account.name,
                                position: account.position,
                                phone: account.phone,
                                email: account.email,
                                password: '',
                                confirmPassword: ''
                              });
                            }}
                          >
                            ✏️
                          </button>
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