// src/components/ItChat.jsx
import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate, useParams }       from 'react-router-dom';
import { FaPaperPlane, FaUsers, FaCheck }     from 'react-icons/fa';
import EmojiPicker                            from 'emoji-picker-react';
import api                                    from '../../api/axiosInstance';
import attachIcon                             from '../../assets/images/attach.png';
import { io }                                 from 'socket.io-client';
import '../style/it_style/ItChat.css';

const SOCKET_SERVER_URL = process.env.REACT_APP_SOCKET_URL || '/';

const ItChat = () => {
  const navigate      = useNavigate();
  const { chatId }    = useParams();
  const token         = localStorage.getItem('token');
  const user          = JSON.parse(localStorage.getItem('user') || '{}');
  const userId        = user._id;
  const headers       = { Authorization: `Bearer ${token}` };
  const socket        = useRef();

  // Sidebar / search
  const [chatList, setChatList]           = useState([]);
  const [searchQuery, setSearchQuery]     = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [allUsers, setAllUsers] = useState([]);

  // Conversation
  const [selectedChat, setSelectedChat]      = useState(null);
  const [messages, setMessages]              = useState([]); 
  const [newMessage, setNewMessage]          = useState('');
  const [tick, setTick]                      = useState(0);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Group modal
  const [showGroupModal, setShowGroupModal]   = useState(false);
  const [groupName, setGroupName]             = useState('');
  const [availableUsers, setAvailableUsers]   = useState([]);
  const [filteredUsers, setFilteredUsers]     = useState([]);
  const [userSearch, setUserSearch]           = useState('');
  const [selectedUsers, setSelectedUsers]     = useState([]);

  // UI toggles
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [showInfoSidebar, setShowInfoSidebar] = useState(false);
  const [reactionPickerMsg, setReactionPickerMsg] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker]     = useState(false);

  // scroll anchor
  const messagesEndRef = useRef(null);

  // Helper
  const getDisplayName = u => {
    if (!u) return '';
    if (u.name) return u.name;
    if (u.firstname || u.lastname) {
      return `${u.firstname || ''} ${u.lastname || ''}`.trim();
    }
    return u.email || '';
  };

  // ─── 1) Socket.IO setup ─────────────────────────────────────
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
      // if open chat, bump & mark seen
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
            ? { ...m, seen: [...(m.seen||[]), { userId: seenBy, timestamp }] }
            : m
        )
      );
    });

    socket.current.on('chatUpdated', ({ chatId: cId, lastMessage }) => {
      setChatList(list =>
        list.map(c => (c._id === cId ? { ...c, lastMessage } : c))
      );
    });

    socket.current.on('groupCreated', group => {
      setChatList(l => [group, ...l]);
    });
    socket.current.on('groupJoined', group => {
      setChatList(l => [group, ...l.filter(c => c._id !== group._id)]);
    });

    return () => socket.current.disconnect();
  }, [token, selectedChat, userId]);

  // ─── 2) Auth guard ──────────────────────────────────────────
  useEffect(() => {
    if (!token || !userId) navigate('/');
  }, [token, userId, navigate]);

  // ─── 3) Fetch chats list ────────────────────────────────────
  useEffect(() => {
    if (!token) return; // prevent fetch if not authenticated

    (async () => {
      try {
        const { data } = await api.get('/chats', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setChatList(data);
      } catch {
        setChatList([]);
      }
    })();
  }, [tick, token]);

  // ─── 4) Auto‑open based on URL ──────────────────────────────
  useEffect(() => {
    if (chatId && chatList.length) {
      const c = chatList.find(ch => ch._id === chatId);
      if (c) {
        setSelectedChat(c);
        setTick(t => t + 1);
      }
    }
  }, [chatId, chatList]);

  // ─── 5) Join room & fetch messages ──────────────────────────
  useEffect(() => {
    if (!selectedChat) return;
    socket.current.emit('joinChat', selectedChat._id);

    (async () => {
      try {
        setLoadingMessages(true);
        const { data } = await api.get(
          `/messages/${selectedChat._id}`,
          { headers }
        );
        // normalize fields: `message`→`content`, `createdAt`→`timestamp`
        const norm = data.map(m => ({
          _id: m._id,
          content: m.message,
          timestamp: m.createdAt,
          isOwn: m.senderId === userId,
          reactions: m.reactions || [],
          seen: m.seen || []
        }));
        setMessages(norm);
        setLoadingMessages(false);

        // mark all incoming as seen
        norm.filter(m => !m.isOwn).forEach(m =>
          socket.current.emit('messageSeen', {
            messageId: m._id,
            userId
          })
        );
      } catch (e) {
        console.error('fetchMessages error', e);
        setLoadingMessages(false);
      }
    })();
  }, [selectedChat, userId, tick, headers]);

  // ─── 6) Sidebar “search chats or users” ─────────────────────
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
  }, [searchQuery, chatList, userId, headers]);

  // ─── 7) Load users for group modal (first 5) ────────────────
  useEffect(() => {
    if (!showGroupModal) return;
    (async () => {
      try {
        const { data } = await api.get(`/users?limit=5`, { headers });
        // remove ourselves
        setAvailableUsers(data.filter(u => u._id !== userId));
        setFilteredUsers(data.filter(u => u._id !== userId));
      } catch {
        setAvailableUsers([]);
        setFilteredUsers([]);
      }
    })();
  }, [showGroupModal, headers, userId]);

  // ─── 8) Debounced “search for users” inside group modal ─────
  useEffect(() => {
    if (!showGroupModal) return;
    const handler = setTimeout(async () => {
      const q = userSearch.trim();
      if (!q) {
        setFilteredUsers(availableUsers);
        return;
      }
      try {
        const { data } = await api.get(
          `/users/search?query=${encodeURIComponent(q)}`,
          { headers }
        );
        setFilteredUsers(data.filter(u => u._id !== userId));
      } catch {
        setFilteredUsers([]);
      }
    }, 300);
    return () => clearTimeout(handler);
  }, [userSearch, showGroupModal, availableUsers, headers, userId]);

    // load the master user list for Info‐Sidebar name lookups
  useEffect(() => {
    api.get('/users', { headers })
       .then(r => setAllUsers(r.data))
       .catch(() => setAllUsers([]));
  }, [headers]);

  // ─── Handlers ───────────────────────────────────────────────
  const handleUserSearch = e => setUserSearch(e.target.value);

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
    navigate(`/am/chat/${chatToOpen._id}`);
  };

  // Copy join code to clipboard
  const copyJoinCode = () => {
    navigator.clipboard.writeText(selectedChat.joinCode)
      .then(() => alert('Join code copied!'))
      .catch(() => alert('Failed to copy'));
  };

  // Remove a member (creator only)
  const handleRemoveMember = async memberId => {
    try {
      await api.post(
        `/chats/${selectedChat._id}/remove-member`,
        { memberId },
        { headers }
      );
      // drop from local state
      setSelectedChat(sc => ({
        ...sc,
        users: sc.users.filter(u => u._id !== memberId)
      }));
      // also update sidebar list
      setChatList(cl =>
        cl.map(c =>
          c._id === selectedChat._id
            ? { ...c, users: c.users.filter(u => u._id !== memberId) }
            : c
        )
      );
    } catch (err) {
      console.error(err);
      alert('Failed to remove member');
    }
  };

  // Stub for rename — you can replace the prompt with a nicer modal
  const handleRenameGroup = async () => {
    const newName = prompt('Enter new group name', selectedChat.name);
    if (!newName || newName === selectedChat.name) return;
    try {
      const { data } = await api.put(
        `/chats/${selectedChat._id}`,
        { name: newName },
        { headers }
      );
      setSelectedChat(data);
      setChatList(cl =>
        cl.map(c => (c._id === data._id ? data : c))
      );
    } catch (err) {
      console.error(err);
      alert('Failed to rename group');
    }
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
    setChatList(l => [newChat, ...l]);
    socket.current.emit('joinChat', newChat._id);
    socket.current.emit('groupCreated', newChat);
    setShowGroupModal(false);
    setGroupName('');
    setUserSearch('');
    setSelectedUsers([]);
    setSelectedChat(newChat);
    setTick(t => t + 1);
    navigate(`/am/chat/${newChat._id}`);
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

  const handleKeyPress = e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
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
    new Date(ts).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });

  const handleLogout = () => {
    localStorage.clear();
    navigate('/');
  };

  const activeList = searchQuery.trim() ? searchResults : chatList;

    const renderSidebarItem = item => {
    const isUser = item.type === 'user';
    const isGroup = item.isGroup;
    let name = '';
    let preview = '';
    let timeStr = '';
    let tickMark = false;
    let bold = false;

    if (isUser) {
      name = getDisplayName(item);
      preview = 'Start a new chat';
    } else {
      const other = isGroup ? null : item.users.find(u => u._id !== userId) || {};
      name = isGroup ? item.name : getDisplayName(other);
      preview = (item.lastMessage?.content || '').slice(0, 30) || 'No messages';
      timeStr = item.lastMessage?.timestamp ? formatDateTime(item.lastMessage.timestamp) : '';

      if (!isGroup && item.lastMessage) {
        const seen = item.lastMessage.seen || [];
        if (item.lastMessage.sender === userId) {
          tickMark = seen.some(s => s.userId === other._id);
        } else {
          bold = !seen.some(s => s.userId === userId);
        }
      }
    }

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
          <div className="modern-chat-preview">
            <span className={bold ? 'unread' : ''}>{preview}</span>
            {tickMark && <span className="sidebar-tick">✓</span>}
          </div>
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
            <div className="user-list" style={{ display:'flex', flexDirection:'column' }}>
              {filteredUsers.map(u => (
                <label key={u._id} className="user-item" style={{ margin:'4px 0' }}>
                  <input
                    type="checkbox"
                    checked={selectedUsers.includes(u._id)}
                    onChange={() => toggleSelectUser(u._id)}
                    style={{ marginRight:8 }}
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
          <Link to="/it"               className="nav-link">Dashboard</Link>
          <Link to="/it/chat"          className="nav-link">Chat</Link>
          <Link to="/it/material-list" className="nav-link">Materials</Link>
          <Link to="/it/manpower-list" className="nav-link">Manpower</Link>
          <Link to="/it/auditlogs"     className="nav-link">Audit Logs</Link>
        </nav>
        <div className="profile-menu-container-IT">
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
                           ? <FaUsers/>
                           : getDisplayName(
                               selectedChat.users.find(u => u._id !== userId)
                             ).charAt(0).toUpperCase()
                         }
                       </div>
                       <div className="modern-chat-header-info">
                         <h3>
                           {selectedChat.isGroup
                             ? selectedChat.name
                             : getDisplayName(
                                 selectedChat.users.find(u => u._id !== userId)
                               )}
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
                     {loadingMessages ? (
                       <div className="messages-loading">Loading messages…</div>
                     ) : (
                       messages.map((msg, idx) => {
                         const counts = msg.reactions.reduce((a,r) => {
                           a[r.emoji] = (a[r.emoji]||0) + 1;
                           return a;
                         }, {});
                         const isLastOwn = msg.isOwn && idx === messages.length - 1;
                         const seenByRecipient = isLastOwn && msg.seen?.length > 0;
                         return (
                           <div
                             key={msg._id}
                             className={`modern-message-wrapper ${
                               msg.isOwn ? 'own' : 'other'
                             }`}
                           >
                             <div className={`modern-message ${
                               msg.isOwn ? 'own' : 'other'
                             }`}>
                               <button
                                 className="reaction-add-btn"
                                 onClick={() => setReactionPickerMsg(msg)}
                               >+</button>
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
                                 {Object.entries(counts).map(([e,c]) => (
                                   <button
                                     key={e}
                                     className="reaction-pill"
                                     onClick={() => toggleReaction(msg, e)}
                                   >
                                     {e}{c>1?` ${c}`:''}
                                   </button>
                                 ))}
                               </div>
                               {reactionPickerMsg?._id===msg._id && (
                                 <div className="reaction-picker-overlay">
                                   {['👍','❤️','😂','😮','😢','👎'].map(em => (
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
                       })
                     )}
                     <div ref={messagesEndRef}/>
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
                         <FaPaperPlane/>
                       </button>
                     </div>
                   </div>
                 </>
               )}
             </div>
             {/* Info Sidebar */}
             {showInfoSidebar && selectedChat && (
               <div
                 className="modern-contact-info"
                 style={{
                   display: 'flex',
                   flexDirection: 'column',
                   padding: 16,
                   width: 260
                 }}
               >
                 <h3>Details</h3>
                 {selectedChat.isGroup ? (
                   <>
                     <p><strong>Members:</strong></p>
                     <ul
                       style={{
                         listStyle: 'none',
                         padding: 0,
                         margin: 0,
                         flexGrow: 1,
                         overflowY: 'auto'
                       }}
                     >
                       {selectedChat.users.map(userIdInGroup => {
                       const member = allUsers.find(u => u._id === userIdInGroup.toString());
                         return (
                           <li
                             key={userIdInGroup.toString()}
                             style={{
                               display: 'flex',
                               justifyContent: 'space-between',
                               alignItems: 'center',
                               marginBottom: 8
                             }}
                           >
                             <span>
                               {member
                                 ? getDisplayName(member)
                                 : userIdInGroup.toString().slice(-6) /* fallback */}
                             </span>
                             { /* only show Remove if I'm the creator AND not myself */ }
                             {selectedChat.creator === user._id &&
                             userIdInGroup.toString() !== user._id && (
                               <button
                                 onClick={() => handleRemoveMember(userIdInGroup)}
                                 style={{
                                   border: '1px solid #e74c3c',
                                   background: 'transparent',
                                   color: '#e74c3c',
                                   padding: '4px 8px',
                                   borderRadius: 4,
                                   cursor: 'pointer',
                                   fontSize: '0.85rem'
                                 }}
                               >
                                 Remove
                               </button>
                             )}
                           </li>
                         );
                       })}
                     </ul>
 
                     <div style={{ marginTop: 16 }}>
                       <p style={{ margin: '8px 0' }}>
                         <strong>Join Code:</strong> {selectedChat.joinCode}
                         <button
                           onClick={copyJoinCode}
                           style={{
                             marginLeft: 8,
                             padding: '4px 8px',
                             fontSize: '0.85rem',
                             border: '1px solid #007bff',
                             background: '#fff',
                             color: '#007bff',
                             borderRadius: 4,
                             cursor: 'pointer'
                           }}
                         >
                           Copy
                         </button>
                       </p>
                     </div>
 
                     {selectedChat.creator === user._id && (
                       <button
                         onClick={handleRenameGroup}
                         style={{
                           width: '100%',
                           padding: '8px 0',
                           marginTop: 8,
                           fontSize: '0.9rem',
                           background: '#007bff',
                           color: '#fff',
                           border: 'none',
                           borderRadius: 4,
                           cursor: 'pointer'
                         }}
                       >
                         Rename Group
                       </button>
                     )}
                   </>
                 ) : (
                   <>
                     <div style={{ marginBottom: 8 }}>
                       <strong>Name:</strong>{' '}
                       {getDisplayName(
                         selectedChat.users.find(u => u._id !== userId)
                       )}
                     </div>
                     <div style={{ marginBottom: 16 }}>
                       <strong>Email:</strong>{' '}
                       {
                         selectedChat.users
                           .find(u => u._id !== userId)
                           ?.email
                       }
                     </div>
                   </>
                 )}
 
                 <button
                   onClick={() => setShowInfoSidebar(false)}
                   style={{
                     width: '100%',
                     padding: '8px 0',
                     fontSize: '0.9rem',
                     background: '#6c757d',
                     color: '#fff',
                     border: 'none',
                     borderRadius: 4,
                     cursor: 'pointer',
                     marginTop: 12
                   }}
                 >
                   Close
                 </button>
               </div>
             )}
           </div>
         </div>
       </div>
     </div>
   );
 };

export default ItChat;