// src/components/PicChat.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  FaUsers,
  FaPaperPlane,
  FaCheck,
  FaTachometerAlt,
  FaComments,
  FaEye,
  FaClipboardList,
  FaProjectDiagram,
} from 'react-icons/fa';
import { io } from 'socket.io-client';
import EmojiPicker from 'emoji-picker-react';

import api from '../../api/axiosInstance';
import attachIcon from '../../assets/images/attach.png';
import NotificationBell from '../NotificationBell';
import '../style/pic_style/Pic_Chat.css';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || '/';
const SOCKET_PATH = process.env.REACT_APP_SOCKET_PATH || '/socket.io';

const PicChat = () => {
  const navigate = useNavigate();
  const { chatId } = useParams();

  const token = localStorage.getItem('token');
  let user = {};
  try {
    user = JSON.parse(localStorage.getItem('user') || '{}');
  } catch {
    user = {};
  }
  const userId = (user && (user._id || user.id)) || null;
  const userName = user?.name || 'Z';
  const userRole = user?.role || '';

  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  // sockets & refs
  const socket = useRef(null);
  const selectedChatIdRef = useRef(null);
  const messagesEndRef = useRef(null);
  // Sequence ref for deterministic ordering tie-breaks
  const seqRef = useRef(0);

  // sidebar/search
  const [chatList, setChatList] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  // conversation
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  // store unsent drafts per chat so typing in one chat doesn't appear in another
  const [drafts, setDrafts] = useState({}); // { [chatId]: draftText }
  const [pendingFiles, setPendingFiles] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // UI toggles
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showInfoSidebar, setShowInfoSidebar] = useState(false);
  const [showInfoTab, setShowInfoTab] = useState('media');
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [showSeenDetails, setShowSeenDetails] = useState(null);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  // group modal
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [availableUsers, setAvailableUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);

  // project bits (kept)
  const [project, setProject] = useState(null);
  const [requests, setRequests] = useState([]);

  // chat customization
  const [editingGroupName, setEditingGroupName] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [availableMembers, setAvailableMembers] = useState([]);
  const [selectedNewMembers, setSelectedNewMembers] = useState([]);
  const [pinnedNewChatId, setPinnedNewChatId] = useState(null);
  // collapse/expand members list in info sidebar
  const [showMembersList, setShowMembersList] = useState(false);
  // media viewer (lightbox)
  const [showMediaViewer, setShowMediaViewer] = useState(false);
  const [mediaViewerIndex, setMediaViewerIndex] = useState(0);

  const mediaImages = React.useMemo(() => (
    messages
      .flatMap(m => m.attachments || [])
      .filter(a => a && a.mime && a.mime.startsWith('image/') && a.url)
  ), [messages]);

  const openMediaViewer = (idx) => { setMediaViewerIndex(idx); setShowMediaViewer(true); };
  const closeMediaViewer = () => setShowMediaViewer(false);
  const navMedia = (dir) => {
    setMediaViewerIndex(i => {
      if (!mediaImages.length) return 0;
      const next = (i + dir + mediaImages.length) % mediaImages.length;
      return next;
    });
  };

  useEffect(() => {
    if (!showMediaViewer) return;
    const handler = (e) => {
      if (e.key === 'Escape') closeMediaViewer();
      if (e.key === 'ArrowRight') navMedia(1);
      if (e.key === 'ArrowLeft') navMedia(-1);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showMediaViewer, mediaImages.length]);

  const sortChatList = (list) => {
    const getTs = (c) => {
      if (c?.lastMessage?.tsNum) return c.lastMessage.tsNum;
      let t = c?.lastMessage?.timestamp || c?.lastMessage?.createdAt || c?.lastMessage?.updatedAt || c?.updatedAt || c?.createdAt;
      if (!t && c?._id && /^[a-f0-9]{24}$/.test(c._id)) t = parseInt(c._id.substring(0,8),16) * 1000;
      if (!t) return 0; if (typeof t === 'number') return t; const n = Date.parse(t); return isNaN(n) ? 0 : n;
    };
    return [...(list || [])].sort((a,b) => {
      const diff = getTs(b) - getTs(a);
      if (diff !== 0) return diff;
      const sa = a?.lastMessage?.seq || 0;
      const sb = b?.lastMessage?.seq || 0;
      return sb - sa;
    });
  };

  // helpers
  const getDisplayName = (u) => {
    if (!u) return '';
    if (u.name) return u.name;
    if (u.firstname || u.lastname) return `${u.firstname || ''} ${u.lastname || ''}`.trim();
    return u.email || '';
  };

  // Show seconds for clarity on rapid activity
  const formatTime = (ts) =>
    new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const mergeMessages = (oldMsgs = [], newMsgs = []) => {
    const map = new Map();
    (oldMsgs || []).forEach((m) => {
      if (m && m._id) map.set(String(m._id), m);
    });
    (newMsgs || []).forEach((m) => {
      if (m && m._id) map.set(String(m._id), m);
    });
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

  const getSeenDisplayNames = (seenArray) => {
    if (!seenArray || seenArray.length === 0 || !selectedChat) return [];
    return seenArray
      .map((seen) => selectedChat.users.find((u) => u._id === seen.userId))
      .map(getDisplayName)
      .filter(Boolean);
  };

  const getGroupSeenDisplay = (seenNames) => {
    if (!seenNames || seenNames.length === 0) return '';
    const firstNames = seenNames.map((n) => n.split(' ')[0]);
    if (firstNames.length === 1) return firstNames[0];
    if (firstNames.length === 2) return `${firstNames[0]} and ${firstNames[1]}`;
    if (firstNames.length === 3) return `${firstNames[0]}, ${firstNames[1]} and ${firstNames[2]}`;
    const others = firstNames.length - 2;
    return `${firstNames[0]}, ${firstNames[1]} and ${others} others`;
  };

  // image resize
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

  // paste images
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

  // collapse header when chat selected
  useEffect(() => {
    setIsHeaderCollapsed(!!selectedChat);
  }, [selectedChat]);

  // close profile dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.user-profile')) setProfileMenuOpen(false);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // guard
  useEffect(() => {
    if (!token) navigate('/');
  }, [navigate, token]);

  // project + requests (as-is)
  useEffect(() => {
    if (!token || !userId) return;
    (async () => {
      try {
        const { data } = await api.get(
          `/projects/by-user-status?userId=${userId}&role=pic&status=Ongoing`
        );
        setProject(data[0] || null);
      } catch {
        setProject(null);
      }
    })();
  }, [token, userId]);

  useEffect(() => {
    if (!token || !project) return;
    api
      .get('/requests/mine', { headers })
      .then(({ data }) => {
        const list = Array.isArray(data)
          ? data.filter((r) => r.project && r.project._id === project._id)
          : [];
        setRequests(list);
      })
      .catch(() => setRequests([]));
  }, [token, project, headers]);

  // socket connect (once)
  useEffect(() => {
    if (!userId || !token) return;
    if (socket.current && socket.current.connected) return;

    if (socket.current) {
      socket.current.disconnect();
      socket.current = null;
    }

    socket.current = io(SOCKET_URL, {
      path: SOCKET_PATH,
      withCredentials: true,
      transports: ['websocket', 'polling'],
      auth: { token },
    });

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
        if (msg.sender !== userId) {
          if (socket.current?.connected) socket.current.emit('messageSeen', { messageId: msg._id, userId });
          else socket.current?.once('connect', () => socket.current.emit('messageSeen', { messageId: msg._id, userId }));
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
      setMessages((ms) => ms.map((m) => (m._id === messageId ? { ...m, reactions } : m)));
    };

    socket.current.on('receiveMessage', onReceive);
    socket.current.on('messageSeen', onSeen);
    socket.current.on('chatUpdated', onChatUpdated);
  socket.current.on('messageReaction', onReaction);
  socket.current.on('chatMembersUpdated', onMembersUpdated);
  socket.current.on('chatCreated', onChatCreated);

    return () => {
      socket.current?.off('receiveMessage', onReceive);
      socket.current?.off('messageSeen', onSeen);
      socket.current?.off('chatUpdated', onChatUpdated);
  socket.current?.off('messageReaction', onReaction);
  socket.current?.off('chatMembersUpdated', onMembersUpdated);
  socket.current?.off('chatCreated', onChatCreated);
      socket.current?.disconnect();
    };
  }, [token, userId]);

  // keep current chat id for handlers
  useEffect(() => {
    selectedChatIdRef.current = selectedChat?._id || null;
  }, [selectedChat?._id]);

  // load chats
  const reloadChats = async () => {
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
      let sorted = sortChatList(withTs || []);
      if (pinnedNewChatId) {
        const idx = sorted.findIndex(c => c._id === pinnedNewChatId);
        if (idx > 0) {
          const [p] = sorted.splice(idx,1);
            if (!p.lastMessage) sorted = [p, ...sorted]; else setPinnedNewChatId(null);
        } else if (idx === 0 && sorted[0]?.lastMessage) setPinnedNewChatId(null);
      }
      setChatList(sorted);
    } catch { setChatList([]); }
  };
  useEffect(() => {
    if (token) reloadChats();
  }, [token, headers]);

  // auto-open from URL
  useEffect(() => {
    if (!chatId || chatList.length === 0) return;
    const c = chatList.find((ch) => ch._id === chatId);
    if (c) setSelectedChat(c);
  }, [chatId, chatList]);

  // join room & fetch messages
  useEffect(() => {
    if (!selectedChat) return;
    if (socket.current?.connected) socket.current.emit('joinChat', selectedChat._id);
    else
      socket.current?.once('connect', () =>
        socket.current.emit('joinChat', selectedChat._id)
      );

    (async () => {
      try {
        setLoadingMessages(true);
        const { data } = await api.get(`/messages/${selectedChat._id}`, { headers });
        const norm = (data || []).map((m) => ({
          _id: m._id,
          content: (m.message ?? m.content ?? m.fileUrl ?? '') || '',
          timestamp: m.createdAt,
          isOwn: m.senderId === userId,
          reactions: m.reactions || [],
          seen: m.seen || [],
          attachments: m.attachments || [],
        }));
        // overwrite to avoid mixing with previous chat
        setMessages(() => norm);

        // mark incoming as seen
        norm
          .filter((m) => !m.isOwn)
          .forEach((m) =>
            socket.current?.emit('messageSeen', { messageId: m._id, userId })
          );
      } finally {
        setLoadingMessages(false);
        setTimeout(() => {
          if (messagesEndRef.current)
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }, 50);
      }
    })();
  }, [selectedChat?._id, userId, headers]);

  // autoscroll when messages change
  useEffect(() => {
    if (messagesEndRef.current)
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages, selectedChat]);

  // show/hide scroll-to-bottom
  useEffect(() => {
    const el = document.querySelector('.modern-chat-messages');
    if (!el) return;
    const onScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 20;
      setShowScrollToBottom(!isNearBottom);
    };
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, [selectedChat]);

  const scrollToBottom = () => {
    if (messagesEndRef.current)
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
  };

  // Debounced sidebar search: combine user directory results and existing chats.
  useEffect(() => {
    const timer = setTimeout(async () => {
      const qRaw = searchQuery.trim();
      if (!qRaw) { setSearchResults([]); return; }
      const q = qRaw.toLowerCase();
      try {
        // Fetch matching users
        const { data: usersData } = await api.get(`/users/search?query=${encodeURIComponent(qRaw)}`, { headers });
        const usersArr = Array.isArray(usersData) ? usersData : [];

        // Chats whose name (group) or other participant matches
        const matchedChats = chatList.filter(c => {
          if (c.isGroup) return (c.name || '').toLowerCase().includes(q);
          const other = (Array.isArray(c.users) ? c.users : []).find(u => u && u._id !== userId);
          return other && getDisplayName(other).toLowerCase().includes(q);
        });

        // Users not already in a direct chat (or still include for visibility but mark new)
        const directChatUserIds = new Set();
        chatList.forEach(c => { if (!c.isGroup) (c.users||[]).forEach(u => { if (u && u._id !== userId) directChatUserIds.add(u._id); }); });

        const userResults = usersArr.map(u => ({ ...u, type: 'user', hasChat: directChatUserIds.has(u._id) }));

        // Remove duplicate display: if chat exists and we also have its user, keep the chat but still allow starting from user if no chat.
        const filteredUsers = userResults.filter(u => !u.hasChat);

        // Sort: exact name/email prefix matches first, then others alphabetically
        const score = (name) => {
          if (!q) return 0;
          if (name === qRaw) return 3;
          if (name.startsWith(qRaw)) return 2;
          if (name.includes(qRaw)) return 1;
          return 0;
        };
        const normalizeName = (item) => item.isGroup ? (item.name||'') : getDisplayName((item.users||[]).find(u=>u._id!==userId) || {});
        matchedChats.sort((a,b)=>{
          const na = normalizeName(a).toLowerCase();
          const nb = normalizeName(b).toLowerCase();
            const sa = score(na);
            const sb = score(nb);
            if (sb!==sa) return sb-sa;
            return na.localeCompare(nb);
        });
        filteredUsers.sort((a,b)=>{
          const na = getDisplayName(a).toLowerCase();
          const nb = getDisplayName(b).toLowerCase();
          const sa = score(na);
          const sb = score(nb);
          if (sb!==sa) return sb-sa;
          return na.localeCompare(nb);
        });

        setSearchResults([
          ...matchedChats,
          ...filteredUsers
        ]);
      } catch (e) {
        console.error('Search failed', e);
        setSearchResults([]);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, chatList, userId, headers]);

  // group modal helpers
  const handleUserSearch = async (e) => {
    const val = e.target.value;
    setUserSearch(val);
    try {
      const { data } = await api.get(
        `/users/search?query=${encodeURIComponent(val)}`,
        { headers }
      );
      const list = (data || []).filter((u) => u._id !== userId);
      setAvailableUsers(list);
      setFilteredUsers(list);
    } catch {
      setAvailableUsers([]);
      setFilteredUsers([]);
    }
  };

  const toggleSelectUser = (id) =>
    setSelectedUsers((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const createGroup = async () => {
    if (!groupName.trim() || selectedUsers.length === 0) return;
    try {
      const { data: newChat } = await api.post('/chats', { name: groupName.trim(), users: [userId, ...selectedUsers], isGroup: true }, { headers });
      setChatList(prev => sortChatList([newChat, ...prev.filter(c => c._id !== newChat._id)]));
      setPinnedNewChatId(newChat._id);
      setShowGroupModal(false); setGroupName(''); setSelectedUsers([]); setFilteredUsers([]); setUserSearch('');
      setSelectedChat(newChat); navigate(`/pic/chat/${newChat._id}`);
      reloadChats();
    } catch (err) { console.error('Create group failed:', err); }
  };

  // open chat (also creates DM when clicking a user result)
  const openChat = async (item) => {
    // persist current draft (and ignore if empty) before switching
    if (selectedChat && selectedChat._id) {
      setDrafts(prev => {
        if (!newMessage && (!pendingFiles || pendingFiles.length === 0)) return prev;
        return { ...prev, [selectedChat._id]: newMessage };
      });
    }
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
    // load draft for newly opened chat (if any) & clear search UI
    setNewMessage(drafts[chatToOpen._id] || '');
    setSearchQuery('');
    setSearchResults([]);
    setPendingFiles([]); // don't carry files between chats
    navigate(`/pic/chat/${chatToOpen._id}`);
  };

  // message send (optimistic)
  const sendMessage = async () => {
    const content = (newMessage || '').trim();
    if ((!content && pendingFiles.length === 0) || !selectedChat) return;

    // clear input/pending files UI immediately
    setNewMessage('');
    // remove stored draft for this chat now that we're sending it
    setDrafts(prev => {
      if (!selectedChat?._id) return prev;
      const c = { ...prev }; delete c[selectedChat._id]; return c;
    });

    const filesNow = pendingFiles;
    setPendingFiles([]);

    // optimistic temp
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

    // optimistic sidebar update & reorder
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
        await api.post('/messages', fd, {
          headers: { ...headers, 'Content-Type': 'multipart/form-data' },
        });
        // fetch fresh to get signed URLs
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
        } catch {}
      } else {
        await api.post(
          '/messages',
          { sender: userId, conversation: selectedChat._id, content, type: 'text' },
          { headers }
        );
        // server socket broadcast will replace temp
      }
    } catch (error) {
      // rollback temp
      setMessages((ms) => ms.filter((m) => m._id !== tempId));
      // restore UI
      setPendingFiles((prev) => [...filesNow, ...prev]);
      setNewMessage(content);
    }
  };

  // reactions (with immediate local update for snappy feel)
  const toggleReaction = async (msg, emoji) => {
    const getUid = (r) => (typeof r.userId === 'string' ? r.userId : r.userId?._id);
    const existing = (msg.reactions || []).find((r) => getUid(r) === userId);

    if (existing && existing.emoji === emoji) {
      await api.delete(`/messages/${msg._id}/reactions`, { data: { userId, emoji }, headers });
      setMessages((ms) =>
        ms.map((m) =>
          m._id === msg._id
            ? { ...m, reactions: (m.reactions || []).filter((r) => !(getUid(r) === userId && r.emoji === emoji)) }
            : m
        )
      );
    } else {
      if (existing) {
        await api.delete(`/messages/${msg._id}/reactions`, {
          data: { userId, emoji: existing.emoji },
          headers,
        });
      }
      await api.post(`/messages/${msg._id}/reactions`, { userId, emoji }, { headers });
      setMessages((ms) =>
        ms.map((m) =>
          m._id === msg._id
            ? {
                ...m,
                reactions: [...(m.reactions || []).filter((r) => getUid(r) !== userId), { userId, emoji }],
              }
            : m
        )
      );
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/');
  };

  // group name edit
  const startEditGroupName = () => {
    setEditingGroupName(true);
    setNewGroupName(selectedChat?.name || '');
  };

  const saveGroupName = async () => {
    const nm = (newGroupName || '').trim();
    if (!nm || nm === selectedChat.name) {
      setEditingGroupName(false);
      return;
    }
    try {
      await api.put(`/chats/${selectedChat._id}`, { name: nm }, { headers });
      setSelectedChat((prev) => ({ ...prev, name: nm }));
      setEditingGroupName(false);
      await reloadChats();
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
      const { data } = await api.get('/users', { headers });
      const currentMemberIds = selectedChat.users.map((u) => u._id);
      const available = (data || []).filter((u) => !currentMemberIds.includes(u._id));
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
      setShowAddMembers(false); setSelectedNewMembers([]);
    } catch (error) { console.error('Add members failed:', error); }
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
    } catch (error) {
      if (error?.response?.status === 403) {
        alert(error.response.data?.error || 'You are not allowed to remove members from this group.');
      }
      console.error('Failed to remove member:', error);
    } finally {
      removeMemberFromGroup._busy = false;
    }
  };

  // derived
  const activeList = searchQuery.trim() ? searchResults : chatList;

  const renderSidebarItem = (item) => {
    if (!item) return null;
    // User search result (no chat yet)
    if (item.type === 'user') {
      const name = getDisplayName(item) || 'User';
      return (
        <div key={`user-${item._id}`} className="modern-chat-item user-result" onClick={() => openChat(item)}>
          <div className="modern-chat-avatar">{name.charAt(0).toUpperCase()}</div>
          <div className="modern-chat-info">
            <div className="modern-chat-name">{name}</div>
            <div className="modern-chat-preview" style={{fontStyle:'italic'}}>Start new chat</div>
          </div>
        </div>
      );
    }
    const chat = item;
    const isGroup = !!chat.isGroup;
    const usersArr = Array.isArray(chat.users) ? chat.users : [];
    const other = !isGroup ? usersArr.find(u => u && u._id !== userId) : null;
    const otherName = other ? getDisplayName(other) : '';
    const name = isGroup ? (chat.name || 'Group') : (otherName || 'Direct Chat');
    const preview = chat.lastMessage?.content || (chat.lastMessage?.attachments?.length ? '📎 Attachment' : 'No messages yet');
    const ts = chat.lastMessage?.timestamp || chat.lastMessage?.createdAt || chat.updatedAt || chat.createdAt;
    const timeStr = ts ? formatTime(ts) : '';
    return (
      <div key={chat._id} className={`modern-chat-item ${selectedChat?._id === chat._id ? 'active' : ''}`} onClick={() => openChat(chat)}>
        <div className="modern-chat-avatar">{isGroup ? <FaUsers /> : name.charAt(0).toUpperCase()}</div>
        <div className="modern-chat-info">
          <div className="modern-chat-name">{name}</div>
          <div className="modern-chat-preview">{preview}</div>
        </div>
        {timeStr && <div className="modern-chat-time">{timeStr}</div>}
      </div>
    );
  };

  return (
    <>
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
            <div className="user-list">
              {filteredUsers.map((u) => (
                <label key={u._id} className="user-item">
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
            <div className="profile-avatar">{userName ? userName.charAt(0).toUpperCase() : 'P'}</div>
            <div className="profile-info">
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
            <Link to="/pic" className="nav-item">
              <FaTachometerAlt />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Dashboard</span>
            </Link>
            <Link to="/pic/chat" className="nav-item active">
              <FaComments />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Chat</span>
            </Link>
            {project && (
              <Link to={`/pic/projects/${project._id}/request`} className="nav-item">
                <FaClipboardList />
                <span className={isHeaderCollapsed ? 'hidden' : ''}>Requests</span>
              </Link>
            )}
            {project && (
              <Link to={`/pic/${project._id}`} className="nav-item">
                <FaEye />
                <span className={isHeaderCollapsed ? 'hidden' : ''}>View Project</span>
              </Link>
            )}
            <Link to="/pic/projects" className="nav-item">
              <FaProjectDiagram />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>My Projects</span>
            </Link>
          </nav>

          <NotificationBell />
        </div>
      </header>

      {/* MAIN */}
      <div className="area-chat-content" style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
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
                        {selectedChat.isGroup ? (
                          <FaUsers />
                        ) : (
                          getDisplayName(selectedChat.users.find((u) => u._id !== userId))
                            .charAt(0)
                            .toUpperCase()
                        )}
                      </div>
                      <div className="modern-chat-header-info">
                        <h3>
                          {selectedChat.isGroup
                            ? selectedChat.name
                            : getDisplayName(selectedChat.users.find((u) => u._id !== userId))}
                        </h3>
                      </div>
                    </div>
                    <button className="modern-info-btn" onClick={() => setShowInfoSidebar((s) => !s)}>
                      i
                    </button>
                  </div>

                  {/* Messages */}
                  <div className="modern-chat-messages">
                    {loadingMessages ? (
                      <div className="messages-loading">Loading messages…</div>
                    ) : (
                      dedupedMessages
                        .filter((m) => {
                          const hasText =
                            typeof m.content === 'string' && m.content.trim().length > 0;
                          const hasAttachments =
                            Array.isArray(m.attachments) && m.attachments.length > 0;
                          return hasText || hasAttachments;
                        })
                        .map((msg, idx) => {
                          const counts = (msg.reactions || []).reduce((a, r) => {
                            a[r.emoji] = (a[r.emoji] || 0) + 1;
                            return a;
                          }, {});
                          const isLastOwn = msg.isOwn && idx === messages.length - 1;
                          const seenByRecipient = isLastOwn && (msg.seen?.length || 0) > 0;
                          const seenNames = getSeenDisplayNames(msg.seen);
                          const hasSeen = msg.seen && msg.seen.length > 0;

                          const isMostRecentSeen =
                            hasSeen &&
                            (() => {
                              if (!selectedChat.isGroup) return isLastOwn;
                              const laterMessages = messages.slice(idx + 1);
                              const currentSeenUserIds = msg.seen.map((s) => s.userId);
                              return !laterMessages.some((laterMsg) => {
                                if (!laterMsg.seen || laterMsg.seen.length === 0) return false;
                                const laterSeenUserIds = laterMsg.seen.map((s) => s.userId);
                                return currentSeenUserIds.every((id) =>
                                  laterSeenUserIds.includes(id)
                                );
                              });
                            })();

                          return (
                            <div
                              key={`${String(msg._id)}-${idx}`}
                              className={`modern-message-wrapper ${msg.isOwn ? 'own' : 'other'}`}
                            >
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
                                            <a
                                              key={i}
                                              href={href}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="att-link img"
                                            >
                                              <img src={href} alt={a.name} className="att-image" />
                                            </a>
                                          ) : (
                                            <div key={i} className="att-placeholder">
                                              Image (loading){a.name ? `: ${a.name}` : ''}
                                            </div>
                                          );
                                        }
                                        if (isVid) {
                                          return href ? (
                                            <div key={i} className="att-video">
                                              <video src={href} controls />
                                            </div>
                                          ) : (
                                            <div key={i} className="att-placeholder">
                                              Video (loading){a.name ? `: ${a.name}` : ''}
                                            </div>
                                          );
                                        }
                                        if (isAud) {
                                          return href ? (
                                            <div key={i} className="att-audio">
                                              <audio src={href} controls />
                                            </div>
                                          ) : (
                                            <div key={i} className="att-placeholder">
                                              Audio (loading){a.name ? `: ${a.name}` : ''}
                                            </div>
                                          );
                                        }
                                        return (
                                          <a key={i} href={href || '#'} download className="att-doc">
                                            📎 {a.name || 'File'}
                                          </a>
                                        );
                                      })}
                                    </div>
                                  )}

                                  {/* DM: seen tick on last own */}
                                  {!selectedChat.isGroup && isLastOwn && seenByRecipient && (
                                    <FaCheck className="message-tick" />
                                  )}
                                </div>

                                <div className="modern-message-time">
                                  {formatTime(msg.timestamp)}
                                  {isMostRecentSeen && (
                                    <div className="message-seen-info">
                                      {selectedChat.isGroup ? (
                                        <span
                                          className="seen-indicator group-seen"
                                          onClick={() =>
                                            setShowSeenDetails(
                                              showSeenDetails === msg._id ? null : msg._id
                                            )
                                          }
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
                                                <span className="seen-time">
                                                  {formatTime(
                                                    msg.seen.find(
                                                      (s) =>
                                                        getSeenDisplayNames([s])[0] === name
                                                    )?.timestamp
                                                  )}
                                                </span>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>

                                {/* Hover quick-reactions */}
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

                                {/* Reactions bar */}
                                {Object.keys(counts).length > 0 && (
                                  <div className="reactions-bar">
                                    {Object.entries(counts).map(([emoji, count]) => {
                                      const hasReacted = (msg.reactions || []).some(
                                        (r) =>
                                          (typeof r.userId === 'string'
                                            ? r.userId
                                            : r.userId?._id) === userId && r.emoji === emoji
                                      );
                                      return (
                                        <button
                                          key={emoji}
                                          className={`reaction-pill ${hasReacted ? 'reacted' : ''}`}
                                          onClick={() => toggleReaction(msg, emoji)}
                                          title={`${emoji} ${
                                            count > 1 ? `(${count} reactions)` : ''
                                          }`}
                                        >
                                          <span className="reaction-emoji">{emoji}</span>
                                          {count > 1 && (
                                            <span className="reaction-count">{count}</span>
                                          )}
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Scroll to Bottom */}
                  {showScrollToBottom && (
                    <button className="scroll-to-bottom-btn" onClick={scrollToBottom} title="Scroll to latest messages">
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
                                if (f.type && f.type.startsWith('image/')) {
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
                            const isImg = f.type && f.type.startsWith('image/');
                            const isVid = f.type && f.type.startsWith('video/');
                            const isAud = f.type && f.type.startsWith('audio/');
                            return (
                              <div key={`${f.name}-${i}`} className="pending-item">
                                {isImg && (
                                  <img
                                    src={URL.createObjectURL(f)}
                                    alt={f.name}
                                    className="pending-thumb"
                                  />
                                )}
                                {isVid && (
                                  <video src={URL.createObjectURL(f)} className="pending-thumb" muted />
                                )}
                                {isAud && <span className="pending-chip">🎵 {f.name}</span>}
                                {!isImg && !isVid && !isAud && (
                                  <span className="pending-chip">📎 {f.name}</span>
                                )}
                                <button
                                  className="remove-pending"
                                  onClick={() =>
                                    setPendingFiles((p) => p.filter((_, idx) => idx !== i))
                                  }
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
                        onKeyDown={handleKeyDown}
                      />

                      <button
                        className="modern-emoji-btn"
                        onClick={() => setShowEmojiPicker((p) => !p)}
                      >
                        😊
                      </button>
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
                  <h3>Chat Details</h3>
                  <button className="close-details-btn" onClick={() => setShowInfoSidebar(false)}>
                    ×
                  </button>
                </div>

                <div className="messenger-content">
                  <div className="profile-section">
                    <div className="profile-avatar-large">
                      {selectedChat.isGroup ? (
                        <FaUsers />
                      ) : (
                        getDisplayName(selectedChat.users.find((u) => u._id !== userId))
                          .charAt(0)
                          .toUpperCase()
                      )}
                    </div>
                    <div className="profile-info-large">
                      <div className="name-container">
                        {editingGroupName ? (
                          <div className="edit-name-container">
                            <input
                              type="text"
                              className="edit-name-input"
                              value={newGroupName}
                              onChange={(e) => setNewGroupName(e.target.value)}
                              autoFocus
                            />
                            <div className="edit-name-actions">
                              <button className="save-name-btn" onClick={saveGroupName}>
                                Save
                              </button>
                              <button className="cancel-name-btn" onClick={cancelEditGroupName}>
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <h4>
                              {selectedChat.isGroup
                                ? selectedChat.name
                                : getDisplayName(selectedChat.users.find((u) => u._id !== userId))}
                            </h4>
                            {selectedChat.isGroup && (
                              <button className="edit-name-btn" onClick={startEditGroupName}>
                                Edit
                              </button>
                            )}
                          </>
                        )}
                      </div>
                      <p className="chat-type">
                        {selectedChat.isGroup ? 'Group Chat' : 'Direct Message'}
                      </p>
                    </div>
                  </div>

                  {!selectedChat.isGroup && (
                    <div className="details-section">
                      <h5>Contact Details</h5>
                      {selectedChat.users
                        .filter((u) => u._id !== userId)
                        .map((member) => (
                          <div key={member._id} className="detail-item">
                            <span className="detail-label">NAME</span>
                            <span className="detail-value">{getDisplayName(member)}</span>
                          </div>
                        ))}
                      {selectedChat.users
                        .filter((u) => u._id !== userId)
                        .map((member) => (
                          <div key={member._id} className="detail-item">
                            <span className="detail-label">EMAIL</span>
                            <span className="detail-value">{member.email}</span>
                          </div>
                        ))}
                    </div>
                  )}

                  {selectedChat.isGroup && (
                    <div className="members-section">
                      <button
                        type="button"
                        className="members-header-toggle"
                        onClick={() => setShowMembersList(s => !s)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          width: '100%',
                          background: 'transparent',
                          border: 'none',
                          padding: '4px 0',
                          cursor: 'pointer',
                          fontSize: 'inherit',
                          fontWeight: 600
                        }}
                      >
                        <span>Members ({selectedChat.users.length})</span>
                        <span style={{ fontSize: 12 }}>{showMembersList ? '▲' : '▼'}</span>
                      </button>
                      {showMembersList && (
                        <div className="members-list">
                          {(() => {
                            const unique = selectedChat.users.reduce((acc, curr) => {
                              if (!curr?._id) return acc;
                              if (!acc.map.has(curr._id)) { acc.map.set(curr._id, true); acc.list.push(curr); }
                              return acc;
                            }, { map: new Map(), list: [] }).list;
                            return unique.map(member => {
                              const isCreator = selectedChat.creator && (selectedChat.creator === member._id || selectedChat.creator?._id === member._id);
                              return (
                                <div key={member._id} className="member-item">
                                  <div className="member-avatar">{getDisplayName(member).charAt(0).toUpperCase()}</div>
                                  <div className="member-info">
                                    <span className="member-name">{getDisplayName(member)}</span>
                                    {member._id === userId && <span className="member-badge">You</span>}
                                    {isCreator && <span className="member-badge admin">Admin</span>}
                                  </div>
                                  {member._id !== userId && (
                                    <button className="remove-member-btn" onClick={() => removeMemberFromGroup(member._id)}>×</button>
                                  )}
                                </div>
                              );
                            });
                          })()}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="actions-section">
                    {selectedChat.isGroup && (
                      <button
                        className="action-btn add-members-btn"
                        onClick={() => {
                          setShowAddMembers(true);
                          loadAvailableMembers();
                        }}
                      >
                        <FaUsers />
                        Add Members
                      </button>
                    )}
                    <button className="action-btn block-btn">
                      <span>🚫</span>
                      Block
                    </button>
                    <button className="action-btn report-btn">
                      <span>⚠️</span>
                      Report
                    </button>
                  </div>

                  {/* Media / Files tabs */}
                  <div style={{ marginTop: 12 }}>
                    <div className="info-tab-buttons">
                      <button
                        className={showInfoTab === 'media' ? 'active' : ''}
                        onClick={() => setShowInfoTab('media')}
                      >
                        Media
                      </button>
                      <button
                        className={showInfoTab === 'files' ? 'active' : ''}
                        onClick={() => setShowInfoTab('files')}
                      >
                        Files
                      </button>
                    </div>

                    {showInfoTab === 'media' && (
                      <div className="info-media-grid" style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {mediaImages.map((a, i) => (
                          <div key={i} className="info-media-item" style={{ width: 60, height: 60, overflow: 'hidden', borderRadius: 4, cursor: 'pointer', position: 'relative' }} onClick={() => openMediaViewer(i)}>
                            <img src={a.url} alt={a.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </div>
                        ))}
                        {mediaImages.length === 0 && <div style={{ fontSize: 12, opacity: 0.6 }}>No images</div>}
                      </div>
                    )}

                    {showInfoTab === 'files' && (
                      <div className="info-files-list" style={{ maxHeight: 200, overflowY: 'auto' }}>
                        {messages
                          .flatMap((m) => m.attachments || [])
                          .filter((a) => !(a.mime && a.mime.startsWith('image/')))
                          .map((a, i) => (
                            <a
                              key={i}
                              href={a.url}
                              download
                              style={{ display: 'block', textDecoration: 'none', color: '#0b5fff' }}
                            >
                              📎 {a.name}
                            </a>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Add Members Modal */}
            {showAddMembers && (
              <div className="add-members-modal">
                <div className="modal-header">
                  <h4>Add Members</h4>
                  <button className="close-modal-btn" onClick={() => setShowAddMembers(false)}>
                    ×
                  </button>
                </div>
                <div className="modal-content">
                  <div className="search-container">
                    <input
                      type="text"
                      className="search-input"
                      placeholder="Search users..."
                      onChange={(e) => {
                        const query = e.target.value.toLowerCase();
                        const filtered = availableMembers.filter((u) =>
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
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedNewMembers((prev) => [...prev, u._id]);
                            } else {
                              setSelectedNewMembers((prev) => prev.filter((id) => id !== u._id));
                            }
                          }}
                        />
                        <span>{getDisplayName(u)}</span>
                      </label>
                    ))}
                  </div>
                  <button
                    className="add-members-submit-btn"
                    onClick={addMembersToGroup}
                    disabled={selectedNewMembers.length === 0}
                  >
                    Add Selected Members
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
  </div>
  {showMediaViewer && mediaImages[mediaViewerIndex] && (
      <div className="media-viewer-overlay" onClick={closeMediaViewer} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
        <div style={{ position: 'absolute', top: 12, right: 20, display: 'flex', gap: 12 }}>
          <button onClick={(e) => { e.stopPropagation(); closeMediaViewer(); }} style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none', fontSize: 24, width: 44, height: 44, borderRadius: '50%', cursor: 'pointer' }}>×</button>
        </div>
        <button onClick={(e) => { e.stopPropagation(); navMedia(-1); }} style={{ position: 'absolute', left: 10, background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none', fontSize: 32, width: 48, height: 72, borderRadius: 6, cursor: 'pointer' }}>‹</button>
        <img
          src={mediaImages[mediaViewerIndex].url}
          alt={mediaImages[mediaViewerIndex].name || 'Image'}
          onClick={(e) => e.stopPropagation()}
          style={{ maxWidth: '90%', maxHeight: '85%', objectFit: 'contain', boxShadow: '0 0 12px rgba(0,0,0,0.6)', borderRadius: 8 }}
        />
        <button onClick={(e) => { e.stopPropagation(); navMedia(1); }} style={{ position: 'absolute', right: 10, background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none', fontSize: 32, width: 48, height: 72, borderRadius: 6, cursor: 'pointer' }}>›</button>
        <div style={{ marginTop: 12, color: '#eee', fontSize: 13 }} onClick={(e) => e.stopPropagation()}>
          {(mediaViewerIndex + 1)} / {mediaImages.length} {mediaImages[mediaViewerIndex].name ? '— ' + mediaImages[mediaViewerIndex].name : ''}
        </div>
      </div>
    )}
  </>
  );
};

export default PicChat;
