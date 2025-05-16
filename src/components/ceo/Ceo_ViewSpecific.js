import React, { useState, useEffect } from 'react';
import "../style/ceo_style/Ceo_ViewSpecific.css";
import { useNavigate } from 'react-router-dom';

const Ceo_ViewSpecific = () => {

  const navigate = useNavigate();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

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
          <a href="#" className="nav-link">Requests</a>
          <a href="#" className="nav-link">Projects</a>
          <a href="#" className="nav-link">Chat</a>
          <a href="#" className="nav-link">Logs</a>
          <a href="#" className="nav-link">Reports</a>
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
      <main className="main">
        <div className="project-detail-container">
          <div className="back-button" onClick={() => navigate('/ceo/proj')} style={{ cursor: 'pointer' }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" 
            viewBox="0 0 24 24" fill="none" stroke="currentColor" 
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5"></path>
            <path d="M12 19l-7-7 7-7"></path>
          </svg>
        </div>

          
          <div className="project-image-container">
            <img 
              src="/api/placeholder/800/400" 
              alt="BGC Hotel" 
              className="project-image"
            />
            <button className="favorite-button">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
            </button>
          </div>
          
          <h1 className="project-title">BGC Hotel</h1>
          
          <div className="project-details-grid">
            <div className="details-column">
              <p className="detail-item"><span className="detail-label">Location:</span> BGC, Taguig City</p>
              
              <div className="detail-group">
                <p className="detail-label">Project Manager:</p>
                <p className="detail-value">Engr. Shaquille Miralles</p>
              </div>
              
              <div className="detail-group">
                <p className="detail-label">Contractor:</p>
                <p className="detail-value">Samuel Masigla</p>
              </div>
              
              <div className="detail-group">
                <p className="detail-label">Target Date:</p>
                <p className="detail-value">January 2028</p>
              </div>
            </div>
            
            <div className="details-column">
              <div className="budget-container">
                <p className="budget-amount">Php 2,300,000</p>
                <p className="budget-label">Estimated Budget</p>
              </div>
              
              <div className="detail-group">
                <p className="detail-label">PICs:</p>
                <p className="detail-value">
                  Ramon Magtaysay<br />
                  Emilio Aguinaldo<br />
                  Apolinario Mabini
                </p>
              </div>
            </div>
          </div>
          
          <div className="manpower-section">
            <p className="detail-label">Manpower:</p>
            <p className="manpower-list">
              Dominick Andrade, Dawn Raphael Mirza, Berlynne Temple, Sedrick Tamason, Paul Jason Cairo, Karloz Ian Sante, Christian Julius Pascua, 
              John Richard Neil, Kenneth Clarence Jule, Lance Kinsaffer Cole, Mariel Dimzon, Sean Carl Matthew Camba, Nomar Semidei, Jan Marc Budlean
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Ceo_ViewSpecific;