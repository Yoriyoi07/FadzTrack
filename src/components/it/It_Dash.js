import React from 'react';
import '../style/it_style/It_Dash.css'; 

const IT_Dash = () => {
  return (
    <div className="dashboard-container">
      <div className="dashboard-content">
        <header className="dashboard-header">
          <h1>IT Dashboard</h1>
          <p>Manage your IT resources and accounts</p>
        </header>

        <div className="dashboard-grid">
          {/* Account Management Card */}
          <div className="dashboard-card">
            <h2>Account Management</h2>
            <ul className="dashboard-list">
              <li>
                <a href="/create-account" className="dashboard-link">
                  <span className="icon">➕</span> Create New Account
                </a>
              </li>
              <li>
                <a href="/manage-accounts" className="dashboard-link">
                  <span className="icon">👥</span> Manage Existing Accounts
                </a>
              </li>
            </ul>
          </div>

          {/* System Status Card */}
          <div className="dashboard-card">
            <h2>System Status</h2>
            <div className="status-list">
              <div className="status-item">
                <span>Servers</span>
                <span className="status-badge status-online">Online</span>
              </div>
              <div className="status-item">
                <span>Database</span>
                <span className="status-badge status-online">Online</span>
              </div>
              <div className="status-item">
                <span>Email Service</span>
                <span className="status-badge status-online">Online</span>
              </div>
            </div>
          </div>

          {/* Quick Stats Card */}
          <div className="dashboard-card">
            <h2>Quick Stats</h2>
            <div className="stats-list">
              <div className="stats-item">
                <span>Active Users</span>
                <span className="stats-value">247</span>
              </div>
              <div className="stats-item">
                <span>Open Tickets</span>
                <span className="stats-value">12</span>
              </div>
              <div className="stats-item">
                <span>Pending Approvals</span>
                <span className="stats-value">5</span>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity Section */}
        <div className="activity-section">
          <h2>Recent Activity</h2>
          <div className="table-container">
            <table className="activity-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Today, 10:23 AM</td>
                  <td className="user-email">john.doe@example.com</td>
                  <td>Account Created</td>
                  <td className="status-completed">Completed</td>
                </tr>
                <tr>
                  <td>Today, 09:41 AM</td>
                  <td className="user-email">sarah.smith@example.com</td>
                  <td>Password Reset</td>
                  <td className="status-completed">Completed</td>
                </tr>
                <tr>
                  <td>Yesterday, 3:12 PM</td>
                  <td className="user-email">admin@example.com</td>
                  <td>System Update</td>
                  <td className="status-pending">Pending</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IT_Dash;