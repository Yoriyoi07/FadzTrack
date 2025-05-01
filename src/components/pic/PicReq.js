import React from 'react';
import { Link } from 'react-router-dom';
import '../style/pic_style/Pic_Req.css';

const PicReq = () => {
  return  (
    <div className="container">
      {/* Header */}
      <header className="chat-header">
        <div className="header-left" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src="/images/FadzLogo 1.png" alt="FadzTrack Logo" className="logo-img" />
          <h1>FadzTrack</h1>
        </div>
        <nav>     
          <Link to="/h">Home</Link>
          <Link to="/chat">Chat</Link>
          <Link to="/material-request">Request for Materials</Link>
          <input type="text" placeholder="Search in site" className="search-input" />
        </nav>
      </header>

      {/* Form Section */}
      <div className="form-container">
        <h2>Request for Materials</h2>
        <p>Please fill in the details below to request materials</p>

        {/* Materials Input */}
        <div className="form-group">
          <label>Materials & Quantity</label>
          <input type="text" placeholder="Enter Materials & Quantity" />
          <small>Please specify the materials needed and the quantity required</small>
        </div>

        {/* Upload Section */}
        <div className="form-group">
          <label>Attachment Proof</label>
          <button className="upload-btn">📎 Upload</button>
          <small>You can attach files such as documents or images</small>
        </div>

        {/* Description Section */}
        <div className="form-group">
          <label>Request Description</label>
          <textarea placeholder="Provide a detailed description of your request"></textarea>
        </div>

        {/* Submit Button */}
        <button className="submit-btn">Submit Request</button>
      </div>
    </div>
  );
};

export default PicReq;