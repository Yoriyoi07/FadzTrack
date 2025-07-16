// src/components/PicChat.jsx
import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate }        from 'react-router-dom';
import { FaPaperPlane, FaUsers }    from 'react-icons/fa';
import EmojiPicker                  from 'emoji-picker-react';
import { io }                       from 'socket.io-client';
import api                          from '../../api/axiosInstance';
import '../style/pic_style/Pic_Chat.css';

const SOCKET_SERVER_URL = process.env.REACT_APP_SOCKET_URL || '/';

const PicChat = () => {
  const navigate = useNavigate();
  const token    = localStorage.getItem('token');
  const user     = JSON.parse(localStorage.getItem('user') || '{}');
  const userId   = user?._id;
  const headers  = { Authorization: `Bearer ${token}` };

  // socket + tick counter
  const socket = useRef();
  const [tick, setTick] = useState(0);

  // Sidebar
  const [chatList, setChatList]           = useState([]);
  const [searchQuery, setSearchQuery]     = useState('');
  const [searchResults, setSearchResults] = useState([]);

  // Selected chat & messages
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages]         = useState([]);
  const [newMessage, setNewMessage]     = useState('');
  const [reactionPickerMsg, setReactionPickerMsg] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker]     = useState(false);

  // UI toggles
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [showInfoSidebar, setShowInfoSidebar] = useState(false);

  // auto-scroll anchor
  const messagesEndRef = useRef(null);

  // 1) init socket once
  useEffect(() => {
    socket.current = io(SOCKET_SERVER_URL, { auth: { token } });

    socket.current.on('receiveMessage', msg => {
      if (selectedChat && msg.conversation === selectedChat._id) {
        // bump tick → triggers both sidebar & thread reload
        setTick(t => t + 1);
        // mark seen
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

  // 2) auth guard
  useEffect(() => {
    if (!token || !userId) {
      navigate('/');
    }
  }, [token, userId, navigate]);

  // 3) fetch sidebar chats on mount & tick
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

  // 4) debounce search users
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
  }, [searchQuery, userId]);

  // 5) fetch thread on chat select & tick
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
      } catch (err) {
        console.error('Thread fetch failed', err);
      }
    })();
  }, [selectedChat, userId, tick, headers]);

  // 6) auto-scroll on messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 7) open or create a chat
  const openChat = async chat => {
    setSelectedChat(chat);
    setSearchQuery('');
    setSearchResults([]);
    setTick(t => t + 1);
  };

  const handleSelectUser = async u => {
    let chat = chatList.find(c =>
      !c.isGroup && c.users.some(x => x._id === u._id)
    );
    if (!chat) {
      const { data } = await api.post(
        '/chats',
        { users: [userId, u._id], isGroup: false },
        { headers }
      );
      chat = data;
      setChatList(prev => [chat, ...prev]);
    }
    openChat(chat);
  };

  // 8) send message
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
      setTick(t => t + 1);
      socket.current.emit('sendMessage', {
        chatId:   selectedChat._id,
        senderId: userId,
        content,
        type:     'text'
      });
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

  // 9) toggle reaction
  const toggleReaction = async (msg, emoji) => {
    const getUid = r => typeof r.userId==='string'? r.userId: r.userId._id;
    const existing = msg.reactions.find(r => getUid(r) === userId);

    if (existing && existing.emoji === emoji) {
      await api.delete(`/messages/${msg._id}/reactions`, { data:{userId,emoji}, headers });
    } else {
      if (existing) {
        await api.delete(`/messages/${msg._id}/reactions`, { data:{userId,emoji:existing.emoji}, headers });
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

  const handleLogout = () => {
    localStorage.clear();
    navigate('/');
  };

  const activeList = searchQuery.trim() ? searchResults : chatList;

  return (
    <div className="pic-chat-wrapper">
      {/* Navbar */}
      <header className="header">
        <div className="logo-container">
          <img src={require('../../assets/images/FadzLogo1.png')} alt="FadzTrack" className="logo-img" />
          <h1 className="brand-name">FadzTrack</h1>
        </div>
        <nav className="nav-menu">
          <Link to="/pic" className="nav-link">Dashboard</Link>
          <Link to="/pic/chat" className="nav-link">Chat</Link>
          <Link to="/pic/projects" className="nav-link">My Projects</Link>
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

      <div className="pic-chat-content">
        {/* Sidebar */}
        <div className="modern-sidebar">
          <div className="modern-sidebar-header">
            <h2>Chats</h2>
            <input
              placeholder="Search users…"
              value={searchQuery}
              onChange={e=>setSearchQuery(e.target.value)}
              className="modern-search-input"
            />
          </div>
          <div className="modern-chat-list">
            {activeList.length === 0
              ? <div className="modern-no-chats">No chats or users found.</div>
              : activeList.map(item => {
                  const isConv = !!item.users;
                  const other  = isConv
                    ? item.users.find(u=>u._id!==userId)
                    : item;
                  const preview = isConv
                    ? (item.lastMessage?.content||'').slice(0,30) || 'No messages'
                    : other.email;
                  const timeStr = isConv && item.lastMessage?.timestamp
                    ? formatDateTime(item.lastMessage.timestamp)
                    : '';
                  return (
                    <div
                      key={isConv? item._id : other._id}
                      className={`modern-chat-item ${
                        isConv && selectedChat?._id===item._id ? 'active':''}`}
                      onClick={()=> isConv ? openChat(item) : handleSelectUser(item)}
                    >
                      <div className="modern-chat-avatar">{other.name.charAt(0).toUpperCase()}</div>
                      <div className="modern-chat-info">
                        <div className="modern-chat-name">{other.name}</div>
                        <div className="modern-chat-preview">{preview}</div>
                      </div>
                      {timeStr && <div className="modern-chat-time">{timeStr}</div>}
                    </div>
                  );
                })
            }
          </div>
        </div>

        {/* Chat Section */}
        <div className="modern-chat-section">
          <div className="modern-chat-wrapper">
            <div className="modern-chat-main">
              {!selectedChat
                ? <div className="modern-no-chat-selected">Select a chat to start messaging</div>
                : <>
                    <div className="modern-chat-header">
                      <div className="modern-chat-header-left">
                        <div className="modern-chat-header-avatar">
                          {selectedChat.users.find(u=>u._id!==userId).name.charAt(0).toUpperCase()}
                        </div>
                        <div className="modern-chat-header-info">
                          <h3>
                            {selectedChat.isGroup
                              ? selectedChat.name
                              : selectedChat.users.find(u=>u._id!==userId).name}
                          </h3>
                          <p className="modern-chat-header-status">Online</p>
                        </div>
                      </div>
                      <button className="modern-info-btn" onClick={()=>setShowInfoSidebar(s=>!s)}>i</button>
                    </div>

                    <div className="modern-chat-messages">
                      {messages.map(msg => {
                        const counts = msg.reactions.reduce((acc,r)=>{ acc[r.emoji]=(acc[r.emoji]||0)+1; return acc; }, {});
                        return (
                          <div key={msg._id} className={`modern-message-wrapper ${msg.isOwn?'own':'other'}`}>
                            <div className={`modern-message ${msg.isOwn?'own':'other'}`}>
                              <button className="reaction-add-btn" onClick={()=>setReactionPickerMsg(msg)}>+</button>
                              <div className="modern-message-content">
                                {msg.content}
                                {!msg.isOwn && <FaPaperPlane className="received-tick" />}
                                {msg.isOwn && msg.seen?.length>0 && <FaPaperPlane className="message-tick" />}
                              </div>
                              <div className="modern-message-time">{formatDateTime(msg.timestamp)}</div>
                              <div className="reactions-bar">
                                {Object.entries(counts).map(([e,c])=>(
                                  <button key={e} className="reaction-pill" onClick={()=>toggleReaction(msg,e)}>
                                    {e}{c>1?` ${c}`:''}
                                  </button>
                                ))}
                              </div>
                              {reactionPickerMsg?._id===msg._id && (
                                <div className="reaction-picker-overlay">
                                  {['👍','❤️','😂','😮','😢','👎'].map(e=>(
                                    <button key={e} className="reaction-btn" onClick={()=>toggleReaction(msg,e)}>{e}</button>
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

                    <div className="modern-message-input-container">
                      <div className="modern-input-wrapper">
                        <label className="modern-attach-btn">
                          <img src={require('../../assets/images/attach.png')} alt="attach" className="attach-icon"/>
                          <input type="file" hidden/>
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
                              <EmojiPicker onEmojiClick={(_,d)=>setNewMessage(m=>m+d.emoji)} height={360} width={300} />
                            </div>
                          )}
                        </div>
                        <button className="modern-send-btn" onClick={sendMessage} disabled={!newMessage.trim()}>
                          <FaPaperPlane/>
                        </button>
                      </div>
                    </div>
                  </>
              }
            </div>

            {selectedChat && showInfoSidebar && (
              <div className="modern-contact-info">
                <h3>Contact Info</h3>
                {selectedChat.isGroup ? (
                  <p><strong>Members:</strong> {selectedChat.users.map(u=>u.name).join(', ')}</p>
                ) : (
                  <>
                    <div><strong>Name:</strong> {selectedChat.users.find(u=>u._id!==userId).name}</div>
                    <div><strong>Email:</strong> {selectedChat.users.find(u=>u._id!==userId).email}</div>
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

export default PicChat;