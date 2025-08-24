// src/components/HrChat.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FaPaperPlane, FaUsers, FaCheck, FaTachometerAlt, FaComments, FaUserTie, FaExchangeAlt, FaProjectDiagram } from 'react-icons/fa';
import EmojiPicker from 'emoji-picker-react';
import api from '../../api/axiosInstance';
import NotificationBell from '../NotificationBell';
import '../style/pm_style/PmChat.css';
import { io } from 'socket.io-client';

const SOCKET_SERVER_URL =
  process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';

export default function HrChat() {
  const navigate = useNavigate();
  const { chatId } = useParams();

  const token  = localStorage.getItem('token');
  const user   = JSON.parse(localStorage.getItem('user') || '{}');
  const userId = user?._id;
  const userName = user?.name || 'H';
  const userRole = user?.role || '';

  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const socket = useRef(null);

  const [chatList, setChatList]           = useState([]);
  const [searchQuery, setSearchQuery]     = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [allUsers, setAllUsers]           = useState([]);

  const [selectedChat, setSelectedChat]   = useState(null);
  const [messages, setMessages]           = useState([]);
  const [newMessage, setNewMessage]       = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);

  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName]           = useState('');
  const [availableUsers, setAvailableUsers] = useState([]);
  const [filteredUsers, setFilteredUsers]   = useState([]);
  const [userSearch, setUserSearch]         = useState('');
  const [selectedUsers, setSelectedUsers]   = useState([]);

  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [showInfoSidebar, setShowInfoSidebar] = useState(false);
  const [reactionPickerMsg, setReactionPickerMsg] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  
  // Enhanced UI features like PM Chat
  const [showSeenDetails, setShowSeenDetails] = useState(null);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [editingGroupName, setEditingGroupName] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [availableMembers, setAvailableMembers] = useState([]);
  const [selectedNewMembers, setSelectedNewMembers] = useState([]);

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

  // Update header collapse state when chat is selected
  useEffect(() => {
    setIsHeaderCollapsed(!!selectedChat);
  }, [selectedChat]);

  // Close profile menu on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.user-profile')) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

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
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 20;
      setShowScrollToBottom(!isNearBottom);
    };

    chatMessages.addEventListener('scroll', handleScroll);
    return () => chatMessages.removeEventListener('scroll', handleScroll);
  }, [selectedChat]);

  /* ---------------------------- Socket wiring ---------------------------- */
  useEffect(() => {
    if (!userId) return;

    socket.current = io(SOCKET_SERVER_URL, {
      transports: ['websocket'],
      withCredentials: true,
      auth: { userId }
    });

    const onReceive = (msg) => {
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
            const updated = {
              ...last,
              _id: msg._id,
              timestamp: msg.timestamp,
              reactions: [],
              seen: [],
            };
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

        if (msg.sender !== userId) {
          socket.current.emit('messageSeen', { messageId: msg._id, userId });
        }
      }
    };

    const onSeen = ({ messageId, userId: seenBy, timestamp }) => {
      setMessages((ms) =>
        ms.map((m) =>
          m._id === messageId
            ? { ...m, seen: [...(m.seen || []), { userId: seenBy, timestamp }] }
            : m
        )
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

  /* ----------------------------- Auth guard ------------------------------ */
  useEffect(() => {
    if (!token || !userId) navigate('/');
  }, [token, userId, navigate]);

  /* ------------------------------ Chats list ----------------------------- */
  const reloadChats = async () => {
    try {
      const { data } = await api.get('/chats', { headers });
      setChatList(data);
    } catch {
      setChatList([]);
    }
  };
  useEffect(() => {
    if (!token) return;
    reloadChats();
  }, [token, headers]);

  /* ---------------------- Open chat from URL param ----------------------- */
  useEffect(() => {
    if (!chatId || chatList.length === 0) return;
    const c = chatList.find((ch) => ch._id === chatId);
    if (c) setSelectedChat(c);
  }, [chatId, chatList]);

  /* --------------------- Join room & fetch conversation ------------------ */
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

        // reliability: also hit seen REST endpoint for incoming messages
        await Promise.all(
          norm
            .filter((m) => !m.isOwn)
            .map((m) => api.post(`/messages/${m._id}/seen`, { userId }, { headers }).catch(() => {}))
        );

        // and emit socket seen (ok to do both)
        norm
          .filter((m) => !m.isOwn)
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
        const { data: users } = await api.get(
          `/users/search?query=${encodeURIComponent(q)}`,
          { headers }
        );

        const matchedChats = chatList.filter((c) => {
          if (c.isGroup) return (c.name || '').toLowerCase().includes(q);
          const other = c.users.find((u) => u._id !== userId) || {};
          return getDisplayName(other).toLowerCase().includes(q);
        });

        const newUsers = users.filter((u) =>
          !chatList.some((c) => c.users.some((x) => x._id === u._id))
        );
        setSearchResults([...matchedChats, ...newUsers.map((u) => ({ ...u, type: 'user' }))]);
      } catch {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(id);
  }, [searchQuery, chatList, userId, headers]);

  /* ------------------------- Group modal helpers ------------------------- */
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

  // Load available members for adding to group
  useEffect(() => {
    if (showAddMembers && selectedChat?.isGroup) {
      loadAvailableMembers();
    }
  }, [showAddMembers, selectedChat]);

  const handleUserSearch = (e) => setUserSearch(e.target.value);

  const openChat = async (item) => {
    let chatToOpen = item;
    if (item.type === 'user') {
      const { data: oneToOne } = await api.post(
        '/chats',
        { users: [userId, item._id] },
        { headers }
      );
      chatToOpen = oneToOne;
      await reloadChats();
    }
    setSelectedChat(chatToOpen);
    setSearchQuery('');
    setSearchResults([]);
    navigate(`/hr/chat/${chatToOpen._id}`);
  };

  const copyJoinCode = () => {
    if (!selectedChat?.joinCode) return;
    navigator.clipboard.writeText(selectedChat.joinCode).then(() => alert('Join code copied!'));
  };

  const toggleSelectUser = (id) =>
    setSelectedUsers((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const createGroup = async () => {
    const members = [userId, ...selectedUsers];
    const { data: newChat } = await api.post(
      '/chats',
      { name: groupName, users: members, isGroup: true },
      { headers }
    );
    setShowGroupModal(false);
    setGroupName(''); setUserSearch(''); setSelectedUsers([]);
    await reloadChats();
    setSelectedChat(newChat);
    navigate(`/hr/chat/${newChat._id}`);
  };

  // Enhanced group management functions
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

  /* --------------------------- Send (optimistic) -------------------------- */
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
      await api.post(
        '/messages',
        { sender: userId, conversation: selectedChat._id, content, type: 'text' },
        { headers }
      );
      // server broadcast replaces temp bubble in onReceive
    } catch {
      setMessages((ms) => ms.filter((m) => m._id !== tempId));
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const toggleReaction = async (msg, emoji) => {
    const myId = (r) => (typeof r.userId === 'string' ? r.userId : r.userId?._id);
    const mine = msg.reactions.find((r) => myId(r) === userId);

    if (mine && mine.emoji === emoji) {
      await api.delete(`/messages/${msg._id}/reactions`, { data: { userId, emoji }, headers });
      setMessages((ms) =>
        ms.map((m) =>
          m._id === msg._id ? { ...m, reactions: m.reactions.filter((r) => myId(r) !== userId) } : m
        )
      );
    } else {
      if (mine) await api.delete(`/messages/${msg._id}/reactions`, { data: { userId, emoji: mine.emoji }, headers });
      await api.post(`/messages/${msg._id}/reactions`, { userId, emoji }, { headers });
      setMessages((ms) =>
        ms.map((m) =>
          m._id === msg._id
            ? { ...m, reactions: [...m.reactions.filter((r) => myId(r) !== userId), { userId, emoji }] }
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

  const activeList = searchQuery.trim() ? searchResults : chatList;

  const renderSidebarItem = (item) => {
    const isUser  = item.type === 'user';
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
    <div className="pm-chat-wrapper">
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
              onChange={(e) => setGroupName(e.target.value)}
            />
            <label>Search users</label>
            <input
              className="modal-input"
              placeholder="Search for users"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
            />
            <div className="user-list" style={{ display: 'flex', flexDirection: 'column' }}>
              {filteredUsers.map((u) => (
                <label key={u._id} className="user-item" style={{ margin: '4px 0' }}>
                  <input
                    type="checkbox"
                    checked={selectedUsers.includes(u._id)}
                    onChange={() => toggleSelectUser(u._id)}
                    style={{ marginRight: 8 }}
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
              <button className="btn-cancel" onClick={() => setShowGroupModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modern Header - Same as PM Chat */}
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
              {userName ? userName.charAt(0).toUpperCase() : 'H'}
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
            <Link to="/hr/dash" className="nav-item">
              <FaTachometerAlt />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Dashboard</span>
            </Link>
            <Link to="/hr/chat" className="nav-item active">
              <FaComments />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Chat</span>
            </Link>
            <Link to="/hr/mlist" className="nav-item">
              <FaUserTie />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Manpower</span>
            </Link>
            <Link to="/hr/movement" className="nav-item">
              <FaExchangeAlt />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Movement</span>
            </Link>
            <Link to="/hr/project-records" className="nav-item">
              <FaProjectDiagram />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Projects</span>
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
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="modern-chat-list">
            {(searchQuery.trim() ? searchResults : chatList).length === 0 ? (
              <div className="modern-no-chats">No chats found.</div>
            ) : (
              (searchQuery.trim() ? searchResults : chatList).map(renderSidebarItem)
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
                  {/* header */}
                  <div className="modern-chat-header">
                    <div className="modern-chat-header-left">
                      <div className="modern-chat-header-avatar">
                        {selectedChat.isGroup
                          ? <FaUsers />
                          : getDisplayName(selectedChat.users.find((u) => u._id !== userId)).charAt(0).toUpperCase()
                        }
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
                        const counts = msg.reactions.reduce((a, r) => { a[r.emoji] = (a[r.emoji] || 0) + 1; return a; }, {});
                        const isLastOwn = msg.isOwn && idx === messages.length - 1;
                        const seenByRecipient = isLastOwn && msg.seen?.length > 0;
                        const seenNames = getSeenDisplayNames(msg.seen);
                        const hasSeen = msg.seen && msg.seen.length > 0;
                        
                        // Only show seen indicator if this is the most recent message seen by any user
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
}
