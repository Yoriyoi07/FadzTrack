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
        setMaterials(ensureMaterialIds(data.materials));
        setDescription(data.description);
        setAttachments(data.attachments || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  // Profile menu outside click handler (if you use the header dropdown)
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest(".profile-menu-container")) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

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
  const handleDeleteAttachment = idx => setAttachments(attachments.filter((_, i) => i !== idx));
  const handleFileUpload = e => setNewFiles(prev => [...prev, ...Array.from(e.target.files)]);
  const handleRemoveNewFile = idx => setNewFiles(prev => prev.filter((_, i) => i !== idx));

  const getAttachmentUrl = (file) =>
    file.startsWith('http') ? file : `http://localhost:5000/uploads/${file}`;

  // --- Save edited request ---
  const handleSaveEdit = async () => {
    const token = localStorage.getItem('token');
    const formData = new FormData();
    // Remove temp id before saving to backend
    const materialsToSave = materials.map(({id, ...mat}) => mat);
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
      setMaterials(ensureMaterialIds(updated.materials));
      setDescription(updated.description);
      setAttachments(updated.attachments);
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
          {editMode ? (
            <form className="materials-form-picmatreq" onSubmit={e => {e.preventDefault(); handleSaveEdit();}}>
              {/* Materials Section */}
              <div className="form-group-picmatreq">
                <label className="form-label-picmatreq">Material to be Requested</label>
                <div className="materials-list-picmatreq">
                  <div className="material-headers-picmatreq">
                    <span className="material-header-label-picmatreq">Material Name</span>
                    <span className="quantity-header-label-picmatreq">Quantity</span>
                    <span className="action-header-label-picmatreq"></span>
                  </div>
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
                        className="quantity-input-picmatreq"
                      />
                      <button
                        type="button"
                        onClick={() => handleDeleteMaterial(material.id)}
                        className="remove-material-btn-picmatreq"
                        disabled={materials.length === 1}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={handleAddMaterial}
                    className="add-material-btn-picmatreq"
                  >
                    + Add Material
                  </button>
                </div>
              </div>
              {/* Attachments Section */}
              <div className="form-group-picmatreq">
                <label className="form-label-picmatreq">Attachment Proof</label>
                <div className="upload-section-picmatreq">
                  <input
                    type="file"
                    id="file-upload"
                    multiple
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="file-input-picmatreq"
                  />
                  <label htmlFor="file-upload" className="upload-button">
                    <span className="upload-icon-picmatreq">📎</span>
                    Upload
                  </label>
                  {(attachments.length > 0 || newFiles.length > 0) && (
                    <div className="preview-container">
                      {attachments.map((file, idx) => (
                        <div key={`existing-${idx}`} style={{ position: 'relative' }}>
                          <img
                            src={getAttachmentUrl(file)}
                            alt={`attachment-${idx}`}
                            style={{
                              width: '200px',
                              height: '200px',
                              objectFit: 'cover',
                              borderRadius: '8px',
                              border: '1px solid #ccc'
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => handleDeleteAttachment(idx)}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      {newFiles.map((file, idx) => (
                        <div key={`newfile-${idx}`} style={{ position: 'relative' }}>
                          <img
                            src={URL.createObjectURL(file)}
                            alt={`new-upload-${idx}`}
                            style={{
                              width: '200px',
                              height: '200px',
                              objectFit: 'cover',
                              borderRadius: '8px',
                              border: '1px solid #ccc'
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveNewFile(idx)}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="upload-hint-picmatreq">You can attach files such as documents or images</p>
                </div>
              </div>
              {/* Description Section */}
              <div className="form-group-picmatreq">
                <label className="form-label-picmatreq">Request Description</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="description-textarea-picmatreq"
                  rows={6}
                  placeholder="Provide a detailed description of your request"
                />
              </div>
              {/* Action Buttons */}
              <div className="form-actions-picmatreq">
                <button type="submit" className="publish-button-picmatreq">
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setEditMode(false)}
                  className="cancel-btn"
                  style={{ marginLeft: '1rem', background: '#dc3545', color: '#fff', minWidth: 120 }}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            // --- VIEW MODE (default detail view) ---
            <>
              {/* Materials */}
              <div className="materials-section">
                <h2 className="section-title">Material to be Requested</h2>
                <div className="materials-list">
                  {requestData.materials.map((mat, idx) => (
                    <div key={idx} className="material-item">
                      <span className="material-name">{mat.materialName}</span>
                      {mat.quantity && <span className="material-quantity"> ({mat.quantity})</span>}
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
              <div className="action-buttons">
                <button onClick={handleBack} className="back-btn">Back</button>
                <button onClick={() => setEditMode(true)} className="edit-btn" style={{
                  padding: '0.75rem 2rem',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: '500',
                  background: '#007bff',
                  color: '#fff',
                  minWidth: 120,
                  cursor: 'pointer',
                  marginLeft: '1rem',
                  transition: 'all 0.2s ease'
                }}>Edit</button>
                <button onClick={handleCancelRequest} className="cancel-btn">Cancel Request</button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default MaterialRequestDetail;
