import React, { useState, useEffect } from 'react';
import '../style/pic_style/Pic_Dash.css';
import { useNavigate, Link } from 'react-router-dom';

const PicDash = () => {
  const navigate = useNavigate();

  const token = localStorage.getItem('token');
  const stored = localStorage.getItem('user');
  const user = stored ? JSON.parse(stored) : null;
  const userId = user?._id;

  const [userName, setUserName] = useState(user?.name || '');
  const [projects, setProjects] = useState([]);
  const [project, setProject] = useState(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  // Load real requests from backend
  const [requests, setRequests] = useState([]);

  // Auth guard: redirect if not logged in
  useEffect(() => {
    if (!token || !user) {
      navigate('/');
      return;
    }
    setUserName(user.name);
  }, [navigate, token, user]);

  // Fetch all projects
  useEffect(() => {
    if (!token || !user) return;
    const fetchProjects = async () => {
      try {
        const res = await fetch('http://localhost:5000/api/projects', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        // Filter only projects where this user is a PIC
        const filtered = data.filter(
          (p) => Array.isArray(p.pic) && p.pic.some((picUser) => picUser._id === userId)
        );
        setProjects(filtered);
      } catch (err) {
        console.error('Failed to fetch projects:', err);
      }
    };
    fetchProjects();
  }, [token, user, userId]);

  // Fetch assigned project for navigation links
  useEffect(() => {
    if (!token || !userId) return;
    const fetchAssigned = async () => {
      try {
        const res = await fetch(
          `http://localhost:5000/api/projects/assigned/${userId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await res.json();
        setProject(data[0] || null);
      } catch (err) {
        console.error('Failed to fetch assigned project:', err);
        setProject(null);
      }
    };
    fetchAssigned();
  }, [token, userId]);

  // Fetch requests from backend (just replace the static list)
  useEffect(() => {
    if (!token) return;
    fetch('http://localhost:5000/api/requests/mine', {
  headers: { Authorization: `Bearer ${token}` }
})
.then(async res => {
  if (!res.ok) throw new Error(res.statusText);
  // Check if response has a body
  const text = await res.text();
  if (!text) throw new Error('No response body');
  return JSON.parse(text);
})
.then(data => setRequests(Array.isArray(data) ? data : []))
.catch(err => console.error('❌ Failed to load requests:', err));

  }, [token]);

// Sample chats data
  const [chats] = useState([
    { id: 1, name: 'Rychea Miralles', initial: 'R', message: 'Hello Good Morning po! As...', color: '#4A6AA5' },
    { id: 2, name: 'Third Castellar', initial: 'T', message: 'Hello Good Morning po! As...', color: '#2E7D32' },
    { id: 3, name: 'Zenarose Miranda', initial: 'Z', message: 'Hello Good Morning po! As...', color: '#9C27B0' }
  ]);

  // Logout handler
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  return (
     <div className="head">
      {/* Header with Navigation */}
      <header className="header">
        <div className="logo-container">
          <img src={require('../../assets/images/FadzLogo1.png')} alt="FadzTrack Logo" className="logo-img" />
          <h1 className="brand-name">FadzTrack</h1>
        </div>
          <nav className="nav-menu">
            <Link to="/pic" className="nav-link">Dashboard</Link>
            <Link to="/pic/projects/:projectId/request" className="nav-link">Requests</Link>
            {project && (<Link to={`/pic/${project._id}`} className="nav-link">View Project</Link>)}
            <Link to="/chat" className="nav-link">Chat</Link>
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

      {/* Main Content */}
      <div className="dashboard-layout">
        {/* Left Sidebar */}
        <div className="sidebar">
          <h2>Requests</h2>
          <button
            className="add-project-btn"
            onClick={() => {
              if (project) {
                navigate(`/pic/projects/${project._id}/request`);
              }
            }}
            disabled={!project}
          >
            Add New Request
          </button>
          {/* Chats List in Left Sidebar */}
          <div className="chats-section">
            <h3 className="chats-title">Chats</h3>
            <div className="chats-list">
              {chats.map(chat => (
                <div key={chat.id} className="chat-item">
                  <div className="chat-avatar" style={{ backgroundColor: chat.color }}>
                    {chat.initial}
                  </div>
                  <div className="chat-info">
                    <div className="chat-name">{chat.name}</div>
                    <div className="chat-message">{chat.message}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Center Content */}
        <div className="main1">
          <div className="main-content-container">
            <h1 className="main-title">Good Morning, {userName}!</h1>
            <div>
              <h2 className="section-title">Request Overview</h2>

  <div className="request-list">
  {requests.map(request => (
    <div key={request._id} className="request-item"
      style={{ cursor: "pointer" }}
      onClick={() => navigate(`/pic/request/${request._id}`)}>
      <div className="request-icon">
        {"📦"}
      </div>
      <div className="request-details">
        <div className="request-name">
          <p>request for</p>{request.materials && request.materials.length > 0
            ? request.materials.map(m => `${m.materialName} (${m.quantity})`).join(', ')
            : '-'}
        </div>
        <div className="request-project" style={{ fontSize: "13px", color: "#666", marginTop: "6px" }}>
          {/* Show Project Name */}
          {request.project?.projectName || '-'}
        </div>
      </div>
      <div className="request-requester" style={{ textAlign: 'right' }}>
        <div className="request-requester-name">
          {/* Show User Name */}
          {request.createdBy?.name || '-'}
        </div>
        <div className="request-date">
          {request.createdAt ? new Date(request.createdAt).toLocaleDateString() : ''}
        </div>
      </div>
      <div className={`badge badge-${(request.status || '').toLowerCase()}`}>
        {request.status}
      </div>
    </div>
  ))}
</div>


              {/* Pagination */}
              <div className="pagination">
                <button className="pagination-button">«</button>
                <button className="pagination-button active">1</button>
                <button className="pagination-button">2</button>
                <button className="pagination-button">3</button>
                <button className="pagination-button">4</button>
                <button className="pagination-button">5</button>
                <button className="pagination-button">»</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PicDash;
