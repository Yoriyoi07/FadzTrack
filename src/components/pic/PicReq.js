import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import '../style/pic_style/Pic_MatReq.css';

const MaterialRequestDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [requestData, setRequestData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [materials, setMaterials] = useState([]);
  const [description, setDescription] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [newFiles, setNewFiles] = useState([]);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  // Auth
  const user = JSON.parse(localStorage.getItem('user'));
  const isPIC = user?._id === requestData?.createdBy?._id;

  // For marking as received
  const canMarkReceived =
    requestData?.status === 'Approved' &&
    !requestData?.receivedByPIC &&
    isPIC;

  // Add unique id to each material for React mapping
  const ensureMaterialIds = (materialsArray) =>
    materialsArray.map((mat, idx) =>
      mat.id ? mat : { ...mat, id: idx + 1 }
    );

  // Fetch request data
  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch(`http://localhost:5000/api/requests/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        setRequestData(data);
        setMaterials(ensureMaterialIds(data.materials || [])); // Ensure materials is an empty array if not found
        setDescription(data.description || '');
        setAttachments(data.attachments || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };
  const handleBack = () => navigate(-1);

  // --- Materials handlers ---
  const handleMaterialChange = (id, field, value) => {
    setMaterials(prev =>
      prev.map(m => (m.id === id ? { ...m, [field]: value } : m))
    );
  };
  const handleAddMaterial = () => {
    const newId = materials.length > 0 ? Math.max(...materials.map(m => m.id)) + 1 : 1;
    setMaterials([...materials, { id: newId, materialName: '', quantity: '' }]);
  };
  const handleDeleteMaterial = id => {
    if (materials.length > 1) {
      setMaterials(materials.filter(m => m.id !== id));
    }
  };

  // --- Attachments handlers ---
  const handleFileUpload = (e) => setNewFiles(prev => [...prev, ...Array.from(e.target.files)]);
  const handleRemoveNewFile = (idx) => setNewFiles(prev => prev.filter((_, i) => i !== idx));
  
  // Function to remove file from the current attachments
  const handleRemoveAttachment = (idx) => {
    setAttachments(prev => prev.filter((_, i) => i !== idx));
  };

  const getAttachmentUrl = (file) =>
    file.startsWith('http') ? file : `http://localhost:5000/uploads/${file}`;

  // --- Save edited request ---
  const handleSaveEdit = async () => {
    const token = localStorage.getItem('token');
    const formData = new FormData();
    const materialsToSave = materials.map(({ id, ...mat }) => mat);
    formData.append('materials', JSON.stringify(materialsToSave));
    formData.append('description', description);
    formData.append('attachments', JSON.stringify(attachments));
    newFiles.forEach(file => formData.append('newAttachments', file));

    try {
      const res = await fetch(`http://localhost:5000/api/requests/${id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      if (!res.ok) throw new Error('Update failed');
      const updated = await res.json();
      setRequestData(updated);
      setMaterials(ensureMaterialIds(updated.materials || []));
      setDescription(updated.description || '');
      setAttachments(updated.attachments || []);
      setNewFiles([]);
      setEditMode(false);
      alert('Request updated!');
    } catch (err) {
      alert('Failed to update request');
      console.error(err);
    }
  };

  // --- Cancel request ---
  const handleCancelRequest = () => {
    if (!window.confirm('Are you sure you want to cancel this request?')) return;
    const token = localStorage.getItem('token');
    fetch(`http://localhost:5000/api/requests/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => {
        if (!res.ok) throw new Error('Cancel failed');
        alert('Request cancelled');
        navigate('/pic');
      })
      .catch(err => {
        alert('Failed to cancel request');
        console.error(err);
      });
  };

  // --- Mark as received ---
  const handleMarkReceived = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`http://localhost:5000/api/requests/${id}/received`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to mark as received');
      alert('Request marked as received!');
      window.location.reload();
    } catch (err) {
      alert('Failed to mark as received');
      console.error(err);
    }
  };

  // --- Prevent editing/cancelling if not pending ---
  const isEditable = [
    'Pending PM',
    'Pending AM',
    'Pending CEO'
  ].includes(requestData?.status);

  // If currently in editMode but not editable, force out of editMode
  useEffect(() => {
    if (!isEditable && editMode) setEditMode(false);
    // eslint-disable-next-line
  }, [isEditable]);

  // --- Denied Approval Info ---
  const deniedApproval = (() => {
    if (!requestData?.approvals) return null;
    return [...requestData.approvals].reverse().find(a => a.decision === 'denied');
  })();

  // --- Helper for user/role display ---
  const getDenierDisplay = (approval) => {
    if (!approval) return '';
    let role =
      approval.role === 'PM'
        ? 'Project Manager'
        : approval.role === 'AM'
        ? 'Area Manager'
        : approval.role === 'CEO'
        ? 'CEO'
        : approval.role;
    if (approval.user && typeof approval.user === 'object' && approval.user.name) {
      return `${approval.user.name} (${role})`;
    }
    return `${role}`;
  };

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
    <div className="app-container">
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

          {/* --- Form/Edit Mode --- */}
          {editMode && isEditable ? (
  <form className="materials-form-picmatreq" onSubmit={e => { e.preventDefault(); handleSaveEdit(); }}>
    {/* Materials Section */}
    <div className="form-group-picmatreq">
      <label className="form-label-picmatreq">Material to be Requested</label>
      <div className="materials-list-picmatreq">
        {materials.map((material) => (
          <div key={material.id} className="material-row-picmatreq">
            <input
              type="text"
              value={material.materialName}
              onChange={(e) => handleMaterialChange(material.id, 'materialName', e.target.value)}
              placeholder="Enter material name"
              className="material-input-picmatreq"
            />
            <input
              type="text"
              value={material.quantity}
              onChange={(e) => handleMaterialChange(material.id, 'quantity', e.target.value)}
              placeholder="Quantity"
              maxLength={7}
              className="quantity-input-picmatreq"
            />
            <button
              type="button"
              onClick={() => handleDeleteMaterial(material.id)}
              className="remove-material-btn-picmatreq"
            >
              ×
            </button>
          </div>
        ))}
        <button type="button" onClick={handleAddMaterial} className="add-material-btn-picmatreq">
          + Add Material
        </button>
      </div>
    </div>

    {/* File Upload */}
    <div className="form-group-picmatreq">
      <label className="form-label-picmatreq">Attachment Proof</label>
      <input
        type="file"
        multiple
        accept="image/*"
        onChange={handleFileUpload}
        className="file-input-picmatreq"
      />
      <div className="preview-container">
        {newFiles.map((file, index) => (
          <div key={index} className="preview-item">
            <img
              src={URL.createObjectURL(file)}
              alt={`Preview ${index}`}
              className="attachment-image"
            />
            <button
              type="button"
              onClick={() => handleRemoveNewFile(index)}
              className="remove-file-btn"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>

    {/* Description */}
    <div className="form-group-picmatreq">
      <label className="form-label-picmatreq">Request Description</label>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="description-textarea-picmatreq"
        rows="4"
        placeholder="Enter a detailed description"
      />
    </div>

    {/* Save or Cancel Buttons */}
    <div className="form-actions-picmatreq">
      <button type="button" onClick={() => setEditMode(false)} className="cancel-btn">Cancel</button>
      <button type="submit" className="save-btn">Save Changes</button>
    </div>
  </form>
) : (
  <>
    {/* Existing Materials Display */}
    <div className="materials-section">
      <h2 className="section-title">Material to be Requested</h2>
      <div className="materials-list">
        {requestData.materials?.map((mat, idx) => (
          <div key={idx} className="material-item">
            <span><strong>Material:</strong> {mat.materialName}</span>
            <span><strong>Quantity:</strong> {mat.quantity}</span>
          </div>
        ))}
      </div>
    </div>

    {/* Existing Attachments Display */}
    <div className="attachments-section">
      <h2 className="section-title">Attachment Proof</h2>
      <div className="attachments-grid">
        {requestData.attachments?.length
          ? requestData.attachments.map((file, idx) => (
            <div key={idx} className="attachment-item">
              <img src={getAttachmentUrl(file)} alt={`Attachment ${idx + 1}`} className="attachment-image" />
              {editMode && (
                <button
                  type="button"
                  onClick={() => handleRemoveAttachment(idx)}
                  className="remove-file-btn"
                >
                  ×
                </button>
              )}
            </div>
          ))
          : <div>No attachments</div>
        }
      </div>
    </div>

    {/* Existing Description Display */}
    <div className="description-section">
      <h2 className="section-title">Request Description</h2>
      <div className="description-content">
        <p>{requestData.description}</p>
      </div>
    </div>

    {/* Action Buttons */}
    <div className="action-buttons">
      <button onClick={handleBack} className="back-btn">Back</button>
      {isEditable && (
        <>
          <button
            onClick={() => setEditMode(true)}
            className="edit-btn"
          >
            Edit
          </button>
          <button onClick={handleCancelRequest} className="cancel-btn">Cancel Request</button>
        </>
      )}
      {/* Mark as received button & info */}
      {requestData.status === 'Approved' && isPIC && (
        requestData.receivedByPIC ? (
          <span className="received-badge">
            <span>✔</span> Received by PIC&nbsp;
            {requestData.receivedDate && (
              <span>
                ({new Date(requestData.receivedDate).toLocaleString()})
              </span>
            )}
          </span>
        ) : (
          <button
            onClick={handleMarkReceived}
            className="received-btn"
          >
            Mark as Received
          </button>
        )
      )}
    </div>
  </>
)}

        </div>
      </main>
    </div>
  );
};

export default MaterialRequestDetail;
