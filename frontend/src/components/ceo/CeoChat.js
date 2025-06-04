import React from 'react';
import { Link } from 'react-router-dom';
import { FaPaperclip, FaPaperPlane, FaWindowMaximize, FaEllipsisH } from 'react-icons/fa';
import '../style/pic_style/Ceo_Chat.css';

const PicChat = () => {
  const messages = [
    { name: 'BOSS', message: 'Hi team, any updates on the concrete delivery schedule today?' },
    { name: 'Project 1', message: 'Hi team, any updates on the concrete delivery schedule today?' },
    { name: 'Project 2', message: 'Hi team, any updates on the concrete delivery schedule today?' },
    { name: 'John Doe', message: 'Hi team, any updates on the concrete delivery schedule today?' },
    { name: 'Oliver Green', message: 'Hi team, any updates on the concrete delivery schedule today?' },
    { name: 'Project 3', message: 'Hi team, any updates on the concrete delivery schedule today?' },
  ];

  return (
    <div className="container">
      {/* Header */}
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

      <div className="content">
        {/* Sidebar */}
        <div className="sidebar" style={{ maxHeight: 'calc(100vh - 80px)', overflowY: 'auto' }}>
          {messages.map((msg, index) => (
            <div key={index} className="message-card">
              <h3 className="message-title">{msg.name}</h3>
              <p className="message-text">{msg.message}</p>
            </div>
          ))}
        </div>

        {/* Chat Section */}
        <div className="chat-section">
          {/* Chat Messages */}
          <div className="chat-window">
            <div className="chat-header-icons" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '10px' }}>
              <button className="icon-btn"><FaWindowMaximize /></button>
              <button className="icon-btn"><FaEllipsisH /></button>
            </div>
          </div>

          {/* Message Input */}
          <div className="message-input">
            <input type="text" placeholder="Type your message here" className="input-box" />
            <button className="icon-btn"><FaPaperclip /></button>
            <button className="icon-btn"><FaPaperPlane /></button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PicChat;
