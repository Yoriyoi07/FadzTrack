import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaPaperPlane } from 'react-icons/fa';
import EmojiPicker from 'emoji-picker-react';
import '../style/hr_style/HrChat.css'; 
import api from '../../api/axiosInstance';

const HrChat = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user'));
  const userId = user?._id;

  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showInfoSidebar, setShowInfoSidebar] = useState(false);

  useEffect(() => {
    if (!token || !user) navigate('/');
  }, [navigate, token, user]);

  useEffect(() => {
    const delay = setTimeout(() => {
      if (!searchQuery.trim()) return setSearchResults([]);
      api.get(`/users/search?query=${searchQuery}`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(({ data }) => {
        setSearchResults(data.filter(u => u._id !== userId));
      });
    }, 300);
    return () => clearTimeout(delay);
  }, [searchQuery, token, userId]);

  const formatDateTime = (ts) => {
    const date = new Date(ts);
    return isNaN(date.getTime()) ? 'Invalid date' : date.toLocaleString();
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedUser) return;
    try {
      const { data } = await api.post('/messages', {
        sender: userId,
        receiver: selectedUser._id,
        content: newMessage
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessages(prev => [...prev, { ...data, isOwn: true }]);
      setNewMessage('');
    } catch (err) {
      console.error('Send failed:', err);
    }
  };

  useEffect(() => {
    if (!selectedUser) return;
    api.get(`/messages/${userId}/${selectedUser._id}`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(({ data }) => {
      const formatted = data.map(msg => ({
        ...msg,
        isOwn: msg.sender === userId
      }));
      setMessages(formatted);
    });
  }, [selectedUser, userId, token]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (!event.target.closest('.profile-menu-container')) setProfileMenuOpen(false);
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
        }, []);

        const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/');
    };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="pic-chat-wrapper">
      {/* Navbar */}
      <header className="header">
        <div className="logo-container">
        <img src={require('../../assets/images/FadzLogo1.png')} alt="FadzTrack Logo" className="logo-img" />
        <h1 className="brand-name">FadzTrack</h1>
        </div>
            <nav className="nav-menu">
                <Link to="/hr/dash" className="nav-link">Dashboard</Link>
                <Link to="/hr/mlist" className="nav-link">Manpower</Link>
                <Link to="/hr/movement" className="nav-link">Movement</Link>
                <Link to="/hr/project-records" className="nav-link">Projects</Link>
                <Link to="/hr/chat" className="nav-link">Chat</Link>
                <Link to="/logs" className="nav-link">Logs</Link>
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

      {/* Chat Layout */}
      <div className="pic-chat-content">
        {/* Sidebar */}
        <div className="modern-sidebar">
          <div className="modern-sidebar-header">
            <h2 className="modern-sidebar-title">Chats</h2>
            <input
              type="text"
              className="modern-search-input"
              placeholder="Search chats or users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="modern-chat-list">
            {searchResults.length === 0 ? (
              <div className="modern-no-chats">No chats yet. Start by searching above.</div>
            ) : (
              searchResults.map((user) => (
                <div
                  key={user._id}
                  className={`modern-chat-item ${selectedUser?._id === user._id ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedUser(user);
                    setMessages([]);
                  }}
                >
                  <div className="modern-chat-avatar">{user.name?.charAt(0).toUpperCase()}</div>
                  <div className="modern-chat-info">
                    <div className="modern-chat-name">{user.name}</div>
                    <div className="modern-chat-preview">{user.email}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Chat Section */}
        <div className="modern-chat-section">
          <div className="modern-chat-wrapper">
            <div className="modern-chat-main">
              {selectedUser ? (
                <>
                  {/* Header */}
                  <div className="modern-chat-header">
                    <div className="modern-chat-header-left">
                      <div className="modern-chat-header-avatar">{selectedUser.name?.charAt(0).toUpperCase()}</div>
                      <div className="modern-chat-header-info">
                        <h3>{selectedUser.name}</h3>
                        <p className="modern-chat-header-status">Online</p>
                      </div>
                    </div>
                    <button className="modern-info-btn" onClick={() => setShowInfoSidebar(!showInfoSidebar)}>i</button>
                  </div>

                  {/* Messages */}
                  <div className="modern-chat-messages">
                    {messages.length === 0 ? (
                      <div className="modern-no-messages">No messages yet. Start the conversation!</div>
                    ) : (
                      messages.map((msg) => (
                        <div key={msg._id} className={`modern-message-wrapper ${msg.isOwn ? 'own' : 'other'}`}>
                          <div className={`modern-message ${msg.isOwn ? 'own' : 'other'}`}>
                            <div className="modern-message-content">{msg.content}</div>
                            <div className="modern-message-time">{formatDateTime(msg.timestamp)}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Input */}
                  <div className="modern-message-input-container">
                    <div className="modern-input-wrapper">
                      <label className="modern-attach-btn">
                        <img src={require('../../assets/images/attach.png')} alt="attach" className="attach-icon" />
                        <input type="file" hidden accept=".jpg,.jpeg,.png,.pdf,.docx" />
                      </label>
                      <input
                        type="text"
                        placeholder="Type your message here"
                        className="modern-chat-input"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={handleKeyPress}
                      />
                      <div className="modern-emoji-container">
                        <button className="modern-emoji-btn" onClick={() => setShowEmojiPicker(!showEmojiPicker)}>😊</button>
                        {showEmojiPicker && (
                          <div className="modern-emoji-picker">
                            <EmojiPicker onEmojiClick={(emojiData) => setNewMessage((prev) => prev + emojiData.emoji)} height={360} width={300} />
                          </div>
                        )}
                      </div>
                      <button className="modern-send-btn" onClick={handleSendMessage} disabled={!newMessage.trim()}>
                        <FaPaperPlane />
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="modern-no-chat-selected">Select a chat to start messaging</div>
              )}
            </div>

            {/* Info Sidebar */}
            {selectedUser && showInfoSidebar && (
              <div className="modern-contact-info">
                <h3>Contact Info</h3>
                <div className="modern-contact-field"><strong>Name:</strong> {selectedUser.name}</div>
                <div className="modern-contact-field"><strong>Email:</strong> {selectedUser.email}</div>
                <div className="modern-contact-field"><strong>Phone:</strong> {selectedUser.phone || 'N/A'}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HrChat;
