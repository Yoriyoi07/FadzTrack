import React, { useState, useEffect } from 'react';
import "../style/ceo_style/Ceo_ViewSpecific.css";
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../../api/axiosInstance'; 
import NotificationBell from '../NotificationBell';


const AreaViewSpecificProj = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  // -- THIS ORDER --
  const stored = localStorage.getItem('user');
  const user = stored ? JSON.parse(stored) : null;
  const [userName, setUserName] = useState(user?.name || 'ALECK');

  const [project, setProject] = useState(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [toggleLoading, setToggleLoading] = useState(false);

  useEffect(() => {
    const fetchProject = async () => {
      try {
        const { data } = await api.get(`/projects/${id}`);
        setProject(data);
        setStatus(data.status);
        api.get(`/daily-reports/project/${id}/progress`).then(progressRes => {
          const completed = progressRes.data.progress.find(p => p.name === 'Completed');
          setProgress(completed ? completed.value : 0);
        });
        console.log("Fetched project data:", data);
      } catch (err) {
        console.error("Failed to fetch project:", err);
      }
    };
    fetchProject();
  }, [id]);

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

  if (!project) return <div>Loading...</div>;

  return (
    <div>
     {/* Header remains the same */}
      <header className="header">
        <div className="logo-container">
          <img src={require('../../assets/images/FadzLogo1.png')} alt="FadzTrack Logo" className="logo-img" />
          <h1 className="brand-name">FadzTrack</h1>
        </div>
        <nav className="nav-menu">
          <Link to="/am" className="nav-link">Dashboard</Link>
          <Link to="/am/chat" className="nav-link">Chat</Link>
          <Link to="/am/matreq" className="nav-link">Material</Link>
          <Link to="/am/manpower-requests" className="nav-link">Manpower</Link>
          <Link to="/am/viewproj" className="nav-link">Projects</Link>
          <Link to="/logs" className="nav-link">Logs</Link>
          <Link to="/reports" className="nav-link">Reports</Link>
        </nav>
       <div className="profile-menu-container" style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                 <NotificationBell />
                 <div className="profile-circle" onClick={() => setProfileMenuOpen(!profileMenuOpen)}>
                   {userName ? userName.charAt(0).toUpperCase() : 'Z'}
                 </div>
                 {profileMenuOpen && (
                   <div className="profile-menu">
                     <button onClick={handleLogout}>Logout</button>
                   </div>
                 )}
               </div>
      </header>

      <main className="main">
        <div className="project-detail-container">
          <div className="back-button" onClick={() => navigate('/am/viewproj')} style={{ cursor: 'pointer' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24">
              <path d="M19 12H5"></path>
              <path d="M12 19l-7-7 7-7"></path>
            </svg>
          </div>

          <div className="project-image-container">
           <img
  src={
    project.photos && project.photos.length > 0
      ? `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}${project.photos[0]}`
      : 'https://placehold.co/400x250?text=No+Photo'
  }
  alt={project.projectName}
  className="project-image"
    width={250}   // or whatever size you want
  height={150}  // or whatever size you want
  style={{ objectFit: "cover", borderRadius: 8 }}
/>


            {progress === 100 && (
              <button
                onClick={async () => {
                  setToggleLoading(true);
                  try {
                    const res = await api.patch(`/projects/${project._id}/toggle-status`);
                    setStatus(res.data.status);
                  } finally {
                    setToggleLoading(false);
                  }
                }}
                disabled={toggleLoading}
                style={{
                  background: status === 'Completed' ? '#4CAF50' : '#f57c00',
                  color: 'white',
                  padding: '8px 16px',
                  borderRadius: 6,
                  border: 'none',
                  cursor: 'pointer',
                  position: 'absolute',
                  top: '10px',
                  right: '10px',
                  zIndex: 10,
                  fontSize: '14px',
                }}
              >
                {status === 'Completed' ? 'Mark as Ongoing' : 'Mark as Completed'}
              </button>
            )}
          </div>

          <h1 className="project-title">{project.projectName}</h1>

          <div className="project-details-grid">
            <div className="details-column">
              <p className="detail-item">
                <span className="detail-label">Location:</span>
                {project.location?.name
                  ? `${project.location.name} (${project.location.region})`
                  : 'No Location'}
              </p>

              <div className="detail-group">
                <p className="detail-label">Project Manager:</p>
                <p className="detail-value">{project.projectmanager?.name || "N/A"}</p>
              </div>

              <div className="detail-group">
                <p className="detail-label">Contractor:</p>
                <p className="detail-value">{project.contractor}</p>
              </div>

              <div className="detail-group">
                <p className="detail-label">Target Date:</p>
                <p className="detail-value">
                {project.startDate && project.endDate
                  ? `${new Date(project.startDate).toLocaleDateString()} to ${new Date(project.endDate).toLocaleDateString()}`
                  : "N/A"}
              </p>
              </div>
            </div>

            <div className="details-column">
              <div className="budget-container">
                <p className="budget-amount">{project.budget?.toLocaleString()}</p>
                <p className="budget-label">Estimated Budget</p>
              </div>

              <div className="detail-group">
                <p className="detail-label">PIC:</p>
                <p className="detail-value">{project.pic && project.pic.length > 0
                  ? project.pic.map(p => p.name).join(', ')
                  : 'N/A'}</p>
              </div>
            </div>
          </div>

          <div className="manpower-section">
            <p className="detail-label">Manpower:</p>
            <p className="manpower-list">
              {Array.isArray(project.manpower) && project.manpower.length > 0
                ? project.manpower.map(mp => `${mp.name} (${mp.position})`).join(', ')
                : 'No Manpower Assigned'}
            </p>
          </div>

          <p>
            <b>Status:</b> {status}
          </p>
        </div>
      </main>
    </div>
  );
};

export default AreaViewSpecificProj;
