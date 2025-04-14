import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import '../style/pm_style/Pm_ViewProjects.css';
import { FiMoreHorizontal } from 'react-icons/fi';
import { Link } from 'react-router-dom';
// Fix for Leaflet default icon
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

// Fix the Leaflet icon issue - this needs to be outside component
const DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

const PmViewProjects = () => {
    const [projectData, setProjectData] = useState({
        name: 'Project ABC',
        description: 'A large-scale construction project in downtown area',
        company: 'Bris & Projects',
        location: [13.7565, 121.0583], // Batangas coordinates
    });

    const [projectTeam, setProjectTeam] = useState([
        { id: 1, name: 'John Doe', role: 'Project Manager', avatar: null },
        { id: 2, name: 'Jane Smith', role: 'Architect', avatar: null },
        { id: 3, name: 'Mike Johnson', role: 'Contractor', avatar: null },
        { id: 4, name: 'Sarah Brown', role: 'Area Manager', avatar: null },
        { id: 5, name: 'Adam White', role: 'Laborer', avatar: null },
        { id: 6, name: 'Emily Green', role: 'Painter', avatar: null },
        { id: 7, name: 'Alex Black', role: 'Mason', avatar: null },
    ]);

    const [manpowerList, setManpowerList] = useState([
        { id: 1, name: 'Vito Camy' },
        { id: 2, name: 'Carlos Williams' },
        { id: 3, name: 'Loreeta Labanda' },
        { id: 4, name: 'John Lapid Doe' },
        { id: 5, name: 'Kuby Dilag' },
        { id: 6, name: 'Julius Lagad' },
        { id: 7, name: 'Edward Santos' },
        { id: 8, name: 'Anthony Joseph' },
        { id: 9, name: 'Vincent Garcia' },
        { id: 10, name: 'Theodore Rosa' },
        { id: 11, name: 'Joku Slanensy' },
        { id: 12, name: 'Nadine Bernardo' },
        { id: 13, name: 'Neal Pasqualino' },
        { id: 14, name: 'Efreen Bernardez' },
        { id: 15, name: 'Harlin Briggs' },
        { id: 16, name: 'Frachie Edmundo' },
        { id: 17, name: 'Manual Tsoukon' },
    ]);

    // Use useEffect to handle map initialization if needed
    useEffect(() => {
        // This is where you would fetch data from API
        // fetchProjectData();
        // fetchProjectTeam();
        // fetchManpowerList();
    }, []);

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

            <div className="project-view-container">
                {/* Project Overview */}
                <div className="project-overview">
                    <div className="overview-content">
                        <div className="overview-image-container">
                            <img
                                src="../../assets/images/login_picture.png"
                                alt="Project Building"
                                className="overview-image"
                            />
                        </div>
                        <div className="overview-details">
                            <h2 className="section-title">Project Overview</h2>
                            <p className="overview-description">Detailed information about the current project</p>
                        </div>
                    </div>
                </div>

                {/* Project Team */}
                <div className="project-team">
                    <h2 className="section-title centered">Project Team</h2>
                    <div className="team-members">
                        {projectTeam.map((member) => (
                            <div key={member.id} className="team-member">
                                <div className="avatar-container">
                                    <div className="avatar">
                                        {member.avatar ? (
                                            <img src={member.avatar} alt={member.name} className="avatar-image" />
                                        ) : (
                                            <span className="avatar-placeholder">{member.name.charAt(0)}</span>
                                        )}
                                    </div>
                                    <button className="avatar-menu">
                                        <FiMoreHorizontal className="menu-icon" />
                                    </button>
                                </div>
                                <div className="member-details">
                                    <p className="member-name">{member.name}</p>
                                    <p className="member-role">{member.role}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Project Details */}
                <div className="project-details">
                    <div className="project-icon"></div>
                    <div className="project-info">
                        <h3 className="project-title">{projectData.name}</h3>
                        <p className="project-subtitle">{projectData.company}</p>
                        <p className="project-description">{projectData.description}</p>
                    </div>
                </div>

                {/* Map */}
                <div className="map-container">
                    <div className="map">
                        {/* Ensure map has explicit height and width */}
                        <div style={{ height: '100%', width: '100%', position: 'relative' }}>
                            <MapContainer 
                                center={projectData.location} 
                                zoom={10} 
                                style={{ height: '100%', width: '100%' }}
                                className="leaflet-map"
                            >
                                <TileLayer
                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                />
                                <Marker position={projectData.location}>
                                    <Popup>
                                        Location of {projectData.name}
                                    </Popup>
                                </Marker>
                            </MapContainer>
                        </div>
                        <div className="map-label">
                            <span>Location of Project</span>
                        </div>
                    </div>
                </div>

                {/* Manpower/Labor */}
                <div className="manpower">
                    <h2 className="section-title centered">Manpower/Labor</h2>
                    <div className="manpower-grid">
                        {manpowerList.map((worker) => (
                            <div key={worker.id} className="worker">{worker.name}</div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PmViewProjects;