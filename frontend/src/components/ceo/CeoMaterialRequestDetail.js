// src/components/am/Area_Material_Req.js
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import api from '../../api/axiosInstance'; 
import ApproveDenyActions from '../ApproveDenyActions';

const CeoMaterialReq = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [userName, setUserName] = useState('');
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [projects, setProjects] = useState([]);
  const [requestData, setRequestData] = useState(null);
  const [loading, setLoading] = useState(true);
  const user = JSON.parse(localStorage.getItem('user'));
  const userId = user?._id;
  const userRole = user?.role;

  useEffect(() => {
    api.get(`/requests/${id}`)
      .then(res => {
        setRequestData(res.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  const handleBack = () => navigate(-1);

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

  const getAttachmentUrl = (file) =>
    file.startsWith('http') ? file : `http://localhost:5000/uploads/${file}`;

  if (loading) return <div>Loading...</div>;
  if (!requestData) return <div>Request not found</div>;

  return (
    <div>
      <header className="header">
        <div className="logo-container">
          <img src={require('../../assets/images/FadzLogo1.png')} alt="FadzTrack Logo" className="logo-img" />
          <h1 className="brand-name">FadzTrack</h1>
        </div>
        <nav className="nav-menu">
          <Link to="/ceo/dash" className="nav-link">Dashboard</Link>
          <Link to="/ceo/material-list" className="nav-link">Material</Link>
          <Link to="/ceo/proj" className="nav-link">Projects</Link>
          <Link to="/chat" className="nav-link">Chat</Link>
          <Link to="/ceo/audit-logs" className="nav-link">Audit Logs</Link>
          <Link to="/reports" className="nav-link">Reports</Link>
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
      <h2>Material Request #{requestData.requestNumber}</h2>
      <div>
        <h3>Project: {requestData.project?.projectName || '-'}</h3>
        <p>Description: {requestData.description}</p>
        <h4>Materials:</h4>
         <ul>
          {requestData.materials.map((mat, idx) => (
            <li key={idx} className="material-item">
              <span className="material-name">
                <strong>Material:</strong> {mat.materialName}
              </span>
              <span className="material-quantity">
                <strong>Quantity:</strong> {mat.quantity}
              </span>
            </li>
          ))}
        </ul>
        <h4>Attachments:</h4>
        {requestData.attachments?.map((file, idx) => (
          <img key={idx} src={getAttachmentUrl(file)} alt={`Attachment ${idx + 1}`} style={{ maxWidth: 120 }} />
        ))}
      </div>
      <ApproveDenyActions
        requestData={requestData}
        userId={userId}
        userRole={userRole}
        onBack={handleBack}
      />
    </div>
  );
};

export default CeoMaterialReq;
