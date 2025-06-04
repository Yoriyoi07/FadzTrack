import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../style/hr_style/Hr_Movement_List.css';

export default function HrManpowerMovement() {
  const [requests, setRequests] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 7;

  const navigate = useNavigate();

  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  useEffect(() => {
    fetch('http://localhost:5000/api/manpower-requests')
      .then(res => res.json())
      .then(data => {
        const approved = data.filter(req => req.status?.toLowerCase() === 'approved');
        setRequests(approved);
      })
      .catch(err => console.error('Error loading approved requests:', err));
  }, []);

  const totalPages = Math.ceil(requests.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentRequests = requests.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const handlePageChange = (page) => setCurrentPage(page);

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

      <main className="hr-movelist-container">
        <div className="hr-movelist-content">
          {currentRequests.map((req, index) => (
            <div className="hr-movelist-item" key={req._id || index}>
              <div className="hr-movelist-details">
                <strong>Manpower Request for{" "}{req.manpowers?.length > 0
                    ? req.manpowers.map(mp => `${mp.quantity} ${mp.type}`).join(", ")
                    : "N/A"}
                </strong>
                <p>Requested by: {req.createdBy?.name || 'N/A'}</p>
              </div>
              <div className="hr-movelist-meta">
                <p>Approved by: {req.approvedBy || 'N/A'}</p>
                <p>{req.updatedAt ? new Date(req.updatedAt).toLocaleDateString() : 'N/A'}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="hr-movelist-pagination">
          <span>
            Showing {startIndex + 1} to {Math.min(startIndex + ITEMS_PER_PAGE, requests.length)} of {requests.length} entries.
          </span>
          <div className="hr-movelist-pages">
            <button className="hr-movelist-page-btn" disabled={currentPage === 1} onClick={() => handlePageChange(currentPage - 1)}>&lt;</button>
            {Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i + 1}
                className={`hr-movelist-page-btn ${currentPage === i + 1 ? 'active' : ''}`}
                onClick={() => handlePageChange(i + 1)}
              >
                {i + 1}
              </button>
            ))}
            <button className="hr-movelist-page-btn" disabled={currentPage === totalPages} onClick={() => handlePageChange(currentPage + 1)}>&gt;</button>
          </div>
        </div>
      </main>
    </div>
  );
}
