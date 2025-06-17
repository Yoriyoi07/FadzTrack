import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaPaperPlane } from 'react-icons/fa';
import EmojiPicker from 'emoji-picker-react';
import '../style/ceo_style/CeoChat.css';
import api from '../../api/axiosInstance';

const CeoChat = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user'));
  const userId = user?._id;

  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [chatList, setChatList] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showInfoSidebar, setShowInfoSidebar] = useState(false);

  useEffect(() => {
    if (!token || !user) navigate('/');
  }, [navigate, token, user]);

  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const { data } = await api.get(`/messages/conversations/${userId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setChatList(data);
      } catch {
        setChatList([]);
      }
    };
    fetchConversations();
  }, [token, userId, messages]);

  useEffect(() => {
    const delay = setTimeout(() => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        return;
      }
      api.get(`/users/search?query=${searchQuery}`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(({ data }) => {
        setSearchResults(data.filter(u => u._id !== userId));
      });
    }, 300);
    return () => clearTimeout(delay);
  }, [searchQuery, token, userId]);

  useEffect(() => {
    if (!selectedUser || !userId) return;
    const fetchMessages = async () => {
      try {
        const { data } = await api.get(`/messages/${userId}/${selectedUser._id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const formatted = data.map(msg => ({
          ...msg,
          isOwn: msg.sender === userId
        }));
        setMessages(formatted);
      } catch (err) {
        console.error('Fetch message failed:', err);
      }
    };
    fetchMessages();
  }, [selectedUser, userId, token]);

  const formatDateTime = (ts) => {
    const date = new Date(ts);
    return isNaN(date.getTime()) ? 'Invalid date' : date.toLocaleString();
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/');
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedUser) return;
    try {
      await api.post('/messages', {
        sender: userId,
        receiver: selectedUser._id,
        content: newMessage
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNewMessage('');
      const updated = await api.get(`/messages/${userId}/${selectedUser._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const formatted = updated.data.map(msg => ({
        ...msg,
        isOwn: msg.sender === userId
      }));
      setMessages(formatted);
    } catch (err) {
      console.error('Send failed:', err);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const activeList = searchQuery.trim() ? searchResults : chatList;

  return (
    <div className="pic-chat-wrapper">
      {/* Header with Navigation */}
      <header className="header">
        <div className="logo-container">
          <img src={require('../../assets/images/FadzLogo1.png')} alt="FadzTrack Logo" className="logo-img" />
          <h1 className="brand-name">FadzTrack</h1>
        </div>
        <nav className="nav-menu">
          <Link to="/ceo/dash" className="nav-link">Dashboard</Link>
          <Link to="/ceo/chat" className="nav-link">Chat</Link>
          <Link to="/ceo/material-list" className="nav-link">Material</Link>
          <Link to="/ceo/proj" className="nav-link">Projects</Link>
          <Link to="/ceo/audit-logs" className="nav-link">Audit Logs</Link>
          <Link to="/reports" className="nav-link">Reports</Link>
        </nav>
        <div className="profile-menu-container-CEO">
          <div className="profile-circle" onClick={() => setProfileMenuOpen(!profileMenuOpen)}>
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          {profileMenuOpen && (
            <div className="profile-menu">
              <button onClick={handleLogout}>Logout</button>
            </div>
          )}
        </div>
      </header>

      {/* Chat Layout */}
      <div className="pic-chat-content">
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
            {activeList.length === 0 ? (
              <div className="modern-no-chats">No chats or users found.</div>
            ) : (
              activeList.map((entry) => {
                const userObj = entry.user || entry;
                const preview = entry.lastMessage?.content?.slice(0, 30) || userObj.email;
                return (
                  <div
                    key={userObj._id}
                    className={`modern-chat-item ${selectedUser?._id === userObj._id ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedUser(userObj);
                      setMessages([]);
                    }}
                  >
                    <div className="modern-chat-avatar">{userObj.name?.charAt(0).toUpperCase()}</div>
                    <div className="modern-chat-info">
                      <div className="modern-chat-name">{userObj.name}</div>
                      <div className="modern-chat-preview">{preview}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Chat Section */}
        <div className="modern-chat-section">
          <div className="modern-chat-wrapper">
            <div className="modern-chat-main">
              {selectedUser ? (
                <>
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

export default CeoChat;
