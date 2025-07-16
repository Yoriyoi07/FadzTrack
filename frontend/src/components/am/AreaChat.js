// src/components/AreaChat.jsx
import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate }        from 'react-router-dom';
import { FaPaperPlane, FaUsers }    from 'react-icons/fa';
import EmojiPicker                  from 'emoji-picker-react';
import { io }                       from 'socket.io-client';
import '../style/am_style/AreaChat.css';
import api                          from '../../api/axiosInstance';

const SOCKET_SERVER_URL = process.env.REACT_APP_SOCKET_URL || '/';

const AreaChat = () => {
  const navigate = useNavigate();
  const token    = localStorage.getItem('token');
  const user     = JSON.parse(localStorage.getItem('user') || '{}');
  const userId   = user?._id;
  const headers  = { Authorization: `Bearer ${token}` };

  // socket ref
  const socket = useRef();

  // UI state
  const [chats, setChats]                   = useState([]);
  const [selectedChat, setSelectedChat]     = useState(null);
  const [messages, setMessages]             = useState([]);
  const [newMessage, setNewMessage]         = useState('');
  const [reactionPickerMsg, setReactionPickerMsg] = useState(null);
  const [profileMenuOpen, setProfileMenuOpen]     = useState(false);
  const [searchQuery, setSearchQuery]             = useState('');
  const [searchResults, setSearchResults]         = useState([]);
  const [showEmojiPicker, setShowEmojiPicker]     = useState(false);
  const [showInfoSidebar, setShowInfoSidebar]     = useState(false);

  // tick for re-fetching messages
  const [tick, setTick] = useState(0);

  // auto‐scroll anchor
  const messagesEndRef = useRef(null);

  // 1) init socket once
  useEffect(() => {
    socket.current = io(SOCKET_SERVER_URL, { auth: { token } });

    socket.current.on('receiveMessage', msg => {
      if (
        selectedChat &&
        msg.conversation.toString() === selectedChat._id
      ) {
        // bump tick to re-fetch thread
        setTick(t => t + 1);
        // mark it seen
        socket.current.emit('messageSeen', {
          chatId:    selectedChat._id,
          messageId: msg._id,
          userId
        });
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

    return () => socket.current.disconnect();
  }, [token, selectedChat, userId]);

  // auto‐scroll when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Redirect if not logged in
  useEffect(() => {
    if (!token || !userId) navigate('/');
  }, [navigate, token, userId]);

  // Load chats
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/chats/${userId}`, { headers });
        setChats(data);
      } catch {
        setChats([]);
      }
    })();
  }, [userId]);

  // Debounced user search
  useEffect(() => {
    const h = setTimeout(async () => {
      if (!searchQuery.trim()) return setSearchResults([]);
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
  }, [searchQuery, userId]);

  // Fetch & join on chat select *and* whenever tick increments
  useEffect(() => {
    if (!selectedChat) return;
    socket.current.emit('joinChat', selectedChat._id);

    (async () => {
      try {
        const { data } = await api.get(
          `/messages/${selectedChat._id}`,
          { headers }
        );
        const normalized = data.map(m => ({
          ...m,
          isOwn:      m.sender._id.toString() === userId,
          reactions: m.reactions || [],
          seen:      m.seen || []
        }));
        setMessages(normalized);

        // mark all incoming as seen
        normalized
          .filter(m => !m.isOwn)
          .forEach(m =>
            socket.current.emit('messageSeen', {
              chatId:    selectedChat._id,
              messageId: m._id,
              userId
            })
          );
      } catch (err) {
        console.error('fetchMessages error', err);
      }
    })();
  }, [selectedChat, userId, tick, headers]);

  // Start/open 1:1
  const handleSelectUser = async u => {
    let chat = chats.find(c =>
      !c.isGroup && c.users.some(x => x._id === u._id)
    );
    if (!chat) {
      const { data } = await api.post(
        '/chats',
        { users: [userId, u._id], isGroup: false },
        { headers }
      );
      chat = data;
      setChats(prev => [chat, ...prev]);
    }
    setSelectedChat(chat);
    setSearchQuery('');
    setSearchResults([]);
    // reset tick so our effect will fetch right away
    setTick(t => t + 1);
  };

  // Send a message
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedChat) return;
    const payload = {
      conversationId: selectedChat._id,
      sender:         userId,
      content:        newMessage.trim(),
      type:           'text'
    };
    await api.post('/messages', payload, { headers });
    setNewMessage('');
    socket.current.emit('sendMessage', {
      chatId:   selectedChat._id,
      senderId: userId,
      content:  payload.content,
      type:     'text'
    });
  };

  // Toggle reaction
  const toggleReaction = async (msg, emoji) => {
    const getUid = r =>
      typeof r.userId === 'string' ? r.userId : r.userId._id;
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
    // locally update for instant feedback
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

  const formatDateTime = ts => new Date(ts).toLocaleString();
  const handleLogout    = () => { localStorage.clear(); navigate('/'); };

  return (
    <div className="pic-chat-wrapper">
      {/* HEADER */}
      <header className="header">
        <div className="logo-container">
          <img
            src={require('../../assets/images/FadzLogo1.png')}
            alt="FadzTrack"
            className="logo-img"
          />
          <h1 className="brand-name">FadzTrack</h1>
        </div>
        <nav className="nav-menu">
          <Link to="/am" className="nav-link">Dashboard</Link>
          <Link to="/am/chat" className="nav-link">Chat</Link>
          <Link to="/am/matreq" className="nav-link">Material</Link>
          <Link to="/am/manpower-requests" className="nav-link">Manpower</Link>
          <Link to="/am/viewproj" className="nav-link">Projects</Link>
          <Link to="/logs" className="nav-link">Logs</Link>
          <Link to="/reports" className="nav-link">Reports</Link>
        </nav>
        <div className="profile-menu-container-AM">
          <div
            className="profile-circle"
            onClick={() => setProfileMenuOpen(o => !o)}
          >
            {user?.name?.[0]?.toUpperCase()}
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
            <h2 className="modern-sidebar-title">Chats</h2>
            <input
              className="modern-search-input"
              placeholder="Search chats or users…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="modern-chat-list">
            {searchQuery.trim()
              ? (searchResults.length
                  ? searchResults.map(u => (
                      <div
                        key={u._id}
                        className="modern-chat-item"
                        onClick={() => handleSelectUser(u)}
                      >
                        <div className="modern-chat-avatar">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="modern-chat-info">
                          <div className="modern-chat-name">{u.name}</div>
                          <div className="modern-chat-preview">{u.email}</div>
                        </div>
                      </div>
                    ))
                  : <div className="modern-no-chats">No users found.</div>)
              : (chats.length
                  ? chats.map(c => {
                      const isGroup = c.isGroup;
                      const title   = isGroup
                        ? c.name
                        : c.users.find(u => u._id !== userId)?.name;
                      const preview = c.lastMessage?.content || 'No messages yet';
                      const timeStr = c.lastMessage?.timestamp
                        ? new Date(c.lastMessage.timestamp)
                            .toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })
                        : '';
                      return (
                        <div
                          key={c._id}
                          className={`modern-chat-item ${
                            selectedChat?._id === c._id ? 'active':''
                          }`}
                          onClick={() => { setSelectedChat(c); setMessages([]); setTick(t=>t+1); }}
                        >
                          <div className="modern-chat-avatar">
                            {isGroup ? <FaUsers/> : title?.[0]?.toUpperCase()}
                          </div>
                          <div className="modern-chat-info">
                            <div className="modern-chat-name">{title}</div>
                            <div className="modern-chat-preview">{preview.slice(0,30)}</div>
                          </div>
                          <div className="modern-chat-time">{timeStr}</div>
                        </div>
                      );
                    })
                  : <div className="modern-no-chats">No chats yet.</div>)
            }
          </div>
        </div>

        {/* CHAT */}
        <div className="modern-chat-section">
          <div className="modern-chat-wrapper">
            <div className="modern-chat-main">
              {selectedChat ? (
                <>
                  {/* Header */}
                  <div className="modern-chat-header">
                    <div className="modern-chat-header-left">
                      <div className="modern-chat-header-avatar">
                        {selectedChat.isGroup
                          ? <FaUsers/>
                          : selectedChat.users
                              .find(u => u._id !== userId)
                              .name[0].toUpperCase()
                        }
                      </div>
                      <div className="modern-chat-header-info">
                        <h3>
                          {selectedChat.isGroup
                            ? selectedChat.name
                            : selectedChat.users
                                .find(u => u._id !== userId)
                                .name
                          }
                        </h3>
                        <p className="modern-chat-header-status">Online</p>
                      </div>
                    </div>
                    <button
                      className="modern-info-btn"
                      onClick={() => setShowInfoSidebar(s => !s)}
                    >i</button>
                  </div>

                  {/* Messages */}
                  <div className="modern-chat-messages">
                    {messages.map(msg => {
                      const counts = msg.reactions.reduce((a,r) => {
                        a[r.emoji] = (a[r.emoji]||0)+1;
                        return a;
                      }, {});
                      return (
                        <div
                          key={msg._id}
                          className={`modern-message-wrapper ${
                            msg.isOwn ? 'own':'other'
                          }`}
                        >
                          <div className={`modern-message ${
                            msg.isOwn ? 'own':'other'
                          }`}>
                            <button
                              className="reaction-add-btn"
                              onClick={()=>setReactionPickerMsg(msg)}
                            >+</button>
                            {msg.type==='image'
                              ? <img src={msg.content} className="message-image" alt=""/>
                              : <div className="modern-message-content">
                                  {msg.content}
                                </div>
                            }
                            <div className="modern-message-time">
                              {formatDateTime(msg.timestamp)}
                            </div>
                            {msg.isOwn && msg.seen?.length>0 && (
                              <div className="seen-indicator">
                                Seen{' '}
                                {new Date(
                                  msg.seen[msg.seen.length-1].timestamp
                                ).toLocaleTimeString([], {
                                  hour:'2-digit', minute:'2-digit'
                                })}
                              </div>
                            )}
                            <div className="reactions-bar">
                              {Object.entries(counts).map(([e,c]) => (
                                <button
                                  key={e}
                                  className="reaction-pill"
                                  onClick={()=>toggleReaction(msg,e)}
                                >
                                  {e}{c>1?` ${c}`:''}
                                </button>
                              ))}
                            </div>
                            {reactionPickerMsg?._id===msg._id && (
                              <div className="reaction-picker-overlay">
                                {['👍','❤️','😂','😮','😢','👎'].map(e=>(
                                  <button
                                    key={e}
                                    className="reaction-btn"
                                    onClick={()=>toggleReaction(msg,e)}
                                  >{e}</button>
                                ))}
                                <button
                                  className="reaction-btn close"
                                  onClick={()=>setReactionPickerMsg(null)}
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
                        <img
                          src={require('../../assets/images/attach.png')}
                          className="attach-icon"
                          alt="attach"
                        />
                        <input type="file" hidden accept=".jpg,.jpeg,.png,.pdf,.docx"/>
                      </label>
                      <input
                        className="modern-chat-input"
                        placeholder="Type your message here"
                        value={newMessage}
                        onChange={e=>setNewMessage(e.target.value)}
                        onKeyPress={e=>e.key==='Enter'&&!e.shiftKey&&handleSendMessage()}
                      />
                      <div className="modern-emoji-container">
                        <button
                          className="modern-emoji-btn"
                          onClick={()=>setShowEmojiPicker(p=>!p)}
                        >😊</button>
                        {showEmojiPicker && (
                          <div className="modern-emoji-picker">
                            <EmojiPicker
                              onEmojiClick={(_,data)=>setNewMessage(m=>m+data.emoji)}
                              height={360} width={300}
                            />
                          </div>
                        )}
                      </div>
                      <button
                        className="modern-send-btn"
                        onClick={handleSendMessage}
                        disabled={!newMessage.trim()}
                      ><FaPaperPlane/></button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="modern-no-chat-selected">
                  Select a chat to start messaging
                </div>
              )}
            </div>

            {/* Info Sidebar */}
            {selectedChat && showInfoSidebar && (
              <div className="modern-contact-info">
                <h3>Details</h3>
                {selectedChat.isGroup ? (
                  <p>
                    <strong>Members:</strong>{' '}
                    {selectedChat.users.map(u => u.name).join(', ')}
                  </p>
                ) : (
                  <>
                    <div>
                      <strong>Name:</strong>{' '}
                      {selectedChat.users.find(u=>u._id!==userId).name}
                    </div>
                    <div>
                      <strong>Email:</strong>{' '}
                      {selectedChat.users.find(u=>u._id!==userId).email}
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

export default AreaChat;
