import { useState } from 'react';
import '../style/am_style/Area_Addproj.css';

export default function AddProject() {
    const [formData, setFormData] = useState({
      projectName: '',
      contractor: '',
      area: '',
      location: '',
      employees: ''
    });
  
    const handleChange = (e) => {
      const { name, value } = e.target;
      setFormData(prevState => ({
        ...prevState,
        [name]: value
      }));
    };
  
    const handleSubmit = (e) => {
      e.preventDefault();
      // In a real app, you would send this data to your backend
      console.log("Form submitted:", formData);
      
      // Clear form after submission (optional)
      setFormData({
        projectName: '',
        contractor: '',
        area: '',
        location: '',
        employees: ''
      });
    };
  
    return (
      <div className="app-container">
        {/* Header with Navigation */}
        <header className="header">
          <div className="logo-section">
            <div className="logo">
              <div className="logo-building"></div>
              <div className="logo-flag"></div>
            </div>
            <h1 className="brand-name">FadzTrack</h1>
          </div>
          <nav className="nav-menu">
            <a href="#" className="nav-link">Home</a>
            <a href="#" className="nav-link">Chats</a>
            <a href="#" className="nav-link">View Projects</a>
            <a href="#" className="nav-link">View Reports</a>
            <a href="#" className="nav-link">View Requests</a>
          </nav>
        </header>
  
        {/* Main Content */}
        <main className="main-content">
          {/* Left Column - Title and Instructions */}
          <div className="title-container">
            <h2 className="page-title">Add New Project</h2>
            <p className="form-instruction">Please fill in the details below:</p>
          </div>
          
          {/* Right Column - Form */}
          <div className="form-container">
            <form onSubmit={handleSubmit} className="project-form">
              <div className="form-group">
                <label htmlFor="projectName">Project Name</label>
                <input
                  type="text"
                  id="projectName"
                  name="projectName"
                  placeholder="Enter Project Name"
                  value={formData.projectName}
                  onChange={handleChange}
                  required
                />
                <p className="input-helper">Enter the name of the project where the employee is assigned.</p>
              </div>
  
              <div className="form-group">
                <label htmlFor="contractor">Contractor</label>
                <input
                  type="text"
                  id="contractor"
                  name="contractor"
                  placeholder="Enter Contractor Name"
                  value={formData.contractor}
                  onChange={handleChange}
                  required
                />
                <p className="input-helper">Enter the name of the contractor employing the employee.</p>
              </div>
  
              <div className="form-group">
                <label htmlFor="area">Area</label>
                <input
                  type="text"
                  id="area"
                  name="area"
                  placeholder="Enter Area"
                  value={formData.area}
                  onChange={handleChange}
                  required
                />
                <p className="input-helper">Specify the area where the employee is working.</p>
              </div>
  
              <div className="form-group">
                <label htmlFor="location">Maps</label>
                <input
                  type="text"
                  id="location"
                  name="location"
                  placeholder="Enter Location"
                  value={formData.location}
                  onChange={handleChange}
                />
                <p className="input-helper">Select the location on the map where the employee is assigned.</p>
              </div>
  
              <div className="form-group">
                <label htmlFor="employees">Employees List</label>
                <textarea
                  id="employees"
                  name="employees"
                  rows="4"
                  placeholder="Enter employee details"
                  value={formData.employees}
                  onChange={handleChange}
                ></textarea>
                <p className="input-helper">Please provide details of employees working on the project.</p>
              </div>
  
              <div className="form-group">
                <button type="submit" className="submit-button">Submit</button>
              </div>
            </form>
          </div>
        </main>
      </div>
    );
  }