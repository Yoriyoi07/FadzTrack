// src/components/am/Area_Material_Req.js
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ApproveDenyActions from '../ApproveDenyActions';
import api from '../../api/axiosInstance'; // Adjust the path as needed

const Area_Material_Req = () => {
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

  if (loading) return <div>Loading...</div>;
  if (error) return <div style={{ color: 'red', margin: 20 }}>{error}</div>;
  if (!requestData) return <div>Request not found</div>;

  return (
    <div>
      <h2>Material Request #{requestData.requestNumber || requestData._id?.slice(-5)}</h2>
      <div>
        <h3>Project: {requestData.project?.projectName || '-'}</h3>
        <p>Description: {requestData.description}</p>
        <h4>Materials:</h4>
        <ul>
          {requestData.materials?.map((mat, idx) => (
            <li key={idx} className="material-item">
              <span className="material-name">
                <strong>Material:</strong> {mat.materialName}
              </span>
              <span className="material-quantity" style={{ marginLeft: 16 }}>
                <strong>Quantity:</strong> {mat.quantity}
              </span>
            </li>
          ))}
        </ul>
        <h4>Attachments:</h4>
        {requestData.attachments && requestData.attachments.length > 0 ? (
          requestData.attachments.map((file, idx) => (
            <img
              key={idx}
              src={getAttachmentUrl(file)}
              alt={`Attachment ${idx + 1}`}
              style={{ maxWidth: 120, marginRight: 8, marginBottom: 8 }}
              onError={e => { e.target.style.display = 'none'; }}
            />
          ))
        ) : (
          <div style={{ color: '#888' }}>No attachments.</div>
        )}
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

export default Area_Material_Req;
