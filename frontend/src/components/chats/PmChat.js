// src/components/PmChat.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FaUsers, FaPaperPlane, FaCheck } from 'react-icons/fa';
import { io } from 'socket.io-client';
import EmojiPicker from 'emoji-picker-react';
import api from '../../api/axiosInstance';
import logo from '../../assets/images/FadzLogo1.png';
import attachIcon from '../../assets/images/attach.png';
import '../style/pm_style/PmChat.css';
import NotificationBell from '../NotificationBell';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || '/';

const PmChat = () => {
  const navigate = useNavigate();
  const { chatId } = useParams();
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const userId = user._id;
  const headers = { Authorization: `Bearer ${token}` };
  const socket = useRef();

  const [chatList, setChatList] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [tick, setTick] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [reactionPickerMsg, setReactionPickerMsg] = useState(null);
  const [showInfoSidebar, setShowInfoSidebar] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [availableUsers, setAvailableUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [project, setProject] = useState(null);
  const [userName, setUserName] = useState(user?.name);

  const messagesEndRef = useRef(null);

  const getDisplayName = u => {
    if (!u) return '';
    if (u.name) return u.name;
    if (u.firstname || u.lastname)
      return `${u.firstname || ''} ${u.lastname || ''}`.trim();
    return u.email || '';
  };

    useEffect(() => {
    if (!token || !userId) navigate('/');
  }, [navigate, token, userId]);

  useEffect(() => {
    socket.current = io(SOCKET_URL, { auth: { token } });

    socket.current.on('receiveMessage', msg => {
      setChatList(list =>
        list.map(c =>
          c._id === msg.conversation
            ? { ...c, lastMessage: { content: msg.content, timestamp: msg.timestamp } }
            : c
        )
      );
      if (selectedChat?._id === msg.conversation) {
        setTick(t => t + 1);
        if (msg.sender !== userId) {
          socket.current.emit('messageSeen', {
            messageId: msg._id,
            userId
          });
        }
      }
    });

    socket.current.on('messageSeen', ({ messageId, userId: seenBy, timestamp }) => {
      setMessages(ms =>
        ms.map(m =>
          m._id === messageId
            ? { ...m, seen: [...(m.seen || []), { userId: seenBy, timestamp }] }
            : m
        )
      );
    });

    socket.current.on('groupCreated', group => {
      setChatList(list => [group, ...list]);
    });

    socket.current.on('groupJoined', group => {
      setChatList(list => [group, ...list.filter(c => c._id !== group._id)]);
    });

    return () => socket.current.disconnect();
  }, [token, selectedChat, userId]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/chats', { headers });
        setChatList(data);
      } catch {
        setChatList([]);
      }
    })();
  }, [tick]);

  useEffect(() => {
    if (chatId && chatList.length) {
      const c = chatList.find(ch => ch._id === chatId);
      if (c) {
        setSelectedChat(c);
        setTick(t => t + 1);
      }
    }
  }, [chatId, chatList]);

  useEffect(() => {
    if (!selectedChat) return;
    socket.current.emit('joinChat', selectedChat._id);
    (async () => {
      try {
        const { data } = await api.get(`/messages/${selectedChat._id}`, { headers });
        const norm = data.map(m => ({
          _id: m._id,
          content: m.message,
          timestamp: m.createdAt,
          isOwn: m.senderId === userId,
          reactions: m.reactions || [],
          seen: m.seen || []
        }));
        setMessages(norm);
        norm.filter(m => !m.isOwn).forEach(m =>
          socket.current.emit('messageSeen', {
            messageId: m._id,
            userId
          })
        );
      } catch {
        setMessages([]);
      }
    })();
  }, [selectedChat, userId, tick]);

    useEffect(() => {
    const handler = setTimeout(async () => {
      const q = searchQuery.trim().toLowerCase();
      if (!q) {
        setSearchResults([]);
        return;
      }
      try {
        const { data: users } = await api.get(
          `/users/search?query=${encodeURIComponent(q)}`,
          { headers }
        );
        const matchedChats = chatList.filter(c => {
          if (c.isGroup) return c.name.toLowerCase().includes(q);
          const other = c.users.find(u => u._id !== userId) || {};
          return getDisplayName(other).toLowerCase().includes(q);
        });
        const newUsers = users.filter(u =>
          !chatList.some(c => c.users.some(x => x._id === u._id))
        );
        setSearchResults([
          ...matchedChats,
          ...newUsers.map(u => ({ ...u, type: 'user' }))
        ]);
      } catch {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery, chatList, userId]);

  useEffect(() => {
    if (!token || !userId) return;
    const fetchAssignedPMProject = async () => {
      try {
        const { data } = await api.get(`/projects/assigned/projectmanager/${userId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setProject(data);
      } catch (err) {
        setProject(null);
      }
    };
    fetchAssignedPMProject();
  }, [token, userId]);

  useEffect(() => {
    if (!showGroupModal) return;
    (async () => {
      try {
        const { data } = await api.get('/users?limit=100', { headers });
        setAvailableUsers(data);
        setFilteredUsers(data);
      } catch {
        setAvailableUsers([]);
        setFilteredUsers([]);
      }
    })();
  }, [showGroupModal]);


  const openChat = async item => {
    let chatToOpen = item;
    if (item.type === 'user') {
      const { data: oneToOne } = await api.post(
        '/chats',
        { users: [userId, item._id] },
        { headers }
      );
      chatToOpen = oneToOne;
      setChatList(l => [oneToOne, ...l.filter(c => c._id !== oneToOne._id)]);
    }
    setSelectedChat(chatToOpen);
    setSearchQuery('');
    setSearchResults([]);
    setTick(t => t + 1);
    navigate(`/pm/chat/${chatToOpen._id}`);
  };

  const sendMessage = async () => {
    const content = newMessage.trim();
    if (!content || !selectedChat) return;
    setNewMessage('');
    await api.post(
      '/messages',
      { sender: userId, conversation: selectedChat._id, content, type: 'text' },
      { headers }
    );
    socket.current.emit('sendMessage', {
      chatId: selectedChat._id,
      sender: userId,
      content,
      type: 'text'
    });
    setTick(t => t + 1);
  };

  const toggleReaction = async (msg, emoji) => {
    const getUid = r => (typeof r.userId === 'string' ? r.userId : r.userId._id);
    const existing = msg.reactions.find(r => getUid(r) === userId);
    if (existing && existing.emoji === emoji) {
      await api.delete(`/messages/${msg._id}/reactions`, {
        data: { userId, emoji },
        headers
      });
    } else {
      if (existing) {
        await api.delete(`/messages/${msg._id}/reactions`, {
          data: { userId, emoji: existing.emoji },
          headers
        });
      }
      await api.post(
        `/messages/${msg._id}/reactions`,
        { userId, emoji },
        { headers }
      );
    }
    setMessages(ms =>
      ms.map(m =>
        m._id === msg._id
          ? {
              ...m,
              reactions: existing
                ? m.reactions.filter(r => !(getUid(r) === userId && r.emoji === emoji))
                : [...m.reactions.filter(r => getUid(r) !== userId), { userId, emoji }]
            }
          : m
      )
    );
    setReactionPickerMsg(null);
  };

  const handleUserSearch = e => {
    const q = e.target.value.toLowerCase();
    setUserSearch(q);
    setFilteredUsers(
      availableUsers.filter(u =>
        getDisplayName(u).toLowerCase().includes(q)
      )
    );
  };

  const toggleSelectUser = id =>
    setSelectedUsers(s =>
      s.includes(id) ? s.filter(x => x !== id) : [...s, id]
    );

  const createGroup = async () => {
    const members = [userId, ...selectedUsers];
    const { data: newChat } = await api.post(
      '/chats',
      { name: groupName, users: members, isGroup: true },
      { headers }
    );
    setChatList(cs => [newChat, ...cs]);
    setShowGroupModal(false);
    setGroupName('');
    setUserSearch('');
    setSelectedUsers([]);
    setSelectedChat(newChat);
    setTick(t => t + 1);
    navigate(`/pm/chat/${newChat._id}`);
  };

  const handleKeyPress = e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatDateTime = ts =>
    new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const handleLogout = () => {
    localStorage.clear();
    navigate('/');
  };

  const activeList = searchQuery.trim() ? searchResults : chatList;

    return (
    <div className="pic-chat-wrapper">
      {/* GROUP MODAL */}
      {showGroupModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Create Group Chat</h3>
            <label>Group Name</label>
            <input
              className="modal-input"
              placeholder="Enter a group name"
              value={groupName}
              onChange={e => setGroupName(e.target.value)}
            />
            <label>Search users</label>
            <input
              className="modal-input"
              placeholder="Search for users"
              value={userSearch}
              onChange={handleUserSearch}
            />
            <div className="user-list">
              {filteredUsers.map(u => (
                <label key={u._id} className="user-item">
                  <input
                    type="checkbox"
                    checked={selectedUsers.includes(u._id)}
                    onChange={() => toggleSelectUser(u._id)}
                  />
                  {getDisplayName(u)}
                </label>
              ))}
            </div>
            <div className="modal-buttons">
              <button
                className="btn-create"
                onClick={createGroup}
                disabled={!groupName || !selectedUsers.length}
              >
                Create
              </button>
              <button
                className="btn-cancel"
                onClick={() => setShowGroupModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <header className="header">
        <div className="logo-container">
          <img src={require('../../assets/images/FadzLogo1.png')} alt="FadzTrack Logo" className="logo-img" />
          <h1 className="brand-name">FadzTrack</h1>
        </div>
        <nav className="nav-menu">
          <Link to="/pm" className="nav-link">Dashboard</Link>
          <Link to="/pm/chat" className="nav-link">Chat</Link>
          <Link to="/pm/request/:id" className="nav-link">Material</Link>
          <Link to="/pm/manpower-list" className="nav-link">Manpower</Link>
          {project && (
            <Link to={`/pm/viewprojects/${project._id || project.id}`} className="nav-link">View Project</Link>
          )}
          <Link to="/pm/daily-logs" className="nav-link">Logs</Link>
          {project && (
  <Link to={`/pm/progress-report/${project._id}`}>Reports</Link>
)}
          <Link to="/pm/daily-logs-list" className="nav-link">Daily Logs</Link>
        </nav>
        <div className="profile-menu-container" style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <NotificationBell />
          <div className="profile-circle" onClick={() => setProfileMenuOpen(!profileMenuOpen)}>
            {userName ? userName.charAt(0).toUpperCase() : 'Z'}
          </div>
          {profileMenuOpen && (
            <div className="profile-menu">
              <button onClick={handleLogout}>Logout</button>
            </div>
          )}
        </div>
      </header>

      {/* MAIN CHAT INTERFACE */}
      <div className="pic-chat-content">
        {/* SIDEBAR */}
        <div className="modern-sidebar">
          <div className="modern-sidebar-header">
            <div className="header-top">
              <h2>Chats</h2>
              <button
                className="group-chat-btn modern-new-group-btn"
                onClick={() => setShowGroupModal(true)}
              >
                + New Group
              </button>
            </div>
            <input
              className="modern-search-input"
              placeholder="Search chats or users"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="modern-chat-list">
            {activeList.length === 0 ? (
              <div className="modern-no-chats">No chats found.</div>
            ) : (
              activeList.map(item => {
                const isUser = item.type === 'user';
                const isGroup = item.isGroup;
                const other = isGroup ? null : item.users?.find(u => u._id !== userId) || {};
                const name = isUser
                  ? getDisplayName(item)
                  : isGroup
                  ? item.name
                  : getDisplayName(other);
                const preview = item.lastMessage?.content?.slice(0, 30) || 'Start chatting';
                const timeStr = item.lastMessage?.timestamp
                  ? formatDateTime(item.lastMessage.timestamp)
                  : '';
                return (
                  <div
                    key={item._id}
                    className={`modern-chat-item ${selectedChat?._id === item._id ? 'active' : ''}`}
                    onClick={() => openChat(item)}
                  >
                    <div className="modern-chat-avatar">
                      {isGroup ? <FaUsers /> : name.charAt(0).toUpperCase()}
                    </div>
                    <div className="modern-chat-info">
                      <div className="modern-chat-name">{name}</div>
                      <div className="modern-chat-preview">{preview}</div>
                    </div>
                    {timeStr && <div className="modern-chat-time">{timeStr}</div>}
                  </div>
                );
              })
            )}
          </div>
        </div>

                {/* CHAT WINDOW */}
        <div className="modern-chat-section">
          <div className="modern-chat-wrapper">
            <div className="modern-chat-main">
              {!selectedChat ? (
                <div className="modern-no-chat-selected">
                  Select a chat to start messaging
                </div>
              ) : (
                <>
                  {/* Chat Header */}
                  <div className="modern-chat-header">
                    <div className="modern-chat-header-left">
                      <div className="modern-chat-header-avatar">
                        {selectedChat.isGroup
                          ? <FaUsers />
                          : getDisplayName(selectedChat.users.find(u => u._id !== userId)).charAt(0).toUpperCase()}
                      </div>
                      <div className="modern-chat-header-info">
                        <h3>
                          {selectedChat.isGroup
                            ? selectedChat.name
                            : getDisplayName(selectedChat.users.find(u => u._id !== userId))}
                        </h3>
                      </div>
                    </div>
                    <button
                      className="modern-info-btn"
                      onClick={() => setShowInfoSidebar(s => !s)}
                    >
                      i
                    </button>
                  </div>

                  {/* Messages */}
                  <div className="modern-chat-messages">
                    {messages.map((msg, idx) => {
                      const counts = msg.reactions.reduce((a, r) => {
                        a[r.emoji] = (a[r.emoji] || 0) + 1;
                        return a;
                      }, {});
                      const isLastOwn = msg.isOwn && idx === messages.length - 1;
                      const seenByRecipient = isLastOwn && msg.seen?.length > 0;
                      return (
                        <div
                          key={msg._id}
                          className={`modern-message-wrapper ${msg.isOwn ? 'own' : 'other'}`}
                        >
                          <div className={`modern-message ${msg.isOwn ? 'own' : 'other'}`}>
                            <button
                              className="reaction-add-btn"
                              onClick={() => setReactionPickerMsg(msg)}
                            >+</button>
                            <div className="modern-message-content">
                              {msg.content}
                              {seenByRecipient && <FaCheck className="message-tick" />}
                            </div>
                            <div className="modern-message-time">{formatDateTime(msg.timestamp)}</div>
                            <div className="reactions-bar">
                              {Object.entries(counts).map(([e, c]) => (
                                <button
                                  key={e}
                                  className="reaction-pill"
                                  onClick={() => toggleReaction(msg, e)}
                                >
                                  {e}{c > 1 ? ` ${c}` : ''}
                                </button>
                              ))}
                            </div>
                            {reactionPickerMsg?._id === msg._id && (
                              <div className="reaction-picker-overlay">
                                {['👍', '❤️', '😂', '😮', '😢', '👎'].map(em => (
                                  <button
                                    key={em}
                                    className="reaction-btn"
                                    onClick={() => toggleReaction(msg, em)}
                                  >{em}</button>
                                ))}
                                <button
                                  className="reaction-btn close"
                                  onClick={() => setReactionPickerMsg(null)}
                                >×</button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Input */}
                  <div className="modern-message-input-container">
                    <div className="modern-input-wrapper">
                      <label className="modern-attach-btn">
                        <img src={require('../../assets/images/attach.png')} className="attach-icon" alt="attach" />
                        <input type="file" hidden />
                      </label>
                      <input
                        className="modern-chat-input"
                        placeholder="Type your message here"
                        value={newMessage}
                        onChange={e => setNewMessage(e.target.value)}
                        onKeyPress={handleKeyPress}
                      />
                      <button
                        className="modern-emoji-btn"
                        onClick={() => setShowEmojiPicker(p => !p)}
                      >😊</button>
                      {showEmojiPicker && (
                        <div className="modern-emoji-picker">
                          <EmojiPicker
                            onEmojiClick={(_, d) => setNewMessage(m => m + d.emoji)}
                            height={360}
                            width={300}
                          />
                        </div>
                      )}
                      <button
                        className="modern-send-btn"
                        onClick={sendMessage}
                        disabled={!newMessage.trim()}
                      >
                        <FaPaperPlane />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Info Sidebar */}
            {showInfoSidebar && selectedChat && (
              <div className="modern-contact-info">
                <h3>Details</h3>
                {selectedChat.isGroup ? (
                  <>
                    <p><strong>Group Name:</strong> {selectedChat.name}</p>
                    <p><strong>Join Code:</strong> {selectedChat.joinCode}</p>
                    <ul>
                      {selectedChat.users.map(u => (
                        <li key={u._id}>{getDisplayName(u)}</li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <>
                    <p><strong>Name:</strong> {getDisplayName(selectedChat.users.find(u => u._id !== userId))}</p>
                    <p><strong>Email:</strong> {selectedChat.users.find(u => u._id !== userId)?.email}</p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PmChat;
