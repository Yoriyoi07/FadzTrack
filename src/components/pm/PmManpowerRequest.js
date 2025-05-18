import React, { useState } from 'react';
import '../style/pm_style/Pm_ManpowerRequest.css';
import { Link } from 'react-router-dom';

const PmManpowerRequest = () => {
  const [requestTitle, setRequestTitle] = useState('');
  const [manpowerType, setManpowerType] = useState('Administrative');
  const [reason, setReason] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Create request object
    const requestData = {
      title: requestTitle,
      type: manpowerType,
      reason: reason,
      date: new Date().toISOString()
    };
    
    console.log('Submitting request:', requestData);
    
    // Reset form after submission
    setRequestTitle('');
    setManpowerType('Administrative');
    setReason('');
    
    alert('Manpower request submitted successfully!');
  };

  return (
    <div className="container">
      <header className="ceo-header">
        <div className="logo">
          <img src="/images/FadzLogo 1.png" alt="FadzTrack Logo" className="logo-img" />
          <h1>FadzTrack</h1>
        </div>
        <nav>
          <ul>
            <li><Link to="/">Home</Link></li>
            <li><Link to="/chats">Chats</Link></li>
            <li><Link to="/view-projects">View Projects</Link></li>
            <li><Link to="/view-reports">View Reports</Link></li>
            <li><Link to="/view-requests">View Requests</Link></li>
          </ul>
        </nav>
      </header>

      <div className="manpower-request-container">
        <div className="manpower-request-left">
          <h1>Manpower Request</h1>
          <p>Submit a request for additional manpower</p>
        </div>
        
        <div className="manpower-request-right">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Request Title</label>
              <input 
                type="text" 
                value={requestTitle}
                onChange={(e) => setRequestTitle(e.target.value)}
                placeholder="Enter Request Title"
                required
              />
              <p className="field-hint">Select the category of manpower needed</p>
            </div>
            
            <div className="form-group">
              <label>Type of Manpower Needed</label>
              <div className="category-options">
                <label className={`category-option ${manpowerType === 'Administrative' ? 'selected' : ''}`}>
                  <input 
                    type="radio" 
                    name="manpowerType" 
                    value="Administrative"
                    checked={manpowerType === 'Administrative'}
                    onChange={(e) => setManpowerType(e.target.value)}
                  />
                  Administrative
                </label>
                
                <label className={`category-option ${manpowerType === 'Technical' ? 'selected' : ''}`}>
                  <input 
                    type="radio" 
                    name="manpowerType" 
                    value="Technical"
                    checked={manpowerType === 'Technical'}
                    onChange={(e) => setManpowerType(e.target.value)}
                  />
                  Technical
                </label>
                
                <label className={`category-option ${manpowerType === 'Operational' ? 'selected' : ''}`}>
                  <input 
                    type="radio" 
                    name="manpowerType" 
                    value="Operational"
                    checked={manpowerType === 'Operational'}
                    onChange={(e) => setManpowerType(e.target.value)}
                  />
                  Operational
                </label>
              </div>
              <p className="field-hint">Select the category of manpower needed</p>
            </div>
            
            <div className="form-group">
              <label>Reason for Request</label>
              <textarea 
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Enter reason for request"
                required
                rows={6}
              />
            </div>
            
            <button type="submit" className="submit-button">Submit Request</button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default PmManpowerRequest;