// src/components/am/Area_Material_Req.js
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ApproveDenyActions from '../ApproveDenyActions';
import '../style/pm_style/Pm_MatRequest.css'; 
import api from '../../api/axiosInstance';

const AreaMaterialReq = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [requestData, setRequestData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const userId = user?._id;
  const userRole = user?.role;

  useEffect(() => {
    setLoading(true);
    api.get(`/requests/${id}`)
      .then(res => {
        setRequestData(res.data);
        setLoading(false);
        setError('');
      })
      .catch((err) => {
        setLoading(false);
        setError('Request not found or failed to fetch.');
      });
  }, [id]);

  const handleBack = () => navigate(-1);

  const getAttachmentUrl = (file) =>
    file && file.startsWith('http') ? file : `http://localhost:5000/uploads/${file}`;

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading request details...</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="error-container">
        <p>{error}</p>
        <button onClick={handleBack} className="back-button">Go Back</button>
      </div>
    );
  }
  if (!requestData) return <div>Request not found</div>;

  return (
    <div>
      <main className="main-content-picmatreq">
        <div className="request-materials-container-picmatreq">
          <h1 className="page-title-picmatreq">
            Material Request #{requestData.requestNumber || requestData._id?.slice(-5)}
          </h1>
          <div className="project-details-box" style={{ marginBottom: '20px' }}>
            <h2 style={{ margin: 0 }}>{requestData.project?.projectName || '-'}</h2>
            <p style={{ margin: 0, fontStyle: 'italic' }}>
              {typeof requestData.project?.location === 'object'
                ? requestData.project.location.name
                : requestData.project?.location || '-'}
            </p>
            <p style={{ margin: 0, color: '#555' }}>
              {requestData.project?.startDate && requestData.project?.endDate
                ? `${new Date(requestData.project.startDate).toLocaleDateString()} - ${new Date(requestData.project.endDate).toLocaleDateString()}`
                : ''}
            </p>
          </div>
          {/* --- VIEW MODE --- */}
          <>
            {/* Materials */}
            <div className="materials-section">
              <h2 className="section-title">Material to be Requested</h2>
              <div className="materials-list">
                {requestData.materials?.map((mat, idx) => (
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
            />
          </>
        </div>
      </main>
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

export default AreaMaterialReq;
