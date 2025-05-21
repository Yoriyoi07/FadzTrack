import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import '../style/pic_style/Pic_Dailylogs.css';

const Pic_Dailylogs = () => {
  const navigate = useNavigate();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    attendance: true,
    siteConditions: true,
    workProgress: true,
    monitoring: true,
    wrapUp: true
  });

  const [formData, setFormData] = useState({
    // Attendance & Safety
    siteAttendance: '',
    toolboxMeeting: '',
    
    // Site Conditions
    weatherConditions: '',
    weatherDetails: '',
    
    // Work Progress
    workPerformed: '',
    equipmentUsage: '',
    
    // Monitoring and Issues
    inspectionsScheduled: '',
    issuesEncountered: '',
    
    // Wrap-up and Planning
    executiveSummary: '',
    plannedWork: '',
    attachments: []
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevState => ({
      ...prevState,
      [name]: value
    }));
  };

  const handleFileUpload = (e) => {
    // Store file objects in state
    const files = Array.from(e.target.files);
    setFormData(prevState => ({
      ...prevState,
      attachments: files
    }));
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
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

    try {
      // Create form data object to handle file uploads
      const requestFormData = new FormData();
      
      // Append all form fields to the FormData
      Object.keys(formData).forEach(key => {
        if (key !== 'attachments') {
          requestFormData.append(key, formData[key]);
        }
      });
      
      // Append each file to the form data
      formData.attachments.forEach(file => {
        requestFormData.append('attachments', file);
      });

      const response = await fetch('http://localhost:5000/api/daily-logs', {
        method: 'POST',
        body: requestFormData
        // Note: Don't set Content-Type header when using FormData, 
        // browser will set it automatically with the correct boundary
      });
  
      const result = await response.json();

      if (response.ok) {
        alert('✅ Daily log submitted successfully!');
        // Reset form
        setFormData({
          siteAttendance: '',
          toolboxMeeting: '',
          weatherConditions: '',
          weatherDetails: '',
          workPerformed: '',
          equipmentUsage: '',
          inspectionsScheduled: '',
          issuesEncountered: '',
          executiveSummary: '',
          plannedWork: '',
          attachments: []
        });
      } else {
        alert(`❌ Error: ${result.message || 'Failed to submit daily log'}`);
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
        <div className="form-container daily-logs-container">
          <h2 className="page-title">Daily Logs Report</h2>
          
          <form onSubmit={handleSubmit} className="project-form">
            {/* Attendance & Safety Section */}
            <div className="form-section">
              <div className="section-header" onClick={() => toggleSection('attendance')}>
                <h3>Attendance & Safety</h3>
                <span className={`section-toggle ${expandedSections.attendance ? 'expanded' : ''}`}>
                  {expandedSections.attendance ? '▲' : '▼'}
                </span>
              </div>
              
              {expandedSections.attendance && (
                <div className="section-content">
                  <div className="form-group">
                    <input
                      type="text"
                      id="siteAttendance"
                      name="siteAttendance"
                      placeholder="Enter names of workers that are present on-site"
                      value={formData.siteAttendance}
                      onChange={handleChange}
                    />
                  </div>
                  
                  <div className="form-group">
                    <input
                      type="text"
                      id="toolboxMeeting"
                      name="toolboxMeeting"
                      placeholder="Toolbox meeting notes - conducted before the work begin"
                      value={formData.toolboxMeeting}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              )}
            </div>
            
            {/* Site Conditions Section */}
            <div className="form-section">
              <div className="section-header" onClick={() => toggleSection('siteConditions')}>
                <h3>Site Conditions</h3>
                <span className={`section-toggle ${expandedSections.siteConditions ? 'expanded' : ''}`}>
                  {expandedSections.siteConditions ? '▲' : '▼'}
                </span>
              </div>
              
              {expandedSections.siteConditions && (
                <div className="section-content">
                  <div className="form-group">
                    <select
                      id="weatherConditions"
                      name="weatherConditions"
                      value={formData.weatherConditions}
                      onChange={handleChange}
                    >
                      <option value="">Weather Conditions</option>
                      <option value="sunny">Sunny</option>
                      <option value="cloudy">Cloudy</option>
                      <option value="rainy">Rainy</option>
                      <option value="stormy">Stormy</option>
                      <option value="windy">Windy</option>
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <input
                      type="text"
                      id="weatherDetails"
                      name="weatherDetails"
                      placeholder="Were there any weather-related challenges during the day?"
                      value={formData.weatherDetails}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              )}
            </div>
            
            {/* Work Progress Section */}
            <div className="form-section">
              <div className="section-header" onClick={() => toggleSection('workProgress')}>
                <h3>Work Progress</h3>
                <span className={`section-toggle ${expandedSections.workProgress ? 'expanded' : ''}`}>
                  {expandedSections.workProgress ? '▲' : '▼'}
                </span>
              </div>
              
              {expandedSections.workProgress && (
                <div className="section-content">
                  <div className="form-group">
                    <input
                      type="text"
                      id="workPerformed"
                      name="workPerformed"
                      placeholder="Work Performed Today - Summarize the tasks/completion for today"
                      value={formData.workPerformed}
                      onChange={handleChange}
                    />
                  </div>
                  
                  <div className="form-group">
                    <input
                      type="text"
                      id="equipmentUsage"
                      name="equipmentUsage"
                      placeholder="Equipment Used/Lost - Detail the equipment that were used today"
                      value={formData.equipmentUsage}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              )}
            </div>
            
            {/* Monitoring and Issues Section */}
            <div className="form-section">
              <div className="section-header" onClick={() => toggleSection('monitoring')}>
                <h3>Monitoring and Issues</h3>
                <span className={`section-toggle ${expandedSections.monitoring ? 'expanded' : ''}`}>
                  {expandedSections.monitoring ? '▲' : '▼'}
                </span>
              </div>
              
              {expandedSections.monitoring && (
                <div className="section-content">
                  <div className="form-group">
                    <input
                      type="text"
                      id="inspectionsScheduled"
                      name="inspectionsScheduled"
                      placeholder="Inspections scheduled - Detail inspections carried out on-site"
                      value={formData.inspectionsScheduled}
                      onChange={handleChange}
                    />
                  </div>
                  
                  <div className="form-group">
                    <input
                      type="text"
                      id="issuesEncountered"
                      name="issuesEncountered"
                      placeholder="Issues Encountered - Detail any issues encountered on-site"
                      value={formData.issuesEncountered}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              )}
            </div>
            
            {/* Wrap-up and Planning Section */}
            <div className="form-section">
              <div className="section-header" onClick={() => toggleSection('wrapUp')}>
                <h3>Wrap-up and Planning</h3>
                <span className={`section-toggle ${expandedSections.wrapUp ? 'expanded' : ''}`}>
                  {expandedSections.wrapUp ? '▲' : '▼'}
                </span>
              </div>
              
              {expandedSections.wrapUp && (
                <div className="section-content">
                  <div className="form-group">
                    <input
                      type="text"
                      id="executiveSummary"
                      name="executiveSummary"
                      placeholder="Executive Summary/Order - Briefly instructional order for on-site supervisor/manager"
                      value={formData.executiveSummary}
                      onChange={handleChange}
                    />
                  </div>
                  
                  <div className="form-group">
                    <input
                      type="text"
                      id="plannedWork"
                      name="plannedWork"
                      placeholder="Planned work for the next day - What will be worked on the following day"
                      value={formData.plannedWork}
                      onChange={handleChange}
                    />
                  </div>
                  
                  <div className="form-group">
                    <div className="file-upload-container">
                      <label>Upload the Photos, Documentation &gt;&gt; Click and see Reports here</label>
                      <div className="upload-container">
                        <button 
                          type="button" 
                          onClick={() => document.getElementById('fileInput').click()}
                          className="upload-button"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '5px' }}>
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="17 8 12 3 7 8"></polyline>
                            <line x1="12" y1="3" x2="12" y2="15"></line>
                          </svg>
                          Upload
                        </button>
                        <input
                          type="file"
                          id="fileInput"
                          multiple
                          onChange={handleFileUpload}
                          style={{ display: 'none' }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="form-row submit-row">
              <button type="submit" className="submit-button">Submit Daily Logs</button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

export default Pic_Dailylogs;