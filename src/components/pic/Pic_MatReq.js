import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import '../style/pic_style/Pic_MatReq.css';

const Pic_MatReq = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [previewImages, setPreviewImages] = useState([]);
  const [materials, setMaterials] = useState([{ id: 1, materialName: '', quantity: '' }]);
  const [formData, setFormData] = useState({ description: '' });
  const token = localStorage.getItem('token');
  const storedUser = localStorage.getItem('user');
  const user = storedUser ? JSON.parse(storedUser) : null;
  const userId = user?._id;

  useEffect(() => {
    if (!token || !user) navigate('/');
  }, [navigate, token, user]);

  useEffect(() => {
    if (!token) return;
    const fetchProject = async () => {
      try {
        const res = await fetch(
          `http://localhost:5000/api/projects/${projectId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await res.json();
        setProject(data);
      } catch (err) {
        console.error('Failed to load project:', err);
      }
    };
    fetchProject();
  }, [projectId, token]);

  useEffect(() => () => previewImages.forEach(URL.revokeObjectURL), [previewImages]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Restrict quantity to numbers and 7 digits max
  const handleMaterialChange = (id, field, value) => {
    setMaterials(prev =>
      prev.map(m => {
        if (m.id === id) {
          if (field === 'quantity') {
            // Remove all non-digits, then trim to 7 digits
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
    const newId = Math.max(...materials.map(m => m.id)) + 1;
    setMaterials(prev => [...prev, { id: newId, materialName: '', quantity: '' }]);
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
    setPreviewImages(prev => prev.filter((_, i) => i !== index));
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest(".profile-menu-container")) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, []);

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

    const validMaterials = materials.filter(m => m.materialName.trim() && m.quantity.trim());
    if (validMaterials.length === 0) {
      alert('Please add at least one material with quantity');
      return;
    }

    const data = new FormData();
    uploadedFiles.forEach(file => data.append('attachments', file));
    data.append('description', formData.description);
    data.append('materials', JSON.stringify(validMaterials));
    data.append('project', projectId);

    try {
      const res = await fetch('http://localhost:5000/api/requests', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: data,
      });

      const result = await res.json();

      if (result.msg === 'Invalid token') {
        alert('Session expired. Please login again.');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/');
        return;
      }

      alert('✅ Material request submitted successfully!');
      setFormData({ description: '' });
      setMaterials([{ id: 1, materialName: '', quantity: '' }]);
      setUploadedFiles([]);
      setPreviewImages([]);
    } catch (err) {
      console.error('❌ Upload failed:', err);
      alert('❌ Upload failed');
    }
  };

  return (
    <div className="app-container">
      <header className="header">
        <div className="logo-container">
          <div className="logo">
            <div className="logo-building"></div>
            <div className="logo-flag"></div>
          </div>
          <h1 className="brand-name">FadzTrack</h1>
        </div>
        <nav className="nav-menu">
          <a href="/ceo/dash" className="nav-link">Dashboard</a>
          <a href="/requests" className="nav-link active">Requests</a>
          <a href="/ceo/proj" className="nav-link">Projects</a>
          <a href="/chat" className="nav-link">Chat</a>
          <a href="/logs" className="nav-link">Logs</a>
          <a href="/reports" className="nav-link">Reports</a>
        </nav>
        <div className="search-profile">
          <div className="search-container">
            <input type="text" placeholder="Search in site" className="search-input" />
            <button className="search-button">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </button>
          </div>
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
        </div>
      </header>

      <main className="main-content-picmatreq">
        <div className="request-materials-container-picmatreq">
          <h1 className="page-title-picmatreq">Request Materials</h1>

          {project && (
            <div className="project-details-box" style={{ marginBottom: '20px' }}>
              <h2 style={{ margin: 0 }}>{project.name}</h2>
              <p style={{ margin: 0, fontStyle: 'italic' }}>
  {project.location?.name} ({project.location?.region})
</p>
              <p style={{ margin: 0, color: '#555' }}>{project.targetDate}</p>
            </div>
          )}
          
          <div className="materials-form-picmatreq">
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
      </main>
    </div>
  );
};

export default Pic_MatReq;
