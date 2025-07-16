// src/components/PmChat.jsx
import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate }        from 'react-router-dom';
import { FaPaperPlane }             from 'react-icons/fa';
import EmojiPicker                  from 'emoji-picker-react';
import { io }                       from 'socket.io-client';
import api                          from '../../api/axiosInstance';
import '../style/pm_style/PmChat.css';

const SOCKET_SERVER_URL = process.env.REACT_APP_SOCKET_URL || '/';

const PmChat = () => {
  const navigate = useNavigate();
  const token    = localStorage.getItem('token');
  const user     = JSON.parse(localStorage.getItem('user') || '{}');
  const userId   = user._id;
  const headers  = { Authorization: `Bearer ${token}` };

  const socket = useRef();

  // Sidebar / search
  const [chats, setChats]               = useState([]); // existing conversations
  const [searchQuery, setSearchQuery]   = useState('');
  const [searchResults, setSearchResults] = useState([]);

  // Selected conversation & messages
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages]         = useState([]);
  const [newMessage, setNewMessage]     = useState('');
  const [tick, setTick]                 = useState(0);

  // UI toggles
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [showInfoSidebar, setShowInfoSidebar] = useState(false);
  const [reactionPickerMsg, setReactionPickerMsg] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker]     = useState(false);

  // Auto-scroll anchor
  const messagesEndRef = useRef(null);

  // 1) Init socket.io
  useEffect(() => {
    socket.current = io(SOCKET_SERVER_URL, { auth: { token } });

    socket.current.on('receiveMessage', msg => {
      // bump tick when a new message arrives in the open chat
      if (selectedChat && msg.conversation === selectedChat._id) {
        setTick(t => t + 1);
        if (msg.sender !== userId) {
          socket.current.emit('messageSeen', {
            chatId:    selectedChat._id,
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

    return () => socket.current.disconnect();
  }, [token, selectedChat, userId]);

  // 2) Redirect if not authed
  useEffect(() => {
    if (!token || !userId) navigate('/');
  }, [token, userId, navigate]);

  // 3) Load all 1:1 chats
  useEffect(() => {
    (async () => {
      const { data } = await api.get(`/chats/${userId}`, { headers });
      setChats(data);
    })();
  }, [userId, tick]);

  // 4) Debounced user search
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

  // 5) Fetch messages whenever chat or tick changes
  useEffect(() => {
    if (!selectedChat) return;
    socket.current.emit('joinChat', selectedChat._id);

    (async () => {
      try {
        const { data } = await api.get(`/messages/${selectedChat._id}`, { headers });
        const norm = data.map(m => ({
          ...m,
          isOwn:      m.sender._id.toString() === userId,
          reactions: m.reactions || [],
          seen:      m.seen || []
        }));
        setMessages(norm);
        norm.filter(m => !m.isOwn).forEach(m =>
          socket.current.emit('messageSeen', {
            chatId:    selectedChat._id,
            messageId: m._id,
            userId
          })
        );
      } catch (e) {
        console.error('Fetch thread failed', e);
      }
    })();
  }, [selectedChat, userId, tick, headers]);

  // 6) Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 7) Open or create a 1:1 chat
  const openChat = async userObj => {
    let conv = chats.find(c =>
      !c.isGroup && c.users.some(u => u._id === userObj._id)
    );
    if (!conv) {
      const { data } = await api.post(
        '/chats',
        { users: [userId, userObj._id], isGroup: false },
        { headers }
      );
      conv = data;
      setChats(prev => [conv, ...prev]);
    }
    setSelectedChat(conv);
    setSearchQuery('');
    setSearchResults([]);
    setTick(t => t + 1);
  };

  // 8) Send message
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
      // optimistic UI
      setMessages(ms => [
        ...ms,
        {
          _id:       Math.random().toString(36).slice(2),
          sender:    { _id: userId, name: user.name },
          content,
          timestamp: new Date().toISOString(),
          isOwn:     true,
          reactions: [],
          seen:      []
        }
      ]);
      socket.current.emit('sendMessage', {
        chatId:   selectedChat._id,
        senderId: userId,
        content,
        type:     'text'
      });
    } catch (e) {
      console.error('Send failed', e);
    }
  };
  const handleKeyPress = e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // 9) Toggle reaction (same as AreaChat)
  const toggleReaction = async (msg, emoji) => {
    const getUid = r => typeof r.userId === 'string' ? r.userId : r.userId._id;
    const existing = msg.reactions.find(r => getUid(r) === userId);
    if (existing && existing.emoji === emoji) {
      await api.delete(`/messages/${msg._id}/reactions`, { data: { userId, emoji }, headers });
    } else {
      if (existing) {
        await api.delete(`/messages/${msg._id}/reactions`, {
          data: { userId, emoji: existing.emoji }, headers
        });
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
    new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const handleLogout = () => { localStorage.clear(); navigate('/'); };

  // decide sidebar list
  const activeList = searchQuery.trim() ? searchResults : chats;

  return (
    <div className="pic-chat-wrapper">
      {/* HEADER */}
      <header className="header">
        <div className="logo-container">
          <img src={require('../../assets/images/FadzLogo1.png')} alt="FadzTrack" className="logo-img"/>
          <h1 className="brand-name">FadzTrack</h1>
        </div>
        <nav className="nav-menu">
          <Link to="/pm" className="nav-link">Dashboard</Link>
          <Link to="/pm/chat" className="nav-link">Chat</Link>
          <Link to="/pm/request/:id" className="nav-link">Material</Link>
          <Link to="/pm/manpower-list" className="nav-link">Manpower</Link>
          <Link to="/reports" className="nav-link">Reports</Link>
        </nav>
        <div className="profile-menu-container">
          <div className="profile-circle" onClick={()=>setProfileMenuOpen(o=>!o)}>
            {user.name?.charAt(0).toUpperCase()||'U'}
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
              onChange={e=>setSearchQuery(e.target.value)}
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
                      ? (item.lastMessage?.content || '').slice(0,30) || 'No messages'
                      : other.email;

                    // ─── determine bold / tick ───
                    let bold   = false;
                    let tickMark = false;
                    if (isConv && item.lastMessage) {
                      const lm = item.lastMessage;
                      const seen = lm.seen || [];
                      if (lm.sender === userId) {
                        // my last message → tick when OTHER has seen it
                        tickMark = seen.some(s => s.userId === other._id);
                      } else {
                        // incoming last → bold until I’ve seen it
                        bold = !seen.some(s => s.userId === userId);
                      }
                    }

                    return (
                      <div
                        key={isConv ? item._id : other._id}
                        className={`modern-chat-item ${
                          isConv && selectedChat?._id===item._id ? 'active':''}`}
                        onClick={()=>{
                          openChat(other);
                          setTick(t=>t+1); // mark read on open
                        }}
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
                        {!!item.lastMessage?.timestamp && (
                          <div className="modern-chat-time">
                            {formatDateTime(item.lastMessage.timestamp)}
                          </div>
                        )}
                      </div>
                    );
                  })}
          </div>
        </div>

        {/* CHAT SECTION */}
        <div className="modern-chat-section">
          <div className="modern-chat-wrapper">
            <div className="modern-chat-main">
              {!selectedChat
                ? <div className="modern-no-chat-selected">Select a chat to start messaging</div>
                : <>
                    {/* Chat Header */}
                    <div className="modern-chat-header">
                      <div className="modern-chat-header-left">
                        <div className="modern-chat-header-avatar">
                          {selectedChat.users.find(u=>u._id!==userId).name.charAt(0).toUpperCase()}
                        </div>
                        <div className="modern-chat-header-info">
                          <h3>{selectedChat.users.find(u=>u._id!==userId).name}</h3>
                          <p className="modern-chat-header-status">Online</p>
                        </div>
                      </div>
                      <button className="modern-info-btn" onClick={()=>setShowInfoSidebar(s=>!s)}>i</button>
                    </div>

                    {/* Messages */}
                    <div className="modern-chat-messages">
                      {messages.map(msg => {
                        const counts = msg.reactions.reduce((a,r)=>{
                          a[r.emoji]=(a[r.emoji]||0)+1; return a;
                        }, {});
                        return (
                          <div key={msg._id} className={`modern-message-wrapper ${msg.isOwn?'own':'other'}`}>
                            <div className={`modern-message ${msg.isOwn?'own':'other'}`}>
                              <button className="reaction-add-btn" onClick={()=>setReactionPickerMsg(msg)}>+</button>
                              <div className="modern-message-content">{msg.content}</div>
                              <div className="modern-message-time">{formatDateTime(msg.timestamp)}</div>
                              {msg.isOwn && msg.seen?.length>0 && (
                                <div className="seen-indicator">
                                  Seen {new Date(msg.seen[msg.seen.length-1].timestamp)
                                    .toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}
                                </div>
                              )}
                              <div className="reactions-bar">
                                {Object.entries(counts).map(([e,c])=>(
                                  <button key={e} className="reaction-pill" onClick={()=>toggleReaction(msg,e)}>
                                    {e}{c>1?` ${c}`:''}
                                  </button>
                                ))}
                              </div>
                              {reactionPickerMsg?._id===msg._id && (
                                <div className="reaction-picker-overlay">
                                  {['👍','❤️','😂','😮','😢','👎'].map(em=>(
                                    <button key={em} className="reaction-btn" onClick={()=>toggleReaction(msg,em)}>{em}</button>
                                  ))}
                                  <button className="reaction-btn close" onClick={()=>setReactionPickerMsg(null)}>×</button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      <div ref={messagesEndRef}/>
                    </div>

                    {/* Input */}
                    <div className="modern-message-input-container">
                      <div className="modern-input-wrapper">
                        <label className="modern-attach-btn">
                          <img src={require('../../assets/images/attach.png')} className="attach-icon" alt="attach"/>
                          <input type="file" hidden accept=".jpg,.jpeg,.png,.pdf,.docx"/>
                        </label>
                        <input
                          className="modern-chat-input"
                          placeholder="Type your message here"
                          value={newMessage}
                          onChange={e=>setNewMessage(e.target.value)}
                          onKeyPress={handleKeyPress}
                        />
                        <div className="modern-emoji-container">
                          <button className="modern-emoji-btn" onClick={()=>setShowEmojiPicker(p=>!p)}>😊</button>
                          {showEmojiPicker && (
                            <div className="modern-emoji-picker">
                              <EmojiPicker onEmojiClick={(_,d)=>setNewMessage(m=>m+d.emoji)} height={360} width={300}/>
                            </div>
                          )}
                        </div>
                        <button className="modern-send-btn" onClick={sendMessage} disabled={!newMessage.trim()}>
                          <FaPaperPlane/>
                        </button>
                      </div>
                    </div>
                  </>}
            </div>

            {/* Info Sidebar */}
            {selectedChat && showInfoSidebar && (
              <div className="modern-contact-info">
                <h3>Contact Info</h3>
                <div><strong>Name:</strong> {selectedChat.users.find(u=>u._id!==userId).name}</div>
                <div><strong>Email:</strong> {selectedChat.users.find(u=>u._id!==userId).email}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PmChat;
