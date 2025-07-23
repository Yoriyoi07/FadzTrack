// src/components/HrChat.jsx
import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate, useParams }      from 'react-router-dom';
import { FaPaperPlane, FaUsers, FaCheck }    from 'react-icons/fa';
import EmojiPicker                            from 'emoji-picker-react';
import api                                    from '../../api/axiosInstance';
import '../style/hr_style/HrChat.css';
import { io }                                from 'socket.io-client';

const SOCKET_SERVER_URL = process.env.REACT_APP_SOCKET_URL || '/';

const HrChat = () => {
  const navigate      = useNavigate();
  const { chatId }    = useParams();
  const token         = localStorage.getItem('token');
  const user          = JSON.parse(localStorage.getItem('user') || '{}');
  const userId        = user?._id;
  const headers       = { Authorization: `Bearer ${token}` };
  const socket        = useRef();

  // Sidebar / Search
  const [chatList, setChatList]           = useState([]);
  const [searchQuery, setSearchQuery]     = useState('');
  const [searchResults, setSearchResults] = useState([]);

  // Conversation
  const [selectedChat, setSelectedChat]   = useState(null);
  const [messages, setMessages]           = useState([]);
  const [newMessage, setNewMessage]       = useState('');
  const [tick, setTick]                   = useState(0);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Group modal
  const [showGroupModal, setShowGroupModal]   = useState(false);
  const [groupName, setGroupName]             = useState('');
  const [availableUsers, setAvailableUsers]   = useState([]);
  const [filteredUsers, setFilteredUsers]     = useState([]);
  const [userSearch, setUserSearch]           = useState('');
  const [selectedUsers, setSelectedUsers]     = useState([]);

  // UI toggles
  const [profileMenuOpen, setProfileMenuOpen]     = useState(false);
  const [showInfoSidebar, setShowInfoSidebar]     = useState(false);
  const [reactionPickerMsg, setReactionPickerMsg] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker]     = useState(false);

  // scroll anchor
  const messagesEndRef = useRef(null);

  // 1) Initialize socket.io
  useEffect(() => {
    socket.current = io(SOCKET_SERVER_URL, { auth: { token } });

    socket.current.on('receiveMessage', msg => {
      // update sidebar preview
      setChatList(list =>
        list.map(c =>
          c._id === msg.conversation
            ? { ...c, lastMessage: { content: msg.content, timestamp: msg.timestamp } }
            : c
        )
      );
      // if open chat, bump tick & mark seen
      if (selectedChat?._id === msg.conversation) {
        setTick(t => t + 1);
        if (msg.sender !== userId) {
          socket.current.emit('messageSeen', {
            chatId:    msg.conversation,
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
            ? { ...m, seen: [...(m.seen||[]), { userId: seenBy, timestamp }] }
            : m
        )
      );
    });

    socket.current.on('chatUpdated', ({ chatId: cId, lastMessage }) => {
      setChatList(list =>
        list.map(c =>
          c._id === cId
            ? { ...c, lastMessage }
            : c
        )
      );
    });

    return () => socket.current.disconnect();
  }, [token, selectedChat, userId]);

  // 2) Auth guard
  useEffect(() => {
    if (!token || !userId) navigate('/');
  }, [token, userId, navigate]);

  // 3) Fetch chat list on mount & on tick
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/chats/${userId}`, { headers });
        setChatList(data);
      } catch {
        setChatList([]);
      }
    })();
  }, [userId, tick]);

  // 4) Auto-open from URL
  useEffect(() => {
    if (chatId && chatList.length) {
      const c = chatList.find(ch => ch._id === chatId);
      if (c) {
        setSelectedChat(c);
        setTick(t => t + 1);
      }
    }
  }, [chatId, chatList]);

  // 5) Join & fetch messages
  useEffect(() => {
    if (!selectedChat) return;
    socket.current.emit('joinChat', selectedChat._id);

    (async () => {
      try {
        const { data } = await api.get(`/messages/${selectedChat._id}`, { headers });
        const norm = data.map(m => ({
          ...m,
          isOwn:      m.sender._id === userId,
          reactions:  m.reactions || [],
          seen:       m.seen || []
        }));
        setMessages(norm);
        // mark all incoming seen
        norm.filter(m => !m.isOwn).forEach(m =>
          socket.current.emit('messageSeen', {
            chatId:    selectedChat._id,
            messageId: m._id,
            userId
          })
        );
      } catch (e) {
        console.error('fetchMessages error', e);
      }
    })();
  }, [selectedChat, userId, tick, headers]);

  // 6) Debounced user search
  useEffect(() => {
    const h = setTimeout(async () => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        return;
      }
      try {
        const { data } = await api.get(
          `/users/search?query=${encodeURIComponent(searchQuery)}`,
          { headers }
        );
        setSearchResults(data.filter(u => u._id !== userId));
      } catch {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(h);
  }, [searchQuery, userId, headers]);

  // 7) Load users for group modal
  useEffect(() => {
    if (!showGroupModal) return;
    (async () => {
      try {
        const { data } = await api.get(`/users?limit=5`, { headers });
        setAvailableUsers(data);
        setFilteredUsers(data);
      } catch {
        setAvailableUsers([]);
        setFilteredUsers([]);
      }
    })();
  }, [showGroupModal, headers]);

  const handleUserSearch = e => {
    const q = e.target.value.toLowerCase();
    setUserSearch(q);
    setFilteredUsers(
      availableUsers.filter(u =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
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
    setChatList(list => [newChat, ...list]);
    setShowGroupModal(false);
    setGroupName('');
    setUserSearch('');
    setSelectedUsers([]);
    setSelectedChat(newChat);
    setTick(t => t + 1);
    navigate(`/hr/chat/${newChat._id}`);
  };

  const openChat = async chat => {
    setSelectedChat(chat);
    setSearchQuery('');
    setSearchResults([]);
    setTick(t => t + 1);
    navigate(`/hr/chat/${chat._id}`);
  };

  const sendMessage = async () => {
    const content = newMessage.trim();
    if (!content || !selectedChat) return;
    setNewMessage('');
    try {
      await api.post(
        '/messages',
        {
          conversationId: selectedChat._id,
          sender:         userId,
          content,
          type:           'text'
        },
        { headers }
      );
      socket.current.emit('sendMessage', {
        chatId:   selectedChat._id,
        senderId: userId,
        content,
        type:     'text'
      });
      setTick(t => t + 1);
    } catch (err) {
      console.error('Send failed', err);
    }
  };
  const handleKeyPress = e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const toggleReaction = async (msg, emoji) => {
    const getUid = r => typeof r.userId === 'string' ? r.userId : r.userId._id;
    const existing = msg.reactions.find(r => getUid(r) === userId);
    if (existing && existing.emoji === emoji) {
      await api.delete(`/messages/${msg._id}/reactions`, { data:{ userId, emoji }, headers });
    } else {
      if (existing) {
        await api.delete(`/messages/${msg._id}/reactions`, { data:{ userId, emoji: existing.emoji }, headers });
      }
      await api.post(`/messages/${msg._id}/reactions`, { userId, emoji }, { headers });
    }
    setMessages(ms =>
      ms.map(m =>
        m._id === msg._id
          ? {
              ...m,
              reactions: existing
                ? m.reactions.filter(r => !(getUid(r)===userId && r.emoji===emoji))
                : [...m.reactions.filter(r=>getUid(r)!==userId), { userId, emoji }]
            }
          : m
      )
    );
    setReactionPickerMsg(null);
  };

  const formatDateTime = ts =>
    new Date(ts).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
  const handleLogout = () => { localStorage.clear(); navigate('/'); };

  const activeList = searchQuery.trim() ? searchResults : chatList;

  return (
    <div className="pic-chat-wrapper">
      {/* GROUP MODAL */}
      {showGroupModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Create Group Chat</h3>
            <label htmlFor="group-name" className="group-name-label">Group Name</label>
            <input
              id="group-name"
              className="modal-input"
              placeholder="Enter a group name"
              value={groupName}
              onChange={e => setGroupName(e.target.value)}
            />
            <label htmlFor="group-user-search" className="search-label">Search users</label>
            <input
              id="group-user-search"
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
                  {u.name}
                </label>
              ))}
            </div>
            <div className="modal-buttons">
              <button
                className="btn-create"
                onClick={createGroup}
                disabled={!groupName || selectedUsers.length === 0}
              >
                Create
              </button>
              <button className="btn-cancel" onClick={() => setShowGroupModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <header className="header">
        <div className="logo-container">
          <img
            src={require('../../assets/images/FadzLogo1.png')}
            alt="FadzTrack Logo"
            className="logo-img"
          />
          <h1 className="brand-name">FadzTrack</h1>
        </div>
        <nav className="nav-menu">
          <Link to="/hr/dash" className="nav-link">Dashboard</Link>
          <Link to="/hr/chat" className="nav-link">Chat</Link>
          <Link to="/hr/mlist" className="nav-link">Manpower</Link>
          <Link to="/hr/movement" className="nav-link">Movement</Link>
          <Link to="/hr/project-records" className="nav-link">Projects</Link>
        </nav>
        <div className="profile-menu-container">
          <div className="profile-circle" onClick={()=>setProfileMenuOpen(o=>!o)}>
            {user?.name?.charAt(0).toUpperCase() || 'U'}
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
              placeholder="Search chats or users…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="modern-chat-list">
            {activeList.length === 0
              ? <div className="modern-no-chats">No chats or users found.</div>
              : activeList.map(item => {
                  const isConv = !!item.users;
                  const other  = isConv
                    ? item.users.find(u => u._id !== userId)
                    : item;
                  const preview = isConv
                    ? (item.lastMessage?.content || '').slice(0, 30) || 'No messages'
                    : other.email;
                  const timeStr = isConv && item.lastMessage?.timestamp
                    ? formatDateTime(item.lastMessage.timestamp)
                    : '';
                  let bold = false, tickMark = false;
                  if (isConv && item.lastMessage) {
                    const lm = item.lastMessage;
                    const seen = lm.seen || [];
                    if (lm.sender === userId) {
                      tickMark = seen.some(s => s.userId === other._id);
                    } else {
                      bold = !seen.some(s => s.userId === userId);
                    }
                  }
                  return (
                    <div
                      key={isConv ? item._id : other._id}
                      className={`modern-chat-item ${
                        isConv && selectedChat?._id === item._id ? 'active' : ''
                      }`}
                      onClick={() => isConv ? openChat(item) : null}
                    >
                      <div className="modern-chat-avatar">
                        {other.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="modern-chat-info">
                        <div className="modern-chat-name">{other.name}</div>
                        <div className="modern-chat-preview">
                          <span className={bold ? 'unread' : ''}>{preview}</span>
                          {tickMark && <span className="sidebar-tick">✓</span>}
                        </div>
                      </div>
                      {timeStr && <div className="modern-chat-time">{timeStr}</div>}
                    </div>
                  );
                })}
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
                          : selectedChat.users.find(u => u._id !== userId).name.charAt(0).toUpperCase()}
                      </div>
                      <div className="modern-chat-header-info">
                        <h3>
                          {selectedChat.isGroup
                            ? selectedChat.name
                            : selectedChat.users.find(u => u._id !== userId).name}
                        </h3>
                      </div>
                    </div>
                    <button className="modern-info-btn" onClick={() => setShowInfoSidebar(s => !s)}>i</button>
                  </div>

                  {/* Messages */}
                  <div className="modern-chat-messages">
                    {loadingMessages ? (
                      <div className="messages-loading">Loading messages…</div>
                    ) : (
                      messages.map((msg, idx) => {
                        const counts = msg.reactions.reduce((a, r) => {
                          a[r.emoji] = (a[r.emoji] || 0) + 1;
                          return a;
                        }, {});
                        const isLastOwn      = msg.isOwn && idx === messages.length - 1;
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
                              >
                                +
                              </button>
                              <div className="modern-message-content">
                                {msg.content}
                                {isLastOwn && seenByRecipient && (
                                  <FaCheck className="message-tick" />
                                )}
                              </div>
                              <div className="modern-message-time">
                                {formatDateTime(msg.timestamp)}
                              </div>
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
                                  {['👍','❤️','😂','😮','😢','👎'].map(em => (
                                    <button
                                      key={em}
                                      className="reaction-btn"
                                      onClick={() => toggleReaction(msg, em)}
                                    >
                                      {em}
                                    </button>
                                  ))}
                                  <button
                                    className="reaction-btn close"
                                    onClick={() => setReactionPickerMsg(null)}
                                  >
                                    ×
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Input */}
                  <div className="modern-message-input-container">
                    <div className="modern-input-wrapper">
                      <label className="modern-attach-btn">
                        <img
                          src={require('../../assets/images/attach.png')}
                          className="attach-icon"
                          alt="attach"
                        />
                        <input type="file" hidden accept=".jpg,.jpeg,.png,.pdf,.docx" />
                      </label>
                      <input
                        className="modern-chat-input"
                        placeholder="Type your message here"
                        value={newMessage}
                        onChange={e => setNewMessage(e.target.value)}
                        onKeyPress={handleKeyPress}
                      />
                      <div className="modern-emoji-container">
                        <button
                          className="modern-emoji-btn"
                          onClick={() => setShowEmojiPicker(p => !p)}
                        >
                          😊
                        </button>
                        {showEmojiPicker && (
                          <div className="modern-emoji-picker">
                            <EmojiPicker
                              onEmojiClick={(_, d) => setNewMessage(m => m + d.emoji)}
                              height={360}
                              width={300}
                            />
                          </div>
                        )}
                      </div>
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
            {selectedChat && showInfoSidebar && (
              <div className="modern-contact-info">
                <h3>Contact Info</h3>
                {selectedChat.isGroup ? (
                  <p>
                    <strong>Members:</strong>{' '}
                    {selectedChat.users.map(u => u.name).join(', ')}
                  </p>
                ) : (
                  <>
                    <div>
                      <strong>Name:</strong>{' '}
                      {selectedChat.users.find(u => u._id !== userId).name}
                    </div>
                    <div>
                      <strong>Email:</strong>{' '}
                      {selectedChat.users.find(u => u._id !== userId).email}
                    </div>
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

export default HrChat;
