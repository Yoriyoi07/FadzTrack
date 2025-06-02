import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import api from '../../api/axiosInstance'; // Adjust path if needed!
import '../style/pic_style/Pic_Req.css';

const MaterialRequestDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [requestData, setRequestData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [project, setProject] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [description, setDescription] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [newFiles, setNewFiles] = useState([]);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const user = JSON.parse(localStorage.getItem('user'));
  const isPIC = user?._id === requestData?.createdBy?._id;

  useEffect(() => {
    api.get(`/requests/${id}`)
      .then(res => {
        const data = res.data;
        setRequestData(data);
        const materialsWithIds = (data.materials || []).map((mat, idx) => ({
          ...mat,
          id: mat.id || Date.now() + idx
        }));
        setMaterials(materialsWithIds);
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

  const handleMaterialChange = (id, field, value) => {
    setMaterials(prev =>
      prev.map(m => (m.id === id ? { ...m, [field]: value } : m))
    );
  };

  const handleAddMaterial = () => {
    setMaterials(prev => [
      ...prev,
      { id: Date.now(), materialName: '', quantity: '' }
    ]);
  };

  const handleDeleteMaterial = id => {
    setMaterials(prev => prev.filter(m => m.id !== id));
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    setNewFiles(prev => [...prev, ...files]);
  };

  const handleRemoveNewFile = (idx) => setNewFiles(prev => prev.filter((_, i) => i !== idx));

  const handleRemoveAttachment = (idx) => {
    setAttachments(prev => prev.filter((_, i) => i !== idx));
  };

  const getAttachmentUrl = (file) =>
    file.startsWith('http') ? file : `http://localhost:5000/uploads/${file}`;

  const handleSaveEdit = async () => {
    const formData = new FormData();
    const materialsToSave = materials.map(({ id, ...mat }) => mat);
    formData.append('materials', JSON.stringify(materialsToSave));
    formData.append('description', description);
    formData.append('attachments', JSON.stringify(attachments));
    newFiles.forEach(file => formData.append('newAttachments', file));

    try {
      const res = await api.put(`/requests/${id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const updated = res.data;

      const updatedMaterialsWithIds = (updated.materials || []).map((mat, idx) => ({
        ...mat,
        id: mat.id || Date.now() + idx
      }));
      setRequestData(updated);
      setMaterials(updatedMaterialsWithIds);
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

  const handleCancelRequest = () => {
    if (!window.confirm('Are you sure you want to cancel this request?')) return;
    api.delete(`/requests/${id}`)
      .then(() => {
        alert('Request cancelled');
        navigate('/pic');
      })
      .catch(err => {
        alert('Failed to cancel request');
        console.error(err);
      });
  };

  const handleMarkReceived = async () => {
    try {
      await api.patch(`/requests/${id}/received`);
      alert('Request marked as received!');
      window.location.reload();
    } catch (err) {
      alert('Failed to mark as received');
      console.error(err);
    }
  };

  const isEditable = [
    'Pending PM',
    'Pending AM',
    'Pending CEO'
  ].includes(requestData?.status);

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
      {/* Header with Navigation */}
      <header className="header">
        <div className="logo-container">
          <img src={require('../../assets/images/FadzLogo1.png')} alt="FadzTrack Logo" className="logo-img" />
          <h1 className="brand-name">FadzTrack</h1>
        </div>
        <nav className="nav-menu">
          <Link to="/pic" className="nav-link">Dashboard</Link>
          <Link to="/pic/projects/:projectId/request" className="nav-link">Requests</Link>
          {project && (<Link to={`/pic/${project._id}`} className="nav-link">View Project</Link>)}
          <Link to="/pic/chat" className="nav-link">Chat</Link>
        </nav>
        <div className="profile-menu-container">
          <div
            className="profile-circle"
            onClick={() => setProfileMenuOpen(!profileMenuOpen)}
          >
            Z
          </div>
          {profileMenuOpen && (
            <div className="profile-menu">
              <button onClick={handleLogout}>Logout</button>
            </div>
          )}
        </div>
      </header>
      <main className="main-content-picmatreq">
        <div className="request-materials-container-picmatreq">
          <h1 className="page-title-picmatreq">Material Request #{requestData.requestNumber}</h1>
          <div className="project-details-box" style={{ marginBottom: '20px' }}>
            <h2 style={{ margin: 0 }}>{requestData.project?.projectName || '-'}</h2>
            <p style={{ margin: 0, fontStyle: 'italic' }}>{requestData.project?.location || '-'}</p>
            <p style={{ margin: 0, color: '#555' }}>{requestData.project?.targetDate || ''}</p>
          </div>

          {editMode && isEditable ? (
            <form className="materials-form-picmatreq" onSubmit={e => { e.preventDefault(); handleSaveEdit(); }}>
              <div className="form-group-picmatreq">
                <label className="form-label-picmatreq">Material to be Requested</label>
                <div className="materials-list-picmatreq">
                  <div className="material-headers-picmatreq">
                    <div className="material-header-label-picmatreq">Material Name</div>
                    <div className="quantity-header-label-picmatreq">Quantity</div>
                  </div>
                  {materials.map((material) => (
                    <div key={material.id} className="material-row-picmatreq">
                      <input
                        type="text"
                        value={material.materialName}
                        onChange={(e) => handleMaterialChange(material.id, 'materialName', e.target.value)}
                        placeholder="Enter material name"
                        className="material-input-picmatreq"
                        required
                      />
                      <input
                        type="text"
                        value={material.quantity}
                        onChange={(e) => handleMaterialChange(material.id, 'quantity', e.target.value)}
                        placeholder="Quantity"
                        maxLength={7}
                        className="quantity-input-picmatreq"
                        required
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
                  <button type="button" onClick={handleAddMaterial} className="add-material-btn-picmatreq">
                    + Add Material
                  </button>
                </div>
              </div>

              <div className="form-group-picmatreq">
                <label className="form-label-picmatreq">Attachment Proof</label>
                <div className="upload-section-picmatreq">
                  <label htmlFor="file-upload-edit" className="upload-button">
                    <span className="upload-icon-picmatreq">📎</span>
                    Choose Files
                  </label>
                  <input
                    type="file"
                    id="file-upload-edit"
                    multiple
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="file-input-picmatreq"
                  />
                  <p className="upload-hint-picmatreq">You can attach files such as documents or images</p>

                  {newFiles.length > 0 && (
                    <div className="uploaded-files-picmatreq">
                      {newFiles.map((file, index) => (
                        <div key={index} className="file-item-picmatreq">
                          <img 
                            src={URL.createObjectURL(file)} 
                            alt={`Preview ${index + 1}`} 
                            className="file-preview-image" 
                            style={{ width: '200px', height: '200px', objectFit: 'cover' }} 
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveNewFile(index)}
                            className="remove-file-btn-picmatreq"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {attachments.length > 0 && (
                    <div className="uploaded-files-picmatreq">
                      <h4 style={{ margin: '1rem 0 0.5rem 0', color: '#666' }}>Current Attachments:</h4>
                      {attachments.map((file, idx) => (
                        <div key={idx} className="file-item-picmatreq">
                          <img 
                            src={getAttachmentUrl(file)} 
                            alt={`Attachment ${idx + 1}`} 
                            className="attachment-image" 
                            style={{ width: '200px', height: '200px', objectFit: 'cover' }} 
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveAttachment(idx)}
                            className="remove-file-btn-picmatreq"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="form-group-picmatreq">
                <label className="form-label-picmatreq">Request Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Provide a detailed description of your request"
                  className="description-textarea-picmatreq"
                  rows="4"
                />
              </div>

              <div className="form-actions-picmatreq">
                <button 
                  type="button" 
                  onClick={() => {
                    setEditMode(false);
                    const materialsWithIds = (requestData.materials || []).map((mat, idx) => ({
                      ...mat,
                      id: mat.id || Date.now() + idx
                    }));
                    setMaterials(materialsWithIds);
                    setDescription(requestData.description || '');
                    setAttachments(requestData.attachments || []);
                    setNewFiles([]);
                  }} 
                  className="cancel-btn-picmatreq"
                >
                  Cancel
                </button>
                <button type="submit" className="publish-button-picmatreq">
                  Save Changes
                </button>
              </div>
            </form>
          ) : (
            <>
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

              <div className="attachments-section">
                <h2 className="section-title">Attachment Proof</h2>
                <div className="attachments-grid">
                  {requestData.attachments?.length
                    ? requestData.attachments.map((file, idx) => (
                        <div key={idx} className="attachment-item">
                          <img src={getAttachmentUrl(file)} alt={`Attachment ${idx + 1}`} className="attachment-image" style={{ width: '200px', height: '200px'}} />
                        </div>
                    )) : <div>No attachments</div>}
                </div>
              </div>

              <div className="description-section">
                <h2 className="section-title">Request Description</h2>
                <div className="description-content">
                  <p>{requestData.description}</p>
                </div>
              </div>

              <div className="action-buttons">
                <button onClick={handleBack} className="back-btn">Back</button>
                {isEditable && (
                  <>
                    <button onClick={() => setEditMode(true)} className="edit-btn">Edit</button>
                    <button onClick={handleCancelRequest} className="cancel-btn">Cancel Request</button>
                  </>
                )}
                {requestData.status === 'Approved' && isPIC && (
                  requestData.receivedByPIC ? (
                    <span className="received-badge">
                      <span>✔</span> Received by PIC&nbsp;
                      {requestData.receivedDate && (
                        <span>({new Date(requestData.receivedDate).toLocaleString()})</span>
                      )}
                    </span>
                  ) : (
                    <button onClick={handleMarkReceived} className="received-btn">Mark as Received</button>
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
