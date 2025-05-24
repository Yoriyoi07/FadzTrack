import React, { useState, useEffect } from 'react';
import '../style/pic_style/Pic_Req.css';

const MaterialRequest = () => {
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  
  const [formData, setFormData] = useState({
    projectName: 'Batangas Townhomes | Ssg. Daryl Morales',
    materials: [
      { item: '100 bags Sand', quantity: '' },
      { item: '50 bags Gravel', quantity: '' },
      { item: '100 bags Cement', quantity: '' },
      { item: '1000 pcs roof Shingles', quantity: '' }
    ],
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevState => ({
      ...prevState,
      [name]: value
    }));
  };

  const handleMaterialChange = (index, field, value) => {
    const newMaterials = [...formData.materials];
    newMaterials[index][field] = value;
    setFormData(prevState => ({
      ...prevState,
      materials: newMaterials
    }));
  };

  const addMaterial = () => {
    setFormData(prevState => ({
      ...prevState,
      materials: [...prevState.materials, { item: '', quantity: '' }]
    }));
  };

  const removeMaterial = (index) => {
    const newMaterials = formData.materials.filter((_, i) => i !== index);
    setFormData(prevState => ({
      ...prevState,
      materials: newMaterials
    }));
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    setUploadedFiles(prevFiles => [...prevFiles, ...files]);
  };

  const removeFile = (index) => {
    setUploadedFiles(prevFiles => prevFiles.filter((_, i) => i !== index));
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
    console.log('Logout clicked');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    alert('✅ Material request submitted successfully!');
  };

  const handleBack = () => {
    console.log('Back clicked');
  };

  const handleCancelRequest = () => {
    if (window.confirm('Are you sure you want to cancel this request?')) {
      console.log('Request cancelled');
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
          <a href="/requests" className="nav-link">Requests</a>
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

      <main className="main-content">
        <div className="request-container">
          <div className="request-header">
            <h1 className="request-title">Material Request #334</h1>
            <p className="project-name">{formData.projectName}</p>
          </div>

          <form onSubmit={handleSubmit} className="request-form">
            <div className="form-section">
              <h3 className="section-title">Material to be Requested</h3>
              <div className="materials-list">
                {formData.materials.map((material, index) => (
                  <div key={index} className="material-item">
                    <input
                      type="text"
                      placeholder="Material item"
                      value={material.item}
                      onChange={(e) => handleMaterialChange(index, 'item', e.target.value)}
                      className="material-input"
                    />
                    <input
                      type="text"
                      placeholder="Quantity"
                      value={material.quantity}
                      onChange={(e) => handleMaterialChange(index, 'quantity', e.target.value)}
                      className="quantity-input"
                    />
                    {formData.materials.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeMaterial(index)}
                        className="remove-btn"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button type="button" onClick={addMaterial} className="add-material-btn">
                + Add Material
              </button>
            </div>

            <div className="form-section">
              <h3 className="section-title">Attachment Proof</h3>
              <div className="upload-section">
                <input
                  type="file"
                  id="file-upload"
                  multiple
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="file-input"
                />
                <label htmlFor="file-upload" className="upload-btn">📎 Upload</label>
                <p className="upload-hint">You can attach files such as documents or images</p>
              </div>

              {uploadedFiles.length > 0 && (
                <div className="uploaded-files">
                  {uploadedFiles.map((file, index) => (
                    <div key={index} className="file-item">
                      <span className="file-name">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="remove-file-btn"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="form-section">
              <h3 className="section-title">Request Description</h3>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                className="description-textarea"
                rows="8"
                placeholder="Enter request description..."
              />
            </div>

            <div className="action-buttons">
              <button type="button" onClick={handleBack} className="back-button1">Back</button>
              <button type="submit" className="submit-btn">Submit Request</button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
};

export default MaterialRequest;
