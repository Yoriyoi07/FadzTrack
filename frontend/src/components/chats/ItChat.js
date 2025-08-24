// src/components/ItChat.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import EmojiPicker from 'emoji-picker-react';
import { FaPaperPlane, FaUsers, FaCheck } from 'react-icons/fa';

import api from '../../api/axiosInstance';
import attachIcon from '../../assets/images/attach.png';
import '../style/am_style/AreaChat.css';

const SOCKET_URL  = process.env.REACT_APP_SOCKET_URL  || '/';
const SOCKET_PATH = process.env.REACT_APP_SOCKET_PATH || '/socket.io';

const ItChat = () => {
  const navigate = useNavigate();
  const { chatId } = useParams();

  const token = localStorage.getItem('token');
  let user = {};
  try { user = JSON.parse(localStorage.getItem('user') || '{}'); } catch { user = {}; }
  const userId = user?._id || user?.id || null;

  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  // Refs
  const socketRef = useRef(null);
  const selectedChatIdRef = useRef(null);
  const messagesEndRef = useRef(null);
  // Sequence counter for tie-breaking deterministic ordering
  const seqRef = useRef(0);

  // Sidebar / search
  const [chatList, setChatList] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [allUsers, setAllUsers] = useState([]);

  // Conversation
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  // per-chat drafts
  const [drafts, setDrafts] = useState({});
  const [pendingFiles, setPendingFiles] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Group modal
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [availableUsers, setAvailableUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);

  // UI toggles
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [showInfoSidebar, setShowInfoSidebar] = useState(false);
  const [showInfoTab, setShowInfoTab] = useState('media');
  // Removed custom reaction picker state; using unified hover reactions like other chats
  const [showSeenDetails, setShowSeenDetails] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  // AreaChat-like group customization states
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

  // Helpers
  const getDisplayName = useCallback((u) => {
    if (!u) return '';
    if (u.name) return u.name;
    if (u.firstname || u.lastname) return `${u.firstname || ''} ${u.lastname || ''}`.trim();
    return u.email || '';
  }, []);

  const formatTime = (ts) =>
    new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const mergeMessages = (oldMsgs = [], newMsgs = []) => {
    const map = new Map();
    (oldMsgs || []).forEach((m) => { if (m && m._id) map.set(String(m._id), m); });
    (newMsgs || []).forEach((m) => { if (m && m._id) map.set(String(m._id), m); });
    const arr = Array.from(map.values());
    arr.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    return arr;
  };

  const dedupedMessages = React.useMemo(() => {
    const seen = new Set();
    return (messages || []).filter((m) => {
      const id = String(m && m._id);
      if (!id) return false;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [messages]);

  // Seen helpers (align with other role chats)
  const getSeenDisplayNames = (seenArray) => {
    if (!seenArray?.length || !selectedChat) return [];
    return seenArray.map(s => {
      const u = selectedChat.users?.find(u => u._id === s.userId);
      return u ? getDisplayName(u) : null;
    }).filter(Boolean);
  };
  const getGroupSeenDisplay = (names) => {
    const first = names.map(n => n.split(' ')[0]);
    if (first.length <= 1) return first[0] || '';
    if (first.length === 2) return `${first[0]} and ${first[1]}`;
    if (first.length === 3) return `${first[0]}, ${first[1]} and ${first[2]}`;
    return `${first[0]}, ${first[1]} and ${first.length - 2} others`;
  };

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

  // ── Socket.IO setup ─────────────────────────────────────────
  useEffect(() => {
    if (!token || !userId) return;

    if (socketRef.current) { socketRef.current.disconnect(); socketRef.current = null; }
    const s = io(SOCKET_URL, {
      path: SOCKET_PATH,
      transports: ['websocket', 'polling'],
      withCredentials: true,
      auth: { userId },
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
            return mergeMessages(filtered, [{ _id: msg._id, content: text, timestamp: msg.timestamp, isOwn: msg.sender === userId, reactions: msg.reactions || [], seen: msg.seen || [], attachments }]);
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

    s.on('receiveMessage', onReceive);
    s.on('messageSeen', onSeen);
    s.on('chatUpdated', onChatUpdated);
  s.on('chatMembersUpdated', onMembersUpdated);
  s.on('chatCreated', onChatCreated);

    return () => {
      s.off('receiveMessage', onReceive);
      s.off('messageSeen', onSeen);
      s.off('chatUpdated', onChatUpdated);
  s.off('chatMembersUpdated', onMembersUpdated);
  s.off('chatCreated', onChatCreated);
      s.disconnect();
    };
  }, [token, userId]);

  // keep current chat id for handlers
  useEffect(() => { selectedChatIdRef.current = selectedChat?._id || null; }, [selectedChat?._id]);

  // guard
  useEffect(() => { if (!token) navigate('/'); }, [token, navigate]);

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
    } catch { setChatList([]); }
  }, [headers, pinnedNewChatId]);
  useEffect(() => { if (token) reloadChats(); }, [token, reloadChats]);

  // auto-open from URL
  useEffect(() => {
    if (!chatId || chatList.length === 0) return;
    const c = chatList.find((ch) => ch._id === chatId);
    if (c) setSelectedChat(c);
  }, [chatId, chatList]);

  // join room & fetch messages
  useEffect(() => {
    if (!selectedChat) return;
    const currentId = selectedChat._id;
    socketRef.current?.emit('joinChat', currentId);

    // Clear first to avoid showing previous chat's thread
    setMessages([]);

    let cancelled = false;
    (async () => {
      try {
        setLoadingMessages(true);
        const { data } = await api.get(`/messages/${currentId}`, { headers });
        if (cancelled) return;
        const norm = (data || []).map((m) => ({
          _id: m._id,
          content: (m.message ?? m.content ?? m.fileUrl ?? '') || '',
          timestamp: m.createdAt,
          isOwn: m.senderId === userId,
          reactions: m.reactions || [],
          seen: m.seen || [],
          attachments: m.attachments || [],
        }));
        setMessages(() => norm);

        // mark all incoming as seen
        norm
          .filter((m) => !m.isOwn)
          .forEach((m) => socketRef.current?.emit('messageSeen', { messageId: m._id, userId }));
      } finally {
        if (!cancelled) setLoadingMessages(false);
      }
    })();

    return () => {
      cancelled = true;
      socketRef.current?.emit('leaveChat', currentId);
    };
  }, [selectedChat?._id, userId, headers]);

  // autoscroll
  useEffect(() => {
    if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages, selectedChat]);

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

  const scrollToBottom = () => {
    if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
  };

  // search (debounced)
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

        const newUsers = (users || []).filter(
          (u) => !chatList.some((c) => c.users.some((x) => x._id === u._id))
        );

        setSearchResults([
          ...matchedChats,
          ...newUsers.map((u) => ({ ...u, type: 'user' })),
        ]);
      } catch {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(id);
  }, [searchQuery, chatList, userId, headers, getDisplayName]);

  // load users for group modal
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

  // debounced search inside group modal
  useEffect(() => {
    if (!showGroupModal) return;
    const id = setTimeout(async () => {
      const q = userSearch.trim();
      if (!q) return setFilteredUsers(availableUsers);
      try {
        const { data } = await api.get(`/users/search?query=${encodeURIComponent(q)}`, { headers });
        setFilteredUsers((data || []).filter((u) => u._id !== userId));
      } catch {
        setFilteredUsers([]);
      }
    }, 300);
    return () => clearTimeout(id);
  }, [userSearch, showGroupModal, availableUsers, headers, userId]);

  // master users for Info sidebar lookups
  useEffect(() => {
    api.get('/users', { headers })
      .then((r) => setAllUsers(r.data || []))
      .catch(() => setAllUsers([]));
  }, [headers]);

  // Handlers
  const handleUserSearch = (e) => setUserSearch(e.target.value);

  const openChat = async (item) => {
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
    navigate(`/it/chat/${chatToOpen._id}`);
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
      setSelectedChat(newChat); navigate(`/it/chat/${newChat._id}`);
      reloadChats();
    } catch (e) { console.error('Create group failed:', e); }
  };

  const copyJoinCode = () => {
    if (!selectedChat?.joinCode) return;
    navigator.clipboard.writeText(selectedChat.joinCode)
      .then(() => alert('Join code copied!'))
      .catch(() => alert('Failed to copy'));
  };

  // Remove member (creator only)
  const handleRemoveMember = async (memberId) => {
    try {
      await api.post(`/chats/${selectedChat._id}/remove-member`, { memberId }, { headers });
      setSelectedChat((sc) => ({ ...sc, users: sc.users.filter((u) => u._id !== memberId) }));
      setChatList((cl) =>
        cl.map((c) => (c._id === selectedChat._id ? { ...c, users: c.users.filter((u) => u._id !== memberId) } : c))
      );
    } catch (err) {
      console.error(err);
      alert('Failed to remove member');
    }
  };

  // Rename group (simple prompt)
  const handleRenameGroup = async () => {
    const newName = prompt('Enter new group name', selectedChat.name);
    if (!newName || newName === selectedChat.name) return;
    try {
      const { data } = await api.put(`/chats/${selectedChat._id}`, { name: newName }, { headers });
      setSelectedChat(data);
      setChatList((cl) => cl.map((c) => (c._id === data._id ? data : c)));
    } catch (err) {
      console.error(err);
      alert('Failed to rename group');
    }
  };

  // Resize image client-side
  const resizeImageFile = (file, maxWidth = 1024, quality = 0.8) =>
    new Promise((resolve) => {
      try {
        const img = new Image();
        img.onload = () => {
          const ratio = Math.min(1, maxWidth / img.width);
          const width = Math.round(img.width * ratio);
          const height = Math.round(img.height * ratio);
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob((b) => (b ? resolve(b) : resolve(file)), 'image/jpeg', quality);
        };
        img.onerror = () => resolve(file);
        img.src = URL.createObjectURL(file);
      } catch {
        resolve(file);
      }
    });

  // Paste images from clipboard
  const handlePaste = async (e) => {
    if (!e.clipboardData) return;
    const items = Array.from(e.clipboardData.items || []);
    const imageItems = items.filter((it) => it.type && it.type.startsWith('image/'));
    if (!imageItems.length) return;
    e.preventDefault();
    const newFiles = [];
    for (const it of imageItems) {
      const raw = it.getAsFile();
      if (!raw) continue;
      const blob = await resizeImageFile(raw, 1024, 0.8);
      const name = raw.name || `pasted-${Date.now()}.jpg`;
      newFiles.push(new File([blob], name, { type: blob.type || 'image/jpeg' }));
    }
    if (newFiles.length) setPendingFiles((prev) => [...prev, ...newFiles]);
  };

  // Send message (optimistic)
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
          attachments: [],
        },
      ])
    );

    setChatList(list => sortChatList(list.map(c => c._id === selectedChat._id ? {
      ...c,
      lastMessage: { content: content || (filesNow.length ? '📎 Attachment' : ''), timestamp: Date.now(), sender: userId, seen: [] }
    } : c)));

    try {
      if (filesNow.length) {
        const fd = new FormData();
        fd.append('conversation', selectedChat._id);
        if (content) fd.append('content', content);
        filesNow.forEach((f) => fd.append('files', f));
        await api.post('/messages', fd, { headers: { ...headers, 'Content-Type': 'multipart/form-data' } });

        // fetch fresh to get signed URLs immediately
        try {
          const { data: fresh } = await api.get(`/messages/${selectedChat._id}`, { headers });
          const norm = (fresh || []).map((m) => ({
            _id: m._id,
            content: (m.message ?? m.content ?? m.fileUrl ?? '') || '',
            timestamp: m.createdAt,
            isOwn: m.senderId === userId,
            reactions: m.reactions || [],
            seen: m.seen || [],
            attachments: m.attachments || [],
          }));
          setMessages(() => norm);
        } catch {
          /* socket will update soon anyway */
        }
      } else {
        await api.post(
          '/messages',
          { sender: userId, conversation: selectedChat._id, content, type: 'text' },
          { headers }
        );
        // socket broadcast replaces temp
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      // rollback temp and restore
      setMessages((ms) => ms.filter((m) => m._id !== tempId));
      setPendingFiles((prev) => [...filesNow, ...prev]);
      setNewMessage(content);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const toggleReaction = async (msg, emoji) => {
    const getUid = (r) => (typeof r.userId === 'string' ? r.userId : r.userId?._id);
    const existing = (msg.reactions || []).find((r) => getUid(r) === userId);

    if (existing && existing.emoji === emoji) {
      await api.delete(`/messages/${msg._id}/reactions`, { data: { userId, emoji }, headers });
    } else {
      if (existing) {
        await api.delete(`/messages/${msg._id}/reactions`, { data: { userId, emoji: existing.emoji }, headers });
      }
      await api.post(`/messages/${msg._id}/reactions`, { userId, emoji }, { headers });
    }

    // local update for snappy UI
    setMessages((ms) => ms.map((m) => {
      if (m._id !== msg._id) return m;
      const mine = (m.reactions || []).find((r) => getUid(r) === userId);
      if (mine && mine.emoji === emoji) {
        return { ...m, reactions: (m.reactions || []).filter(r => !(getUid(r) === userId && r.emoji === emoji)) };
      }
      const withoutMine = (m.reactions || []).filter(r => getUid(r) !== userId);
      return { ...m, reactions: [...withoutMine, { userId, emoji }] };
    }));
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/');
  };

  // ===== AreaChat-like group name editing =====
  const startEditGroupName = () => {
    if (!selectedChat?.isGroup) return;
    setNewGroupName(selectedChat.name || '');
    setEditingGroupName(true);
  };
  const saveGroupName = async () => {
    if (!selectedChat?.isGroup) { setEditingGroupName(false); return; }
    const trimmed = newGroupName.trim();
    if (!trimmed || trimmed === selectedChat.name) { setEditingGroupName(false); return; }
    try {
      const { data } = await api.put(`/chats/${selectedChat._id}`, { name: trimmed }, { headers });
      setSelectedChat(data);
      setChatList(list => list.map(c => c._id === data._id ? data : c));
    } catch (e) { console.error(e); }
    setEditingGroupName(false);
  };
  const cancelEditGroupName = () => { setEditingGroupName(false); setNewGroupName(''); };

  // ===== AreaChat-like add members =====
  const loadAvailableMembers = async () => {
    if (!selectedChat?.isGroup) return;
    try {
      const { data } = await api.get('/users?limit=100', { headers });
      const currentIds = (selectedChat.users || []).map(u => u._id);
      setAvailableMembers((data || []).filter(u => !currentIds.includes(u._id)));
      setSelectedNewMembers([]);
    } catch (e) { console.error(e); setAvailableMembers([]); }
  };
  useEffect(() => { if (showAddMembers && selectedChat?.isGroup) loadAvailableMembers(); }, [showAddMembers, selectedChat?.isGroup]);
  const addMembersToGroup = async () => {
    if (!selectedNewMembers.length || !selectedChat?.isGroup) return;
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
      setChatList(list => list.map(c => c._id === selectedChat._id ? { ...c, users: [...new Set([...c.users.map(u=>u._id?u._id:u), ...selectedNewMembers])].map(id => c.users.find(u=>u._id===id)||{_id:id,name:''}) } : c));
      await reloadChats();
      setShowAddMembers(false); setSelectedNewMembers([]);
    } catch (e) { console.error('Add members failed:', e); }
  };
  const removeMemberFromGroup = async (memberId) => {
    if (!selectedChat?.isGroup) return;
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
        setChatList(list => list.map(c => c._id === selectedChat._id ? { ...c, users: c.users.filter(u => u._id !== memberId) } : c));
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
    <div className="area-chat-wrapper">
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
          <Link to="/it" className="nav-link">Dashboard</Link>
          <Link to="/it/chat" className="nav-link">Chat</Link>
          <Link to="/it/material-list" className="nav-link">Materials</Link>
          <Link to="/it/manpower-list" className="nav-link">Manpower</Link>
          <Link to="/it/auditlogs" className="nav-link">Audit Logs</Link>
        </nav>
        <div className="profile-menu-container-IT">
          <div className="profile-circle" onClick={() => setProfileMenuOpen((o) => !o)}>
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
              <button className="group-chat-btn modern-new-group-btn" onClick={() => setShowGroupModal(true)}>
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
                          const hasSeen = (msg.seen?.length || 0) > 0;
                          const seenNames = getSeenDisplayNames(msg.seen);
                          // For DMs: only show 'Seen' on very last own message if recipient saw.
                          const seenByRecipient = !selectedChat.isGroup && isLastOwn && hasSeen;
                          // For groups: replicate logic from other chats for most recent fully seen message.
                          const isMostRecentSeen = selectedChat.isGroup && hasSeen && (() => {
                            const later = messages.slice(idx + 1);
                            return !later.some(l => {
                              if (!l.seen?.length) return false;
                              const laterIds = l.seen.map(s => s.userId);
                              const ids = msg.seen.map(s => s.userId);
                              return ids.every(id => laterIds.includes(id));
                            });
                          })();

                          return (
                            <div key={`${String(msg._id)}-${idx}`} className={`modern-message-wrapper ${msg.isOwn ? 'own' : 'other'}`}>
                              <div className={`modern-message ${msg.isOwn ? 'own' : 'other'}`}>
                                <div className="modern-message-content">
                                  {msg.content && <div className="msg-text">{msg.content}</div>}
                                  {Array.isArray(msg.attachments) && msg.attachments.length > 0 && (
                                    <div className="msg-attachments">
                                      {msg.attachments.map((a, i) => {
                                        const mime = a.mime || '';
                                        const isImg = mime.startsWith('image/');
                                        const isVid = mime.startsWith('video/');
                                        const isAud = mime.startsWith('audio/');
                                        const href = a.url;
                                        if (isImg) {
                                          return href ? (
                                            <a key={i} href={href} target="_blank" rel="noreferrer" className="att-link img">
                                              <img src={href} alt={a.name} className="att-image" />
                                            </a>
                                          ) : <div key={i} className="att-placeholder">Image (loading){a.name ? `: ${a.name}` : ''}</div>;
                                        }
                                        if (isVid) return href ? <div key={i} className="att-video"><video src={href} controls /></div> : <div key={i} className="att-placeholder">Video (loading){a.name ? `: ${a.name}` : ''}</div>;
                                        if (isAud) return href ? <div key={i} className="att-audio"><audio src={href} controls /></div> : <div key={i} className="att-placeholder">Audio (loading){a.name ? `: ${a.name}` : ''}</div>;
                                        return <a key={i} href={href || '#'} download className="att-doc">📎 {a.name || 'File'}</a>;
                                      })}
                                    </div>
                                  )}
                                  {!selectedChat.isGroup && seenByRecipient && <FaCheck className="message-tick" />}
                                </div>
                                <div className="modern-message-time">
                                  {formatTime(msg.timestamp)}
                                  {selectedChat.isGroup && isMostRecentSeen && (
                                    <div className="message-seen-info">
                                      <span
                                        className="seen-indicator group-seen"
                                        onClick={() => setShowSeenDetails(showSeenDetails === msg._id ? null : msg._id)}
                                        title={`Seen by ${seenNames.join(', ')}`}
                                      >
                                        Seen by: {getGroupSeenDisplay(seenNames)}
                                      </span>
                                      {showSeenDetails === msg._id && (
                                        <div className="seen-details-tooltip">
                                          <div className="tooltip-header">Seen by:</div>
                                          <div className="seen-users-list">
                                            {seenNames.map((n, i2) => <div key={i2} className="seen-user"><span className="seen-user-name">{n}</span></div>)}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  {!selectedChat.isGroup && seenByRecipient && <span className="seen-indicator dm-seen">Seen</span>}
                                </div>
                                <div className="reactions-bar">
                                  {Object.entries(counts).map(([e, c]) => {
                                    const hasReacted = (msg.reactions || []).some(r => (typeof r.userId === 'string' ? r.userId : r.userId?._id) === userId && r.emoji === e);
                                    return (
                                      <button key={e} className={`reaction-pill ${hasReacted ? 'reacted' : ''}`} onClick={() => toggleReaction(msg, e)} title={`${e} ${c > 1 ? `(${c})` : ''}`}>
                                        <span className="reaction-emoji">{e}</span>{c > 1 && <span className="reaction-count">{c}</span>}
                                      </button>
                                    );
                                  })}
                                </div>
                                <div className="hover-reactions-bar">
                                  {['👍', '❤️', '😂', '😮', '😢', '👎'].map(emoji => (
                                    <button key={emoji} className="hover-reaction-btn" onClick={() => toggleReaction(msg, emoji)} title={emoji}>{emoji}</button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          );
                        })
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Scroll to bottom */}
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
                        <img src={attachIcon} className="attach-icon" alt="attach" />
                        <input
                          type="file"
                          hidden
                          multiple
                          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
                          onChange={async (e) => {
                            const arr = Array.from(e.target.files || []);
                            if (arr.length) {
                              const processed = [];
                              for (const f of arr) {
                                if (f.type.startsWith('image/')) {
                                  try {
                                    const blob = await resizeImageFile(f, 1024, 0.8);
                                    processed.push(
                                      new File([blob], f.name || `img-${Date.now()}.jpg`, {
                                        type: blob.type || f.type,
                                      })
                                    );
                                  } catch {
                                    processed.push(f);
                                  }
                                } else {
                                  processed.push(f);
                                }
                              }
                              setPendingFiles((prev) => [...prev, ...processed]);
                            }
                            e.target.value = '';
                          }}
                        />
                      </label>

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
                        onPaste={handlePaste}
                        onKeyPress={handleKeyPress}
                      />

                      <button className="modern-emoji-btn" onClick={() => setShowEmojiPicker((p) => !p)}>😊</button>
                      {showEmojiPicker && (
                        <div className="modern-emoji-picker">
                          <EmojiPicker
                            onEmojiClick={(emojiData) => setNewMessage((m) => (m || '') + (emojiData?.emoji || ''))}
                            height={360}
                            width={300}
                          />
                        </div>
                      )}

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

            {/* Info Sidebar */}
            {showInfoSidebar && selectedChat && (
              <div className="modern-contact-info">
                <div className="messenger-header">
                  <button className="close-details-btn" onClick={() => setShowInfoSidebar(false)}>×</button>
                  <h3>Chat Details</h3>
                </div>
                <div className="messenger-content">
                  <div className="profile-section">
                    <div className="profile-avatar-large">
                      {selectedChat.isGroup ? <FaUsers /> : getDisplayName(selectedChat.users.find(u => u._id !== userId)).charAt(0).toUpperCase()}
                    </div>
                    <div className="profile-info-large">
                      {editingGroupName ? (
                        <div className="edit-name-container">
                          <input type="text" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} className="edit-name-input" autoFocus />
                          <div className="edit-name-actions">
                            <button className="save-name-btn" onClick={saveGroupName}>Save</button>
                            <button className="cancel-name-btn" onClick={cancelEditGroupName}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div className="name-container">
                          <h4>{selectedChat.isGroup ? selectedChat.name : getDisplayName(selectedChat.users.find(u => u._id !== userId))}</h4>
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
                        <button className="action-btn add-members-btn" onClick={() => setShowAddMembers(true)}><FaUsers /><span>Add Members</span></button>
                        <button className="action-btn share-link-btn" onClick={copyJoinCode}><span>Copy Join Code</span></button>
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
                        <div className="detail-item"><span className="detail-label">Name</span><span className="detail-value">{getDisplayName(selectedChat.users.find(u => u._id !== userId))}</span></div>
                        <div className="detail-item"><span className="detail-label">Email</span><span className="detail-value">{selectedChat.users.find(u => u._id !== userId)?.email}</span></div>
                      </>
                    )}
                    <div style={{ marginTop: 12 }}>
                      <div className="info-tab-buttons">
                        <button className={showInfoTab === 'media' ? 'active' : ''} onClick={() => setShowInfoTab('media')}>Media</button>
                        <button className={showInfoTab === 'files' ? 'active' : ''} onClick={() => setShowInfoTab('files')}>Files</button>
                      </div>
                      {showInfoTab === 'media' && (
                        <div className="info-media-grid">
                          {messages.flatMap(m => (m.attachments || [])).filter(a => a.mime && a.mime.startsWith('image/')).map((a, i) => (
                            <div key={i} className="info-media-item"><img src={a.url} alt={a.name} /></div>
                          ))}
                        </div>
                      )}
                      {showInfoTab === 'files' && (
                        <div className="info-files-list">
                          {messages.flatMap(m => (m.attachments || [])).filter(a => !(a.mime && a.mime.startsWith('image/'))).map((a, i) => (
                            <a key={i} href={a.url} download style={{ textDecoration: 'none', color: '#0b5fff' }}>📎 {a.name}</a>
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
                                  <div className="member-info"><span className="member-name">{getDisplayName(u)}</span>{u._id === userId && <span className="member-badge">You</span>}{isCreator && <span className="member-badge admin">Admin</span>}</div>
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
                {showAddMembers && (
                  <div className="add-members-modal">
                    <div className="modal-header">
                      <h4>Add Members</h4>
                      <button className="close-modal-btn" onClick={() => setShowAddMembers(false)}>×</button>
                    </div>
                    <div className="modal-content">
                      <div className="search-container">
                        <input type="text" placeholder="Search users..." className="search-input" onChange={(e) => {
                          const q = e.target.value.toLowerCase();
                          setAvailableMembers(prev => prev.map(u => u).filter(u => getDisplayName(u).toLowerCase().includes(q)));
                        }} />
                      </div>
                      <div className="users-list">
                        {availableMembers.map((u,i) => (
                          <label key={`${u._id}-${i}`} className="user-checkbox-item">
                            <input type="checkbox" checked={selectedNewMembers.includes(u._id)} onChange={() => setSelectedNewMembers(prev => prev.includes(u._id) ? prev.filter(id => id !== u._id) : [...prev, u._id])} />
                            <div className="user-avatar">{getDisplayName(u).charAt(0).toUpperCase()}</div>
                            <span className="user-name">{getDisplayName(u)}</span>
                          </label>
                        ))}
                      </div>
                      <div className="modal-actions">
                        <button className="add-members-submit-btn" onClick={addMembersToGroup} disabled={selectedNewMembers.length === 0}>Add {selectedNewMembers.length} member{selectedNewMembers.length !== 1 ? 's' : ''}</button>
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

export default ItChat;
