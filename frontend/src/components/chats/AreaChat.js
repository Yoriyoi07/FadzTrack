import React, { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { FaUsers, FaCheck, FaPaperPlane } from 'react-icons/fa';
import EmojiPicker from 'emoji-picker-react';
import api from '../../api/axiosInstance';
import logo from '../../assets/images/FadzLogo1.png';
import attachIcon from '../../assets/images/attach.png';
import '../style/am_style/AreaChat.css';

const SOCKET_SERVER_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';

export default function AreaChat() {
  const navigate   = useNavigate();
  const { chatId } = useParams();

  const token  = localStorage.getItem('token');
  const user   = JSON.parse(localStorage.getItem('user') || '{}');
  const userId = user?.id || user?._id; // supports either shape

  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const socket  = useRef(null);

  // sidebar / search
  const [chatList, setChatList]               = useState([]);
  const [searchQuery, setSearchQuery]         = useState('');
  const [searchResults, setSearchResults]     = useState([]);
  const [allUsers, setAllUsers]               = useState([]);

  // conversation
  const [selectedChat, setSelectedChat]       = useState(null);
  const [messages, setMessages]               = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [newMessage, setNewMessage]           = useState('');

  // group modal
  const [showGroupModal, setShowGroupModal]   = useState(false);
  const [groupName, setGroupName]             = useState('');
  const [availableUsers, setAvailableUsers]   = useState([]);
  const [filteredUsers, setFilteredUsers]     = useState([]);
  const [userSearch, setUserSearch]           = useState('');
  const [selectedUsers, setSelectedUsers]     = useState([]);

  // ui toggles
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [showInfoSidebar, setShowInfoSidebar] = useState(false);
  const [reactionPickerMsg, setReactionPickerMsg] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const messagesEndRef = useRef(null);

  const selectedChatIdRef = useRef(null);
  useEffect(() => {
    selectedChatIdRef.current = selectedChat?._id || null;
  }, [selectedChat?._id]);

  const getDisplayName = (u) => {
    if (!u) return '';
    if (u.name) return u.name;
    if (u.firstname || u.lastname) return `${u.firstname || ''} ${u.lastname || ''}`.trim();
    return u.email || '';
  };
  const formatTime = (ts) =>
    new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  /* --------------------------- Socket connection -------------------------- */
  useEffect(() => {
    if (!userId) return;

    socket.current = io(SOCKET_SERVER_URL, {
      transports: ['websocket'],
      withCredentials: true,
      auth: { userId }
    });

    const onReceive = (msg) => {
      // update sidebar preview
      setChatList((list) =>
        list.map((c) =>
          c._id === msg.conversation
            ? { ...c, lastMessage: { content: msg.content ?? msg.fileUrl ?? '', timestamp: msg.timestamp } }
            : c
        )
      );

      if (selectedChatIdRef.current === msg.conversation) {
        const incomingText = msg.content ?? msg.fileUrl ?? '';

        setMessages((ms) => {
          // avoid duplicates if real server msg arrives after optimistic
          if (ms.some((m) => m._id === msg._id)) return ms;

          const last = ms[ms.length - 1];
          if (
            msg.sender === userId &&
            last &&
            last.isOwn &&
            typeof last._id === 'string' &&
            last._id.startsWith('tmp-') &&
            (last.content ?? '') === incomingText
          ) {
            const updated = { ...last, _id: msg._id, timestamp: msg.timestamp, reactions: [], seen: [] };
            return [...ms.slice(0, -1), updated];
          }

          return [
            ...ms,
            {
              _id: msg._id,
              content: incomingText,
              timestamp: msg.timestamp,
              isOwn: msg.sender === userId,
              reactions: [],
              seen: [],
            },
          ];
        });

        // mark as seen for incoming (not mine)
        if (msg.sender !== userId) {
          // socket path
          socket.current.emit('messageSeen', { messageId: msg._id, userId });
          // REST path (reliable persistence)
          api.post(`/messages/${msg._id}/seen`, { userId }, { headers }).catch(() => {});
        }
      }
    };

    const onSeen = ({ messageId, userId: seenBy, timestamp }) => {
      setMessages((ms) =>
        ms.map((m) => (m._id === messageId ? { ...m, seen: [...(m.seen || []), { userId: seenBy, timestamp }] } : m))
      );
    };

    const onChatUpdated = ({ chatId: cId, lastMessage }) => {
      setChatList((list) => list.map((c) => (c._id === cId ? { ...c, lastMessage } : c)));
    };

    const onReaction = ({ messageId, reactions }) => {
      setMessages((ms) => ms.map((m) => (m._id === messageId ? { ...m, reactions } : m)));
    };

    const onGroupCreated = (group) => setChatList((l) => [group, ...l]);
    const onGroupJoined  = (group) => setChatList((l) => [group, ...l.filter((c) => c._id !== group._id)]);

    socket.current.on('receiveMessage', onReceive);
    socket.current.on('messageSeen', onSeen);
    socket.current.on('chatUpdated', onChatUpdated);
    socket.current.on('messageReaction', onReaction);
    socket.current.on('groupCreated', onGroupCreated);
    socket.current.on('groupJoined', onGroupJoined);

    return () => {
      socket.current.off('receiveMessage', onReceive);
      socket.current.off('messageSeen', onSeen);
      socket.current.off('chatUpdated', onChatUpdated);
      socket.current.off('messageReaction', onReaction);
      socket.current.off('groupCreated', onGroupCreated);
      socket.current.off('groupJoined', onGroupJoined);
      socket.current.disconnect();
    };
  }, [userId]);

  /* ------------------------------ Auth guard ----------------------------- */
  useEffect(() => {
    if (!token || !userId) navigate('/');
  }, [token, userId, navigate]);

  /* ------------------------------- Chats list ---------------------------- */
  const reloadChats = async () => {
    try {
      const { data } = await api.get('/chats', { headers });
      setChatList(data);
    } catch {
      setChatList([]);
    }
  };
  useEffect(() => { if (token) reloadChats(); }, [token, headers]);

  /* ------------------------ Open chat from router param ------------------ */
  useEffect(() => {
    if (!chatId || chatList.length === 0) return;
    const c = chatList.find((ch) => ch._id === chatId);
    if (c) setSelectedChat(c);
  }, [chatId, chatList]);

  /* ---------------- Join room & fetch conversation on change ------------- */
  useEffect(() => {
    if (!selectedChat) return;

    socket.current.emit('joinChat', selectedChat._id);

    (async () => {
      try {
        setLoadingMessages(true);
        const { data } = await api.get(`/messages/${selectedChat._id}`, { headers });
        const norm = data.map((m) => ({
          _id: m._id,
          content: m.message ?? (m.fileUrl || ''),
          timestamp: m.createdAt,
          isOwn: m.senderId === userId,
          reactions: m.reactions || [],
          seen: m.seen || [],
        }));
        setMessages(norm);

        // mark all incoming as seen (socket + REST)
        await Promise.all(
          norm.filter((m) => !m.isOwn)
              .map((m) => api.post(`/messages/${m._id}/seen`, { userId }, { headers }).catch(() => {}))
        );
        norm.filter((m) => !m.isOwn)
            .forEach((m) => socket.current.emit('messageSeen', { messageId: m._id, userId }));
      } finally {
        setLoadingMessages(false);
      }
    })();
  }, [selectedChat?._id, userId, headers]);

  /* --------------------------- Search (debounced) ------------------------ */
  useEffect(() => {
    const id = setTimeout(async () => {
      const q = searchQuery.trim().toLowerCase();
      if (!q) return setSearchResults([]);

      try {
        const { data: users } = await api.get(`/users/search?query=${encodeURIComponent(q)}`, { headers });

        const matchedChats = chatList.filter((c) => {
          if (c.isGroup) return (c.name || '').toLowerCase().includes(q);
          const other = c.users.find((u) => u._id !== userId) || {};
          return getDisplayName(other).toLowerCase().includes(q);
        });

        const newUsers = users.filter((u) => !chatList.some((c) => c.users.some((x) => x._id === u._id)));
        setSearchResults([...matchedChats, ...newUsers.map((u) => ({ ...u, type: 'user' }))]);
      } catch {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(id);
  }, [searchQuery, chatList, userId, headers]);

  /* --------------------------- Group modal data -------------------------- */
  useEffect(() => {
    if (!showGroupModal) return;
    (async () => {
      try {
        const { data } = await api.get('/users?limit=5', { headers });
        const list = data.filter((u) => u._id !== userId);
        setAvailableUsers(list);
        setFilteredUsers(list);
      } catch {
        setAvailableUsers([]); setFilteredUsers([]);
      }
    })();
  }, [showGroupModal, headers, userId]);

  useEffect(() => {
    if (!showGroupModal) return;
    const id = setTimeout(async () => {
      const q = userSearch.trim();
      if (!q) return setFilteredUsers(availableUsers);
      try {
        const { data } = await api.get(`/users/search?query=${encodeURIComponent(q)}`, { headers });
        setFilteredUsers(data.filter((u) => u._id !== userId));
      } catch {
        setFilteredUsers([]);
      }
    }, 300);
    return () => clearTimeout(id);
  }, [userSearch, showGroupModal, availableUsers, headers, userId]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/users', { headers });
        setAllUsers(data);
      } catch {
        setAllUsers([]);
      }
    })();
  }, [headers]);

  /* -------------------------------- Actions ------------------------------ */
  const handleUserSearch = (e) => setUserSearch(e.target.value);

  const openChat = async (item) => {
    let chatToOpen = item;
    if (item.type === 'user') {
      const { data: oneToOne } = await api.post('/chats', { users: [userId, item._id] }, { headers });
      chatToOpen = oneToOne;
      await reloadChats();
    }
    setSelectedChat(chatToOpen);
    setSearchQuery('');
    setSearchResults([]);
    navigate(`/am/chat/${chatToOpen._id}`);
  };

  const copyJoinCode = () => {
    if (!selectedChat?.joinCode) return;
    navigator.clipboard.writeText(selectedChat.joinCode).then(() => alert('Join code copied!'));
  };

  const handleRemoveMember = async (memberId) => {
    try {
      await api.post(`/chats/${selectedChat._id}/remove-member`, { memberId }, { headers });
      setSelectedChat((sc) => ({ ...sc, users: sc.users.filter((u) => u._id !== memberId) }));
      await reloadChats();
    } catch {
      alert('Failed to remove member');
    }
  };

  const handleRenameGroup = async () => {
    const newName = prompt('Enter new group name', selectedChat.name);
    if (!newName || newName === selectedChat.name) return;
    try {
      const { data } = await api.put(`/chats/${selectedChat._id}`, { name: newName }, { headers });
      setSelectedChat(data);
      await reloadChats();
    } catch {
      alert('Failed to rename group');
    }
  };

  const toggleSelectUser = (id) =>
    setSelectedUsers((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const createGroup = async () => {
    const members = [userId, ...selectedUsers];
    const { data: newChat } = await api.post('/chats', { name: groupName, users: members, isGroup: true }, { headers });
    setShowGroupModal(false);
    setGroupName(''); setUserSearch(''); setSelectedUsers([]);
    await reloadChats();
    setSelectedChat(newChat);
    navigate(`/am/chat/${newChat._id}`);
  };

  // optimistic send; server broadcast replaces temp bubble
  const sendMessage = async () => {
    const content = (newMessage || '').trim();
    if (!content || !selectedChat) return;

    const tempId = `tmp-${Date.now()}`;
    setMessages((ms) => [
      ...ms,
      { _id: tempId, content, timestamp: Date.now(), isOwn: true, reactions: [], seen: [] },
    ]);
    setNewMessage('');

    try {
      await api.post('/messages', { sender: userId, conversation: selectedChat._id, content, type: 'text' }, { headers });
    } catch {
      // rollback temp bubble if request fails
      setMessages((ms) => ms.filter((m) => m._id !== tempId));
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const toggleReaction = async (msg, emoji) => {
    const uid = (r) => (typeof r.userId === 'string' ? r.userId : r.userId?._id);
    const mine = msg.reactions.find((r) => uid(r) === userId);

    if (mine && mine.emoji === emoji) {
      await api.delete(`/messages/${msg._id}/reactions`, { data: { userId, emoji }, headers });
      setMessages((ms) =>
        ms.map((m) =>
          m._id === msg._id ? { ...m, reactions: m.reactions.filter((r) => uid(r) !== userId) } : m
        )
      );
    } else {
      if (mine) await api.delete(`/messages/${msg._id}/reactions`, { data: { userId, emoji: mine.emoji }, headers });
      await api.post(`/messages/${msg._id}/reactions`, { userId, emoji }, { headers });
      setMessages((ms) =>
        ms.map((m) =>
          m._id === msg._id
            ? { ...m, reactions: [...m.reactions.filter((r) => uid(r) !== userId), { userId, emoji }] }
            : m
        )
      );
    }
    setReactionPickerMsg(null);
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/');
  };

  // Emoji picker handler (works for v3 and v4 of emoji-picker-react)
  const handleEmojiClick = (arg1, arg2) => {
    const data = arg1?.emoji ? arg1 : arg2;        // v4 sends (emojiData, event), v3 sends (event, emojiObject)
    const picked = data?.emoji || data?.native || '';
    if (picked) setNewMessage((m) => (m || '') + picked);
  };

  const activeList = searchQuery.trim() ? searchResults : chatList;

  const renderSidebarItem = (item) => {
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
      const other = isGroup ? null : item.users.find((u) => u._id !== userId) || {};
      name = isGroup ? item.name : getDisplayName(other);
      preview = (item.lastMessage?.content || '').slice(0, 30) || 'No messages';
      timeStr = item.lastMessage?.timestamp ? formatTime(item.lastMessage.timestamp) : '';

      // optional: if your lastMessage embeds sender/seen metadata
      if (!isGroup && item.lastMessage) {
        const seen = item.lastMessage.seen || [];
        if (item.lastMessage.sender === userId) {
          tickMark = seen.some((s) => s.userId === other._id);
        } else {
          bold = !seen.some((s) => s.userId === userId);
        }
      }
    }

    return (
      <div
        key={item._id}
        className={`modern-chat-item ${selectedChat?._id === item._id ? 'active' : ''}`}
        onClick={() => openChat(item)}
      >
        <div className="modern-chat-avatar">{isGroup ? <FaUsers /> : name.charAt(0).toUpperCase()}</div>
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
      {/* Group Modal */}
      {showGroupModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Create Group Chat</h3>
            <label>Group Name</label>
            <input className="modal-input" placeholder="Enter a group name" value={groupName} onChange={(e) => setGroupName(e.target.value)} />
            <label>Search users</label>
            <input className="modal-input" placeholder="Search for users" value={userSearch} onChange={e => setUserSearch(e.target.value)} />
            <div className="user-list" style={{ display: 'flex', flexDirection: 'column' }}>
              {filteredUsers.map((u) => (
                <label key={u._id} className="user-item" style={{ margin: '4px 0' }}>
                  <input
                    type="checkbox"
                    checked={selectedUsers.includes(u._id)}
                    onChange={() => setSelectedUsers(s => s.includes(u._id) ? s.filter(x => x !== u._id) : [...s, u._id])}
                    style={{ marginRight: 8 }}
                  />
                  {getDisplayName(u)}
                </label>
              ))}
            </div>
            <div className="modal-buttons">
              <button className="btn-create" onClick={createGroup} disabled={!groupName || !selectedUsers.length}>Create</button>
              <button className="btn-cancel" onClick={() => setShowGroupModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="header">
        <div className="logo-container">
          <img src={logo} alt="FadzTrack Logo" className="logo-img" />
          <h1 className="brand-name">FadzTrack</h1>
        </div>
        <nav className="nav-menu">
          <Link to="/am" className="nav-link">Dashboard</Link>
          <Link to="/am/chat" className="nav-link">Chat</Link>
          <Link to="/am/matreq" className="nav-link">Material</Link>
          <Link to="/am/manpower-requests" className="nav-link">Manpower</Link>
          <Link to="/am/viewproj" className="nav-link">Projects</Link>
          <Link to="/logs" className="nav-link">Logs</Link>
          <Link to="/am/progress-report/:id" className="nav-link">Reports</Link>
        </nav>
        <div className="profile-menu-container">
          <div className="profile-circle" onClick={() => setProfileMenuOpen((p) => !p)}>
            {user.name?.charAt(0).toUpperCase() || 'Z'}
          </div>
          {profileMenuOpen && (
            <div className="profile-menu">
              <button onClick={() => { localStorage.clear(); navigate('/'); }}>Logout</button>
            </div>
          )}
        </div>
      </header>

      {/* Main */}
      <div className="pic-chat-content">
        {/* Sidebar */}
        <div className="modern-sidebar">
          <div className="modern-sidebar-header">
            <div className="header-top">
              <h2>Chats</h2>
              <button className="group-chat-btn modern-new-group-btn" onClick={() => setShowGroupModal(true)}>+ New Group</button>
            </div>
            <input className="modern-search-input" placeholder="Search chats or users" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
          <div className="modern-chat-list">
            {(searchQuery.trim() ? searchResults : chatList).length === 0 ? (
              <div className="modern-no-chats">No chats found.</div>
            ) : (
              (searchQuery.trim() ? searchResults : chatList).map(renderSidebarItem)
            )}
          </div>
        </div>

        {/* Chat Window */}
        <div className="modern-chat-section">
          <div className="modern-chat-wrapper">
            <div className="modern-chat-main">
              {!selectedChat ? (
                <div className="modern-no-chat-selected">Select a chat to start messaging</div>
              ) : (
                <>
                  {/* Header */}
                  <div className="modern-chat-header">
                    <div className="modern-chat-header-left">
                      <div className="modern-chat-header-avatar">
                        {selectedChat.isGroup ? <FaUsers /> : getDisplayName(selectedChat.users.find((u) => u._id !== userId)).charAt(0).toUpperCase()}
                      </div>
                      <div className="modern-chat-header-info">
                        <h3>
                          {selectedChat.isGroup
                            ? selectedChat.name
                            : getDisplayName(selectedChat.users.find((u) => u._id !== userId))}
                        </h3>
                      </div>
                    </div>
                    <button className="modern-info-btn" onClick={() => setShowInfoSidebar((s) => !s)}>i</button>
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
                        const isLastOwn = msg.isOwn && idx === messages.length - 1;
                        const seenByRecipient = isLastOwn && msg.seen?.length > 0;
                        return (
                          <div key={msg._id} className={`modern-message-wrapper ${msg.isOwn ? 'own' : 'other'}`}>
                            <div className={`modern-message ${msg.isOwn ? 'own' : 'other'}`}>
                              <button className="reaction-add-btn" onClick={() => setReactionPickerMsg(msg)}>+</button>
                              <div className="modern-message-content">
                                {msg.content}
                                {isLastOwn && seenByRecipient && <FaCheck className="message-tick" />}
                              </div>
                              <div className="modern-message-time">{formatTime(msg.timestamp)}</div>
                              <div className="reactions-bar">
                                {Object.entries(counts).map(([e, c]) => (
                                  <button key={e} className="reaction-pill" onClick={() => toggleReaction(msg, e)}>
                                    {e}{c > 1 ? ` ${c}` : ''}
                                  </button>
                                ))}
                              </div>
                              {reactionPickerMsg?._id === msg._id && (
                                <div className="reaction-picker-overlay">
                                  {['👍', '❤️', '😂', '😮', '😢', '👎'].map((em) => (
                                    <button key={em} className="reaction-btn" onClick={() => toggleReaction(msg, em)}>{em}</button>
                                  ))}
                                  <button className="reaction-btn close" onClick={() => setReactionPickerMsg(null)}>×</button>
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
                        <img src={attachIcon} className="attach-icon" alt="attach" />
                        <input type="file" hidden />
                      </label>
                      <input
                        className="modern-chat-input"
                        placeholder="Type your message here"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            sendMessage();
                          }
                        }}
                      />
                      <button className="modern-emoji-btn" onClick={() => setShowEmojiPicker((p) => !p)}>😊</button>
                      {showEmojiPicker && (
                        <div className="modern-emoji-picker">
                          <EmojiPicker onEmojiClick={handleEmojiClick} height={360} width={300} />
                        </div>
                      )}
                      <button className="modern-send-btn" onClick={sendMessage} disabled={!newMessage.trim()}>
                        <FaPaperPlane />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Info Sidebar */}
            {showInfoSidebar && selectedChat && (
              <div className="modern-contact-info" style={{ display: 'flex', flexDirection: 'column', padding: 16, width: 260 }}>
                <h3>Details</h3>
                {selectedChat.isGroup ? (
                  <>
                    <p><strong>Members:</strong></p>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, flexGrow: 1, overflowY: 'auto' }}>
                      {selectedChat.users.map((u) => (
                        <li key={u._id}
                            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <span>{getDisplayName(u)}</span>
                          {selectedChat.creator === user._id && u._id !== user._id && (
                            <button
                              onClick={() => handleRemoveMember(u._id)}
                              style={{ border: '1px solid #e74c3c', background: 'transparent', color: '#e74c3c',
                                       padding: '4px 8px', borderRadius: 4, cursor: 'pointer', fontSize: '0.85rem' }}>
                              Remove
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                    <div style={{ marginTop: 16 }}>
                      <p style={{ margin: '8px 0' }}>
                        <strong>Join Code:</strong> {selectedChat.joinCode}
                        <button
                          onClick={copyJoinCode}
                          style={{ marginLeft: 8, padding: '4px 8px', fontSize: '0.85rem',
                                   border: '1px solid #007bff', background: '#fff', color: '#007bff',
                                   borderRadius: 4, cursor: 'pointer' }}>
                          Copy
                        </button>
                      </p>
                    </div>
                    {selectedChat.creator === user._id && (
                      <button
                        onClick={handleRenameGroup}
                        style={{ width: '100%', padding: '8px 0', marginTop: 8, fontSize: '0.9rem',
                                 background: '#007bff', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
                        Rename Group
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <div style={{ marginBottom: 8 }}>
                      <strong>Name:</strong>{' '}
                      {getDisplayName(selectedChat.users.find((u) => u._id !== userId))}
                    </div>
                    <div style={{ marginBottom: 16 }}>
                      <strong>Email:</strong>{' '}
                      {selectedChat.users.find((u) => u._id !== userId)?.email}
                    </div>
                  </>
                )}
                <button
                  onClick={() => setShowInfoSidebar(false)}
                  style={{ width: '100%', padding: '8px 0', fontSize: '0.9rem',
                           background: '#6c757d', color: '#fff', border: 'none',
                           borderRadius: 4, cursor: 'pointer', marginTop: 12 }}>
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
