import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import '../style/pm_style/Pm_ManpowerRequest.css';

const ManpowerReq = () => {
  const navigate = useNavigate();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [project, setProject] = useState(null); // Only one project
  const user = JSON.parse(localStorage.getItem('user')); // or use a useAuth() hook if you make one!
const token = localStorage.getItem('token');

  const [formData, setFormData] = useState({
    acquisitionDate: '',
    duration: '',
    project: '', // Will be set automatically!
    manpowers: [{ type: '', quantity: '' }],
    description: '',
    attachments: []
  });

  // Returns tomorrow's date in yyyy-mm-dd format
  function getTomorrowDateString() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  }

  // Fetch the one project for this Project Manager
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || !user._id) return;

    fetch(`http://localhost:5000/api/projects/assigned/projectmanager/${user._id}`)
      .then(res => res.json())
      .then(data => {
        if (data && data._id) {
          setProject(data);
          setFormData(prev => ({
            ...prev,
            project: data._id // Set the ObjectId!
          }));
        }
      })
      .catch(err => console.error('Error fetching project', err));
  }, []);

  // Dynamic Manpower Handlers
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
      manpowers: [...prev.manpowers, { type: '', quantity: '' }]
    }));
  };

  const removeManpowerRow = (idx) => {
    setFormData(prev => ({
      ...prev,
      manpowers: prev.manpowers.filter((_, i) => i !== idx)
    }));
  };

  // General Field Change Handler
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevState => ({
      ...prevState,
      [name]: value
    }));
  };

  // Attachment Handler (for file uploads)
  const handleAttachmentChange = (e) => {
    setFormData(prev => ({
      ...prev,
      attachments: Array.from(e.target.files)
    }));
  };

  // Profile Menu Logic
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

  // Submit Handler
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Extra: block today/previous acquisitionDate even if user bypasses HTML
    const selectedDate = new Date(formData.acquisitionDate);
    selectedDate.setHours(0, 0, 0, 0);
    const tomorrow = new Date();
    tomorrow.setHours(0, 0, 0, 0);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (selectedDate < tomorrow) {
      alert("Acquisition date must be at least tomorrow.");
      return;
    }

    try {
      const requestFormData = new FormData();
      requestFormData.append('acquisitionDate', formData.acquisitionDate);
      requestFormData.append('duration', formData.duration);
      requestFormData.append('project', formData.project); // ObjectId!
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
          acquisitionDate: '',
          duration: '',
          project: project ? project._id : '',
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
            {/* Acquisition Date & Duration */}
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="acquisitionDate">Target Acquisition Date</label>
                <input
                  type="date"
                  id="acquisitionDate"
                  name="acquisitionDate"
                  value={formData.acquisitionDate}
                  onChange={handleChange}
                  required
                  min={getTomorrowDateString()}
                />
              </div>
              <div className="form-group">
                <label htmlFor="duration">Duration (days)</label>
                <input
                  type="number"
                  id="duration"
                  name="duration"
                  min="1"
                  placeholder="How many days?"
                  value={formData.duration}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            {/* Project Name (read-only) */}
            {project && (
              <div className="form-row">
                <div className="form-group" style={{ width: '100%' }}>
                  <label>Project</label>
                  <input
                    type="text"
                    value={project.projectName}
                    readOnly
                  />
                </div>
              </div>
            )}

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
                <div style={{ width: '80px' }}></div>
              </div>

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
                  <button
                    type="button"
                    onClick={() => {
                      if (formData.manpowers.length > 1) removeManpowerRow(idx);
                    }}
                    className="remove-btn"
                    title={
                      formData.manpowers.length === 1
                        ? "At least one manpower row is required"
                        : "Remove this manpower requirement"
                    }
                    disabled={formData.manpowers.length === 1}
                    style={{
                      opacity: formData.manpowers.length === 1 ? 0.6 : 1,
                      cursor: formData.manpowers.length === 1 ? 'not-allowed' : 'pointer'
                    }}
                  >
                    Remove
                  </button>
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
