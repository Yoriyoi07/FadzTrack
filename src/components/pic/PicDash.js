import React from "react";
import { Link } from 'react-router-dom';
import "../style/pic_style/Pic_Dash.css";

const Header = () => {
  return (
    <header className="header">
      <div className="logo">
        <img src="/images/FadzLogo 1.png" alt="FadzTrack Logo" className="logo-img" />
        <h1>FadzTrack</h1>
      </div>
      <nav>
        <ul>
          <li><Link to="/h">Home</Link></li>
          <li><Link to="/chat">Chat</Link></li>
          <li><Link to="/material-request">Request for Materials</Link></li>
        </ul>
      </nav>
      <div className="search-container">
        <input type="text" placeholder="Search in site" className="search-input" />
        <button className="search-btn">🔍</button>
      </div>
    </header>
  );
};

const PicDash = () => {
  const materialRequests = [
    { id: 1, status: "Pending", date: "08/20/2022", color: "pending" },
    { id: 2, status: "Approved", date: "08/18/2022", color: "approved" },
    { id: 3, status: "Denied", date: "08/15/2022", color: "denied" },
    { id: 4, status: "Pending", date: "08/22/2022", color: "pending" },
  ];

  return (
    <>
      <Header />
      <div className="dashboard">

        {/* Report Section */}
        <div className="report-section">
          <div className="report-card adjusted">
            <div className="report-image-placeholder"></div>
            <div className="report-content">
              <h2>Today's Report</h2>
              <p>Short summary of daily construction project report</p>
            </div>
            <button className="view-details">View Details</button>
          </div>
        </div>

        {/* Material Requests Section */}
        <div className="material-section">
          <h2>Material Requests</h2>
          <div className="materials-grid">
            {materialRequests.map((request) => (
              <div key={request.id} className={`material-card ${request.color}`}>
                <div className="material-image-placeholder"></div>
                <h3>Material Request {request.id}</h3>
                <p>Requested on {request.date}</p>
                <p className={`status ${request.color}`}>Status: {request.status}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Messages Section */}
        <div className="messages-section">
          <h2>Messages</h2>
          <p>Summary of recent messages</p>
          <button className="view-all">View All Messages</button>
          <div className="messages-grid">
            {[{ id: 1, author: "John Doe", text: "Nullam vel sagittis orci. Cras a efficitur odio.", imgSrc: "/path-to-image1.png" },
            { id: 2, author: "Jane Smith", text: "Vestibulum ultricies nisl non maximus.", imgSrc: "/path-to-image2.png" }
            ].map((message) => (
              <div key={message.id} className="message-card">
                <img src={message.imgSrc} alt={`Message from ${message.author}`} className="message-image" />
                <h3>Message {message.id}</h3>
                <p>{message.text}</p>
                <p className="author">🧑 {message.author}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default PicDash;
