import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../api/axiosInstance'; // Use Axios instance!
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
  const navigate = useNavigate();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

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
        if (value !== newAccount.password || '') errorMsg = 'Passwords do not match';
        break;
      default:
        break;
    }

    setErrors((prev) => ({ ...prev, [name]: errorMsg }));
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest(".profile-menu-container-IT")) {
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

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const response = await api.get('/auth/Users');
        const data = response.data;
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
      let response, data;
      if (isEditing) {
        response = await api.put(`/auth/users/${editingAccount.id}`, {
          name: newAccount.name,
          role: newAccount.position,
          phone: newAccount.phone,
          email: newAccount.email,
          password: newAccount.password || undefined,
        });
        data = response.data;
        setAccounts(accounts.map(account =>
          account.id === editingAccount.id
            ? { ...account, ...data.user }
            : account
        ));
        alert('Account updated successfully!');
      } else {
        response = await api.post('/auth/register', {
          name: newAccount.name,
          role: newAccount.position,
          phone: newAccount.phone,
          email: newAccount.email,
          password: newAccount.password,
        });
        data = response.data;
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

  const handleToggleAccountStatus = async (account) => {
    const newStatus = account.status === 'Active' ? 'Inactive' : 'Active';
    if (newStatus === 'Inactive') {
      const confirm = window.confirm(`Are you sure you want to deactivate ${account.name}'s account?`);
      if (!confirm) return;
    }
    if (newStatus === 'Active') {
      const confirm = window.confirm(`Are you sure you want to activate ${account.name}'s account?`);
      if (!confirm) return;
    }
    try {
      const response = await api.put(`/auth/users/${account.id}/status`, { status: newStatus });
      if (response.data) {
        setAccounts(prevAccounts =>
          prevAccounts.map(a =>
            a.id === account.id ? { ...a, status: newStatus } : a
          )
        );
        alert(`Account ${newStatus === 'Inactive' ? 'disabled' : 'enabled'} successfully.`);
      }
    } catch (error) {
      console.error('Failed to toggle account status:', error);
      alert('An error occurred. Please try again.');
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
          <button className="new-account-btn-IT" onClick={() => setShowCreateAccount(true)}>
            Create New Account
          </button>
          <div className="user-profile-large-IT">
            <div className="profile-avatar-IT">J</div>
            <h3>Jane Cooper</h3>
            <p className="user-email-IT">jane@microsoft.com</p>
            <p className="user-position-IT">PM</p>
            <div className="status-indicator-IT">
              <span className="status-IT active-IT">Active</span>
            </div>
          </div>
        </>
      );
    } else {
      return (
        <div className="create-account-sidebar-IT">
          <h2>{isEditing ? 'Update Account' : 'Create New Account'}</h2>
          <div className="form-group-IT">
            <input
              type="text"
              name="name"
              placeholder="Enter Name"
              value={newAccount.name}
              onChange={handleInputChange}
              className="form-control-IT"
            />
            {errors.name && <div className="error-msg-IT">{errors.name}</div>}
          </div>
          <div className="form-group-IT">
            <select
              name="position"
              value={newAccount.position}
              onChange={handleInputChange}
              className="form-control-IT"
            >
              <option value="">Position</option>
              <option value="Project Manager">Project Manager</option>
              <option value="Area Manager">Area Manager</option>
              <option value="Person in Charge">Person in Charge</option>
            </select>
          </div>
          <div className="form-group-IT">
            <input
              type="text"
              name="phone"
              placeholder="Enter Phone Number"
              value={newAccount.phone}
              onChange={handleInputChange}
              className="form-control-IT"
              maxLength="11"
            />
            {errors.phone && <div className="error-msg-IT">{errors.phone}</div>}
          </div>
          <div className="form-group-IT">
            <input
              type="email"
              name="email"
              placeholder="Enter Email"
              value={newAccount.email}
              onChange={handleInputChange}
              className="form-control-IT"
            />
            {errors.email && <div className="error-msg-IT">{errors.email}</div>}
          </div>
          <div className="form-group-IT">
            <input
              type="password"
              name="password"
              placeholder="Enter Password"
              value={newAccount.password}
              onChange={handleInputChange}
              className="form-control-IT"
            />
            {errors.password && <div className="error-msg-IT">{errors.password}</div>}
          </div>
          <div className="form-group-IT">
            <input
              type="password"
              name="confirmPassword"
              placeholder="Confirm Password"
              value={newAccount.confirmPassword}
              onChange={handleInputChange}
              className="form-control-IT"
            />
            {errors.confirmPassword && <div className="error-msg-IT">{errors.confirmPassword}</div>}
          </div>
          <div className="form-group-IT button-group-IT">
            <button className="create-account-btn-IT" onClick={handleSaveAccount}>
              {isEditing ? 'Update Account' : 'Create New Account'}
            </button>
            <button
              className="back-btn-IT"
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
              <span className="back-arrow-IT">←</span> Back
            </button>
          </div>
        </div>
      );
    }
  };

  return (
    <div className="fadztrack-app-IT">
      <div className="head-IT">
        {/* Header with Navigation */}
        <header className="header-IT">
          <div className="logo-container-IT">
            <div className="logo-IT">
              <div className="logo-building-IT"></div>
              <div className="logo-flag-IT"></div>
            </div>
            <h1 className="brand-name-IT">FadzTrack</h1>
          </div>
          <nav className="nav-menu-IT">
            <a href="#" className="nav-link-IT">Dashboard</a>
            <a href="#" className="nav-link-IT">Chat</a>
          </nav>
          <div className="search-profile-IT">
            <div className="search-container-IT">
              <input type="text" placeholder="Search in site" className="search-input-IT" />
              <button className="search-button-IT">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
              </button>
            </div>
            <div className="profile-menu-container-IT">
              <div
                className="profile-circle-IT"
                onClick={() => setProfileMenuOpen(!profileMenuOpen)}
              >
                Z
              </div>
              {profileMenuOpen && (
                <div className="profile-menu-IT">
                  <button onClick={handleLogout}>Logout</button>
                </div>
              )}
            </div>
          </div>
        </header>
      </div>
      <div className="main-content-IT">
        <aside className="sidebar-IT">
          {renderSidebar()}
        </aside>
        <main className="dashboard-content-IT">
          <div className="dashboard-card-IT">
            <div className="welcome-header-IT">
              <h2>Hello, Admin!</h2>
              <div className="stats-container-IT">
                <div className="stat-card-IT">
                  <div className="stat-icon-IT users-IT">👥</div>
                  <div className="stat-info-IT">
                    <div className="stat-label-IT">Total Accounts</div>
                    <div className="stat-number-IT">{accounts.length}</div>
                  </div>
                </div>
                <div className="stat-card-IT">
                  <div className="stat-icon-IT devices-IT">💻</div>
                  <div className="stat-info-IT">
                    <div className="stat-label-IT">Total Active</div>
                    <div className="stat-number-IT">{accounts.filter(a => a.status === 'Active').length}</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="accounts-section-IT">
              <div className="accounts-header-IT">
                <h3>Accounts:</h3>
                <div className="accounts-tools-IT">
                  <div className="search-box-IT">
                    <input
                      type="text"
                      placeholder="Search"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="search-input-IT"
                    />
                  </div>
                  <div className="sort-dropdown-IT">
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
              <div className="accounts-table-IT">
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
                          <span className={`status-badge-IT ${account.status.toLowerCase()}-IT`}>
                            {account.status}
                          </span>
                        </td>
                        <td>
                          <button
                            className="edit-button-IT"
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
                        <td>
                          <button
                            className={`status-toggle-button-IT ${account.status === 'Active' ? 'deactivate-IT' : 'activate-IT'}`}
                            onClick={() => handleToggleAccountStatus(account)}
                          >
                            {account.status === 'Active' ? 'Disable' : 'Enable'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="pagination-IT">
                <span className="pagination-info-IT">
                  Showing data 1 to {currentAccounts.length} of {filteredAccounts.length} entries.
                </span>
                <div className="pagination-controls-IT">
                  <button
                    className="pagination-btn-IT prev-IT"
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
                        className={`pagination-btn-IT ${pageNum === currentPage ? 'active-IT' : ''}`}
                        onClick={() => goToPage(pageNum)}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  <button
                    className="pagination-btn-IT next-IT"
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
