import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import '../style/pic_style/Pic_Req.css';

const ManpowerReq = () => {
  const navigate = useNavigate();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const [formData, setFormData] = useState({
    requestTitle: '',
    projectLocation: '',
    manpowers: [{ type: '', quantity: '' }],  // Dynamic rows here
    description: '',
    attachments: []
  });

  // --- Dynamic Manpower Handlers ---
  const handleManpowerChange = (idx, field, value) => {
    setFormData(prev => {
      const newManpowers = prev.manpowers.map((mp, i) => 
        i === idx ? { ...mp, [field]: value } : mp
      );
      return { ...prev, manpowers: newManpowers };
    });
  };

  const addManpowerRow = () => {
    setFormData(prev => ({
      ...prev,
      manpowers: [ ...prev.manpowers, { type: '', quantity: '' } ]
    }));
  };

  const removeManpowerRow = (idx) => {
    setFormData(prev => ({
      ...prev,
      manpowers: prev.manpowers.filter((_, i) => i !== idx)
    }));
  };

  // --- General Field Change Handler ---
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevState => ({
      ...prevState,
      [name]: value
    }));
  };

  // --- Attachment Handler (optional if you want to use file uploads) ---
  const handleAttachmentChange = (e) => {
    setFormData(prev => ({
      ...prev,
      attachments: Array.from(e.target.files)
    }));
  };

  // --- Profile Menu Logic ---
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

  // --- Form Submit Handler ---
  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const requestFormData = new FormData();
      requestFormData.append('requestTitle', formData.requestTitle);
      requestFormData.append('projectLocation', formData.projectLocation);
      requestFormData.append('manpowers', JSON.stringify(formData.manpowers));
      requestFormData.append('description', formData.description);

      formData.attachments.forEach(file => {
        requestFormData.append('attachments', file);
      });

      const response = await fetch('http://localhost:5000/api/manpower-requests', {
        method: 'POST',
        body: requestFormData
      });
      const result = await response.json();

      if (response.ok) {
        alert('✅ Manpower request submitted successfully!');
        setFormData({
          requestTitle: '',
          projectLocation: '',
          manpowers: [{ type: '', quantity: '' }],
          description: '',
          attachments: []
        });
      } else {
        alert(`❌ Error: ${result.message || 'Failed to submit request'}`);
      }
    } catch (error) {
      console.error('❌ Submission error:', error);
      alert('❌ Failed to connect to server.');
    }
  };

  return (
    <div className="app-container">
      {/* Header with Navigation */}
      <header className="header">
        <div className="logo-container">
          <div className="logo">
            <div className="logo-building"></div>
            <div className="logo-flag"></div>
          </div>
          <h1 className="brand-name">FadzTrack</h1>
        </div>
        <nav className="nav-menu">
          <Link to="/requests" className="nav-link">Requests</Link>
          <Link to="/projects" className="nav-link">Projects</Link>
          <Link to="/chat" className="nav-link">Chat</Link>
          <Link to="/logs" className="nav-link">Logs</Link>
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

      {/* Main Content */}
      <main className="main-content">
        <div className="form-container">
          <h2 className="page-title">Request Manpower</h2>
          <form onSubmit={handleSubmit} className="project-form">
            {/* Request Title & Project Location */}
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="requestTitle">Target Acquisition Date</label>
                <input
                  type="text"
                  id="requestTitle"
                  name="requestTitle"
                  placeholder="Enter request name"
                  value={formData.requestTitle}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="projectLocation">Duration</label>
                <input
                  type="text"
                  id="projectLocation"
                  name="projectLocation"
                  placeholder="Location of project"
                  value={formData.projectLocation}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

{/* Dynamic Manpower Rows */}
<div style={{ marginTop: '18px' }}>
  {/* Header labels */}
  <div className="form-row">
    <div className="form-group">
      <label>Type of Manpower</label>
    </div>
    <div className="form-group">
      <label>Quantity</label>
    </div>
    <div style={{ width: '80px' }}></div> {/* Spacer for remove button */}
  </div>
  
  {/* Dynamic input rows */}
  {formData.manpowers.map((mp, idx) => (
    <div className="form-row manpower-row" key={idx}>
      <div className="form-group">
        <input
          type="text"
          name={`manpowerType_${idx}`}
          placeholder="Type of Manpower"
          value={mp.type}
          onChange={e => handleManpowerChange(idx, 'type', e.target.value)}
          required
        />
      </div>
      <div className="form-group">
        <input
          type="number"
          name={`manpowerQuantity_${idx}`}
          placeholder="Quantity"
          min="1"
          value={mp.quantity}
          onChange={e => handleManpowerChange(idx, 'quantity', e.target.value)}
          required
        />
      </div>
      {formData.manpowers.length > 1 && (
        <button
          type="button"
          onClick={() => removeManpowerRow(idx)}
          className="remove-btn"
          title="Remove this manpower requirement"
        >
          Remove
        </button>
      )}
    </div>
  ))}
  
  <div className="button-container">
    <button
      type="button"
      onClick={addManpowerRow}
      className="add-btn"
    >
      <span>+</span> Add Another
    </button>
  </div>
</div>
            {/* Description */}
            <div className="form-row">
              <div className="form-group" style={{ width: '100%' }}>
                <label htmlFor="description">Request Description</label>
                <textarea
                  id="description"
                  name="description"
                  placeholder="Provide a detailed description of your request"
                  value={formData.description}
                  onChange={handleChange}
                  rows={5}
                  required
                ></textarea>
              </div>
            </div>

            <div className="form-row submit-row">
              <button type="submit" className="submit-button">Add Manpower Request</button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

export default ManpowerReq;
