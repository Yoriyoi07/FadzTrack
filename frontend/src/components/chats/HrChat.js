// src/components/HrChat.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import EmojiPicker from 'emoji-picker-react';
import {
  FaUsers, FaPaperPlane, FaCheck, FaTachometerAlt, FaComments,
  FaUserTie, FaExchangeAlt, FaProjectDiagram
} from 'react-icons/fa';
import api from '../../api/axiosInstance';
import NotificationBell from '../NotificationBell';
import '../style/am_style/AreaChat.css';

const SOCKET_URL  = process.env.REACT_APP_SOCKET_URL  || '/';
const SOCKET_PATH = process.env.REACT_APP_SOCKET_PATH || '/socket.io';

export default function HrChat() {
  const navigate   = useNavigate();
  const { chatId } = useParams();

  const token    = localStorage.getItem('token');
  const user     = JSON.parse(localStorage.getItem('user') || '{}');
  const userId   = user?._id;
  const userName = user?.name || 'HR';
  const userRole = user?.role || '';

  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  // Refs
  const socketRef = useRef(null);
  const selectedChatIdRef = useRef(null);
  const messagesEndRef = useRef(null);
  // Monotonic sequence for tie-breaking when timestamps equal
  const seqRef = useRef(0);

  // Sidebar
  const [chatList, setChatList] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  // Conversation
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  // per-chat drafts so typing in one chat doesn't appear in another
  const [drafts, setDrafts] = useState({});
  const [pendingFiles, setPendingFiles] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // UI
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showInfoSidebar, setShowInfoSidebar] = useState(false);
  const [showInfoTab, setShowInfoTab] = useState('media');
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [showSeenDetails, setShowSeenDetails] = useState(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);

  // Media lightbox
  const [showMediaViewer, setShowMediaViewer] = useState(false);
  const [mediaViewerIndex, setMediaViewerIndex] = useState(0);

  // Group modal
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [availableUsers, setAvailableUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);

  // Chat customization
  const [editingGroupName, setEditingGroupName] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [availableMembers, setAvailableMembers] = useState([]);
  const [selectedNewMembers, setSelectedNewMembers] = useState([]);
  const [pinnedNewChatId, setPinnedNewChatId] = useState(null);
  // collapse/expand members list
  const [showMembersList, setShowMembersList] = useState(false);

  const sortChatList = (list) => {
    const getTs = (c) => {
      if (c?.lastMessage?.tsNum) return c.lastMessage.tsNum;
      let t = c?.lastMessage?.timestamp || c?.lastMessage?.createdAt || c?.lastMessage?.updatedAt || c?.updatedAt || c?.createdAt;
      if (!t && c?._id && /^[a-f0-9]{24}$/.test(c._id)) t = parseInt(c._id.substring(0,8),16) * 1000;
      if (!t) return 0;
      if (typeof t === 'number') return t;
      const n = Date.parse(t); return isNaN(n) ? 0 : n;
    };
    return [...(list || [])].sort((a,b) => {
      const diff = getTs(b) - getTs(a);
      if (diff !== 0) return diff;
      const sa = a?.lastMessage?.seq || 0;
      const sb = b?.lastMessage?.seq || 0;
      return sb - sa;
    });
  };

  // collapse header when a chat opens
  useEffect(() => { setIsHeaderCollapsed(!!selectedChat); }, [selectedChat]);

  // guard
  useEffect(() => { if (!token || !userId) navigate('/'); }, [navigate, token, userId]);

  // close profile menu on outside click
  useEffect(() => {
    const handler = (e) => { if (!e.target.closest('.user-profile')) setProfileMenuOpen(false); };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  // helpers
  const getDisplayName = useCallback((u) => {
    if (!u) return 'User';
    if (u.name) return u.name;
    const comb = `${u?.firstname || ''} ${u?.lastname || ''}`.trim();
    return comb || u.email || 'User';
  }, []);

  // Show seconds for clarity in rapid updates
  const formatTime = (ts) =>
    ts ? new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';

  const getSeenDisplayNames = (seenArray) => {
    if (!seenArray?.length) return [];
    return seenArray
      .map((s) => {
        const u = chatList
          .find((c) => c.users.some((x) => x._id === s.userId))
          ?.users.find((x) => x._id === s.userId);
        return getDisplayName(u);
      })
      .filter(Boolean);
  };

  const getGroupSeenDisplay = (names) => {
    const first = names.map((n) => n.split(' ')[0]);
    if (first.length <= 1) return first[0] || '';
    if (first.length === 2) return `${first[0]} and ${first[1]}`;
    if (first.length === 3) return `${first[0]}, ${first[1]} and ${first[2]}`;
    return `${first[0]}, ${first[1]} and ${first.length - 2} others`;
  };

  const mergeMessages = (oldMsgs = [], newMsgs = []) => {
    const map = new Map();
    (oldMsgs || []).forEach((m) => { if (m && m._id) map.set(String(m._id), m); });
    (newMsgs || []).forEach((m) => { if (m && m._id) map.set(String(m._id), m); });
    const arr = Array.from(map.values());
    arr.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    return arr;
  };

  const dedupedMessages = useMemo(() => {
    const seen = new Set();
    return (messages || []).filter((m) => {
      const id = String(m && m._id);
      if (!id) return false;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [messages]);

  // All image attachments for media viewer
  const mediaImages = useMemo(() => (
    messages
      .flatMap(m => m.attachments || [])
      .filter(a => a?.mime?.startsWith('image/'))
  ), [messages]);

  const openMediaViewer = (idx) => { setMediaViewerIndex(idx); setShowMediaViewer(true); };
  const closeMediaViewer = () => setShowMediaViewer(false);
  const navMedia = (dir) => {
    setMediaViewerIndex(i => {
      if (!mediaImages.length) return 0;
      let n = (i + dir) % mediaImages.length;
      if (n < 0) n = mediaImages.length - 1;
      return n;
    });
  };

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (!showMediaViewer) return;
    const handler = (e) => {
      if (e.key === 'Escape') closeMediaViewer();
      else if (e.key === 'ArrowLeft') navMedia(-1);
      else if (e.key === 'ArrowRight') navMedia(1);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showMediaViewer, mediaImages.length]);

  // Normalize messages to avoid showing raw attachment URLs / placeholder text
  const normalizeIncoming = (msg) => {
    let text = (msg.content ?? msg.message ?? msg.fileUrl ?? '') || '';
    const attachments = Array.isArray(msg.attachments) ? msg.attachments : [];
    if (attachments.length) {
      const urls = attachments.map(a => a && a.url).filter(Boolean);
      if (urls.includes(text)) text = '';
      if (/^https?:\/\//.test(text) && urls.some(u => u && text.startsWith(u.split('?')[0]))) text = '';
      if (/^Sending \d+ attachment\(s\)…$/.test(text)) text = '';
    }
    return { text, attachments };
  };

  // SOCKET — single connection
  useEffect(() => {
    if (!userId) return;

    if (socketRef.current) { socketRef.current.disconnect(); socketRef.current = null; }
    const s = io(SOCKET_URL, {
      path: SOCKET_PATH, withCredentials: true,
      transports: ['websocket', 'polling'], auth: { userId }
    });
    socketRef.current = s;

    const onReceive = (msg) => {
      const { text, attachments } = normalizeIncoming(msg);
      const tsNum = typeof msg.timestamp === 'number' ? msg.timestamp : (msg.timestamp ? Date.parse(msg.timestamp) : Date.now());
      setChatList(list => sortChatList(list.map(c => c._id === msg.conversation ? {
        ...c,
        lastMessage: { content: text || (attachments.length ? '📎 Attachment' : ''), timestamp: msg.timestamp || tsNum, tsNum, seq: ++seqRef.current, sender: msg.sender, seen: msg.seen || [] }
      } : c)));
      if (selectedChatIdRef.current === msg.conversation) {
        setMessages(ms => {
          if (ms.some(m => m._id === msg._id)) return ms;
          const filtered = ms.filter(m => {
            if (!String(m._id).startsWith('tmp-')) return true;
            if (!m.isOwn) return true;
            if (msg.sender === userId) return false;
            if (m.content === (msg.content || '')) return false;
            if (/^Sending \d+ attachment\(s\)…$/.test(m.content) && attachments.length > 0) return false;
            return true;
          });
          return [...filtered, { _id: msg._id, content: text, timestamp: msg.timestamp, isOwn: msg.sender === userId, reactions: msg.reactions || [], seen: msg.seen || [], attachments }];
        });
        if (msg.sender !== userId) s.emit('messageSeen', { messageId: msg._id, userId });
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
      const raw = lastMessage?.timestamp || lastMessage?.createdAt || lastMessage?.updatedAt;
      const ts = typeof raw === 'number' ? raw : (raw ? Date.parse(raw) : Date.now());
      setChatList(list => sortChatList(list.map(c => c._id === cId ? { ...c, lastMessage: { ...lastMessage, tsNum: ts, seq: ++seqRef.current } } : c)));
    };

    const onMembersUpdated = ({ chatId: cid, users, name }) => {
      setChatList(list => list.map(c => c._id === cid ? { ...c, users: users || c.users, name: name || c.name } : c));
      setSelectedChat(prev => prev && prev._id === cid ? { ...prev, users: users || prev.users, name: name || prev.name } : prev);
    };
    const onChatCreated = (chatObj) => {
      if (!chatObj || !chatObj._id) return;
      if (!(chatObj.users || []).some(u => u._id === userId)) return;
      const raw = chatObj.lastMessage?.timestamp || chatObj.lastMessage?.createdAt || chatObj.lastMessage?.updatedAt;
      let num = typeof raw === 'number' ? raw : (raw ? Date.parse(raw) : 0);
      if (chatObj.lastMessage) chatObj = { ...chatObj, lastMessage: { ...chatObj.lastMessage, tsNum: num, seq: ++seqRef.current } };
      setChatList(list => sortChatList([chatObj, ...list.filter(c => c._id !== chatObj._id)]));
    };

    const onReaction = ({ messageId, reactions }) => {
      setMessages((ms) =>
        ms.map((m) => (m._id === messageId ? { ...m, reactions } : m))
      );
    };

    s.on('receiveMessage', onReceive);
    s.on('messageSeen', onSeen);
    s.on('chatUpdated', onChatUpdated);
  s.on('messageReaction', onReaction);
  s.on('chatMembersUpdated', onMembersUpdated);
  s.on('chatCreated', onChatCreated);

    return () => {
      s.off('receiveMessage', onReceive);
      s.off('messageSeen', onSeen);
      s.off('chatUpdated', onChatUpdated);
  s.off('messageReaction', onReaction);
  s.off('chatMembersUpdated', onMembersUpdated);
  s.off('chatCreated', onChatCreated);
      s.disconnect();
    };
  }, [userId]);

  // keep current chat id for handlers
  useEffect(() => { selectedChatIdRef.current = selectedChat?._id || null; }, [selectedChat?._id]);

  // autoscroll
  useEffect(() => { if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: 'smooth' }); }, [messages, selectedChat]);
  const scrollToBottom = () => { if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: 'smooth' }); };

  // show/hide “scroll to bottom”
  useEffect(() => {
    const el = document.querySelector('.modern-chat-messages');
    if (!el) return;
    const onScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      setShowScrollToBottom(scrollHeight - scrollTop - clientHeight >= 20);
    };
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, [selectedChat]);

  // load chats
  const reloadChats = useCallback(async () => {
    try {
      const { data } = await api.get('/chats', { headers });
      const withTs = (data || []).map(c => {
        if (c?.lastMessage) {
          const raw = c.lastMessage.timestamp || c.lastMessage.createdAt || c.lastMessage.updatedAt;
          let num = typeof raw === 'number' ? raw : (raw ? Date.parse(raw) : 0);
          return { ...c, lastMessage: { ...c.lastMessage, tsNum: num } };
        }
        return c;
      });
      let sorted = sortChatList(withTs);
      if (pinnedNewChatId) {
        const idx = sorted.findIndex(c => c._id === pinnedNewChatId);
        if (idx > 0) {
          const [p] = sorted.splice(idx,1);
          if (!p.lastMessage) sorted = [p, ...sorted]; else setPinnedNewChatId(null);
        } else if (idx === 0 && sorted[0]?.lastMessage) setPinnedNewChatId(null);
      }
      setChatList(sorted);
    } catch {
      setChatList([]);
    }
  }, [headers, pinnedNewChatId]);
  useEffect(() => { if (token) reloadChats(); }, [token, reloadChats]);

  // auto-select from URL
  useEffect(() => {
    if (!chatId || chatList.length === 0) return;
    const c = chatList.find((ch) => ch._id === chatId);
    if (c) setSelectedChat(c);
  }, [chatId, chatList]);

  // join + fetch messages
  useEffect(() => {
    if (!selectedChat) return;
    const chatIdCurrent = selectedChat._id;
    socketRef.current?.emit('joinChat', chatIdCurrent);

    // Clear immediately to avoid briefly showing previous chat's messages
    setMessages([]);

    let cancelled = false;
    (async () => {
      try {
        setLoadingMessages(true);
        const { data } = await api.get(`/messages/${chatIdCurrent}`, { headers });
        if (cancelled) return; // stale fetch guard
        if (!selectedChat || selectedChat._id !== chatIdCurrent) return; // chat switched
        const norm = (data || []).map((m) => ({
          _id: m._id,
          content: (m.message ?? m.content ?? m.fileUrl ?? '') || '',
          timestamp: m.createdAt,
          isOwn: m.senderId === userId,
          reactions: m.reactions || [],
          seen: m.seen || [],
          attachments: m.attachments || []
        }));
        setMessages(() => norm);

        // mark incoming seen
        norm.filter((m) => !m.isOwn).forEach((m) =>
          socketRef.current?.emit('messageSeen', { messageId: m._id, userId })
        );
      } finally {
        if (!cancelled) {
          setLoadingMessages(false);
          setTimeout(() => scrollToBottom(), 100);
        }
      }
    })();

    return () => {
      cancelled = true;
      socketRef.current?.emit('leaveChat', chatIdCurrent);
    };
  }, [selectedChat?._id, userId, headers]);

  // search (debounced)
  useEffect(() => {
    const id = setTimeout(async () => {
      const q = searchQuery.trim().toLowerCase();
      if (!q) return setSearchResults([]);

      try {
        const { data: users } = await api.get(`/users/search?query=${encodeURIComponent(q)}`, { headers });

        const matchedChats = chatList.filter((c) => {
          if (c.isGroup) return (c.name || '').toLowerCase().includes(q);
          const other = c.users.find((u) => u._id !== userId);
          return getDisplayName(other).toLowerCase().includes(q);
        });

        const newUsers = (users || []).filter(
          (u) => !chatList.some((c) => c.users.some((x) => x._id === u._id))
        );

        setSearchResults([
          ...matchedChats,
          ...newUsers.map((u) => ({ ...u, type: 'user' }))
        ]);
      } catch {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(id);
  }, [searchQuery, chatList, userId, headers, getDisplayName]);

  // group modal lists
  useEffect(() => {
    if (!showGroupModal) return;
    (async () => {
      try {
        const { data } = await api.get('/users?limit=100', { headers });
        const list = (data || []).filter((u) => u._id !== userId);
        setAvailableUsers(list);
        setFilteredUsers(list);
      } catch {
        setAvailableUsers([]); setFilteredUsers([]);
      }
    })();
  }, [showGroupModal, headers, userId]);

  useEffect(() => {
    if (!showAddMembers || !selectedChat?.isGroup) return;
    (async () => {
      try {
        const { data } = await api.get('/users?limit=100', { headers });
        const currentIds = selectedChat.users.map((u) => u._id);
        setAvailableMembers((data || []).filter((u) => !currentIds.includes(u._id)));
        setSelectedNewMembers([]);
      } catch {
        setAvailableMembers([]);
      }
    })();
  }, [showAddMembers, selectedChat, headers]);

  // actions
  const openChat = async (item) => {
    // save current draft before switching
    if (selectedChat && selectedChat._id) {
      setDrafts(prev => {
        if (!newMessage && (!pendingFiles || pendingFiles.length === 0)) return prev;
        return { ...prev, [selectedChat._id]: newMessage };
      });
    }
    let chatToOpen = item;
    if (item.type === 'user') {
      const { data: dm } = await api.post('/chats', { users: [userId, item._id] }, { headers });
      chatToOpen = dm;
      await reloadChats();
    }
    setSelectedChat(chatToOpen);
    setNewMessage(drafts[chatToOpen._id] || '');
    setSearchQuery('');
    setSearchResults([]);
    setPendingFiles([]);
    navigate(`/hr/chat/${chatToOpen._id}`);
  };

  const handleUserSearch = (e) => {
    const q = e.target.value.toLowerCase();
    setUserSearch(q);
    setFilteredUsers(availableUsers.filter((u) => getDisplayName(u).toLowerCase().includes(q)));
  };

  const toggleSelectUser = (id) =>
    setSelectedUsers((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const createGroup = async () => {
    if (!groupName.trim() || selectedUsers.length === 0) return;
    const members = [userId, ...selectedUsers];
    try {
      const { data: newChat } = await api.post('/chats', { name: groupName.trim(), users: members, isGroup: true }, { headers });
  setChatList(prev => sortChatList([newChat, ...prev.filter(c => c._id !== newChat._id)]));
  setPinnedNewChatId(newChat._id);
      setShowGroupModal(false); setGroupName(''); setUserSearch(''); setSelectedUsers([]);
      setSelectedChat(newChat); navigate(`/hr/chat/${newChat._id}`);
      reloadChats();
    } catch (e) { console.error('Create group failed:', e); }
  };

  // group name edit
  const startEditGroupName = () => { setNewGroupName(selectedChat.name); setEditingGroupName(true); };
  const saveGroupName = async () => {
    if (!newGroupName.trim() || newGroupName === selectedChat.name) { setEditingGroupName(false); return; }
    try {
      await api.put(`/chats/${selectedChat._id}`, { name: newGroupName.trim() }, { headers });
      setSelectedChat((prev) => ({ ...prev, name: newGroupName.trim() }));
      await reloadChats();
      setEditingGroupName(false);
    } catch (e) { console.error(e); }
  };
  const cancelEditGroupName = () => { setEditingGroupName(false); setNewGroupName(''); };

  const addMembersToGroup = async () => {
    if (!selectedNewMembers.length) return;
    try {
      const updatedUsers = [...selectedChat.users.map(u => u._id), ...selectedNewMembers];
      try {
        await api.put(`/chats/${selectedChat._id}`, { users: updatedUsers }, { headers });
      } catch (err) {
        if (err?.response?.status === 403) {
          alert(err.response.data?.error || 'You are not allowed to add members.');
          return;
        }
        throw err;
      }
      setSelectedChat(prev => prev ? {
        ...prev,
        users: Array.from(new Set([
          ...prev.users.map(u => u._id ? u._id : u),
          ...selectedNewMembers
        ])).map(id => prev.users.find(u => u._id === id) || { _id: id, name: '' })
      } : prev);
      await reloadChats();
      setShowAddMembers(false);
      setSelectedNewMembers([]);
    } catch (e) { console.error('Add members failed:', e); }
  };
  const removeMemberFromGroup = async (memberId) => {
    if (memberId === userId) return;
    if (removeMemberFromGroup._busy) return;
    removeMemberFromGroup._busy = true;
    try {
      let removed = false;
      try {
  const { data } = await api.post(`/chats/${selectedChat._id}/remove-member`, { memberId }, { headers });
        if (data?.chat) { setSelectedChat(data.chat); removed = true; } else removed = true;
      } catch (err) {
        if (err?.response?.status === 403) {
          try {
            const remaining = selectedChat.users.filter(u => u._id !== memberId).map(u => u._id);
            await api.put(`/chats/${selectedChat._id}`, { users: remaining }, { headers });
            removed = true;
          } catch (putErr) { throw putErr; }
        } else { throw err; }
      }
      if (removed) {
        setSelectedChat(prev => prev ? { ...prev, users: prev.users.filter(u => u._id !== memberId) } : prev);
        await reloadChats();
      }
    } catch (e) {
      if (e?.response?.status === 403) {
        alert(e.response.data?.error || 'You are not allowed to remove members from this group.');
      }
      console.error('Remove member failed:', e);
    } finally {
      removeMemberFromGroup._busy = false;
    }
  };

  // Paste images/files from clipboard into pendingFiles
  const handlePaste = (e) => {
    if (!e.clipboardData) return;
    const items = Array.from(e.clipboardData.items || []);
    const files = items
      .filter((i) => i.kind === 'file')
      .map((i) => i.getAsFile())
      .filter(Boolean);
    if (files.length) setPendingFiles((prev) => [...prev, ...files]);
  };

  // SEND — text + files (multipart) with optimistic temp message
  const sendMessage = async () => {
    const content = (newMessage || '').trim();
    if (!content && pendingFiles.length === 0) return;
    if (!selectedChat) return;

    const filesNow = pendingFiles;
    setNewMessage('');
    setPendingFiles([]);
    setDrafts(prev => {
      if (!selectedChat?._id) return prev;
      const c = { ...prev }; delete c[selectedChat._id]; return c;
    });

    const tempId = `tmp-${Date.now()}-${Math.random()}`;
    setMessages((ms) =>
      mergeMessages(ms, [
        {
          _id: tempId,
          content: content || (filesNow.length ? `Sending ${filesNow.length} attachment(s)…` : ''),
          timestamp: Date.now(),
          isOwn: true,
          reactions: [],
          seen: [],
          attachments: [] // real attachments come via socket
        }
      ])
    );

    // Optimistically update sidebar preview & reorder
    setChatList(list => sortChatList(list.map(c => c._id === selectedChat._id ? {
      ...c,
      lastMessage: { content: content || (filesNow.length ? '📎 Attachment' : ''), timestamp: Date.now(), sender: userId, seen: [] }
    } : c)));

    try {
      const fd = new FormData();
      fd.append('conversation', selectedChat._id);
      if (content) fd.append('content', content);
      filesNow.forEach((f) => fd.append('files', f));
      await api.post('/messages', fd, {
        headers: { ...headers, 'Content-Type': 'multipart/form-data' }
      });

      // fetch fresh messages to ensure attachments are present immediately
      try {
        const { data: fresh } = await api.get(`/messages/${selectedChat._id}`, { headers });
        const norm = (fresh || []).map((m) => ({
          _id: m._id,
          content: (m.message ?? m.content ?? m.fileUrl ?? '') || '',
          timestamp: m.createdAt,
          isOwn: m.senderId === userId,
          reactions: m.reactions || [],
          seen: m.seen || [],
          attachments: m.attachments || []
        }));
        setMessages(() => norm);
      } catch {
        // ignore; socket will deliver the message
      }
    } catch (err) {
      console.error('Failed to send:', err);
      setMessages((ms) => ms.filter((m) => m._id !== tempId));
      setPendingFiles((prev) => [...filesNow, ...prev]);
      setNewMessage(content);
    }
  };

  const toggleReaction = async (msg, emoji) => {
    const getUid = (r) => (typeof r.userId === 'string' ? r.userId : r.userId?._id);
    const mine = msg.reactions?.find((r) => getUid(r) === userId);

    if (mine && mine.emoji === emoji) {
      await api.delete(`/messages/${msg._id}/reactions`, { data: { userId, emoji }, headers });
    } else {
      if (mine)
        await api.delete(`/messages/${msg._id}/reactions`, { data: { userId, emoji: mine.emoji }, headers });
      await api.post(`/messages/${msg._id}/reactions`, { userId, emoji }, { headers });
    }
  };

  const handleKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } };
  const handleLogout = () => { localStorage.clear(); navigate('/'); };

  const activeList = searchQuery.trim() ? searchResults : chatList;

  return (
    <div className="area-chat-wrapper" onPaste={handlePaste}>
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
              onChange={handleUserSearch}
            />
            <div className="user-list">
              {filteredUsers.map((u, i) => (
                <label key={`${u._id}-${i}`} className="user-item">
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
                disabled={!groupName.trim() || !selectedUsers.length}
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
      <header className={`dashboard-header ${isHeaderCollapsed ? 'collapsed' : ''}`}>
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
            <div className="profile-avatar">{userName ? userName.charAt(0).toUpperCase() : 'H'}</div>
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

      {/* BODY */}
      <div className="area-chat-content">
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
              (searchQuery.trim() ? searchResults : chatList).map((item) => {
                const isUser = item.type === 'user';
                const isGroup = item.isGroup;
                const other = isGroup ? null : item.users?.find((u) => u._id !== userId) || {};
                const name = isUser ? getDisplayName(item) : isGroup ? item.name : getDisplayName(other);
                const preview = item.lastMessage?.content?.slice(0, 30) || 'Start chatting';
                const timeStr = item.lastMessage?.timestamp ? formatTime(item.lastMessage.timestamp) : '';
                return (
                  <div
                    key={item._id}
                    className={`modern-chat-item ${selectedChat?._id === item._id ? 'active' : ''}`}
                    onClick={() => openChat(item)}
                  >
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
                  <div className="modern-chat-header">
                    <div className="modern-chat-header-left">
                      <div className="modern-chat-header-avatar">
                        {selectedChat.isGroup
                          ? <FaUsers />
                          : getDisplayName(selectedChat.users.find((u) => u._id !== userId)).charAt(0).toUpperCase()}
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
                      dedupedMessages
                        .filter((m) => {
                          const hasText = typeof m.content === 'string' && m.content.trim().length > 0;
                          const hasAttachments = Array.isArray(m.attachments) && m.attachments.length > 0;
                          return hasText || hasAttachments;
                        })
                        .map((msg, idx) => {
                          const counts = (msg.reactions || []).reduce((a, r) => { a[r.emoji] = (a[r.emoji] || 0) + 1; return a; }, {});
                          const isLastOwn = msg.isOwn && idx === messages.length - 1;
                          const seenByRecipient = isLastOwn && msg.seen?.length > 0;
                          const seenNames = getSeenDisplayNames(msg.seen || []);
                          const hasSeen = (msg.seen || []).length > 0;
                          const isMostRecentSeen = hasSeen && (() => {
                            if (!selectedChat.isGroup) return isLastOwn;
                            const later = messages.slice(idx + 1);
                            return !later.some((l) => {
                              if (!l.seen?.length) return false;
                              const laterIds = l.seen.map((s) => s.userId);
                              const ids = (msg.seen || []).map((s) => s.userId);
                              return ids.every((id) => laterIds.includes(id));
                            });
                          })();

                          return (
                            <div key={`${String(msg._id)}-${idx}`} className={`modern-message-wrapper ${msg.isOwn ? 'own' : 'other'}`}>
                              <div className={`modern-message ${msg.isOwn ? 'own' : 'other'}`}>
                                <div className="modern-message-content">
                                  {/* Text */}
                                  {msg.content && <div className="msg-text">{msg.content}</div>}

                                  {/* Attachments */}
                                  {Array.isArray(msg.attachments) && msg.attachments.length > 0 && (
                                    <div className="msg-attachments">
                                      {msg.attachments.map((a, i) => {
                                        const mime = a.mime || '';
                                        const isImg = mime.startsWith('image/');
                                        const isVid = mime.startsWith('video/');
                                        const isAud = mime.startsWith('audio/');
                                        const href  = a.url;

                                        if (isImg) {
                                          if (href) return (
                                            <a key={i} href={href} target="_blank" rel="noreferrer" className="att-link img">
                                              <img src={href} alt={a.name} className="att-image" />
                                            </a>
                                          );
                                          return <div key={i} className="att-placeholder">Image (loading){a.name ? `: ${a.name}` : ''}</div>;
                                        }
                                        if (isVid) {
                                          return href
                                            ? <div key={i} className="att-video"><video src={href} controls /></div>
                                            : <div key={i} className="att-placeholder">Video (loading){a.name ? `: ${a.name}` : ''}</div>;
                                        }
                                        if (isAud) {
                                          return href
                                            ? <div key={i} className="att-audio"><audio src={href} controls /></div>
                                            : <div key={i} className="att-placeholder">Audio (loading){a.name ? `: ${a.name}` : ''}</div>;
                                        }
                                        return (
                                          <a key={i} href={href || '#'} download className="att-doc">📎 {a.name || 'File'}</a>
                                        );
                                      })}
                                    </div>
                                  )}

                                  {/* Seen tick (DMs) */}
                                  {!selectedChat.isGroup && isLastOwn && seenByRecipient && <FaCheck className="message-tick" />}
                                </div>

                                <div className="modern-message-time">
                                  {formatTime(msg.timestamp)}
                                  {isMostRecentSeen && (
                                    <div className="message-seen-info">
                                      {selectedChat.isGroup ? (
                                        <span
                                          className="seen-indicator group-seen"
                                          onClick={() => setShowSeenDetails(showSeenDetails === msg._id ? null : msg._id)}
                                          title={`Seen by ${seenNames.join(', ')}`}
                                        >
                                          Seen by: {getGroupSeenDisplay(seenNames)}
                                        </span>
                                      ) : (
                                        <span className="seen-indicator dm-seen">Seen</span>
                                      )}
                                      {selectedChat.isGroup && showSeenDetails === msg._id && (
                                        <div className="seen-details-tooltip">
                                          <div className="tooltip-header">Seen by:</div>
                                          <div className="seen-users-list">
                                            {seenNames.map((name, index) => (
                                              <div key={index} className="seen-user">
                                                <span className="seen-user-name">{name}</span>
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
                                    const hasReacted = (msg.reactions || []).some(
                                      (r) =>
                                        (typeof r.userId === 'string' ? r.userId : r.userId?._id) === userId &&
                                        r.emoji === e
                                    );
                                    return (
                                      <button
                                        key={e}
                                        className={`reaction-pill ${hasReacted ? 'reacted' : ''}`}
                                        onClick={() => toggleReaction(msg, e)}
                                        title={`${e} ${c > 1 ? `(${c})` : ''}`}
                                      >
                                        <span className="reaction-emoji">{e}</span>
                                        {c > 1 && <span className="reaction-count">{c}</span>}
                                      </button>
                                    );
                                  })}
                                </div>

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

                  {/* Scroll-to-bottom */}
                  {showScrollToBottom && (
                    <button className="scroll-to-bottom-btn" onClick={scrollToBottom} title="Scroll to latest messages">
                      ↓
                    </button>
                  )}

                  {/* INPUT */}
                  <div className="modern-message-input-container">
                    <div className="modern-input-wrapper">
                      {/* Attach */}
                      <label className="modern-attach-btn">
                        <img src={require('../../assets/images/attach.png')} className="attach-icon" alt="attach" />
                        <input
                          type="file"
                          hidden
                          multiple
                          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
                          onChange={(e) => {
                            const arr = Array.from(e.target.files || []);
                            if (arr.length) setPendingFiles((prev) => [...prev, ...arr]);
                            e.target.value = '';
                          }}
                        />
                      </label>

                      {/* Pending previews */}
                      {pendingFiles.length > 0 && (
                        <div className="pending-previews">
                          {pendingFiles.map((f, i) => {
                            const isImg = f.type.startsWith('image/');
                            const isVid = f.type.startsWith('video/');
                            const isAud = f.type.startsWith('audio/');
                            return (
                              <div key={`${f.name}-${i}`} className="pending-item">
                                {isImg && <img src={URL.createObjectURL(f)} alt={f.name} className="pending-thumb" />}
                                {isVid && <video src={URL.createObjectURL(f)} className="pending-thumb" muted />}
                                {isAud && <span className="pending-chip">🎵 {f.name}</span>}
                                {!isImg && !isVid && !isAud && <span className="pending-chip">📎 {f.name}</span>}
                                <button
                                  className="remove-pending"
                                  onClick={() => setPendingFiles((p) => p.filter((_, idx) => idx !== i))}
                                >
                                  ×
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Text */}
                      <input
                        className="modern-chat-input"
                        placeholder="Type your message here"
                        value={newMessage}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNewMessage(val);
                          if (selectedChat && selectedChat._id) {
                            setDrafts(prev => ({ ...prev, [selectedChat._id]: val }));
                          }
                        }}
                        onKeyDown={handleKeyDown}
                      />

                      {/* Emoji */}
                      <button className="modern-emoji-btn" onClick={() => setShowEmojiPicker((p) => !p)}>😊</button>
                      {showEmojiPicker && (
                        <div className="modern-emoji-picker">
                          <EmojiPicker onEmojiClick={(emojiData) => setNewMessage((m) => (m || '') + (emojiData?.emoji || ''))} height={360} width={300} />
                        </div>
                      )}

                      {/* Send */}
                      <button
                        className="modern-send-btn"
                        onClick={sendMessage}
                        disabled={!newMessage.trim() && pendingFiles.length === 0}
                      >
                        <FaPaperPlane />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* INFO SIDEBAR */}
            {showInfoSidebar && selectedChat && (
              <div className="modern-contact-info">
                <div className="messenger-header">
                  <button className="close-details-btn" onClick={() => setShowInfoSidebar(false)}>×</button>
                  <h3>Chat Details</h3>
                </div>

                <div className="messenger-content">
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
                              <button className="edit-name-btn" onClick={startEditGroupName}><span>Edit</span></button>
                            </div>
                          )}
                        </div>
                      )}
                      <p className="chat-type">{selectedChat.isGroup ? 'Group Chat' : 'Direct Message'}</p>
                    </div>
                  </div>

                  <div className="actions-section">
                    {selectedChat.isGroup && (
                      <>
                        <button className="action-btn add-members-btn" onClick={() => setShowAddMembers(true)}>
                          <FaUsers /><span>Add Members</span>
                        </button>
                        <button className="action-btn share-link-btn"><span>Share Link</span></button>
                      </>
                    )}
                    <button className="action-btn block-btn"><span>Block</span></button>
                    <button className="action-btn report-btn"><span>Report</span></button>
                  </div>

                  <div className="details-section">
                    <h5>Details</h5>
                    {selectedChat.isGroup ? (
                      <>
                        <div className="detail-item"><span className="detail-label">Group Name</span><span className="detail-value">{selectedChat.name}</span></div>
                        <div className="detail-item"><span className="detail-label">Join Code</span><span className="detail-value code">{selectedChat.joinCode}</span></div>
                        <div className="detail-item"><span className="detail-label">Members</span><span className="detail-value">{selectedChat.users.length} people</span></div>
                      </>
                    ) : (
                      <>
                        <div className="detail-item"><span className="detail-label">Name</span><span className="detail-value">{getDisplayName(selectedChat.users.find((u) => u._id !== userId))}</span></div>
                        <div className="detail-item"><span className="detail-label">Email</span><span className="detail-value">{selectedChat.users.find((u) => u._id !== userId)?.email}</span></div>
                      </>
                    )}

                    {/* Media / Files tabs */}
                    <div style={{ marginTop: 12 }}>
                      <div className="info-tab-buttons">
                        <button className={showInfoTab === 'media' ? 'active' : ''} onClick={() => setShowInfoTab('media')}>Media</button>
                        <button className={showInfoTab === 'files' ? 'active' : ''} onClick={() => setShowInfoTab('files')}>Files</button>
                      </div>

                      {showInfoTab === 'media' && (
                        <div className="info-media-grid">
                          {mediaImages.map((a, i) => (
                            <div key={i} className="info-media-item" onClick={() => openMediaViewer(i)} style={{ cursor:'pointer' }}>
                              <img src={a.url} alt={a.name} />
                            </div>
                          ))}
                        </div>
                      )}

                      {showInfoTab === 'files' && (
                        <div className="info-files-list">
                          {messages
                            .flatMap((m) => m.attachments || [])
                            .filter((a) => !(a.mime && a.mime.startsWith('image/')))
                            .map((a, i) => (
                              <a key={i} href={a.url} download style={{ textDecoration: 'none', color: '#0b5fff' }}>
                                📎 {a.name}
                              </a>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {selectedChat.isGroup && (
                    <div className="members-section">
                      <button
                        type="button"
                        className="members-header-toggle"
                        onClick={() => setShowMembersList(s => !s)}
                        style={{ display:'flex', alignItems:'center', justifyContent:'space-between', width:'100%', background:'transparent', border:'none', padding:'4px 0', cursor:'pointer', fontWeight:600 }}
                      >
                        <span>Members ({selectedChat.users.length})</span>
                        <span style={{ fontSize:12 }}>{showMembersList ? '▲' : '▼'}</span>
                      </button>
                      {showMembersList && (
                        <div className="members-list">
                          {(() => {
                            const unique = selectedChat.users.reduce((acc, curr) => {
                              if (!curr?._id) return acc;
                              if (!acc.map.has(curr._id)) { acc.map.set(curr._id, true); acc.list.push(curr); }
                              return acc;
                            }, { map: new Map(), list: [] }).list;
                            return unique.map((u, i) => {
                              const isCreator = selectedChat.creator && (selectedChat.creator === u._id || selectedChat.creator?._id === u._id);
                              return (
                                <div key={`${u._id}-${i}`} className="member-item">
                                  <div className="member-avatar">{getDisplayName(u).charAt(0).toUpperCase()}</div>
                                  <div className="member-info">
                                    <span className="member-name">{getDisplayName(u)}</span>
                                    {u._id === userId && <span className="member-badge">You</span>}
                                    {isCreator && <span className="member-badge admin">Admin</span>}
                                  </div>
                                  {u._id !== userId && (
                                    <button className="remove-member-btn" onClick={() => removeMemberFromGroup(u._id)} title="Remove member">×</button>
                                  )}
                                </div>
                              );
                            });
                          })()}
                        </div>
                      )}
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
                            const q = e.target.value.toLowerCase();
                            const filtered = availableMembers.filter((u) => getDisplayName(u).toLowerCase().includes(q));
                            setAvailableMembers(filtered);
                          }}
                        />
                      </div>
                      <div className="users-list">
                        {availableMembers.map((u, i) => (
                          <label key={`${u._id}-${i}`} className="user-checkbox-item">
                            <input
                              type="checkbox"
                              checked={selectedNewMembers.includes(u._id)}
                              onChange={() => {
                                setSelectedNewMembers((prev) =>
                                  prev.includes(u._id) ? prev.filter((id) => id !== u._id) : [...prev, u._id]
                                );
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
      {showMediaViewer && mediaImages[mediaViewerIndex] && (
        <div className="media-viewer-overlay" onClick={closeMediaViewer} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column' }}>
          <div style={{ position:'absolute', top:12, right:20, display:'flex', gap:12 }}>
            <button onClick={(e) => { e.stopPropagation(); closeMediaViewer(); }} style={{ background:'rgba(255,255,255,0.15)', color:'#fff', border:'none', fontSize:24, width:44, height:44, borderRadius:'50%', cursor:'pointer' }}>×</button>
          </div>
          <button onClick={(e) => { e.stopPropagation(); navMedia(-1); }} style={{ position:'absolute', left:10, background:'rgba(255,255,255,0.15)', color:'#fff', border:'none', fontSize:32, width:48, height:72, borderRadius:6, cursor:'pointer' }}>‹</button>
          <img src={mediaImages[mediaViewerIndex].url} alt={mediaImages[mediaViewerIndex].name || 'Image'} onClick={(e) => e.stopPropagation()} style={{ maxWidth:'90%', maxHeight:'85%', objectFit:'contain', boxShadow:'0 0 12px rgba(0,0,0,0.6)', borderRadius:8 }} />
          <button onClick={(e) => { e.stopPropagation(); navMedia(1); }} style={{ position:'absolute', right:10, background:'rgba(255,255,255,0.15)', color:'#fff', border:'none', fontSize:32, width:48, height:72, borderRadius:6, cursor:'pointer' }}>›</button>
          <div style={{ marginTop:12, color:'#eee', fontSize:13 }} onClick={(e) => e.stopPropagation()}>{(mediaViewerIndex+1)} / {mediaImages.length} {mediaImages[mediaViewerIndex].name ? '— '+mediaImages[mediaViewerIndex].name : ''}</div>
        </div>
      )}
    </div>
  );
}
