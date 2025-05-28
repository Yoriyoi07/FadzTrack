import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import '../style/am_style/Area_Manpower_ReqDetails.css';

export default function Area_Manpower_ReqDetails() {
    const navigate = useNavigate();
    const [profileMenuOpen, setProfileMenuOpen] = useState(false);
    const stored = localStorage.getItem('user');
    const user = stored ? JSON.parse(stored) : null;
    const userId = user?._id;
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
        <div className="fadztrack-app">
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
                <Link to="/am/dash" className="nav-link">Dashboard</Link>
                <Link to="/requests" className="nav-link">Requests</Link>
                <Link to="/am/proj" className="nav-link">Projects</Link>
                <Link to="/chat" className="nav-link">Chat</Link>
                <Link to="/logs" className="nav-link">Logs</Link>
                <Link to="/reports" className="nav-link">Reports</Link>
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
                    {user?.name?.charAt(0).toUpperCase() || 'U'}
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
        <div className="fadztrack-main">
            <div className="fadztrack-card">
            {/* Header */}
            <div className="fadztrack-header-section">
                <h1 className="fadztrack-title">Manpower Req. 223</h1>
                <p className="fadztrack-subtitle">Batangas | Batangas Townhomes | Engr. Daryll Miralles</p>
            </div>

            {/* Form */}
            <div className="fadztrack-form">
                {/* Date and Duration */}
                <div className="fadztrack-form-row">
                <div className="fadztrack-form-group">
                    <label className="fadztrack-label">
                    Target Acquisition Date:
                    </label>
                    <input
                    type="text"
                    className="fadztrack-input"
                    />
                </div>
                <div className="fadztrack-form-group">
                    <label className="fadztrack-label">
                    Duration
                    </label>
                    <input
                    type="text"
                    className="fadztrack-input"
                    />
                </div>
                </div>

                {/* Request Summary */}
                <div className="fadztrack-summary-section">
                <label className="fadztrack-summary-label">
                    Request Summary
                </label>
                <div className="fadztrack-summary-box">
                    <div className="fadztrack-summary-list">
                    <div className="fadztrack-summary-item">2 Mason</div>
                    <div className="fadztrack-summary-item">3 Painter</div>
                    <div className="fadztrack-summary-item">2 Electrician</div>
                    </div>
                </div>
                </div>

                {/* Dropdowns */}
                <div className="fadztrack-form-row">
                <div className="fadztrack-form-group">
                    <label className="fadztrack-label">
                    Select Area
                    </label>
                    <select className="fadztrack-select">
                    <option>Dropdown ng Area na Sakop ni AM</option>
                    </select>
                </div>
                <div className="fadztrack-form-group">
                    <label className="fadztrack-label">
                    Select Project
                    </label>
                    <select className="fadztrack-select">
                    <option>Dropdown ng Projects within that area</option>
                    </select>
                </div>
                </div>

                <div className="fadztrack-form-row">
                <div className="fadztrack-form-group">
                    <label className="fadztrack-label">
                    Select Manpower
                    </label>
                    <select className="fadztrack-select">
                    <option>Dropdown ng Manpower na nasa project</option>
                    </select>
                </div>
                <div className="fadztrack-form-group">
                    <label className="fadztrack-label">
                    Manpower to lend:
                    </label>
                    <select className="fadztrack-select">
                    <option>Mga Selected</option>
                    </select>
                </div>
                </div>

                {/* Buttons */}
                <div className="fadztrack-buttons">
                <button className="fadztrack-button">
                    Back
                </button>
                <button className="fadztrack-button">
                    Provide Manpower
                </button>
                </div>
            </div>
            </div>
        </div>
        </div>
    );
    }