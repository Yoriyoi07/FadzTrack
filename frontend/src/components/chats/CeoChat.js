// CeoChat.js
import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { Link, useNavigate, useParams } from 'react-router-dom';
import EmojiPicker from 'emoji-picker-react';
import { FaUsers, FaPaperPlane, FaCheck } from 'react-icons/fa';
import api from '../../api/axiosInstance';
import logo from '../../assets/images/FadzLogo1.png';
import attachIcon from '../../assets/images/attach.png';
import '../style/ceo_style/CeoChat.css';

const SOCKET_SERVER_URL = process.env.REACT_APP_SOCKET_URL || '/';

export default function CeoChat() {
  const navigate = useNavigate();
  const { chatId } = useParams();
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const userId = user._id;
  const headers = { Authorization: `Bearer ${token}` };
  const socket = useRef();

  const [chatList, setChatList] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [tick, setTick] = useState(0);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [showInfoSidebar, setShowInfoSidebar] = useState(false);
  const [reactionPickerMsg, setReactionPickerMsg] = useState(null);
  const messagesEndRef = useRef(null);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [availableUsers, setAvailableUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);

  const getDisplayName = u => {
    if (!u) return '';
    if (u.name) return u.name;
    if (u.firstname || u.lastname) {
      return `${u.firstname || ''} ${u.lastname || ''}`.trim();
    }
    return u.email || '';
  };

  useEffect(() => {
    if (!token || !userId) navigate('/');
  }, [navigate, token, userId]);

  useEffect(() => {
    socket.current = io(SOCKET_SERVER_URL, { auth: { token } });

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

  // Handle user search inside the group modal
  const handleUserSearch = async e => {
    const val = e.target.value;
    setUserSearch(val);
    try {
      const { data } = await api.get(`/users/search?query=${encodeURIComponent(val)}`, {
        headers
      });
      setAvailableUsers(data);
      setFilteredUsers(data.filter(u => u._id !== userId));
    } catch {
      setAvailableUsers([]);
      setFilteredUsers([]);
    }
  };

  // Toggle selection of users to add to the group
  const toggleSelectUser = userId => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  // Create group chat
  const createGroup = async () => {
    try {
      const { data: groupChat } = await api.post(
        '/chats',
        {
          name: groupName,
          users: selectedUsers,
          isGroup: true
        },
        { headers }
      );
      socket.current.emit('sendMessage', {
        chatId: groupChat._id,
        sender: userId,
        content: `📢 Group "${groupName}" created`,
        type: 'text'
      });
      setChatList(list => [groupChat, ...list]);
      setShowGroupModal(false);
      setGroupName('');
      setSelectedUsers([]);
      setFilteredUsers([]);
      setUserSearch('');
      navigate(`/ceo/chat/${groupChat._id}`);
    } catch (err) {
      console.error('❌ Failed to create group:', err);
    }
  };


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
    navigate(`/ceo/chat/${chatToOpen._id}`);
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

    const formatDateTime = ts =>
    new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const handleLogout = () => {
    localStorage.clear();
    navigate('/');
  };

  const handleKeyPress = e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const activeList = searchQuery.trim() ? searchResults : chatList;

  const renderSidebarItem = item => {
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
  };

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
          <img src={logo} alt="FadzTrack Logo" className="logo-img" />
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
        <div className="profile-menu-container">
          <div
            className="profile-circle"
            onClick={() => setProfileMenuOpen(p => !p)}
          >
            {user.name?.charAt(0).toUpperCase() || 'Z'}
          </div>
          {profileMenuOpen && (
            <div className="profile-menu">
              <button onClick={handleLogout}>Logout</button>
            </div>
          )}
        </div>
      </header>

      {/* MAIN */}
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
              activeList.map(renderSidebarItem)
            )}
          </div>
        </div>

        {/* CHAT WINDOW */}
        <div className="modern-chat-section">
          <div className="modern-chat-wrapper">
            <div className="modern-chat-main">
              {!selectedChat ? (
                <div className="modern-no-chat-selected">Select a chat to start messaging</div>
              ) : (
                <>
                  {/* Chat Header */}
                  <div className="modern-chat-header">
                    <div className="modern-chat-header-left">
                      <div className="modern-chat-header-avatar">
                        {selectedChat.isGroup
                          ? <FaUsers/>
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
                        <img src={attachIcon} className="attach-icon" alt="attach" />
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
}
