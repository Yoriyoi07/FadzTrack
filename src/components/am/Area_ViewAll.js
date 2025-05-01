import React from 'react';
import '../style/am_style/Area_ViewAll.css';

function Area_ViewAll() {
  // Mock data for workforce requests
  const workforceRequests = [
    {
      title: "Request for 3 Laborers",
      project: "Project: Building A",
      manager: "John Doe",
      date: "09/15/2022"
    },
    {
      title: "Request for 2 Painters",
      project: "Project: Infrastructure Project B",
      manager: "Jane Smith",
      date: "09/20/2022"
    },
    {
      title: "Request for 1 Mason",
      project: "Project: Residential Development C",
      manager: "Emily Brown",
      date: "09/25/2022"
    }
  ];

  // Mock data for material requests
  const materialRequests = [
    {
      title: "Request for Cement",
      project: "Project: Building A",
      manager: "John Doe",
      date: "09/15/2022"
    },
    {
      title: "Request for Steel Bars",
      project: "Project: Infrastructure Project B",
      manager: "Jane Smith",
      date: "09/20/2022"
    },
    {
      title: "Request for Bricks",
      project: "Project: Residential Development C",
      manager: "Emily Brown",
      date: "09/25/2022"
    }
  ];

  // Workforce request card component
  const WorkforceRequestCard = ({ request }) => (
    <div className="request-card">
      <div className="request-icon-container workforce-icon">
        {/* Simple circle div instead of SVG */}
      </div>
      <div className="request-info">
        <h3>{request.title}</h3>
        <p>{request.project}</p>
      </div>
      <div className="request-manager">
        <h4>Project Manager:</h4>
        <p>{request.manager}, Requested on: {request.date}</p>
      </div>
    </div>
  );

  // Material request card component
  const MaterialRequestCard = ({ request }) => (
    <div className="request-card">
      <div className="request-icon-container material-icon">
        {/* Simple square div instead of SVG */}
      </div>
      <div className="request-info">
        <h3>{request.title}</h3>
        <p>{request.project}</p>
      </div>
      <div className="request-manager">
        <h4>Project Manager:</h4>
        <p>{request.manager}, Requested on: {request.date}</p>
      </div>
    </div>
  );

  return (
    <div className="view-all-container">
      {/* Updated header to match the image */}
      <header className="fadztrack-header">
        <div className="logo-section">
          <div className="logo"></div>
          <h1>FadzTrack</h1>
        </div>
        <nav className="main-nav">
          <a href="#home">Home</a>
          <a href="#chats">Chats</a>
          <a href="#projects">View Projects</a>
          <a href="#reports">View Reports</a>
          <a href="#requests">View Requests</a>
        </nav>
      </header>

      <div className="request-board">
        <div className="request-sections">
          {/* Workforce Requests Section */}
          <div className="request-section">
            <h2>Workforce Requests</h2>
            <div className="request-cards">
              {workforceRequests.map((request, index) => (
                <WorkforceRequestCard key={index} request={request} />
              ))}
            </div>
          </div>

          {/* Material Requests Section */}
          <div className="request-section">
            <h2>Material Requests</h2>
            <div className="request-cards">
              {materialRequests.map((request, index) => (
                <MaterialRequestCard key={index} request={request} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Area_ViewAll;