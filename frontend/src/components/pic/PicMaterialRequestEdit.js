import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../../api/axiosInstance';
import '../style/pic_style/Pic_MatReq.css';
import '../style/pm_style/Pm_Dash.css';
// Nav icons
import { FaTachometerAlt, FaComments, FaClipboardList, FaEye, FaProjectDiagram, FaArrowLeft, FaInfoCircle, FaUser, FaBoxes as FaMaterials, FaPaperclip, FaTruck, FaCheck, FaClock, FaDownload, FaCalendarAlt, FaMapMarkerAlt, FaPlus, FaTrash, FaSave } from 'react-icons/fa';

const PicMaterialRequestEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [materialRequest, setMaterialRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const profileDropdownRef = useRef(null);
  
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });

  // Form state
  const [formData, setFormData] = useState({
    description: '',
    materials: [{ id: 1, materialName: '', quantity: '', unit: '' }],
    attachments: []
  });

  // File handling
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [previewImages, setPreviewImages] = useState([]);
  const [newFiles, setNewFiles] = useState([]);

  useEffect(() => {
    // Fetch the material request data
    api.get(`/requests/${id}`)
      .then(res => {
        console.log('Material Request Data for Edit:', res.data);
        const data = res.data;
        setMaterialRequest(data);
        
        // Initialize form data
        setFormData({
          description: data.description || '',
          materials: data.materials && data.materials.length > 0 
            ? data.materials.map((mat, idx) => ({
                id: mat.id || Date.now() + idx,
                materialName: mat.materialName || '',
                quantity: mat.quantity || '',
                unit: mat.unit || ''
              }))
            : [{ id: 1, materialName: '', quantity: '', unit: '' }],
          attachments: data.attachments || []
        });
        
        setError('');
      })
      .catch((err) => {
        console.error('Error fetching request:', err);
        setError('Failed to load request details.');
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) {
        setProfileMenuOpen(false);
      }
    };
    const handleScroll = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      setIsHeaderCollapsed(scrollTop > 50);
    };
    document.addEventListener('click', handleClickOutside);
    window.addEventListener('scroll', handleScroll);
    return () => { 
      document.removeEventListener('click', handleClickOutside); 
      window.removeEventListener('scroll', handleScroll); 
    };
  }, []);

  useEffect(() => {
    return () => previewImages.forEach(url => URL.revokeObjectURL(url));
  }, [previewImages.length]);

  const handleLogout = () => {
    const token = localStorage.getItem('token');
    api.post('/auth/logout', {}, {
      headers: { Authorization: `Bearer ${token}` }
    }).finally(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      navigate('/');
    });
  };

  const handleBack = () => navigate(`/pic/request/${id}`);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleMaterialChange = (id, field, value) => {
    setFormData(prev => ({
      ...prev,
      materials: prev.materials.map(m => {
        if (m.id === id) {
          if (field === 'quantity') {
            let filtered = value.replace(/\D/g, '').slice(0, 7);
            return { ...m, [field]: filtered };
          }
          return { ...m, [field]: value };
        }
        return m;
      })
    }));
  };

  const addMaterial = () => {
    const newId = formData.materials.length ? Math.max(...formData.materials.map(m => m.id)) + 1 : 1;
    setFormData(prev => ({
      ...prev,
      materials: [...prev.materials, { id: newId, materialName: '', quantity: '', unit: '' }]
    }));
  };

  const removeMaterial = (id) => {
    if (formData.materials.length > 1) {
      setFormData(prev => ({
        ...prev,
        materials: prev.materials.filter(m => m.id !== id)
      }));
    }
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    setNewFiles(prev => [...prev, ...files]);
    const previews = files.map(file => URL.createObjectURL(file));
    setPreviewImages(prev => [...prev, ...previews]);
  };

  const removeFile = (index) => {
    setNewFiles(prev => prev.filter((_, i) => i !== index));
    setPreviewImages(prev => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  };

  const removeExistingFile = (index) => {
    setFormData(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const data = new FormData();
      data.append('description', formData.description);
      data.append('materials', JSON.stringify(formData.materials));
      
      // Add new files
      newFiles.forEach(file => data.append('attachments', file));
      
      // Add existing attachments that weren't removed
      formData.attachments.forEach(attachment => {
        data.append('existingAttachments', attachment);
      });

      const response = await api.put(`/requests/${id}`, data, {
        headers: { 
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.data.success) {
        alert('✅ Material request updated successfully!');
        navigate(`/pic/request/${id}`);
      } else {
        setError('Failed to update request. Please try again.');
      }
    } catch (err) {
      console.error('Error updating request:', err);
      setError('Failed to update request. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div>Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: '20px' }}>
        <div style={{ color: 'red' }}>{error}</div>
        <button onClick={handleBack}>Go Back</button>
      </div>
    );
  }

  return (
    <div>
      {/* PIC-style collapsible header */}
      <header className={`dashboard-header ${isHeaderCollapsed ? 'collapsed' : ''}`}>
        <div className="header-top">
          <div className="logo-section">
            <img src={require('../../assets/images/FadzLogo1.png')} alt="FadzTrack Logo" className="header-logo" />
            <h1 className="header-brand">FadzTrack</h1>
          </div>
          <div className="user-profile" ref={profileDropdownRef} onClick={() => setProfileMenuOpen(!profileMenuOpen)}>
            <div className="profile-avatar">{user?.name ? user.name.charAt(0).toUpperCase() : 'P'}</div>
            <div className={`profile-info ${isHeaderCollapsed ? 'hidden' : ''}`}>
              <span className="profile-name">{user?.name || 'PIC'}</span>
              <span className="profile-role">{user?.role || 'Person in Charge'}</span>
            </div>
            {profileMenuOpen && (
              <div className="profile-dropdown" onClick={(e) => e.stopPropagation()}>
                <button onClick={(e) => { e.stopPropagation(); handleLogout(); }} className="logout-btn"><span>Logout</span></button>
              </div>
            )}
          </div>
        </div>
        <div className="header-bottom">
          <nav className="header-nav">
            <Link to="/pic" className="nav-item">
              <FaTachometerAlt />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Dashboard</span>
            </Link>
            <Link to="/pic/chat" className="nav-item">
              <FaComments />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Chat</span>
            </Link>
            <Link to="/pic/requests" className="nav-item active">
              <FaClipboardList />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Requests</span>
            </Link>
            <Link to="/pic/projects" className="nav-item">
              <FaProjectDiagram />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>My Projects</span>
            </Link>
          </nav>
        </div>
      </header>

      {/* Main content */}
      <div className="dashboard-layout">
        <main className="dashboard-main">
          <div className="page-container">
            <div className="request-materials-container-picmatreq">
              {/* Back Button */}
              <div className="back-button-container" style={{ marginBottom: '20px' }}>
                <button 
                  onClick={handleBack} 
                  className="back-button"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 16px',
                    backgroundColor: '#f8f9fa',
                    border: '1px solid #dee2e6',
                    borderRadius: '6px',
                    color: '#495057',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.backgroundColor = '#e9ecef';
                    e.target.style.borderColor = '#adb5bd';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor = '#f8f9fa';
                    e.target.style.borderColor = '#dee2e6';
                  }}
                >
                  <FaArrowLeft /> Back to Request Details
                </button>
              </div>

              <h1 className="page-title-picmatreq">Edit Material Request</h1>
              
              {materialRequest && (
                <div className="project-details-box" style={{ 
                  marginBottom: '20px',
                  background: '#ffffff',
                  padding: '16px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
                }}>
                  <h2 style={{ margin: '0 0 8px 0', fontSize: '18px', color: '#1f2937' }}>
                    {materialRequest.project?.projectName || 'Project'}
                  </h2>
                  <p style={{ margin: '0 0 4px 0', fontStyle: 'italic', color: '#6b7280' }}>
                    {materialRequest.project?.location?.name} ({materialRequest.project?.location?.region})
                  </p>
                  <p style={{ margin: 0, color: '#9ca3af', fontSize: '14px' }}>
                    Requested by: {materialRequest.createdBy?.name || 'Unknown'}
                  </p>
                </div>
              )}
              
              <form onSubmit={handleSubmit} className="materials-form-picmatreq">
                <div className="form-group-picmatreq">
                  <label className="form-label-picmatreq">Request Description</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    className="description-textarea-picmatreq"
                    rows="6"
                    placeholder="Provide a detailed description of your request"
                    required
                  />
                </div>

                <div className="form-group-picmatreq">
                  <label className="form-label-picmatreq">Materials</label>
                  <div className="materials-list-picmatreq">
                    <div className="material-headers-picmatreq">
                      <span className="material-header-label-picmatreq">Material Name</span>
                      <span className="quantity-header-label-picmatreq">Quantity</span>
                      <span className="unit-header-label-picmatreq">Unit</span>
                      <span className="action-header-label-picmatreq"></span>
                    </div>
                    {formData.materials.map((material) => (
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
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={material.quantity}
                          onChange={(e) => handleMaterialChange(material.id, 'quantity', e.target.value)}
                          placeholder="Quantity"
                          maxLength={7}
                          className="quantity-input-picmatreq"
                          required
                          onPaste={e => {
                            const paste = e.clipboardData.getData('text');
                            if (!/^\d+$/.test(paste)) e.preventDefault();
                            if (paste.length > 7) e.preventDefault();
                          }}
                          onKeyPress={e => {
                            if (!/[0-9]/.test(e.key) || material.quantity.length >= 7) {
                              e.preventDefault();
                            }
                          }}
                        />
                        <select
                          value={material.unit}
                          onChange={(e) => handleMaterialChange(material.id, 'unit', e.target.value)}
                          className="unit-select-picmatreq"
                          required
                        >
                          <option value="">Select Unit</option>
                          <option value="kg">Kilograms (kg)</option>
                          <option value="g">Grams (g)</option>
                          <option value="ton">Metric Tons (ton)</option>
                          <option value="bag">Bags</option>
                          <option value="piece">Pieces</option>
                          <option value="box">Boxes</option>
                          <option value="roll">Rolls</option>
                          <option value="sheet">Sheets</option>
                          <option value="m">Meters (m)</option>
                          <option value="cm">Centimeters (cm)</option>
                          <option value="m2">Square Meters (m²)</option>
                          <option value="m3">Cubic Meters (m³)</option>
                          <option value="l">Liters (L)</option>
                          <option value="truck">Truck Loads</option>
                          <option value="set">Sets</option>
                          <option value="pair">Pairs</option>
                          <option value="bundle">Bundles</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => removeMaterial(material.id)}
                          className="remove-material-btn-picmatreq"
                          disabled={formData.materials.length === 1}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={addMaterial}
                      className="add-material-btn-picmatreq"
                    >
                      + Add Material
                    </button>
                  </div>
                </div>
                
                <div className="form-group-picmatreq">
                  <label className="form-label-picmatreq">Attachments</label>
                  <div className="upload-section-picmatreq">
                    {/* Existing attachments */}
                    {formData.attachments.length > 0 && (
                      <div style={{ marginBottom: '16px' }}>
                        <h4 style={{ fontSize: '14px', marginBottom: '8px', color: '#374151' }}>Current Attachments:</h4>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {formData.attachments.map((attachment, index) => (
                            <div key={index} style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '8px',
                              padding: '8px 12px',
                              backgroundColor: '#f3f4f6',
                              borderRadius: '6px',
                              border: '1px solid #d1d5db'
                            }}>
                              <FaPaperclip style={{ color: '#6b7280' }} />
                              <span style={{ fontSize: '12px', color: '#374151' }}>
                                {attachment.name || `Attachment ${index + 1}`}
                              </span>
                              <button
                                type="button"
                                onClick={() => removeExistingFile(index)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#ef4444',
                                  cursor: 'pointer',
                                  fontSize: '14px',
                                  padding: '2px 6px'
                                }}
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* New file upload */}
                    <input
                      type="file"
                      id="file-upload"
                      multiple
                      accept="image/*,.pdf,.doc,.docx"
                      onChange={handleFileUpload}
                      className="file-input-picmatreq"
                    />
                    <label htmlFor="file-upload" className="upload-button">
                      <span className="upload-icon-picmatreq">📎</span>
                      Upload New Files
                    </label>
                    
                    {/* Preview of new files */}
                    {previewImages.length > 0 && (
                      <div className="preview-container" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '10px' }}>
                        {previewImages.map((src, index) => (
                          <div key={index} style={{ position: 'relative' }}>
                            <img
                              src={src}
                              alt={`preview-${index}`}
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
                              onClick={() => removeFile(index)}
                              style={{
                                position: 'absolute',
                                top: '-6px',
                                right: '-6px',
                                background: '#ff4d4f',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '50%',
                                width: '20px',
                                height: '20px',
                                cursor: 'pointer'
                              }}
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
                
                <div className="form-actions-picmatreq">
                  <button 
                    type="submit" 
                    className="publish-button-picmatreq"
                    disabled={saving}
                    style={{
                      opacity: saving ? 0.7 : 1,
                      cursor: saving ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default PicMaterialRequestEdit;
