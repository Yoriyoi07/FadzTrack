import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../api/axiosInstance'; // Adjust the path if needed!
import ApproveDenyActions from '../ApproveDenyActions';
import '../style/pm_style/Pm_MatRequest.css';

const chats = [
  { id: 1, name: 'Rychea Miralles', initial: 'R', message: 'Hello Good Morning po! As...', color: '#4A6AA5' },
  { id: 2, name: 'Third Castellar', initial: 'T', message: 'Hello Good Morning po! As...', color: '#2E7D32' },
  { id: 3, name: 'Zenarose Miranda', initial: 'Z', message: 'Hello Good Morning po! As...', color: '#9C27B0' }
];

const PmMaterialRequestDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [requestData, setRequestData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [, setProfileMenuOpen] = useState(false);
  const user = JSON.parse(localStorage.getItem('user'));

  const userId = user?._id;
  const userRole = user?.role;

  // Fetch request data 
  useEffect(() => {
    api.get(`/requests/${id}`)
      .then(res => {
        setRequestData(res.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest(".profile-menu-container")) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const handleBack = () => navigate(-1);

  // --- Attachments helpers ---
  const getAttachmentUrl = (file) =>
    file.startsWith('http') ? file : `http://localhost:5000/uploads/${file}`;

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading request details...</p>
      </div>
    );
  }
  if (!requestData) {
    return (
      <div className="error-container">
        <p>Request not found</p>
        <button onClick={handleBack} className="back-button">Go Back</button>
      </div>
    );
  }

  return (
    <div>
      <div className="dashboard-layout">
        {/* Sidebar with Chats */}
        <div className="sidebar">
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

        {/* Main Content */}
        <main className="main-content-picmatreq">
          <div className="request-materials-container-picmatreq">
            <h1 className="page-title-picmatreq">
              Material Request #{requestData.requestNumber}
            </h1>
            <div className="project-details-box" style={{ marginBottom: '20px' }}>
              <h2 style={{ margin: 0 }}>{requestData.project?.projectName || '-'}</h2>
              <p style={{ margin: 0, fontStyle: 'italic' }}>{requestData.project?.location || '-'}</p>
              <p style={{ margin: 0, color: '#555' }}>{requestData.project?.targetDate || ''}</p>
            </div>
            {/* --- VIEW MODE --- */}
            <>
              {/* Materials */}
              <div className="materials-section">
                <h2 className="section-title">Material to be Requested</h2>
                <div className="materials-list">
                  {requestData.materials.map((mat, idx) => (
                    <div key={idx} className="material-item">
                      <span className="material-name">
                        <strong>Material:</strong> {mat.materialName}
                      </span>
                      <span className="material-quantity">
                        <strong>Quantity:</strong> {mat.quantity}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              {/* Attachments */}
              <div className="attachments-section">
                <h2 className="section-title">Attachment Proof</h2>
                <div className="attachments-grid">
                  {requestData.attachments?.length
                    ? requestData.attachments.map((file, idx) => (
                      <div key={idx} className="attachment-item">
                        <img src={getAttachmentUrl(file)} alt={`Attachment ${idx + 1}`} className="attachment-image" />
                      </div>
                    ))
                    : <div>No attachments</div>
                  }
                </div>
              </div>
              {/* Description */}
              <div className="description-section">
                <h2 className="section-title">Request Description</h2>
                <div className="description-content">
                  <p>{requestData.description}</p>
                </div>
              </div>
              {/* Action Buttons */}
              <ApproveDenyActions
                requestData={requestData}
                userId={userId}
                userRole={userRole}
                onBack={handleBack}
                // Optionally, add onActionComplete if you want extra behavior after approve/deny
              />
            </>
          </div>
        </main>
      </div>
      {/* Simple Modal Styling */}
      <style>{`
        .modal-overlay {
          position: fixed;
          z-index: 20;
          top: 0; left: 0; right: 0; bottom: 0;
          display: flex;
          align-items: center; justify-content: center;
        }
        .modal-content {
          background: #fff;
          border-radius: 10px;
          box-shadow: 0 4px 24px rgba(0,0,0,0.14);
          padding: 2rem;
          min-width: 320px;
          z-index: 22;
        }
        .modal-backdrop {
          position: fixed;
          z-index: 21;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.15);
        }
      `}</style>
    </div>
  );
};

export default PmMaterialRequestDetail;
