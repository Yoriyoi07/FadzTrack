import React, { useState, useEffect } from 'react';
import "../style/ceo_style/Ceo_ViewSpecific.css";
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../../api/axiosInstance'; 
import NotificationBell from '../NotificationBell';
import { FaRegCommentDots, FaRegFileAlt, FaRegListAlt } from 'react-icons/fa';

const CeoViewSpecific = () => {
  const stored = localStorage.getItem('user');
  const userName = stored ? JSON.parse(stored).name : 'ALECK';

  const { id } = useParams();
  const navigate = useNavigate();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [project, setProject] = useState(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [toggleLoading, setToggleLoading] = useState(false);

  // Tabs
  const [activeTab, setActiveTab] = useState('Details');

  // Placeholder for files if you want to show them later
  const [docSignedUrls, setDocSignedUrls] = useState([]);

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
      } catch (err) {
        console.error("Failed to fetch project:", err);
      }
    };
    fetchProject();
  }, [id]);

  // Optional: Fetch signed URLs for Files tab
  useEffect(() => {
    async function fetchSignedUrls() {
      if (project?.documents?.length) {
        const promises = project.documents.map(async docPath => {
          try {
            const { data } = await api.get(`/photo-signed-url?path=${encodeURIComponent(docPath)}`);
            return data.signedUrl;
          } catch {
            return null;
          }
        });
        const urls = await Promise.all(promises);
        setDocSignedUrls(urls);
      } else {
        setDocSignedUrls([]);
      }
    }
    fetchSignedUrls();
  }, [project]);

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
      <header className="header">
        <div className="logo-container">
          <img src={require('../../assets/images/FadzLogo1.png')} alt="FadzTrack Logo" className="logo-img" />
          <h1 className="brand-name">FadzTrack</h1>
        </div>
        <nav className="nav-menu">
          <Link to="/ceo/dash" className="nav-link">Dashboard</Link>
          <Link to="/ceo/chat" className="nav-link">Chat</Link>
          <Link to="/ceo/material-list" className="nav-link">Material</Link>
          <Link to="/ceo/proj" className="nav-link">Projects</Link>
          <Link to="/ceo/audit-logs" className="nav-link">Audit Logs</Link>
          <Link to="/reports" className="nav-link">Reports</Link>
        </nav>
        <div className="profile-menu-container" style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <NotificationBell />
          <div className="profile-circle" onClick={() => setProfileMenuOpen(!profileMenuOpen)}>
            {userName.charAt(0).toUpperCase() || 'Z'}
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
          <div className="back-button" onClick={() => navigate('/ceo/proj')} style={{ cursor: 'pointer' }}>
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
              width={250}
              height={150}
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

          {/* Tabs */}
          <div className="tabs-row">
            <button
              className={`tab-btn${activeTab === 'Discussions' ? ' active' : ''}`}
              onClick={() => setActiveTab('Discussions')}
              type="button"
            >
              <FaRegCommentDots /> Discussions
            </button>
            <button
              className={`tab-btn${activeTab === 'Details' ? ' active' : ''}`}
              onClick={() => setActiveTab('Details')}
              type="button"
            >
              <FaRegListAlt /> Details
            </button>
            <button
              className={`tab-btn${activeTab === 'Files' ? ' active' : ''}`}
              onClick={() => setActiveTab('Files')}
              type="button"
            >
              <FaRegFileAlt /> Files
            </button>
            <button
              className={`tab-btn${activeTab === 'Reports' ? ' active' : ''}`}
              onClick={() => setActiveTab('Reports')}
              type="button"
            >
              <FaRegFileAlt /> Reports
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'Details' && (
            <>
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

              <p><b>Status:</b> {status}</p>
            </>
          )}

          {activeTab === 'Discussions' && (
            <div style={{ color: '#888', fontSize: 20, marginTop: 50 }}>
              Discussions placeholder
            </div>
          )}

          {activeTab === 'Files' && (
            <div className="project-files-list">
              {project.documents && project.documents.length > 0 ? (
                <div>
                  <h3 style={{ marginBottom: 18 }}>Project Documents</h3>
                  <ul>
                    {project.documents.map((docPath, idx) => {
                      const fileName = docPath.split('/').pop();
                      const url = docSignedUrls[idx];
                      return (
                        <li key={idx}>
                          <FaRegFileAlt style={{ marginRight: 4 }} />
                          <span style={{ flex: 1 }}>{fileName}</span>
                          {url ? (
                            <a
                              href={url}
                              download={fileName}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              View Document
                            </a>
                          ) : (
                            <span style={{ color: '#aaa' }}>Loading link…</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : (
                <div style={{ color: '#888', fontSize: 20 }}>No documents uploaded for this project.</div>
              )}
            </div>
          )}

          {activeTab === 'Reports' && (
            <div className="project-reports-placeholder">
              <h3 style={{ marginBottom: 18 }}>Project Reports</h3>
              <div style={{ color: '#888', fontSize: 20 }}>
                No reports are currently available.
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
};

export default CeoViewSpecific;
