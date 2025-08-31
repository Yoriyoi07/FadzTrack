import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../../api/axiosInstance';
import NotificationBell from '../NotificationBell';
import '../style/pic_style/Pic_MatReq.css';
import '../style/pm_style/Pm_Dash.css';

// React Icons
import { FaTachometerAlt, FaComments, FaClipboardList, FaEye, FaProjectDiagram } from 'react-icons/fa';
import AppHeader from '../layout/AppHeader';

const chats = [
  { id: 1, name: 'Rychea Miralles', initial: 'R', message: 'Hello Good Morning po! As...', color: '#4A6AA5' },
  { id: 2, name: 'Third Castellar', initial: 'T', message: 'Hello Good Morning po! As...', color: '#2E7D32' },
  { id: 3, name: 'Zenarose Miranda', initial: 'Z', message: 'Hello Good Morning po! As...', color: '#9C27B0' }
];

const PicMatReq = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [previewImages, setPreviewImages] = useState([]);
  const [materials, setMaterials] = useState([{ id: 1, materialName: '', quantity: '', unit: '' }]);
  const [formData, setFormData] = useState({ description: '' });
  const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    const user = storedUser ? JSON.parse(storedUser) : null;
  const [userName, setUserName] = useState(user?.name || 'PIC');
  const [userRole, setUserRole] = useState(user?.role || 'Person in Charge');
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);

  useEffect(() => {
    if (!token || !user) navigate('/');
  }, [navigate, token, user]);

  useEffect(() => {
    if (!token || !projectId) return;
    api.get(`/projects/${projectId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => setProject(res.data))
      .catch(() => setProject(null));
  }, [projectId, token]);

  useEffect(() => {
    return () => previewImages.forEach(url => URL.revokeObjectURL(url));
  }, [previewImages.length]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest(".user-profile")) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const shouldCollapse = scrollTop > 50;
      setIsHeaderCollapsed(shouldCollapse);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleMaterialChange = (id, field, value) => {
    setMaterials(prev =>
      prev.map(m => {
        if (m.id === id) {
          if (field === 'quantity') {
            let filtered = value.replace(/\D/g, '').slice(0, 7);
            return { ...m, [field]: filtered };
          }
          return { ...m, [field]: value };
        }
        return m;
      })
    );
  };

  const addMaterial = () => {
    const newId = materials.length ? Math.max(...materials.map(m => m.id)) + 1 : 1;
    setMaterials(prev => [...prev, { id: newId, materialName: '', quantity: '', unit: '' }]);
  };

  const removeMaterial = (id) => {
    if (materials.length > 1) {
      setMaterials(prev => prev.filter(m => m.id !== id));
    }
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    setUploadedFiles(prev => [...prev, ...files]);
    const previews = files.map(file => URL.createObjectURL(file));
    setPreviewImages(prev => [...prev, ...previews]);
  };

  const removeFile = (index) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
    setPreviewImages(prev => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!token) {
      alert('No token, please log in again.');
      navigate('/');
      return;
    }

    const validMaterials = materials.filter(m => m.materialName.trim() && m.quantity.trim() && m.unit.trim());
    if (validMaterials.length === 0) {
      alert('Please add at least one material with quantity and unit');
      return;
    }

    const data = new FormData();
    uploadedFiles.forEach(file => data.append('attachments', file));
    data.append('description', formData.description);
    data.append('materials', JSON.stringify(validMaterials));
    data.append('project', projectId);

    try {
      const res = await api.post('/requests', data, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data.msg === 'Invalid token') {
        alert('Session expired. Please login again.');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/');
        return;
      }

      alert('✅ Material request submitted successfully!');
      setFormData({ description: '' });
      setMaterials([{ id: 1, materialName: '', quantity: '', unit: '' }]);
      setUploadedFiles([]);
      setPreviewImages([]);
    } catch (err) {
      alert('❌ Upload failed');
    }
  };

  return (
    <div>
  <AppHeader roleSegment="pic" />

      <div style={{padding:'1.05rem 1.6rem .3rem'}}>
        <h1 style={{margin:'0 0 4px',fontSize:'1.06rem',fontWeight:600,color:'#1e293b'}}>New Material Request</h1>
        <p style={{margin:0,fontSize:'.7rem',letterSpacing:.2,color:'#64748b'}}>Create a new request for your project</p>
      </div>

      {/* Main content */}
      <div className="dashboard-layout">
        <main className="dashboard-main">
          <div className="page-container">
            <div className="request-materials-container-picmatreq">
              {/* Back Button */}
              <div className="back-button-container" style={{ marginBottom: '20px' }}>
                <button 
                  onClick={() => navigate('/pic/requests')} 
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
                  ← Back to Requests
                </button>
        </div>

            <h1 className="page-title-picmatreq">Request Materials</h1>
            {project && (
                <div className="project-details-box" style={{ 
                  marginBottom: '20px',
                  background: '#ffffff',
                  padding: '16px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
                }}>
                  <h2 style={{ margin: '0 0 8px 0', fontSize: '18px', color: '#1f2937' }}>{project.name}</h2>
                  <p style={{ margin: '0 0 4px 0', fontStyle: 'italic', color: '#6b7280' }}>
                  {project.location?.name} ({project.location?.region})
                </p>
                  <p style={{ margin: 0, color: '#9ca3af', fontSize: '14px' }}>Target Date: {project.targetDate}</p>
              </div>
            )}
              
            <div className="materials-form-picmatreq">
              <div className="form-group-picmatreq">
                <label className="form-label-picmatreq">Material to be Requested</label>
                <div className="materials-list-picmatreq">
                  <div className="material-headers-picmatreq">
                    <span className="material-header-label-picmatreq">Material Name</span>
                    <span className="quantity-header-label-picmatreq">Quantity</span>
                    <span className="unit-header-label-picmatreq">Unit</span>
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
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={material.quantity}
                        onChange={(e) => handleMaterialChange(material.id, 'quantity', e.target.value)}
                        placeholder="Quantity"
                        maxLength={7}
                        className="quantity-input-picmatreq"
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
                        disabled={materials.length === 1}
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
                
              <div className="form-group-picmatreq">
                <label className="form-label-picmatreq">Request Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  className="description-textarea-picmatreq"
                  rows="6"
                  placeholder="Provide a detailed description of your request"
                />
              </div>
                
              <div className="form-actions-picmatreq">
                <button onClick={handleSubmit} className="publish-button-picmatreq">
                  Publish Request
                </button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default PicMatReq;
