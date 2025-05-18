import React, { useState } from 'react';
import '../style/pm_style/Pm_IncidentReport.css';
import { Link } from 'react-router-dom';

const PmIncidentReport = () => {
  const [incidentTitle, setIncidentTitle] = useState('');
  const [peopleInvolved, setPeopleInvolved] = useState('');
  const [incidentDescription, setIncidentDescription] = useState('');
  const [category, setCategory] = useState('Workplace Incident Report');

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Create report object with form data
    const report = {
      title: incidentTitle,
      peopleInvolved,
      description: incidentDescription,
      category
    };
    
    // You can add API call here to submit the report
    console.log('Submitting report:', report);
    
    // Reset form after submission
    setIncidentTitle('');
    setPeopleInvolved('');
    setIncidentDescription('');
    setCategory('Workplace Incident Report');
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
            <li><Link to="/pm-dash">Home</Link></li>
            <li><Link to="/cprojects">View Projects</Link></li>
            <li><Link to="/crecords">View Records</Link></li>
            <li><Link to="/cchat">Chat</Link></li>
          </ul>
        </nav>
        <div className="search-container">
          <input type="text" placeholder="Search in site" className="search-input" />
          <button className="search-btn">🔍</button>
        </div>
      </header>

      <div className="incident-report-container">
        <div className="incident-report-left">
          <h1>Incident Report</h1>
          <p>Report an incident on-site</p>
        </div>
        
        <div className="incident-report-right">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Incident Title</label>
              <input 
                type="text" 
                value={incidentTitle}
                onChange={(e) => setIncidentTitle(e.target.value)}
                placeholder="Enter Incident Title"
                required
              />
              <p className="field-hint">Provide a brief title for the incident report</p>
            </div>
            
            <div className="form-group">
              <label>People Involved</label>
              <input 
                type="text" 
                value={peopleInvolved}
                onChange={(e) => setPeopleInvolved(e.target.value)}
                placeholder="Enter names of individuals involved"
              />
              <p className="field-hint">List the names of all individuals involved in the incident</p>
            </div>
            
            <div className="form-group">
              <label>Incident Description</label>
              <textarea 
                value={incidentDescription}
                onChange={(e) => setIncidentDescription(e.target.value)}
                placeholder="Describe what happened"
                required
                rows={6}
              />
              <p className="field-hint">Provide a detailed account of the incident</p>
            </div>
            
            <div className="form-group">
              <label>Category</label>
              <div className="category-options">
                <label className={`category-option ${category === 'Workplace Incident Report' ? 'selected' : ''}`}>
                  <input 
                    type="radio" 
                    name="category" 
                    value="Workplace Incident Report"
                    checked={category === 'Workplace Incident Report'}
                    onChange={(e) => setCategory(e.target.value)}
                  />
                  Workplace Incident Report
                </label>
                
                <label className={`category-option ${category === 'Safety Violation Report' ? 'selected' : ''}`}>
                  <input 
                    type="radio" 
                    name="category" 
                    value="Safety Violation Report"
                    checked={category === 'Safety Violation Report'}
                    onChange={(e) => setCategory(e.target.value)}
                  />
                  Safety Violation Report
                </label>
                
                <label className={`category-option ${category === 'Property Damage Report' ? 'selected' : ''}`}>
                  <input 
                    type="radio" 
                    name="category" 
                    value="Property Damage Report"
                    checked={category === 'Property Damage Report'}
                    onChange={(e) => setCategory(e.target.value)}
                  />
                  Property Damage Report
                </label>
              </div>
              <p className="field-hint">Select the appropriate category for this incident report</p>
            </div>
            
            <button type="submit" className="submit-button">Submit Report</button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default PmIncidentReport;