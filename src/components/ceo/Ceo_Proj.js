import React, { useState } from "react";
import { Link } from "react-router-dom";
import "../style/ceo_style/Ceo_Dash.css";

const ViewProjects = () => {
  const [selectedArea, setSelectedArea] = useState("Batangas");

  const projects = {
    Batangas: [
      { name: "Project A", manager: "John Doe", startDate: "05/10/2022" },
      { name: "Project B", manager: "Jane Smith", startDate: "06/01/2022" },
      { name: "Project X", manager: "Alice Johnson", startDate: "05/15/2022" },
      { name: "Project Y", manager: "Bob Brown", startDate: "05/28/2022" },
    ],
    Makati: [
      { name: "Project M1", manager: "Mark Spencer", startDate: "07/12/2022" },
      { name: "Project M2", manager: "Lisa Ray", startDate: "08/03/2022" },
      { name: "Project M3", manager: "Chris Evans", startDate: "09/25/2022" },
    ],
  };

  return (
    <div className="ceo-dashboard">
      <header className="ceo-header">
        <div className="logo">
          <img src="/images/FadzLogo 1.png" alt="FadzTrack Logo" className="logo-img" />
          <h1>FadzTrack</h1>
        </div>
        <nav>
          <ul>
            <li><Link to="/cdash">Home</Link></li>
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

      <div className="view-projects-container">
        <h2>Areas</h2>
        <div className="areas">
          <button 
            className={selectedArea === "Batangas" ? "area-button selected" : "area-button"} 
            onClick={() => setSelectedArea("Batangas")}
          >
            Batangas
          </button>
          <button 
            className={selectedArea === "Makati" ? "area-button selected" : "area-button"} 
            onClick={() => setSelectedArea("Makati")}
          >
            Makati
          </button>
        </div>

        <h2>Projects in {selectedArea}</h2>
        <div className="projects-list">
          {projects[selectedArea].map((project, index) => (
            <div key={index} className="project-card">
              <div className="project-icon"></div>
              <div className="project-details">
                <h3>{project.name}</h3>
                <p>Project Manager: {project.manager}</p>
                <p><strong>Started on:</strong> {project.startDate}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ViewProjects;
