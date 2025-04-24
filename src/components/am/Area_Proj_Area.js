import { useState } from 'react';
import { MapPin, FileText } from 'lucide-react';
import "../style/am_style/Area_Proj.css";

export default function AreasPage() {
  const [selectedArea, setSelectedArea] = useState('Batangas');
  
  const projects = {
    Batangas: [
      { id: 1, name: 'Project A', manager: 'John Doe', startDate: '05/10/2022' },
      { id: 2, name: 'Project B', manager: 'Jane Smith', startDate: '06/01/2022' },
      { id: 3, name: 'Project X', manager: 'Alice Johnson', startDate: '05/15/2022' },
      { id: 4, name: 'Project Y', manager: 'Bob Brown', startDate: '05/28/2022' }
    ],
    Makati: [
      { id: 5, name: 'Project C', manager: 'Mike Wilson', startDate: '04/12/2022' },
      { id: 6, name: 'Project D', manager: 'Sarah Lee', startDate: '03/22/2022' }
    ]
  };

  return (
    <div className="app">
      {/* Navigation Bar */}
      <header className="header">
        <div className="header-container">
          <div className="logo-container">
            <div className="logo">
              <div className="logo-circle"></div>
              <div className="logo-base"></div>
            </div>
            <span className="brand">FadzTrack</span>
          </div>
          <nav className="nav">
            <a href="#" className="nav-link">Home</a>
            <a href="#" className="nav-link">Chats</a>
            <a href="#" className="nav-link">View Projects</a>
            <a href="#" className="nav-link">View Reports</a>
            <a href="#" className="nav-link">View Requests</a>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="main">
        <h2 className="section-title">Areas</h2>
        
        {/* Area Selection Buttons */}
        <div className="area-buttons">
          <button 
            className={`area-button ${selectedArea === 'Batangas' ? 'selected' : ''}`}
            onClick={() => setSelectedArea('Batangas')}
          >
            <div className="icon-container">
              <MapPin size={24} color="red" />
            </div>
            <span>Batangas</span>
          </button>
          
          <button 
            className={`area-button ${selectedArea === 'Makati' ? 'selected' : ''}`}
            onClick={() => setSelectedArea('Makati')}
          >
            <div className="icon-container">
              <MapPin size={24} color="red" />
            </div>
            <span>Makati</span>
          </button>
        </div>
        
        {/* Projects Section */}
        <h2 className="projects-title">Projects in {selectedArea}</h2>
        
        <div className="project-list">
          {projects[selectedArea].map(project => (
            <div key={project.id} className="project-card">
              <div className="project-info">
                <div className="project-icon">
                  <FileText size={24} />
                </div>
                <div className="project-details">
                  <h3 className="project-name">{project.name}</h3>
                  <p className="project-manager">Project Manager: {project.manager}</p>
                </div>
              </div>
              <div className="date-container">
                <p className="date-label">Started on:</p>
                <p className="date-value">{project.startDate}</p>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}