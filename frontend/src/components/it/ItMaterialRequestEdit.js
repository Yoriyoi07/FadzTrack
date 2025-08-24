import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../../api/axiosInstance';
import '../style/it_style/ItMaterialRequestDetail.css';
// Nav icons
import { FaTachometerAlt, FaComments, FaBoxes, FaUsers, FaClipboardList, FaArrowLeft, FaInfoCircle, FaUser, FaBoxes as FaMaterials, FaPaperclip, FaTruck, FaCheck, FaClock, FaDownload, FaCalendarAlt, FaMapMarkerAlt, FaPlus, FaTrash, FaSave } from 'react-icons/fa';

const ItMaterialRequestEdit = () => {
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

  const handleBack = () => navigate(`/it/material-request/${id}`);
  const handleCancel = () => navigate(`/it/material-request/${id}`);

  // Form handlers
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
            // Allow only numbers for quantity
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

  // File handling
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

  const removeExistingAttachment = (index) => {
    setFormData(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index)
    }));
  };

  // Form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.description.trim()) {
      setError('Description is required');
      return;
    }

    const validMaterials = formData.materials.filter(m => 
      m.materialName.trim() && m.quantity.trim() && m.unit.trim()
    );

    if (validMaterials.length === 0) {
      setError('At least one material is required');
      return;
    }

    setSaving(true);
    setError('');

    try {
      // Prepare form data
      const submitData = new FormData();
      submitData.append('description', formData.description);
      submitData.append('materials', JSON.stringify(validMaterials));
      submitData.append('attachments', JSON.stringify(formData.attachments));

      // Add new files
      newFiles.forEach(file => {
        submitData.append('files', file);
      });

      // Update the request
      const response = await api.put(`/requests/${id}`, submitData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        }
      });

      console.log('Request updated successfully:', response.data);
      alert('Material request updated successfully!');
      navigate(`/it/material-request/${id}`);
      
    } catch (err) {
      console.error('Error updating request:', err);
      setError(err.response?.data?.message || 'Failed to update request');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="fadztrack-app-IT">
        <div className="loading-container-IT">
          <div className="loading-spinner-IT"></div>
          <p>Loading request details...</p>
        </div>
      </div>
    );
  }

  if (!materialRequest) {
    return (
      <div className="fadztrack-app-IT">
        <div className="error-container-IT">
          <p>{error || 'Request not found.'}</p>
          <button onClick={handleBack} className="back-button-IT">Go Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fadztrack-app-IT">
      <div className="head-IT">
        <header className={`dashboard-header ${isHeaderCollapsed ? 'collapsed' : ''}`}>
          <div className="header-top">
            <div className="logo-section">
              <img
                src={require('../../assets/images/FadzLogo1.png')}
                alt="FadzTrack Logo"
                className="header-logo"
              />
              <h1 className="header-brand">FadzTrack</h1>
            </div>

            <div className="user-profile" onClick={() => setProfileMenuOpen(!profileMenuOpen)}>
              <div className="profile-avatar">
                {user?.name ? user.name.charAt(0).toUpperCase() : 'I'}
              </div>
              <div className={`profile-info ${isHeaderCollapsed ? 'hidden' : ''}`}>
                <span className="profile-name">{user?.name || 'User'}</span>
                <span className="profile-role">{user?.role || 'IT Administrator'}</span>
              </div>
              {profileMenuOpen && (
                <div className="profile-dropdown">
                  <button onClick={handleLogout} className="logout-btn">
                    <span>Logout</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="header-bottom">
            <nav className="header-nav">
              <Link to="/it" className="nav-item">
                <FaTachometerAlt />
                <span className={isHeaderCollapsed ? 'hidden' : ''}>Dashboard</span>
              </Link>
              <Link to="/it/chat" className="nav-item">
                <FaComments />
                <span className={isHeaderCollapsed ? 'hidden' : ''}>Chat</span>
              </Link>
              <Link to="/it/material-list" className="nav-item active">
                <FaBoxes />
                <span className={isHeaderCollapsed ? 'hidden' : ''}>Materials</span>
              </Link>
              <Link to="/it/manpower-list" className="nav-item">
                <FaUsers />
                <span className={isHeaderCollapsed ? 'hidden' : ''}>Manpower</span>
              </Link>
              <Link to="/it/auditlogs" className="nav-item">
                <FaClipboardList />
                <span className={isHeaderCollapsed ? 'hidden' : ''}>Audit Logs</span>
              </Link>
            </nav>
          </div>
        </header>
      </div>

      <div className="main-content-IT no-sidebar-IT">
        <main className="dashboard-content-IT">
          <div className="dashboard-card-IT">
            <div className="welcome-header-IT">
              <div className="header-left-IT">
                <h2>Edit Material Request</h2>
                <p style={{ fontSize: '14px', color: '#666', marginTop: '4px' }}>
                  Request ID: {materialRequest._id}
                </p>
              </div>
              <div className="header-right-IT">
                <div className="action-buttons-header-IT">
                  <button className="back-btn-header-IT" onClick={handleCancel}>
                    <FaArrowLeft style={{ marginRight: 8 }} />
                    Cancel
                  </button>
                </div>
              </div>
            </div>

            {error && (
              <div className="error-message-IT">
                <i className="fas fa-exclamation-triangle"></i>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="detail-grid-IT">
                <div className="detail-column-IT">
                  <div className="detail-card-IT">
                    <div className="card-header-IT">
                      <h3><FaInfoCircle /> Request Information</h3>
                    </div>
                    <div className="card-content-IT">
                      <div className="info-row-IT">
                        <span className="info-label-IT">Description:</span>
                        <div className="info-value-IT" style={{ textAlign: 'left', marginLeft: 0 }}>
                          <textarea
                            name="description"
                            value={formData.description}
                            onChange={handleChange}
                            className="description-input-IT"
                            placeholder="Enter request description..."
                            rows="4"
                            required
                          />
                        </div>
                      </div>
                      
                      <div className="info-row-IT">
                        <span className="info-label-IT">Project:</span>
                        <span className="info-value-IT">
                          {materialRequest.project?.projectName || 'No project specified'}
                        </span>
                      </div>
                      
                      <div className="info-row-IT">
                        <span className="info-label-IT">Status:</span>
                        <span className="info-value-IT">
                          <span className={`priority-badge-IT priority-${(materialRequest.status || 'pending').toLowerCase().replace(/\s+/g, '-')}`}>
                            {materialRequest.status || 'Pending'}
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="detail-column-IT">
                  <div className="detail-card-IT">
                    <div className="card-header-IT">
                      <h3><FaMaterials /> Requested Materials</h3>
                    </div>
                    <div className="card-content-IT">
                      {formData.materials.map((material, index) => (
                        <div key={material.id} className="material-edit-item-IT">
                          <div className="material-edit-row-IT">
                            <div className="material-edit-field-IT">
                              <label>Material Name:</label>
                              <input
                                type="text"
                                value={material.materialName}
                                onChange={(e) => handleMaterialChange(material.id, 'materialName', e.target.value)}
                                placeholder="Enter material name"
                                required
                              />
                            </div>
                            <div className="material-edit-field-IT">
                              <label>Quantity:</label>
                              <input
                                type="text"
                                value={material.quantity}
                                onChange={(e) => handleMaterialChange(material.id, 'quantity', e.target.value)}
                                placeholder="Enter quantity"
                                required
                              />
                            </div>
                            <div className="material-edit-field-IT">
                              <label>Unit:</label>
                              <select
                                value={material.unit}
                                onChange={(e) => handleMaterialChange(material.id, 'unit', e.target.value)}
                                required
                              >
                                <option value="">Select unit</option>
                                <option value="pcs">Pieces</option>
                                <option value="kg">Kilograms</option>
                                <option value="m">Meters</option>
                                <option value="l">Liters</option>
                                <option value="box">Boxes</option>
                                <option value="roll">Rolls</option>
                                <option value="set">Sets</option>
                                <option value="pair">Pairs</option>
                                <option value="unit">Units</option>
                                <option value="bundle">Bundles</option>
                              </select>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeMaterial(material.id)}
                              className="remove-material-btn-IT"
                              disabled={formData.materials.length === 1}
                            >
                              <FaTrash />
                            </button>
                          </div>
                        </div>
                      ))}
                      
                      <button
                        type="button"
                        onClick={addMaterial}
                        className="add-material-btn-IT"
                      >
                        <FaPlus style={{ marginRight: 8 }} />
                        Add Material
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="detail-card-IT full-width-IT">
                <div className="card-header-IT">
                  <h3><FaPaperclip /> Attachments</h3>
                </div>
                <div className="card-content-IT">
                  {/* Existing Attachments */}
                  {formData.attachments.length > 0 && (
                    <div className="existing-attachments-IT">
                      <h4>Current Attachments:</h4>
                      <div className="attachments-list-IT">
                        {formData.attachments.map((attachment, index) => (
                          <div key={index} className="attachment-item-IT">
                            <div className="attachment-icon-IT">
                              <FaDownload />
                            </div>
                            <div className="attachment-info-IT">
                              <span className="attachment-name-IT">{attachment}</span>
                              <button
                                type="button"
                                onClick={() => removeExistingAttachment(index)}
                                className="remove-attachment-btn-IT"
                              >
                                <FaTrash />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* New File Upload */}
                  <div className="file-upload-section-IT">
                    <h4>Add New Files:</h4>
                    <input
                      type="file"
                      multiple
                      onChange={handleFileUpload}
                      className="file-input-IT"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt"
                    />
                    
                    {/* Preview of new files */}
                    {newFiles.length > 0 && (
                      <div className="new-files-preview-IT">
                        <h5>New Files to Upload:</h5>
                        <div className="attachments-list-IT">
                          {newFiles.map((file, index) => (
                            <div key={index} className="attachment-item-IT">
                              <div className="attachment-icon-IT">
                                <FaPaperclip />
                              </div>
                              <div className="attachment-info-IT">
                                <span className="attachment-name-IT">{file.name}</span>
                                <button
                                  type="button"
                                  onClick={() => removeFile(index)}
                                  className="remove-attachment-btn-IT"
                                >
                                  <FaTrash />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="submit-actions-IT">
                <button
                  type="submit"
                  className="save-btn-IT"
                  disabled={saving}
                >
                  <FaSave style={{ marginRight: 8 }} />
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="cancel-btn-IT"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
};

export default ItMaterialRequestEdit;
