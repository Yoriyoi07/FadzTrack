import { useState } from 'react';
import { Link } from 'react-router-dom';
import '../style/am_style/Area_Proj.css';

export default function AreasPage() {
    const [selectedArea, setSelectedArea] = useState('Makati');
    
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
        {/* Header */}
        <header className="header">
          <div className="logo-container">
            <div className="logo">
              <div className="logo-building">
                <div className="logo-top"></div>
              </div>
            </div>
            <h1 className="app-title">FadzTrack</h1>
          </div>
          
          <nav className="navigation">
            <ul>
              <li><Link to="/am" className="nav-link">Home</Link></li>
              <li><Link to="/chat" className="nav-link">Chats</Link></li>
              <li><Link to="/viewproj" className="nav-link">View Projects</Link></li>
              <li><Link to="/q" className="nav-link">View Reports</Link></li>
              <li><Link to="/viewall" className="nav-link">View Requests</Link></li>
            </ul>
          </nav>
          
          <div className="search-container">
            <input type="text" placeholder="Search in site" className="search-input" />
            <button className="search-button">
              <span className="search-icon">🔍</span>
            </button>
          </div>
        </header>
  
        {/* Main Content */}
        <main className="main">
          <div className="area-section">
            <h2 className="section-title">Areas</h2>
            <div className="area-buttons">
              <button 
                className={`area-button ${selectedArea === 'Batangas' ? 'selected' : ''}`}
                onClick={() => setSelectedArea('Batangas')}
              >
                <span>Batangas</span>
              </button>
              
              <button 
                className={`area-button ${selectedArea === 'Makati' ? 'selected' : ''}`}
                onClick={() => setSelectedArea('Makati')}
              >
                <span>Makati</span>
              </button>
            </div>
          </div>
          
          {/* Projects Section */}
          <div className="projects-section">
            <h2 className="projects-title">Projects in {selectedArea}</h2>
            
            <div className="project-cards">
              {projects[selectedArea].map(project => (
                <div key={project.id} className="project-card">
                  <div className="project-info">
                    <div className="project-name">
                      Project {project.name[project.name.length - 1]}
                    </div>
                    <div className="project-manager">
                      Project Manager: {project.manager}
                    </div>
                  </div>
                  <div className="project-date">
                    <div className="date-label">Started on:</div>
                    <div className="date-value">{project.startDate}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    );
}