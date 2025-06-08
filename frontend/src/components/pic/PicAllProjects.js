import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api/axiosInstance';
import '../style/pic_style/PicAllProjects.css'; // create if you want extra style

const PicAllProjects = () => {
  const token = localStorage.getItem('token');
  const stored = localStorage.getItem('user');
  const user = stored ? JSON.parse(stored) : null;
  const userId = user?._id;

  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('Ongoing');
  const [ongoing, setOngoing] = useState([]);
  const [completed, setCompleted] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    Promise.all([
      api.get(`/projects/by-user-status?userId=${userId}&role=pic&status=Ongoing`),
      api.get(`/projects/by-user-status?userId=${userId}&role=pic&status=Completed`)
    ])
      .then(([resOngoing, resCompleted]) => {
        setOngoing(resOngoing.data || []);
        setCompleted(resCompleted.data || []);
        setLoading(false);
      })
      .catch(() => {
        setOngoing([]); setCompleted([]); setLoading(false);
      });
  }, [userId]);

  if (loading) return <div style={{ padding: 32 }}>Loading...</div>;

  const ProjectTable = ({ projects }) => (
    <table className="myprojects-table">
      <thead>
        <tr>
          <th>Project Name</th>
          <th>Status</th>
          <th>Location</th>
          <th>Start</th>
          <th>End</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {projects.length === 0 && (
          <tr>
            <td colSpan={6} style={{ textAlign: 'center' }}>No projects found.</td>
          </tr>
        )}
        {projects.map((proj) => (
          <tr key={proj._id}>
            <td>{proj.projectName}</td>
            <td>
              <span className={`status-badge badge-${proj.status?.toLowerCase() || 'unknown'}`}>{proj.status}</span>
            </td>
            <td>{proj.location?.name || '-'}</td>
            <td>{proj.startDate ? new Date(proj.startDate).toLocaleDateString() : '-'}</td>
            <td>{proj.endDate ? new Date(proj.endDate).toLocaleDateString() : '-'}</td>
            <td>
              <button
                className="view-btn"
                onClick={() => navigate(`/pic/${proj._id}`)}
              >View</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <div className="myprojects-page">
      <header className="header">
        <div className="logo-container">
          <img src={require('../../assets/images/FadzLogo1.png')} alt="FadzTrack Logo" className="logo-img" />
          <h1 className="brand-name">FadzTrack</h1>
        </div>
        <nav className="nav-menu">
          <Link to="/pic" className="nav-link">Dashboard</Link>
          <Link to="/pic/projects" className="nav-link active">My Projects</Link>
          <Link to="/pic/chat" className="nav-link">Chat</Link>
        </nav>
      </header>
      <main className="main1">
        <div className="main-content-container">
          <h1 className="main-title">My Projects</h1>
          <div className="tabs">
            <button
              className={activeTab === 'Ongoing' ? 'tab active' : 'tab'}
              onClick={() => setActiveTab('Ongoing')}
            >Ongoing</button>
            <button
              className={activeTab === 'Completed' ? 'tab active' : 'tab'}
              onClick={() => setActiveTab('Completed')}
            >Completed</button>
          </div>
          <div className="projects-table-container">
            {activeTab === 'Ongoing' ? (
              <ProjectTable projects={ongoing} />
            ) : (
              <ProjectTable projects={completed} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default PicAllProjects;
