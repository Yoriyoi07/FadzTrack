import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaPaperclip, FaPaperPlane, FaWindowMaximize, FaEllipsisH } from 'react-icons/fa';
import io from 'socket.io-client';
import '../style/pic_style/Pic_Chat.css';
import api from '../../api/axiosInstance';

const socket = io('http://localhost:5000'); 

const PicChat = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const stored = localStorage.getItem('user');
  const user = stored ? JSON.parse(stored) : null;
  const userId = user?._id;

  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [project, setProject] = useState(null);
  const [userName, setUserName] = useState(user?.name || '');
  const [projects, setProjects] = useState([]);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);


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
  
  // Auth guard
  useEffect(() => {
    if (!token || !user) {
      navigate('/');
      return;
    }
    setUserName(user.name);
  }, [navigate, token, user]);

  // Fetch all projects where this user is PIC
  useEffect(() => {
    if (!token || !user) return;
    const fetchProjects = async () => {
      try {
        const { data } = await api.get('/projects', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const filtered = data.filter(
          (p) => Array.isArray(p.pic) && p.pic.some((picUser) => picUser._id === userId)
        );
        setProjects(filtered);
      } catch (err) {
        setProjects([]);
      }
    };
    fetchProjects();
  }, [token, user, userId]);

  // Fetch assigned project for nav links
  useEffect(() => {
    if (!token || !userId) return;
    const fetchAssigned = async () => {
      try {
        const { data } = await api.get(`/projects/assigned/${userId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setProject(data[0] || null);
      } catch (err) {
        setProject(null);
      }
    };
    fetchAssigned();
  }, [token, userId]);

    // Logout handler
    const handleLogout = () => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      navigate('/');
    };
  
    // Profile menu close on outside click
    useEffect(() => {
      const handleClickOutside = (event) => {
        if (!event.target.closest(".profile-menu-container")) {
          setProfileMenuOpen(false);
        }
      };
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }, []);

  return (
    <div className="container">
      {/* Header with Navigation */}
      <header className="header">
        <div className="logo-container">
          <img src={require('../../assets/images/FadzLogo1.png')} alt="FadzTrack Logo" className="logo-img" />
          <h1 className="brand-name">FadzTrack</h1>
        </div>
        <nav className="nav-menu">
          <Link to="/pic" className="nav-link">Dashboard</Link>
          {project && (<Link to={`/pic/projects/${project._id}/request`} className="nav-link">Requests</Link>)}
          {project && (<Link to={`/pic/${project._id}`} className="nav-link">View Project</Link>)}
          <Link to="/pic/chat" className="nav-link">Chat</Link>
        </nav>
        <div className="profile-menu-container">
          <div className="profile-circle" onClick={() => setProfileMenuOpen(!profileMenuOpen)}>Z</div>
          {profileMenuOpen && (
            <div className="profile-menu">
              <button onClick={handleLogout}>Logout</button>
            </div>
          )}
        </div>
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
