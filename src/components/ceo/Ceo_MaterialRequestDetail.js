// src/components/am/Area_Material_Req.js
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ApproveDenyActions from '../ApproveDenyActions';

const Ceo_Material_Req = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [requestData, setRequestData] = useState(null);
  const [loading, setLoading] = useState(true);
  const user = JSON.parse(localStorage.getItem('user'));
  const userId = user?._id;
  const userRole = user?.role;

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch(`http://localhost:5000/api/requests/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        setRequestData(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  const handleBack = () => navigate(-1);

  const getAttachmentUrl = (file) =>
    file.startsWith('http') ? file : `http://localhost:5000/uploads/${file}`;

  if (loading) return <div>Loading...</div>;
  if (!requestData) return <div>Request not found</div>;

  return (
    <div>
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

export default Ceo_Material_Req;
