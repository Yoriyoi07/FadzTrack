import React, { useEffect, useState } from 'react';
import axios from 'axios';
import '../style/it_style/It_Dash.css';

const ITAdminPage = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedUser, setSelectedUser] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        role: 'user',
        password: '',
        status: 'active'
    });

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const response = await axios.get('/api/users');
            setUsers(response.data);
        } catch (err) {
            setError('Failed to fetch users.');
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        try {
            await axios.post('/api/users', formData);
            fetchUsers();
            resetForm();
            alert('User created successfully');
        } catch (error) {
            alert('Failed to create user');
        }
    };

    const handleUpdateUser = async (e) => {
        e.preventDefault();
        try {
            await axios.put(`/api/users/${selectedUser._id}`, formData);
            fetchUsers();
            resetForm();
            setIsEditing(false);
            alert('User updated successfully');
        } catch (error) {
            alert('Failed to update user');
        }
    };

    const handleDeactivateUser = async (userId, currentStatus) => {
        const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
        const action = newStatus === 'active' ? 'activate' : 'deactivate';
        
        if (window.confirm(`Are you sure you want to ${action} this user?`)) {
            try {
                await axios.put(`/api/users/${userId}/status`, { status: newStatus });
                fetchUsers();
                alert(`User ${action}d successfully`);
            } catch (error) {
                alert(`Failed to ${action} user`);
            }
        }
    };

    const handleEdit = (user) => {
        setSelectedUser(user);
        setFormData({
            name: user.name,
            email: user.email,
            role: user.role,
            password: '',
            status: user.status || 'active'
        });
        setIsEditing(true);
    };

    const resetForm = () => {
        setFormData({
            name: '',
            email: '',
            role: 'user',
            password: '',
            status: 'active'
        });
        setSelectedUser(null);
        setIsEditing(false);
    };

    const getStatusBadgeClass = (status) => {
        return status === 'active' ? 'status-online' : 'status-offline';
    };

    return (
        <div className="dashboard-container">
            <div className="dashboard-content">
                <div className="dashboard-header">
                    <h1>IT Admin Dashboard</h1>
                    <p>Manage user accounts and permissions</p>
                </div>

                <div className="dashboard-grid">
                    <div className="dashboard-card">
                        <h2>{isEditing ? 'Edit User' : 'Create New User'}</h2>
                        <form onSubmit={isEditing ? handleUpdateUser : handleCreateUser}>
                            <div className="form-group">
                                <label>Name:</label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleInputChange}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Email:</label>
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleInputChange}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Role:</label>
                                <select
                                    name="role"
                                    value={formData.role}
                                    onChange={handleInputChange}
                                >
                                    <option value="user">User</option>
                                    <option value="project_manager">Project Manager</option>
                                    <option value="area_manager">Area Manager</option>
                                    <option value="it_admin">IT Admin</option>
                                    <option value="hr">HR</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Password:</label>
                                <input
                                    type="password"
                                    name="password"
                                    value={formData.password}
                                    onChange={handleInputChange}
                                    required={!isEditing}
                                />
                            </div>
                            <div className="form-actions">
                                <button type="submit" className="btn-primary">
                                    {isEditing ? 'Update User' : 'Create User'}
                                </button>
                                {isEditing && (
                                    <button type="button" onClick={resetForm} className="btn-secondary">
                                        Cancel
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>

                    <div className="dashboard-card">
                        <h2>User Management</h2>
                        {loading ? (
                            <p>Loading users...</p>
                        ) : error ? (
                            <p className="error">{error}</p>
                        ) : (
                            <div className="table-container">
                                <table className="activity-table">
                                    <thead>
                                        <tr>
                                            <th>Name</th>
                                            <th>Email</th>
                                            <th>Role</th>
                                            <th>Status</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {users.map(user => (
                                            <tr key={user._id}>
                                                <td className="user-email">{user.name}</td>
                                                <td>{user.email}</td>
                                                <td>{user.role}</td>
                                                <td>
                                                    <span className={`status-badge ${getStatusBadgeClass(user.status)}`}>
                                                        {user.status || 'active'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <button
                                                        onClick={() => handleEdit(user)}
                                                        className="btn-secondary"
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeactivateUser(user._id, user.status)}
                                                        className={user.status === 'active' ? 'btn-danger' : 'btn-primary'}
                                                    >
                                                        {user.status === 'active' ? 'Deactivate' : 'Activate'}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ITAdminPage;
