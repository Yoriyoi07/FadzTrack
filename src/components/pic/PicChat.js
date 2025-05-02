import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FaPaperclip, FaPaperPlane, FaWindowMaximize, FaEllipsisH } from 'react-icons/fa';
import io from 'socket.io-client';
import '../style/pic_style/Pic_Chat.css';

const socket = io('http://localhost:5000'); 

const PicChat = () => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');

  // Listen for incoming messages
  useEffect(() => {
    socket.on('receiveMessage', (data) => {
      setMessages((prevMessages) => [...prevMessages, data]);
    });

    // Clean up socket on unmount
    return () => socket.off('receiveMessage');
  }, []);

  const handleSend = () => {
    if (!newMessage.trim()) return;
  
    const user = JSON.parse(localStorage.getItem('user'));

    const messageData = {
      sender: user.id, 
      content: newMessage,
      chatId: '64e2c7c2053f826db77d9301',
      timestamp: new Date().toISOString()
    };
  
    socket.emit('sendMessage', messageData);
    setNewMessage(''); 
  };

  return (
    <div className="container">
      <header className="chat-header">
        <div className="header-left">
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

      <div className="content">
  <div className="sidebar">
    <div className="message-card">
      <h3 className="message-title">Chat</h3>
      <p className="message-text">Start chatting below</p>
    </div>
  </div>

  {/* Chat Section */}
  <div className="chat-section">
    <div className="chat-window">
      {/* Chat Header */}
      <div className="chat-header-icons">
        <button className="icon-btn"><FaWindowMaximize /></button>
        <button className="icon-btn"><FaEllipsisH /></button>
      </div>

      {/* Chat Messages */}
      <div className="chat-messages">
        {messages.map((msg, index) => (
          <div key={index} className="chat-message">
            <strong>{msg.sender}:</strong> {msg.content}
          </div>
        ))}
      </div>
    </div>

    {/* Input Field */}
    <div className="message-input">
      <input
        type="text"
        placeholder="Type your message here"
        className="input-box"
        value={newMessage}
        onChange={(e) => setNewMessage(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
      />
      <button className="icon-btn" onClick={handleSend}><FaPaperPlane /></button>
    </div>
  </div>
</div>
    </div>
  );
};

export default PicChat;
