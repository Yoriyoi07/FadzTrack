// src/components/PmChat.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FaUsers, FaPaperPlane, FaCheck, FaTachometerAlt, FaComments, FaBoxes, FaEye, FaClipboardList, FaChartBar, FaCalendarAlt, FaUserCircle } from 'react-icons/fa';
import { io } from 'socket.io-client';
import EmojiPicker from 'emoji-picker-react';
import api from '../../api/axiosInstance';
import NotificationBell from '../NotificationBell';
import '../style/pm_style/PmChat.css';

const SOCKET_URL  = process.env.REACT_APP_SOCKET_URL  || '/';
const SOCKET_PATH = process.env.REACT_APP_SOCKET_PATH || '/socket.io';

const PmChat = () => {
  const navigate   = useNavigate();
  const { chatId } = useParams();

  const token  = localStorage.getItem('token');
  const user   = JSON.parse(localStorage.getItem('user') || '{}');
  const userId = user?._id;
  const userName = user?.name || 'Z';
  const userRole = user?.role || '';

  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const socket = useRef(null);
  const selectedChatIdRef = useRef(null);

  // Sidebar
  const [chatList, setChatList] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  // Conversation
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);

  // UI
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showInfoSidebar, setShowInfoSidebar] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [showSeenDetails, setShowSeenDetails] = useState(null);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  // Group modal
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [availableUsers, setAvailableUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);

  // Project (kept)
  const [project, setProject] = useState(null);

  // Chat customization
  const [editingGroupName, setEditingGroupName] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [availableMembers, setAvailableMembers] = useState([]);
  const [selectedNewMembers, setSelectedNewMembers] = useState([]);

  const messagesEndRef = useRef(null);

  // Update header collapse state when chat is selected
  useEffect(() => {
    setIsHeaderCollapsed(!!selectedChat);
  }, [selectedChat]);

  const getDisplayName = (u) => {
    if (!u) return '';
    if (u.name) return u.name;
    if (u.firstname || u.lastname) return `${u.firstname || ''} ${u.lastname || ''}`.trim();
    return u.email || '';
  };
  
  const getSeenDisplayNames = (seenArray) => {
    if (!seenArray || seenArray.length === 0) return [];
    return seenArray.map(seen => {
      const user = chatList.find(chat => 
        chat.users.some(u => u._id === seen.userId)
      )?.users.find(u => u._id === seen.userId);
      return getDisplayName(user);
    }).filter(name => name);
  };
  
  const getGroupSeenDisplay = (seenNames) => {
    if (!seenNames || seenNames.length === 0) return '';
    
    // Get first names only
    const firstNames = seenNames.map(name => name.split(' ')[0]);
    
    if (firstNames.length === 1) {
      return firstNames[0];
    } else if (firstNames.length === 2) {
      return `${firstNames[0]} and ${firstNames[1]}`;
    } else if (firstNames.length === 3) {
      return `${firstNames[0]}, ${firstNames[1]} and ${firstNames[2]}`;
    } else {
      // Show first 2 names + count of others
      const othersCount = firstNames.length - 2;
      return `${firstNames[0]}, ${firstNames[1]} and ${othersCount} others`;
    }
  };
  
  const formatTime = (ts) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // ── Guards
  useEffect(() => {
    if (!token || !userId) navigate('/');
  }, [navigate, token, userId]);

  // ── Single socket connection + stable handlers
  useEffect(() => {
    if (!userId) return;

    // Clean up any existing socket connection
    if (socket.current) {
      socket.current.disconnect();
      socket.current = null;
    }

    socket.current = io(SOCKET_URL, {
      path: SOCKET_PATH,
      withCredentials: true,
      transports: ['websocket', 'polling'],
      auth: { userId },
    });

    console.log('Socket connected for user:', userId);

    const onReceive = (msg) => {
      console.log('Received message:', msg);
      // update sidebar preview
      setChatList((list) =>
        list.map((c) =>
          c._id === msg.conversation
            ? { ...c, lastMessage: { content: msg.content ?? msg.fileUrl ?? '', timestamp: msg.timestamp } }
            : c
        )
      );

      // append to open chat - prevent duplicates and replace temp messages
      if (selectedChatIdRef.current === msg.conversation) {
        setMessages((ms) => {
          // Check if message already exists to prevent duplicates
          const messageExists = ms.some(m => m._id === msg._id);
          if (messageExists) {
            console.log('Message already exists, skipping duplicate:', msg._id);
            return ms; // Don't add duplicate
          }
          
          // Remove any temporary messages with the same content to replace with real message
          const filteredMs = ms.filter(m => !(m._id.startsWith('tmp-') && m.content === msg.content && m.isOwn));
          
          console.log('Adding new message, filtered temp messages:', { newMsg: msg, filteredCount: ms.length - filteredMs.length });
          
          return [
            ...filteredMs,
          {
            _id: msg._id,
            content: msg.content ?? msg.fileUrl ?? '',
            timestamp: msg.timestamp,
            isOwn: msg.sender === userId,
            reactions: [],
            seen: [],
          },
          ];
        });
        
        if (msg.sender !== userId) {
          socket.current.emit('messageSeen', { messageId: msg._id, userId });
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

    socket.current.on('receiveMessage', onReceive);
    socket.current.on('messageSeen', onSeen);
    socket.current.on('chatUpdated', onChatUpdated);
    socket.current.on('messageReaction', onReaction);

    return () => {
      socket.current.off('receiveMessage', onReceive);
      socket.current.off('messageSeen', onSeen);
      socket.current.off('chatUpdated', onChatUpdated);
      socket.current.off('messageReaction', onReaction);
      socket.current.disconnect();
    };
  }, [userId]);

  // keep current chat id for handlers
  useEffect(() => {
    selectedChatIdRef.current = selectedChat?._id || null;
  }, [selectedChat?._id]);

  // Auto-scroll to bottom when messages change or chat is selected
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, selectedChat]);

  // Manual scroll to bottom function
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Handle scroll events to show/hide scroll-to-bottom button
  useEffect(() => {
    const chatMessages = document.querySelector('.modern-chat-messages');
    if (!chatMessages) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = chatMessages;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 20; // Very sensitive threshold
      setShowScrollToBottom(!isNearBottom);
    };

    chatMessages.addEventListener('scroll', handleScroll);
    return () => chatMessages.removeEventListener('scroll', handleScroll);
  }, [selectedChat]);

  // ── Load chats
  const reloadChats = async () => {
    try {
      const { data } = await api.get('/chats', { headers });
      setChatList(data);
    } catch {
      setChatList([]);
    }
  };
  useEffect(() => { if (token) reloadChats(); }, [token, headers]);

  // ── Auto select from URL
  useEffect(() => {
    if (!chatId || chatList.length === 0) return;
    const c = chatList.find((ch) => ch._id === chatId);
    if (c) setSelectedChat(c);
  }, [chatId, chatList]);

  // ── Join + fetch messages when chat changes
  useEffect(() => {
    if (!selectedChat) return;
    socket.current.emit('joinChat', selectedChat._id);

    (async () => {
      try {
        setLoadingMessages(true);
        const { data } = await api.get(`/messages/${selectedChat._id}`, { headers });
        const norm = data.map((m) => ({
          _id: m._id,
          content: m.message ?? m.fileUrl ?? '',
          timestamp: m.createdAt,
          isOwn: m.senderId === userId,
          reactions: m.reactions || [],
          seen: m.seen || [],
        }));
        setMessages(norm);

        // mark incoming seen
        norm.filter((m) => !m.isOwn).forEach((m) => socket.current.emit('messageSeen', { messageId: m._id, userId }));
      } finally {
        setLoadingMessages(false);
        // Scroll to bottom after messages are loaded
        setTimeout(() => scrollToBottom(), 100);
      }
    })();
  }, [selectedChat?._id, userId, headers]);

  // ── Search (debounced)
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

  // ── Project for PM (kept)
  useEffect(() => {
    if (!token || !userId) return;
    (async () => {
      try {
        const { data } = await api.get(`/projects/assigned/projectmanager/${userId}`, { headers });
        setProject(data);
      } catch { setProject(null); }
    })();
  }, [token, userId, headers]);

  // ── Group modal users
  useEffect(() => {
    if (!showGroupModal) return;
    (async () => {
      try {
        const { data } = await api.get('/users?limit=100', { headers });
        setAvailableUsers(data);
        setFilteredUsers(data);
      } catch {
        setAvailableUsers([]); setFilteredUsers([]);
      }
    })();
  }, [showGroupModal, headers]);

  // ── Load available members for adding to group
  useEffect(() => {
    if (showAddMembers && selectedChat?.isGroup) {
      loadAvailableMembers();
    }
  }, [showAddMembers, selectedChat]);

  // ── Actions
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
    navigate(`/pm/chat/${chatToOpen._id}`);
  };

  // POST only; server broadcasts receiveMessage
  const sendMessage = async () => {
    const content = (newMessage || '').trim();
    if (!content || !selectedChat) return;

    console.log('Sending message:', { content, chatId: selectedChat._id, userId });

    // Clear input immediately to prevent double-send
    setNewMessage('');

    // optimistic - use a unique temp ID to prevent duplicates
    const tempId = `tmp-${Date.now()}-${Math.random()}`;
    const tempMessage = { 
      _id: tempId, 
      content, 
      timestamp: Date.now(), 
      isOwn: true, 
      reactions: [], 
      seen: [] 
    };
    
    console.log('Adding temp message:', tempMessage);
    setMessages((ms) => [...ms, tempMessage]);

    try {
      const response = await api.post('/messages', { sender: userId, conversation: selectedChat._id, content, type: 'text' }, { headers });
      console.log('Message sent successfully:', response.data);
    } catch (error) {
      console.error('Failed to send message:', error);
      // Remove temp message on error
      setMessages((ms) => ms.filter((m) => m._id !== tempId));
    }
  };

  const toggleReaction = async (msg, emoji) => {
    const getUid = (r) => (typeof r.userId === 'string' ? r.userId : r.userId?._id);
    const mine = msg.reactions.find((r) => getUid(r) === userId);

    if (mine && mine.emoji === emoji) {
      await api.delete(`/messages/${msg._id}/reactions`, { data: { userId, emoji }, headers });
    } else {
      if (mine) await api.delete(`/messages/${msg._id}/reactions`, { data: { userId, emoji: mine.emoji }, headers });
      await api.post(`/messages/${msg._id}/reactions`, { userId, emoji }, { headers });
    }
    // server emits 'messageReaction' which updates state
  };

  const handleUserSearch = (e) => {
    const q = e.target.value.toLowerCase();
    setUserSearch(q);
    setFilteredUsers(availableUsers.filter((u) => getDisplayName(u).toLowerCase().includes(q)));
  };

  const toggleSelectUser = (id) =>
    setSelectedUsers((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const createGroup = async () => {
    const members = [userId, ...selectedUsers];
    const { data: newChat } = await api.post('/chats', { name: groupName, users: members, isGroup: true }, { headers });
    await reloadChats();
    setShowGroupModal(false);
    setGroupName(''); setUserSearch(''); setSelectedUsers([]);
    setSelectedChat(newChat);
    navigate(`/pm/chat/${newChat._id}`);
  };

  // Chat customization functions
  const startEditGroupName = () => {
    setNewGroupName(selectedChat.name);
    setEditingGroupName(true);
  };

  const saveGroupName = async () => {
    if (!newGroupName.trim() || newGroupName === selectedChat.name) {
      setEditingGroupName(false);
      return;
    }

    try {
      await api.put(`/chats/${selectedChat._id}`, { name: newGroupName.trim() }, { headers });
      setSelectedChat(prev => ({ ...prev, name: newGroupName.trim() }));
      await reloadChats();
      setEditingGroupName(false);
    } catch (error) {
      console.error('Failed to update group name:', error);
    }
  };

  const cancelEditGroupName = () => {
    setEditingGroupName(false);
    setNewGroupName('');
  };

  const loadAvailableMembers = async () => {
    try {
      const { data } = await api.get('/users?limit=100', { headers });
      const currentMemberIds = selectedChat.users.map(u => u._id);
      const available = data.filter(u => !currentMemberIds.includes(u._id));
      setAvailableMembers(available);
      setSelectedNewMembers([]);
    } catch (error) {
      console.error('Failed to load available members:', error);
    }
  };

  const addMembersToGroup = async () => {
    if (selectedNewMembers.length === 0) return;

    try {
      const updatedUsers = [...selectedChat.users.map(u => u._id), ...selectedNewMembers];
      await api.put(`/chats/${selectedChat._id}`, { users: updatedUsers }, { headers });
      
      // Refresh chat data
      await reloadChats();
      const updatedChat = await api.get(`/chats/${selectedChat._id}`, { headers });
      setSelectedChat(updatedChat.data);
      
      setShowAddMembers(false);
      setSelectedNewMembers([]);
    } catch (error) {
      console.error('Failed to add members:', error);
    }
  };

  const removeMemberFromGroup = async (memberId) => {
    if (memberId === userId) return; // Can't remove yourself

    try {
      const updatedUsers = selectedChat.users.filter(u => u._id !== memberId).map(u => u._id);
      await api.put(`/chats/${selectedChat._id}`, { users: updatedUsers }, { headers });
      
      // Refresh chat data
      await reloadChats();
      const updatedChat = await api.get(`/chats/${selectedChat._id}`, { headers });
      setSelectedChat(updatedChat.data);
    } catch (error) {
      console.error('Failed to remove member:', error);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const activeList = searchQuery.trim() ? searchResults : chatList;

  return (
    <div className="pm-chat-wrapper">
      {/* GROUP MODAL */}
      {showGroupModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Create Group Chat</h3>
            <label>Group Name</label>
            <input className="modal-input" placeholder="Enter a group name" value={groupName} onChange={(e) => setGroupName(e.target.value)} />
            <label>Search users</label>
            <input className="modal-input" placeholder="Search for users" value={userSearch} onChange={handleUserSearch} />
            <div className="user-list">
              {filteredUsers.map((u) => (
                <label key={u._id} className="user-item">
                  <input type="checkbox" checked={selectedUsers.includes(u._id)} onChange={() => toggleSelectUser(u._id)} />
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

      {/* Modern Header - Same as PM Dash */}
      <header className={`dashboard-header ${isHeaderCollapsed ? 'collapsed' : ''}`}>
        {/* Top Row: Logo and Profile */}
        <div className="header-top">
          <div className="logo-section">
            <img
              src={require('../../assets/images/FadzLogo1.png')}
              alt="FadzTrack Logo"
              className="header-logo"
            />
            <h1 className="header-brand">FadzTrack</h1>
          </div>
          
          <div className="user-profile" onClick={() => setProfileMenuOpen(!profileMenuOpen)}>
            <div className="profile-avatar">
              <FaUserCircle />
        </div>
            <div className={`profile-info ${isHeaderCollapsed ? 'hidden' : ''}`}>
              <span className="profile-name">{userName}</span>
              <span className="profile-role">{userRole}</span>
          </div>
          {profileMenuOpen && (
              <div className="profile-dropdown">
                <button onClick={handleLogout} className="logout-btn">
                  <span>Logout</span>
                </button>
            </div>
          )}
          </div>
        </div>

        {/* Bottom Row: Navigation and Notifications */}
        <div className="header-bottom">
          <nav className="header-nav">
            <Link to="/pm" className="nav-item">
              <FaTachometerAlt />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Dashboard</span>
            </Link>
            <Link to="/pm/chat" className="nav-item active">
              <FaComments />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Chat</span>
            </Link>
            <Link to="/pm/request/:id" className="nav-item">
              <FaBoxes />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Material</span>
            </Link>
            <Link to="/pm/manpower-list" className="nav-item">
              <FaUsers />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Manpower</span>
            </Link>
            {project && (
              <Link to={`/pm/viewprojects/${project._id || project.id}`} className="nav-item">
                <FaEye />
                <span className={isHeaderCollapsed ? 'hidden' : ''}>View Project</span>
              </Link>
            )}
            <Link to="/pm/daily-logs" className="nav-item">
              <FaClipboardList />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Logs</span>
            </Link>
            {project && (
              <Link to={`/pm/progress-report/${project._id}`} className="nav-item">
                <FaChartBar />
                <span className={isHeaderCollapsed ? 'hidden' : ''}>Reports</span>
              </Link>
            )}
            <Link to="/pm/daily-logs-list" className="nav-item">
              <FaCalendarAlt />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Daily Logs</span>
            </Link>
          </nav>
          
          <NotificationBell />
        </div>
      </header>

      {/* MAIN CHAT INTERFACE */}
      <div className="pm-chat-content">
        {/* SIDEBAR */}
        <div className="modern-sidebar">
          <div className="modern-sidebar-header">
            <div className="header-top">
              <h2>Chats</h2>
              <button className="group-chat-btn modern-new-group-btn" onClick={() => setShowGroupModal(true)}>+ New Group</button>
            </div>
            <input className="modern-search-input" placeholder="Search chats or users" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
          <div className="modern-chat-list">
            {activeList.length === 0 ? (
              <div className="modern-no-chats">No chats found.</div>
            ) : (
              activeList.map((item) => {
                const isUser = item.type === 'user';
                const isGroup = item.isGroup;
                const other = isGroup ? null : item.users?.find((u) => u._id !== userId) || {};
                const name = isUser ? getDisplayName(item) : isGroup ? item.name : getDisplayName(other);
                const preview = item.lastMessage?.content?.slice(0, 30) || 'Start chatting';
                const timeStr = item.lastMessage?.timestamp ? formatTime(item.lastMessage.timestamp) : '';
                return (
                  <div key={item._id} className={`modern-chat-item ${selectedChat?._id === item._id ? 'active' : ''}`} onClick={() => openChat(item)}>
                    <div className="modern-chat-avatar">{isGroup ? <FaUsers /> : name.charAt(0).toUpperCase()}</div>
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
                <div className="modern-no-chat-selected">Select a chat to start messaging</div>
              ) : (
                <>
                  {/* Chat Header */}
                  <div className="modern-chat-header">
                    <div className="modern-chat-header-left">
                      <div className="modern-chat-header-avatar">
                        {selectedChat.isGroup ? <FaUsers /> : getDisplayName(selectedChat.users.find((u) => u._id !== userId)).charAt(0).toUpperCase()}
                      </div>
                      <div className="modern-chat-header-info">
                        <h3>{selectedChat.isGroup ? selectedChat.name : getDisplayName(selectedChat.users.find((u) => u._id !== userId))}</h3>
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
                        const counts = msg.reactions.reduce((a, r) => { a[r.emoji] = (a[r.emoji] || 0) + 1; return a; }, {});
                        const isLastOwn = msg.isOwn && idx === messages.length - 1;
                        const seenByRecipient = isLastOwn && msg.seen?.length > 0;
                        const seenNames = getSeenDisplayNames(msg.seen);
                        const hasSeen = msg.seen && msg.seen.length > 0;
                        
                        // Only show seen indicator if this is the most recent message seen by any user
                        // This prevents showing "Seen by: Gian" on multiple messages when he's seen them all
                        const isMostRecentSeen = hasSeen && (() => {
                          if (!selectedChat.isGroup) {
                            // For DMs, only show on the last message
                            return isLastOwn;
                          } else {
                            // For group chats, check if this is the most recent message seen by any user
                            const currentMessageIndex = idx;
                            const laterMessages = messages.slice(currentMessageIndex + 1);
                            
                            // If any later message has been seen by the same users, don't show seen on this one
                            return !laterMessages.some(laterMsg => {
                              if (!laterMsg.seen || laterMsg.seen.length === 0) return false;
                              
                              // Check if the same users have seen the later message
                              const laterSeenUserIds = laterMsg.seen.map(s => s.userId);
                              const currentSeenUserIds = msg.seen.map(s => s.userId);
                              
                              // If all users who saw this message also saw a later message, don't show seen here
                              return currentSeenUserIds.every(userId => laterSeenUserIds.includes(userId));
                            });
                          }
                        })();
                        
                        return (
                          <div key={msg._id} className={`modern-message-wrapper ${msg.isOwn ? 'own' : 'other'}`}>
                            <div className={`modern-message ${msg.isOwn ? 'own' : 'other'}`}>
                              <div className="modern-message-content">
                                {msg.content}
                                {/* Only show seen indicator on the last message in DMs */}
                                {!selectedChat.isGroup && isLastOwn && seenByRecipient && (
                                  <FaCheck className="message-tick" />
                                )}
                              </div>
                              <div className="modern-message-time">
                                {formatTime(msg.timestamp)}
                                {/* Seen feature - different for DMs vs Group Chats */}
                                {isMostRecentSeen && (
                                  <div className="message-seen-info">
                                    {selectedChat.isGroup ? (
                                      /* Group Chat: Show names of people who have seen it */
                                      <span 
                                        className="seen-indicator group-seen"
                                        onClick={() => setShowSeenDetails(showSeenDetails === msg._id ? null : msg._id)}
                                        title={`Seen by ${seenNames.join(', ')}`}
                                      >
                                        Seen by: {getGroupSeenDisplay(seenNames)}
                                      </span>
                                    ) : (
                                      /* DM: Only show on last message */
                                      <span className="seen-indicator dm-seen">
                                        Seen
                                      </span>
                                    )}
                                    {/* Expandable seen details for group chats */}
                                    {selectedChat.isGroup && showSeenDetails === msg._id && (
                                      <div className="seen-details-tooltip">
                                        <div className="tooltip-header">Seen by:</div>
                                        <div className="seen-users-list">
                                          {seenNames.map((name, index) => (
                                            <div key={index} className="seen-user">
                                              <span className="seen-user-name">{name}</span>
                                              <span className="seen-time">
                                                {formatTime(msg.seen.find(s => 
                                                  getSeenDisplayNames([s])[0] === name
                                                )?.timestamp)}
                                              </span>
                              </div>
                                ))}
                              </div>
                                      </div>
                                    )}
                                </div>
                              )}
                              </div>
                              <div className="reactions-bar">
                                {Object.entries(counts).map(([e, c]) => {
                                  const hasReacted = msg.reactions.some(r => 
                                    (typeof r.userId === 'string' ? r.userId : r.userId?._id) === userId && r.emoji === e
                                  );
                                  return (
                                    <button 
                                      key={e} 
                                      className={`reaction-pill ${hasReacted ? 'reacted' : ''}`} 
                                      onClick={() => toggleReaction(msg, e)}
                                      title={`${e} ${c > 1 ? `(${c} reactions)` : ''}`}
                                    >
                                      <span className="reaction-emoji">{e}</span>
                                      {c > 1 && <span className="reaction-count">{c}</span>}
                                    </button>
                                  );
                                })}
                              </div>
                              {/* Simple horizontal reaction bar on hover */}
                              <div className="hover-reactions-bar">
                                {['👍', '❤️', '😂', '😮', '😢', '👎'].map((emoji) => (
                                  <button 
                                    key={emoji} 
                                    className="hover-reaction-btn" 
                                    onClick={() => toggleReaction(msg, emoji)}
                                    title={emoji}
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Scroll to bottom button */}
                  {showScrollToBottom && (
                    <button 
                      className="scroll-to-bottom-btn"
                      onClick={scrollToBottom}
                      title="Scroll to latest messages"
                    >
                      ↓
                    </button>
                  )}

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
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={handleKeyDown}
                      />
                      <button className="modern-emoji-btn" onClick={() => setShowEmojiPicker((p) => !p)}>😊</button>
                      {showEmojiPicker && (
                        <div className="modern-emoji-picker">
                          <EmojiPicker onEmojiClick={(_, d) => setNewMessage((m) => (m || '') + d.emoji)} height={360} width={300} />
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
              <div className="modern-contact-info">
                <div className="messenger-header">
                  <button className="close-details-btn" onClick={() => setShowInfoSidebar(false)}>×</button>
                  <h3>Chat Details</h3>
                </div>
                
                <div className="messenger-content">
                  {/* Profile Section */}
                  <div className="profile-section">
                    <div className="profile-avatar-large">
                      {selectedChat.isGroup ? <FaUsers /> : getDisplayName(selectedChat.users.find((u) => u._id !== userId)).charAt(0).toUpperCase()}
                    </div>
                    <div className="profile-info-large">
                      {editingGroupName ? (
                        <div className="edit-name-container">
                          <input
                            type="text"
                            value={newGroupName}
                            onChange={(e) => setNewGroupName(e.target.value)}
                            className="edit-name-input"
                            autoFocus
                          />
                          <div className="edit-name-actions">
                            <button className="save-name-btn" onClick={saveGroupName}>Save</button>
                            <button className="cancel-name-btn" onClick={cancelEditGroupName}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div className="name-container">
                          <h4>{selectedChat.isGroup ? selectedChat.name : getDisplayName(selectedChat.users.find((u) => u._id !== userId))}</h4>
                          {selectedChat.isGroup && (
                            <div className="edit-name-wrapper">
                              <button className="edit-name-btn" onClick={startEditGroupName}>
                                <span>Edit</span>
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                      <p className="chat-type">{selectedChat.isGroup ? 'Group Chat' : 'Direct Message'}</p>
                    </div>
                  </div>

                  {/* Actions Section */}
                  <div className="actions-section">
                    {selectedChat.isGroup && (
                      <>
                        <button className="action-btn add-members-btn" onClick={() => setShowAddMembers(true)}>
                          <FaUsers />
                          <span>Add Members</span>
                        </button>
                        <button className="action-btn share-link-btn">
                          <span>Share Link</span>
                        </button>
                      </>
                    )}
                    <button className="action-btn block-btn">
                      <span>Block</span>
                    </button>
                    <button className="action-btn report-btn">
                      <span>Report</span>
                    </button>
                  </div>

                  {/* Details Section */}
                  <div className="details-section">
                    <h5>Details</h5>
                {selectedChat.isGroup ? (
                  <>
                        <div className="detail-item">
                          <span className="detail-label">Group Name</span>
                          <span className="detail-value">{selectedChat.name}</span>
                        </div>
                        <div className="detail-item">
                          <span className="detail-label">Join Code</span>
                          <span className="detail-value code">{selectedChat.joinCode}</span>
                        </div>
                        <div className="detail-item">
                          <span className="detail-label">Members</span>
                          <span className="detail-value">{selectedChat.users.length} people</span>
                        </div>
                  </>
                ) : (
                  <>
                        <div className="detail-item">
                          <span className="detail-label">Name</span>
                          <span className="detail-value">{getDisplayName(selectedChat.users.find((u) => u._id !== userId))}</span>
                        </div>
                        <div className="detail-item">
                          <span className="detail-label">Email</span>
                          <span className="detail-value">{selectedChat.users.find((u) => u._id !== userId)?.email}</span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Members Section */}
                  {selectedChat.isGroup && (
                    <div className="members-section">
                      <div className="members-header">
                        <h5>Members ({selectedChat.users.length})</h5>
                      </div>
                      <div className="members-list">
                        {selectedChat.users.map((u) => (
                          <div key={u._id} className="member-item">
                            <div className="member-avatar">
                              {getDisplayName(u).charAt(0).toUpperCase()}
                            </div>
                            <div className="member-info">
                              <span className="member-name">{getDisplayName(u)}</span>
                              {u._id === userId && <span className="member-badge">You</span>}
                            </div>
                            {u._id !== userId && (
                              <button 
                                className="remove-member-btn"
                                onClick={() => removeMemberFromGroup(u._id)}
                                title="Remove member"
                              >
                                ×
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Add Members Modal */}
                {showAddMembers && (
                  <div className="add-members-modal">
                    <div className="modal-header">
                      <h4>Add Members</h4>
                      <button className="close-modal-btn" onClick={() => setShowAddMembers(false)}>×</button>
                    </div>
                    <div className="modal-content">
                      <div className="search-container">
                        <input
                          type="text"
                          placeholder="Search users..."
                          className="search-input"
                          onChange={(e) => {
                            const query = e.target.value.toLowerCase();
                            const filtered = availableMembers.filter(u => 
                              getDisplayName(u).toLowerCase().includes(query)
                            );
                            setAvailableMembers(filtered);
                          }}
                        />
                      </div>
                      <div className="users-list">
                        {availableMembers.map((u) => (
                          <label key={u._id} className="user-checkbox-item">
                            <input
                              type="checkbox"
                              checked={selectedNewMembers.includes(u._id)}
                              onChange={() => {
                                if (selectedNewMembers.includes(u._id)) {
                                  setSelectedNewMembers(prev => prev.filter(id => id !== u._id));
                                } else {
                                  setSelectedNewMembers(prev => [...prev, u._id]);
                                }
                              }}
                            />
                            <div className="user-avatar">{getDisplayName(u).charAt(0).toUpperCase()}</div>
                            <span className="user-name">{getDisplayName(u)}</span>
                          </label>
                        ))}
                      </div>
                      <div className="modal-actions">
                        <button 
                          className="add-members-submit-btn"
                          onClick={addMembersToGroup}
                          disabled={selectedNewMembers.length === 0}
                        >
                          Add {selectedNewMembers.length} member{selectedNewMembers.length !== 1 ? 's' : ''}
                        </button>
                      </div>
                    </div>
                  </div>
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
