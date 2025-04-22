import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import '../style/pm_style/Pm_DailyReports.css'; 

const PmDailyReports = () => {
  const [reportData, setReportData] = useState({
    title: '',
    description: '',
    attachments: [],
    absences: []
  });

  const [selectedAbsences, setSelectedAbsences] = useState([]);

  // Team members that could be absent
  const teamMembers = [
    { id: 1, name: 'Kyle Dyogi' },
    { id: 2, name: 'Carlo Villamin' },
    { id: 3, name: 'Lorenz Laddaran' },
    { id: 4, name: 'John Lloyd Hita' },
    { id: 5, name: 'Kelvy Dori' }
  ];

  const handleTitleChange = (e) => {
    setReportData({ ...reportData, title: e.target.value });
  };

  const handleDescriptionChange = (e) => {
    setReportData({ ...reportData, description: e.target.value });
  };

  const handleFileChange = (e) => {
    // Handle file uploads
    const files = Array.from(e.target.files);
    setReportData({ ...reportData, attachments: [...reportData.attachments, ...files] });
  };

  const toggleAbsence = (id) => {
    if (selectedAbsences.includes(id)) {
      setSelectedAbsences(selectedAbsences.filter(absenceId => absenceId !== id));
    } else {
      setSelectedAbsences([...selectedAbsences, id]);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Create final report data
    const finalReport = {
      ...reportData,
      absences: selectedAbsences.map(id => {
        const member = teamMembers.find(m => m.id === id);
        return member ? member.name : '';
      })
    };
    
    // Submit data to API
    console.log('Submitting report:', finalReport);
    
    // For demonstration, we're just logging the data
    alert('Report submitted successfully!');
  };

  return (
    <div className="container">
      <header className="main-header">
        <div className="logo">
          <img src="/images/FadzLogo 1.png" alt="FadzTrack Logo" className="logo-img" />
          <h1>FadzTrack</h1>
        </div>
        <nav>
          <ul className="nav-links">
            <li><Link to="/c">Home</Link></li>
            <li><Link to="/chats">Chats</Link></li>
            <li><Link to="/j">View Projects</Link></li>
            <li><Link to="/q">View Reports</Link></li>
            <li><Link to="/d">View Requests</Link></li>
          </ul>
        </nav>
      </header>

      <div className="main-content">
        <div className="report-title">
          <h2>Daily Progress Report</h2>
          <p>Submit your daily progress update</p>
        </div>

        <form className="report-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="reportTitle">Report Title</label>
            <input
              type="text"
              id="reportTitle"
              value={reportData.title}
              onChange={handleTitleChange}
              placeholder="Enter Report Title"
              className="form-control"
            />
            <small className="form-text">Provide a brief title for your daily report</small>
          </div>

          <div className="form-group">
            <label htmlFor="imageAttachments">Image Attachments</label>
            <div className="file-upload">
              <input
                type="file"
                id="imageAttachments"
                multiple
                onChange={handleFileChange}
                className="form-control-file"
              />
            </div>
            <small className="form-text">Upload images related to your progress</small>
            <small className="form-text">Attach visual updates of your daily progress</small>
          </div>

          <div className="form-group">
            <label htmlFor="reportDescription">Report Description</label>
            <textarea
              id="reportDescription"
              value={reportData.description}
              onChange={handleDescriptionChange}
              placeholder="Write a detailed description of your progress"
              className="form-control"
              rows="4"
            ></textarea>
            <small className="form-text">Share specific details and achievements of the day</small>
          </div>

          <div className="form-group">
            <label>Absences</label>
            <div className="absence-tags">
              {teamMembers.map(member => (
                <div 
                  key={member.id} 
                  className={`absence-tag ${selectedAbsences.includes(member.id) ? 'selected' : ''}`}
                  onClick={() => toggleAbsence(member.id)}
                >
                  {member.name}
                </div>
              ))}
            </div>
            <small className="form-text">Select the names of absent team members</small>
          </div>

          <button type="submit" className="submit-button">Submit Report</button>
        </form>
      </div>
    </div>
  );
};

export default PmDailyReports;