// src/components/AreaChat.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import AppHeader from '../layout/AppHeader';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  FaUsers, FaPaperPlane, FaTachometerAlt, FaComments, FaBoxes,
  FaClipboardList, FaChartBar, FaProjectDiagram, FaReply, FaShare, FaTrash,
  FaSearch, FaTimes, FaArrowUp, FaArrowDown, FaEllipsisH, FaCalendarAlt, FaEye, FaExchangeAlt, FaMapMarkerAlt, FaSignOutAlt, FaUserPlus
} from 'react-icons/fa';
import { io } from 'socket.io-client';
import EmojiPicker from 'emoji-picker-react';
import api, { API_BASE_URL } from '../../api/axiosInstance';
import { SOCKET_URL, SOCKET_PATH } from '../../utils/socketConfig';
import '../style/am_style/AreaChat.css';

// Map role/baseSegment to its navigation links so reused chat shows correct menu.
const NAV_CONFIG = {
  am: [
    { to: '/am', icon: FaTachometerAlt, label: 'Dashboard' },
    { to: '/am/chat', icon: FaComments, label: 'Chat', activeMatch: /^\/am\/chat/ },
    { to: '/am/matreq', icon: FaBoxes, label: 'Material' },
    { to: '/am/manpower-requests', icon: FaUsers, label: 'Manpower' },
    { to: '/am/viewproj', icon: FaProjectDiagram, label: 'Projects' },
    { to: '/logs', icon: FaClipboardList, label: 'Logs' },
    { to: '/reports', icon: FaChartBar, label: 'Reports' },
  ],
  pm: [
    { to: '/pm/chat', icon: FaComments, label: 'Chat', activeMatch: /^\/pm\/chat/ },
    { to: '/pm/request/placeholder', icon: FaBoxes, label: 'Material', activeMatch: /^\/pm\/request/ },
    { to: '/pm/manpower-list', icon: FaUsers, label: 'Manpower', activeMatch: /^\/pm\/manpower/ },
    { toDynamic: (pid)=> pid ? `/pm/viewprojects/${pid}` : null, icon: FaProjectDiagram, label: 'View Project', activeMatch: /^\/pm\/viewprojects/ },
    { to: '/pm/daily-logs', icon: FaClipboardList, label: 'Logs', activeMatch: /^\/pm\/daily-logs(?!-list)/ },
    { toDynamic: (pid)=> pid ? `/pm/progress-report/${pid}` : null, icon: FaChartBar, label: 'Reports', activeMatch: /^\/pm\/progress-report/ },
    { to: '/pm/daily-logs-list', icon: FaCalendarAlt, label: 'Daily Logs', activeMatch: /^\/pm\/daily-logs-list/ },
  ],
  pic: [
    { to: '/pic', icon: FaTachometerAlt, label: 'Dashboard', activeMatch: /^\/pic(?!\/)/ },
    { to: '/pic/chat', icon: FaComments, label: 'Chat', activeMatch: /^\/pic\/chat/ },
    { to: '/pic/requests', icon: FaClipboardList, label: 'Requests', activeMatch: /^\/pic\/requests/ },
    { toDynamic: (pid) => pid ? `/pic/${pid}` : null, icon: FaEye, label: 'View Project', activeMatch: /^\/pic\/(?!chat|projects|requests)([a-f0-9]{24})$/ },
    { to: '/pic/projects', icon: FaProjectDiagram, label: 'My Projects', activeMatch: /^\/pic\/projects/ },
  ],
  it: [
  { to: '/it', icon: FaTachometerAlt, label: 'Dashboard', activeMatch: /^\/it(?!\/.+)/ },
  { to: '/it/chat', icon: FaComments, label: 'Chat', activeMatch: /^\/it\/chat/ },
  { to: '/it/material-list', icon: FaBoxes, label: 'Materials', activeMatch: /^\/it\/material-list/ },
  { to: '/it/manpower-list', icon: FaUsers, label: 'Manpower', activeMatch: /^\/it\/manpower-list/ },
  { to: '/it/auditlogs', icon: FaClipboardList, label: 'Audit Logs', activeMatch: /^\/it\/auditlogs/ },
  ],
  ceo: [
    { to: '/ceo/dash', icon: FaTachometerAlt, label: 'Dashboard', activeMatch: /^\/ceo\/dash/ },
    { to: '/ceo/chat', icon: FaComments, label: 'Chat', activeMatch: /^\/ceo\/chat/ },
    { to: '/ceo/manpower-requests', icon: FaUsers, label: 'Manpower', activeMatch: /^\/ceo\/manpower-requests/ },
    { to: '/ceo/proj', icon: FaProjectDiagram, label: 'Projects', activeMatch: /^\/ceo\/proj/ },
    { to: '/ceo/material-list', icon: FaBoxes, label: 'Materials', activeMatch: /^\/ceo\/material-list/ },
    { to: '/ceo/audit-logs', icon: FaClipboardList, label: 'Audit Logs', activeMatch: /^\/ceo\/audit-logs/ },
    { to: '/reports', icon: FaChartBar, label: 'Reports', activeMatch: /^\/reports/ },
    // Areas & Projects toggle button omitted here (requires dashboard-only sidebar logic)
  ],
  hr: [
    { to: '/hr', icon: FaTachometerAlt, label: 'Dashboard', activeMatch: /^\/hr(?!\/.+)/ },
    { to: '/hr/chat', icon: FaComments, label: 'Chat', activeMatch: /^\/hr\/chat/ },
    { to: '/hr/mlist', icon: FaUsers, label: 'Manpower', activeMatch: /^\/hr\/mlist/ },
    { to: '/hr/movement', icon: FaExchangeAlt, label: 'Movement', activeMatch: /^\/hr\/movement/ },
    { to: '/hr/project-records', icon: FaProjectDiagram, label: 'Projects', activeMatch: /^\/hr\/project-records/ },
    { to: '/hr/attendance', icon: FaCalendarAlt, label: 'Attendance', activeMatch: /^\/hr\/attendance/ },
  ],
  staff: [
    { to: '/staff/current-project', icon: FaProjectDiagram, label: 'Project', activeMatch: /^\/staff\/current-project/ },
    { to: '/staff/chat', icon: FaComments, label: 'Chat', activeMatch: /^\/staff\/chat/ },
    { to: '/staff/all-projects', icon: FaProjectDiagram, label: 'My Projects', activeMatch: /^\/staff\/all-projects/ },
  ],
  'hr-site': [
    { to: '/hr-site/current-project', icon: FaProjectDiagram, label: 'Project', activeMatch: /^\/hr-site\/current-project/ },
    { to: '/hr-site/chat', icon: FaComments, label: 'Chat', activeMatch: /^\/hr-site\/chat/ },
    { to: '/hr-site/all-projects', icon: FaProjectDiagram, label: 'My Projects', activeMatch: /^\/hr-site\/all-projects/ },
    { to: '/hr-site/attendance-report', icon: FaClipboardList, label: 'Attendance', activeMatch: /^\/hr-site\/attendance-report/ },
  ],
};

// Socket base and path are centralized in utils/socketConfig

// Generic chat component now parameterized by baseSegment so other roles reuse it safely.
const AreaChat = ({ baseSegment = 'am' }) => {
  const navigate   = useNavigate();
  const { chatId } = useParams();

  const token    = localStorage.getItem('token');
  const user     = JSON.parse(localStorage.getItem('user') || '{}');
  const userId   = user?._id;
  const userName = user?.name || 'Z';
  const userRole = user?.role || '';

  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const socket = useRef(null);
  const selectedChatIdRef = useRef(null);
  const messagesEndRef = useRef(null);
  // monotonic sequence for ordering tie-breaks (newer updates always larger)
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
  const [drafts, setDrafts] = useState({}); // { [chatId]: text }
  const [pendingFiles, setPendingFiles] = useState([]); // <— NEW
  const [loadingMessages, setLoadingMessages] = useState(false);

  // UI
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showInfoSidebar, setShowInfoSidebar] = useState(false);
  const [showInfoTab, setShowInfoTab] = useState('media');
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [showSeenDetails, setShowSeenDetails] = useState(null);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  // Message-level features (search, reply, forward, delete)
  const [messageSearch, setMessageSearch] = useState('');
  const [searchMatches, setSearchMatches] = useState([]); // indices of matching messages
  const [searchIndex, setSearchIndex] = useState(0);
  const [replyTo, setReplyTo] = useState(null); // message object being replied to
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [forwardMessage, setForwardMessage] = useState(null);
  const [forwardTargets, setForwardTargets] = useState([]); // chat IDs to forward to
  const [actionMenu, setActionMenu] = useState({ open: false, msgId: null, x: 0, y: 0 });

  // Group modal
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [availableUsers, setAvailableUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  // Keep a just-created (empty) group at the very top until it gets its first message
  const [pinnedNewChatId, setPinnedNewChatId] = useState(null);
  // (Restored) group creation member selection
  const [selectedUsers, setSelectedUsers] = useState([]);
  // Group name editing
  const [editingGroupName, setEditingGroupName] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  // Add members modal
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [availableMembers, setAvailableMembers] = useState([]);
  const [selectedNewMembers, setSelectedNewMembers] = useState([]);
  const [addMembersSearch, setAddMembersSearch] = useState('');
  // collapse/expand members list (only for group chats)
  const [showMembersList, setShowMembersList] = useState(false);
  // media viewer (lightbox)
  const [showMediaViewer, setShowMediaViewer] = useState(false);
  const [mediaViewerIndex, setMediaViewerIndex] = useState(0);
  // For Project Manager & PIC conditional nav items (project-dependent)
  const [pmProjectId, setPmProjectId] = useState(null);
  const [picProjectId, setPicProjectId] = useState(null);
  // Track which long messages are expanded (to avoid truncation)
  const [expandedLongMessages, setExpandedLongMessages] = useState(new Set());
  // Real-time presence (Set of userIds online) and per-chat last read timestamps
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [lastRead, setLastRead] = useState({}); // { chatId: epochMs }

  // Hydrate persisted read markers (so navigating away & back keeps chats read)
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('chatLastRead') || '{}');
      if (stored && typeof stored === 'object') setLastRead(stored);
    } catch {}
  }, []);

  // helper: consistent display name for a user
  function getDisplayName(u) {
    return u?.name || `${u?.firstname || ''} ${u?.lastname || ''}`.trim() || u?.email || '';
  }

  const toggleExpandLong = (id) => {
    setExpandedLongMessages(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const mediaImages = useMemo(() => (
    messages
      .flatMap(m => m.attachments || [])
      .filter(a => a && a.mime && a.mime.startsWith('image/') && a.url)
  ), [messages]);
  
  // Filtered list for Add Members modal (non-destructive filtering)
  const filteredAvailableMembers = useMemo(() => {
    if (!addMembersSearch.trim()) return availableMembers;
    const q = addMembersSearch.trim().toLowerCase();
    return availableMembers.filter(u => getDisplayName(u).toLowerCase().includes(q));
  }, [availableMembers, addMembersSearch]);
  // Map for quick lookup of an image attachment's index within mediaImages (by URL)
  const mediaImageIndexByUrl = useMemo(() => {
    const map = new Map();
    mediaImages.forEach((img, idx) => { if (img?.url) map.set(img.url, idx); });
    return map;
  }, [mediaImages]);
  const openMediaViewer = (idx) => { setMediaViewerIndex(idx); setShowMediaViewer(true); };
  const closeMediaViewer = () => setShowMediaViewer(false);
  const navMedia = (dir) => {
    setMediaViewerIndex(i => {
      if (!mediaImages.length) return 0;
      return (i + dir + mediaImages.length) % mediaImages.length;
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

  // Load minimal project info for PM & PIC to show conditional nav links similar to their dashboards
  useEffect(() => {
    if (baseSegment !== 'pm' && baseSegment !== 'pic') return;
    (async () => {
      try {
        if (baseSegment === 'pm') {
          const { data } = await api.get('/projects?limit=1', { headers });
          if (Array.isArray(data) && data.length) {
            const first = data[0];
            setPmProjectId(first._id || first.id || null);
          }
        } else if (baseSegment === 'pic' && userId) {
          // Mirror PicDash: /projects/by-user-status?userId=...&role=pic&status=Ongoing
          const { data } = await api.get(`/projects/by-user-status?userId=${userId}&role=pic&status=Ongoing`, { headers });
            if (Array.isArray(data) && data.length) {
              const first = data[0];
              setPicProjectId(first._id || first.id || null);
            }
        }
      } catch { /* ignore */ }
    })();
  }, [baseSegment, headers, userId]);

  // Consistent ordering helper: newest lastMessage (with fallbacks) first, plus pin logic
  const sortChatList = (list) => {
    // A chat only counts as having a real last message if it has: non-empty content OR attachments OR a sender id.
    const hasRealLastMessage = (c) => {
      const lm = c?.lastMessage;
      // For group chats we want even an "empty" synthetic placeholder (no content/attachments/sender)
      // to count so ordering uses its timestamp and places it among active chats.
      if (c?.isGroup) {
        if (!lm) return true; // no lastMessage yet (we may synthesize elsewhere) -> include
        const hasContentG = typeof lm.content === 'string' && lm.content.trim().length > 0;
        const hasAttG = Array.isArray(lm.attachments) && lm.attachments.length > 0;
        const hasSenderG = !!lm.sender;
        // If it's still empty placeholder, still treat as real for ordering.
        if (!hasContentG && !hasAttG && !hasSenderG) return true;
        return true; // normal non-empty group message
      }
      // Direct chats: only count if there is a meaningful lastMessage
      if (!lm) return false;
      const hasContent = typeof lm.content === 'string' && lm.content.trim().length > 0;
      const hasAttachments = Array.isArray(lm.attachments) && lm.attachments.length > 0;
      const hasSender = !!lm.sender;
      return hasContent || hasAttachments || hasSender;
    };
    const getTs = (c) => {
      // Prefer a precomputed numeric timestamp for reliable ordering
      if (c?.lastMessage?.tsNum) return c.lastMessage.tsNum;
      // For empty group chats (no lastMessage) use createdAt so they sort by creation time.
      if (!c?.lastMessage && c?.isGroup) {
        const created = c.createdAt || c.updatedAt;
        if (created) {
          const num = typeof created === 'number' ? created : Date.parse(created);
          return isNaN(num) ? 0 : num;
        }
      }
      let t = c?.lastMessage?.timestamp || c?.lastMessage?.createdAt || c?.lastMessage?.updatedAt || c?.updatedAt || c?.createdAt;
      if (!t && c?._id && /^[a-f0-9]{24}$/.test(c._id)) {
        t = parseInt(c._id.substring(0,8),16) * 1000;
      }
      if (!t) return 0;
      if (typeof t === 'number') return t;
      const n = Date.parse(t);
      return isNaN(n) ? 0 : n;
    };
    // Updated priority:
    // - Chats with a real lastMessage OR (empty group chats) participate in chronological ordering.
    // - Empty direct chats (no lastMessage) stay at the bottom in original order.
    const withIndex = [...(list || [])].map((c, idx) => ({ c, idx }));
    let sorted = withIndex.sort((a, b) => {
      const aHas = hasRealLastMessage(a.c);
      const bHas = hasRealLastMessage(b.c);
      if (aHas && !bHas) return -1;
      if (!aHas && bHas) return 1;
      if (!aHas && !bHas) return a.idx - b.idx; // both empty non-group (DM) chats
      // both have lastMessage -> original ordering logic
      const diff = getTs(b.c) - getTs(a.c);
      if (diff !== 0) return diff;
      const sa = a.c?.lastMessage?.seq || 0;
      const sb = b.c?.lastMessage?.seq || 0;
  if (sb !== sa) return sb - sa;
  // Final deterministic fallback: group chats before direct if otherwise identical
  if (a.c.isGroup && !b.c.isGroup) return -1;
  if (!a.c.isGroup && b.c.isGroup) return 1;
  return 0;
    }).map(x => x.c);
    if (pinnedNewChatId) {
      const idx = sorted.findIndex(c => c._id === pinnedNewChatId);
      if (idx > -1) {
        const pinned = sorted[idx];
        if (!pinned.lastMessage) {
          // Now that empty chats no longer float to top automatically, we also remove special pinning behavior.
          // Leave it in place only if you still want manual pin; otherwise just clear the pin state.
          // So we simply keep order and clear pin.
          sorted = sorted; // no-op
          setPinnedNewChatId(null);
        } else {
          setPinnedNewChatId(null);
        }
      } else {
        setPinnedNewChatId(null);
      }
    }
    return sorted;
  };

  // reloadChats defined once (see below after socket setup)

  // Unpin when first message arrives (extra safeguard)
  useEffect(() => {
    if (!pinnedNewChatId) return;
    const pinned = chatList.find(c => c._id === pinnedNewChatId);
    if (pinned && pinned.lastMessage) setPinnedNewChatId(null);
  }, [chatList, pinnedNewChatId]);

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
  // Close message action menu on outside/Escape
  useEffect(() => {
    const onDocClick = (e) => { if (!e.target.closest('.msg-action-trigger') && !e.target.closest('.msg-action-popover')) setActionMenu(m => m.open ? { ...m, open:false } : m); };
    const onKey = (e) => { if (e.key === 'Escape') setActionMenu(m => m.open ? { ...m, open:false } : m); };
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('click', onDocClick); document.removeEventListener('keydown', onKey); };
  }, []);

  // helpers (getDisplayName moved above for earlier usage)
  // Show seconds so chats ordered within the same minute are distinguishable
  const formatTime = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
  const now = new Date();
  const sameDay = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  if (sameDay) return timeStr;
  // Include short date + time (no seconds if you prefer, but keep seconds for consistency)
  const dateStr = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  // If different year add year
  const addYear = d.getFullYear() !== now.getFullYear() ? ' ' + d.getFullYear() : '';
  return `${dateStr}${addYear} ${timeStr}`;
  };

  const getSeenDisplayNames = (seenArray) => {
    if (!seenArray?.length) return [];
    return seenArray.map(s => {
      const user = chatList.find(c => c.users.some(u => u._id === s.userId))?.users.find(u => u._id === s.userId);
      return getDisplayName(user);
    }).filter(Boolean);
  };
  // Merge incoming messages with existing, dedupe by _id and sort by timestamp
  const mergeMessages = (oldMsgs = [], newMsgs = []) => {
    const map = new Map();
    (oldMsgs || []).forEach(m => { if (m && m._id) map.set(String(m._id), m); });
    (newMsgs || []).forEach(m => { if (m && m._id) map.set(String(m._id), m); });
    const arr = Array.from(map.values());
    arr.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    return arr;
  };

  const dedupedMessages = React.useMemo(() => {
    const seen = new Set();
    return (messages || []).filter(m => {
      const id = String(m && m._id);
      if (!id) return false;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [messages]);
  // --- In-chat search helpers ---
  const escapeRegExp = (s='') => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const highlightMessage = (text='') => {
    if (!messageSearch.trim()) return text;
    try {
      const re = new RegExp(`(${escapeRegExp(messageSearch.trim())})`, 'gi');
      return text.replace(re, '<mark class="msg-hit">$1</mark>');
    } catch { return text; }
  };
  useEffect(() => {
    if (!messageSearch.trim()) { setSearchMatches([]); setSearchIndex(0); return; }
    const q = messageSearch.trim().toLowerCase();
    const matches = dedupedMessages
      .map((m,i) => ({ i, content: (m.content||'').toLowerCase() }))
      .filter(x => x.content.includes(q))
      .map(x => x.i);
    setSearchMatches(matches);
    setSearchIndex(0);
    if (matches.length) {
      setTimeout(() => {
        const el = document.querySelector(`[data-msg-index="${matches[0]}"]`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
    }
  }, [messageSearch, dedupedMessages]);
  const gotoMatch = (dir) => {
    if (!searchMatches.length) return;
    setSearchIndex(i => {
      const next = (i + dir + searchMatches.length) % searchMatches.length;
      const idx = searchMatches[next];
      setTimeout(() => {
        const el = document.querySelector(`[data-msg-index="${idx}"]`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 30);
      return next;
    });
  };
  const getGroupSeenDisplay = (names) => {
    const first = names.map(n => n.split(' ')[0]);
    if (first.length <= 1) return first[0] || '';
    if (first.length === 2) return `${first[0]} and ${first[1]}`;
    if (first.length === 3) return `${first[0]}, ${first[1]} and ${first[2]}`;
    return `${first[0]}, ${first[1]} and ${first.length - 2} others`;
  };

  // SOCKET — single connection
  useEffect(() => {
    if (!userId) return;

    if (socket.current) { socket.current.disconnect(); socket.current = null; }
    socket.current = io(SOCKET_URL, {
      path: SOCKET_PATH, withCredentials: true,
      transports: ['websocket', 'polling'], auth: { userId }
    });

    // Diagnostics for production connection issues
    socket.current.on('connect_error', (err) => {
      // If websocket failed first, allow engine.io to fallback to polling automatically; log once
      console.warn('[socket] connect_error', SOCKET_URL, err?.message);
    });
    socket.current.on('error', (err) => {
      console.warn('[socket] error', err);
    });
    socket.current.on('reconnect_attempt', (n) => {
      // ensure both transports remain allowed
      try { socket.current.io.opts.transports = ['websocket','polling']; } catch {}
      if (n === 1) console.info('[socket] reconnect attempt');
    });
    socket.current.on('reconnect_failed', () => {
      console.error('[socket] reconnect failed');
    });

  // Helper: normalize an incoming socket message so that we don't display
  // raw attachment URLs (e.g. signed Supabase URLs) as the text content
  // when the user only sent files/images with no accompanying message.
  const normalizeIncoming = (msg) => {
    let text = (msg.content ?? msg.message ?? msg.fileUrl ?? '') || '';
    const attachments = Array.isArray(msg.attachments) ? msg.attachments : [];
    if (attachments.length) {
      const urls = attachments.map(a => a && a.url).filter(Boolean);
      // If the text exactly equals one of the attachment URLs, drop it.
      if (urls.includes(text)) text = '';
      // If text looks like a long signed URL and every attachment url is contained inside it, drop it.
      if (/^https?:\/\//.test(text) && urls.some(u => text.startsWith(u.split('?')[0]))) {
        text = '';
      }
      // Some backends may echo a temporary placeholder like "Sending X attachment(s)…"
      if (/^Sending \d+ attachment\(s\)…$/.test(text)) text = '';
    }
    return { text, attachments };
  };

  const onReceive = (msg) => {
      const { text, attachments } = normalizeIncoming(msg);
      // update list preview + reorder
      console.log('Debug: onReceive message', msg);
      const tsNum = typeof msg.timestamp === 'number' ? msg.timestamp : (msg.timestamp ? Date.parse(msg.timestamp) : Date.now());
      setChatList(list => {
        let found = false;
        const updated = list.map(c => {
          if (c._id !== msg.conversation) return c;
          found = true;
          // Build preview content with richer attachment indicator (image vs files)
          let content = text;
          if (!content && attachments.length) {
            const allImages = attachments.every(a => (a?.mimetype||'').startsWith('image/'));
            const count = attachments.length;
            content = allImages ? (count === 1 ? '� Photo' : `🖼 ${count} Photos`) : (count === 1 ? '�📎 Attachment' : `📎 ${count} Files`);
          }
          return { ...c, lastMessage: { content, timestamp: msg.timestamp || tsNum, tsNum, seq: ++seqRef.current, attachments, sender: msg.sender } };
        });
        if (!found) return list; // chat not yet in list (will be added by chatCreated event)
        return sortChatList(updated);
      });

      // show in open chat
      if (selectedChatIdRef.current === msg.conversation) {
        setMessages(ms => {
          const filtered = ms.filter(m => {
            if (!String(m._id).startsWith('tmp-')) return true;
            if (!m.isOwn) return true;
            // If server message is from self, drop the temp placeholder
            if (msg.sender === userId) return false;
            // Or if placeholder content matches server text
            if (m.content === (msg.content || '')) return false;
            // Or if placeholder said "Sending X attachment(s)…" and real message has attachments
            if (/^Sending \d+ attachment\(s\)…$/.test(m.content) && (attachments.length > 0)) return false;
            return true;
          });

          return [...filtered, {
            _id: msg._id,
            content: text,
            timestamp: msg.timestamp,
            isOwn: msg.sender === userId,
            reactions: [],
            seen: [],
            attachments,
            replyTo: msg.replyTo || null,
            forwardOf: msg.forwardOf || null,
            senderId: msg.sender || msg.senderId || null,
          }];
        });

        if (msg.sender !== userId) {
          if (socket.current && socket.current.connected) socket.current.emit('messageSeen', { messageId: msg._id, userId });
          else if (socket.current && socket.current.once) socket.current.once('connect', () => socket.current.emit('messageSeen', { messageId: msg._id, userId }));
        }
      }
    };

    const onSeen = ({ messageId, userId: seenBy, timestamp }) => {
      setMessages(ms => ms.map(m => m._id === messageId ? { ...m, seen: [...(m.seen || []), { userId: seenBy, timestamp }] } : m));
    };

    const onChatUpdated = ({ chatId: cId, lastMessage }) => {
      const ts = (typeof lastMessage?.timestamp === 'number' ? lastMessage.timestamp : Date.parse(lastMessage?.timestamp)) || Date.now();
      setChatList(list => sortChatList(list.map(c => {
        if (c._id !== cId) return c;
        const prevSeen = c.lastMessage?.seen || [];
        const mergedSeen = lastMessage?.seen ? lastMessage.seen : prevSeen;
        return { ...c, lastMessage: { ...lastMessage, seen: mergedSeen, tsNum: ts, seq: ++seqRef.current } };
      })));
    };

    const onMembersUpdated = ({ chatId: cid, users, name }) => {
      setChatList(list => list.map(c => c._id === cid ? { ...c, users: users || c.users, name: name || c.name } : c));
      setSelectedChat(prev => prev && prev._id === cid ? { ...prev, users: users || prev.users, name: name || prev.name } : prev);
    };
    const onChatCreated = (chatObj) => {
      if (!chatObj || !chatObj._id) return;
      if (!(chatObj.users || []).some(u => u._id === userId)) return; // only if I'm a member
      const raw = chatObj.lastMessage?.timestamp || chatObj.lastMessage?.createdAt || chatObj.lastMessage?.updatedAt;
      let num = typeof raw === 'number' ? raw : (raw ? Date.parse(raw) : 0);
      chatObj = chatObj.lastMessage ? { ...chatObj, lastMessage: { ...chatObj.lastMessage, tsNum: num, seq: ++seqRef.current } } : chatObj;
      // If no lastMessage yet and NOT a group, don't insert (hide empty 1-1). Allow empty groups to appear.
      if (!chatObj.lastMessage && !chatObj.isGroup) return;
      // For empty group chats add synthetic timestamp based on createdAt/_id for ordering
      if (!chatObj.lastMessage && chatObj.isGroup) {
        let created = chatObj.createdAt || chatObj.updatedAt;
        if (!created && /^[a-f0-9]{24}$/.test(chatObj._id)) {
          created = new Date(parseInt(chatObj._id.substring(0,8),16) * 1000).toISOString();
        }
        let tsNum = 0;
        if (created) {
          tsNum = typeof created === 'number' ? created : Date.parse(created) || 0;
        }
        chatObj = { ...chatObj, lastMessage: { content: '', timestamp: created, tsNum, seq: ++seqRef.current, sender: null, attachments: [], seen: [] } };
      }
    setChatList(list => sortChatList([chatObj, ...list.filter(c => c._id !== chatObj._id)]));
    };

    const onReaction = ({ messageId, reactions }) => {
      setMessages(ms => ms.map(m => m._id === messageId ? { ...m, reactions } : m));
    };

    socket.current.on('receiveMessage', onReceive);
    socket.current.on('messageSeen', onSeen);
    socket.current.on('chatUpdated', onChatUpdated);
  socket.current.on('messageReaction', onReaction);
  socket.current.on('chatMembersUpdated', onMembersUpdated);
  socket.current.on('chatCreated', onChatCreated);

    // Presence + read receipt listeners
    socket.current.on('presenceSnapshot', (ids=[]) => {
      try { setOnlineUsers(new Set(ids.map(String))); } catch {}
    });
    socket.current.on('userOnline', (id) => { if(!id) return; setOnlineUsers(prev => { const n=new Set(prev); n.add(String(id)); return n; }); });
    socket.current.on('userOffline', (id) => { if(!id) return; setOnlineUsers(prev => { const n=new Set(prev); n.delete(String(id)); return n; }); });
    socket.current.on('chatReadReceipt', ({ chatId, timestamp }) => {
      if (chatId && timestamp) setLastRead(lr => ({ ...lr, [chatId]: timestamp }));
    });
    // Request initial presence data
    try { socket.current.emit('getPresence'); } catch {}

    return () => {
      socket.current.off('receiveMessage', onReceive);
      socket.current.off('messageSeen', onSeen);
      socket.current.off('chatUpdated', onChatUpdated);
  socket.current.off('messageReaction', onReaction);
  socket.current.off('chatMembersUpdated', onMembersUpdated);
  socket.current.off('chatCreated', onChatCreated);
  socket.current.off('presenceSnapshot');
  socket.current.off('userOnline');
  socket.current.off('userOffline');
  socket.current.off('chatReadReceipt');
      socket.current.disconnect();
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
  const reloadChats = async () => {
    try {
      const { data } = await api.get('/chats', { headers });
      const withTs = (data || []).map(c => {
        if (c?.lastMessage) {
          const lm = c.lastMessage;
          const raw = lm.timestamp || lm.createdAt || lm.updatedAt;
          let num = typeof raw === 'number' ? raw : (raw ? Date.parse(raw) : 0);
          if (!num) num = 0;
          let content = lm.content || '';
          if ((!content || /^https?:\/\//.test(content)) && Array.isArray(lm.attachments) && lm.attachments.length) {
            const allImages = lm.attachments.every(a => (a?.mimetype||'').startsWith('image/'));
            const count = lm.attachments.length;
            if (allImages) content = count === 1 ? '🖼 Photo' : `🖼 ${count} Photos`;
            else content = count === 1 ? '📎 Attachment' : `📎 ${count} Files`;
          }
          return { ...c, lastMessage: { ...lm, content, tsNum: num, attachments: lm.attachments || [] } };
        }
        // No lastMessage: if it's a group, synthesize one so ordering treats creation as activity
        if (c?.isGroup) {
          let created = c.createdAt || c.updatedAt;
          if (!created && /^[a-f0-9]{24}$/.test(c._id || '')) {
            created = new Date(parseInt(c._id.substring(0,8),16) * 1000).toISOString();
          }
          let tsNum = 0;
          if (created) {
            tsNum = typeof created === 'number' ? created : (Date.parse(created) || 0);
          }
          if (!tsNum) tsNum = Date.now(); // fallback ensure it floats
          return { ...c, lastMessage: { content: '', timestamp: created || new Date().toISOString(), tsNum, seq: ++seqRef.current, sender: null, attachments: [], seen: [] } };
        }
        return c;
      });
      // Visible chats: include all groups (even empty) and only DMs with a real lastMessage
      const visible = withTs.filter(c => {
        if (c.isGroup) return true;
        const lm = c.lastMessage;
        if (!lm) return false;
        const hasContent = typeof lm.content === 'string' && lm.content.trim().length > 0;
        const hasAttachments = Array.isArray(lm.attachments) && lm.attachments.length > 0;
        const hasSender = !!lm.sender;
        return hasContent || hasAttachments || hasSender;
      });
      setChatList(sortChatList(visible));
    } catch { setChatList([]); }
  };
  useEffect(() => { if (token) reloadChats(); }, [token, headers]);

  // auto-select from URL
  useEffect(() => {
    if (!chatId || chatList.length === 0) return;
    const c = chatList.find(ch => ch._id === chatId);
    if (c) setSelectedChat(c);
  }, [chatId, chatList]);

  // join + fetch messages
  useEffect(() => {
    if (!selectedChat) return;
    const chatIdCurrent = selectedChat._id;
    socket.current.emit('joinChat', chatIdCurrent);
    // Clear immediately to avoid briefly showing previous chat's messages
    setMessages([]);

    let cancelled = false;
    (async () => {
      try {
        setLoadingMessages(true);
        const { data } = await api.get(`/messages/${chatIdCurrent}`, { headers });
        if (cancelled) return; // stale fetch guard
        if (!selectedChat || selectedChat._id !== chatIdCurrent) return; // chat switched
        const norm = (data || []).map(m => ({
          _id: m._id,
          content: (m.message ?? m.content ?? m.fileUrl ?? '') || '',
          timestamp: m.createdAt,
          isOwn: m.senderId === userId,
          reactions: m.reactions || [],
          seen: m.seen || [],
          attachments: m.attachments || [],
          replyTo: m.replyTo || null,
          forwardOf: m.forwardOf || null,
          senderId: m.senderId || (m.sender && m.sender._id) || null,
        }));
        setMessages(() => norm);
        norm.filter(m => !m.isOwn).forEach(m => {
          if (socket.current && socket.current.connected) socket.current.emit('messageSeen', { messageId: m._id, userId });
          else if (socket.current && socket.current.once) socket.current.once('connect', () => socket.current.emit('messageSeen', { messageId: m._id, userId }));
        });
      } finally {
        if (!cancelled) {
          setLoadingMessages(false);
          setTimeout(() => scrollToBottom(), 100);
        }
      }
    })();

    return () => {
      cancelled = true;
      socket.current.emit('leaveChat', chatIdCurrent);
    };
  }, [selectedChat?._id, userId, headers]);

  // search (debounced)
  useEffect(() => {
    const id = setTimeout(async () => {
      const q = searchQuery.trim().toLowerCase();
      if (!q) return setSearchResults([]);
      try {
        // Fetch all users once per search (backend already auth-protected)
        const { data: allUsers } = await api.get('/users', { headers });
        const users = Array.isArray(allUsers) ? allUsers : [];

        // Existing chats that match (group or direct)
        const matchedChats = chatList.filter(c => c.isGroup ? (c.name || '').toLowerCase().includes(q)
          : getDisplayName(c.users.find(u => u._id !== userId)).toLowerCase().includes(q));

        // All users matching query (by name/email) regardless of existing chat
        const regex = new RegExp(q, 'i');
        const matchedUsers = users.filter(u => regex.test(u.name || '') || regex.test(u.email || ''));

        // Combine: keep matched chats as-is; add matched users (mark type:'user') if no existing 1-1 chat with them
        const results = [...matchedChats];
        matchedUsers.forEach(u => {
          const alreadyDirect = chatList.some(c => !c.isGroup && c.users.some(x => x._id === u._id));
          if (!alreadyDirect) results.push({ ...u, type: 'user' });
        });

        setSearchResults(results);
      } catch (e) {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(id);
  }, [searchQuery, chatList, userId, headers]);

  // group modal lists
  useEffect(() => {
    if (!showGroupModal) return;
    (async () => {
      try {
        const { data } = await api.get('/users?limit=100', { headers });
        setAvailableUsers(data || []); setFilteredUsers(data || []);
      } catch { setAvailableUsers([]); setFilteredUsers([]); }
    })();
  }, [showGroupModal, headers]);

  useEffect(() => {
    if (showAddMembers && selectedChat?.isGroup) loadAvailableMembers();
  }, [showAddMembers, selectedChat]);

  // actions
  const openChat = async (item) => {
    // persist current draft before switching (if any content or files)
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
    setSearchQuery(''); setSearchResults([]); setPendingFiles([]);
  navigate(`/${baseSegment}/chat/${chatToOpen._id}`);
  // Mark read locally & notify server
  const lmTs = (chatToOpen?.lastMessage && (Date.parse(chatToOpen.lastMessage.timestamp) || chatToOpen.lastMessage.tsNum || Date.now())) || Date.now();
  setLastRead(prev => ({ ...prev, [chatToOpen._id]: lmTs }));
  try {
    const existing = JSON.parse(localStorage.getItem('chatLastRead') || '{}');
    existing[chatToOpen._id] = lmTs;
    localStorage.setItem('chatLastRead', JSON.stringify(existing));
  } catch {}
  // Optimistically add current user to lastMessage.seen so unread clears instantly
  setChatList(prev => prev.map(c => {
    if (c._id === chatToOpen._id) {
      if (c.lastMessage) {
        const seen = (c.lastMessage.seen || []).map(String);
        if (!seen.includes(String(userId))) {
          return { ...c, lastMessage: { ...c.lastMessage, seen: [...c.lastMessage.seen || [], userId] } };
        }
      }
    }
    return c;
  }));
  // Also patch selectedChat state so its header (if any) reflects seen
  setSelectedChat(sc => {
    if (!sc || sc._id !== chatToOpen._id) return sc;
    if (!sc.lastMessage) return sc;
    const seen = (sc.lastMessage.seen || []).map(String);
    if (seen.includes(String(userId))) return sc;
    return { ...sc, lastMessage: { ...sc.lastMessage, seen: [...sc.lastMessage.seen || [], userId] } };
  });
  try { socket.current && socket.current.emit('markChatRead', { chatId: chatToOpen._id, timestamp: lmTs }); } catch {}
  // rely on server markChatRead to update lastMessage.seen
  // Dispatch global event so AppHeader (or others) can refresh unread badge immediately
  try { window.dispatchEvent(new CustomEvent('chatUnreadChanged', { detail: { chatId: chatToOpen._id, action: 'read' } })); } catch {}
  };

  // SEND — text + files (multipart) with optimistic temp message
  const sendMessage = async () => {
    const content = (newMessage || '').trim();
    if (!content && pendingFiles.length === 0) return;
    if (!selectedChat) return;

    const filesNow = pendingFiles;
    setNewMessage('');
    setPendingFiles([]);
    // remove stored draft after sending
    setDrafts(prev => {
      if (!selectedChat?._id) return prev;
      const c = { ...prev }; delete c[selectedChat._id]; return c;
    });

    const tempId = `tmp-${Date.now()}-${Math.random()}`;
    setMessages(ms => mergeMessages(ms, [{
      _id: tempId,
      content: content || (filesNow.length ? `Sending ${filesNow.length} attachment(s)…` : ''),
      timestamp: Date.now(),
      isOwn: true,
      reactions: [],
      seen: [],
      attachments: [], // real attachments come via socket
      replyTo: replyTo ? replyTo._id : null,
    }]));

    // Optimistic sidebar preview + reorder
    const optimisticTs = Date.now();
    setChatList(list => sortChatList(list.map(c => c._id === selectedChat._id ? {
      ...c,
      lastMessage: { content: content || (filesNow.length ? '📎 Attachment' : ''), timestamp: optimisticTs, tsNum: optimisticTs, seq: ++seqRef.current, sender: userId, seen: [] }
    } : c)));

    try {
      const fd = new FormData();
      fd.append('conversation', selectedChat._id);
  if (content) fd.append('content', content);
  if (replyTo) fd.append('replyTo', replyTo._id);
      filesNow.forEach(f => fd.append('files', f));
      await api.post('/messages', fd, { headers: { ...headers, 'Content-Type': 'multipart/form-data' } });
      // fetch fresh messages to ensure attachments (signed URLs) are present immediately
        try {
          const { data: fresh } = await api.get(`/messages/${selectedChat._id}`, { headers });
          const norm = (fresh || []).map(m => ({
            _id: m._id,
            content: m.message || '',
            timestamp: m.createdAt,
            isOwn: m.senderId === userId,
            reactions: m.reactions || [],
            seen: m.seen || [],
            attachments: m.attachments || [],
    replyTo: m.replyTo || null,
    forwardOf: m.forwardOf || null,
  senderId: m.senderId || (m.sender && m.sender._id) || null,
          }));
          // After sending we want the server's canonical set (with attachment URLs).
          // Replace the current messages for this chat with the normalized server result.
      setMessages(() => norm);
      setReplyTo(null);
        } catch (e) {
        // ignore fetch error; socket will deliver the message
      }
    } catch (err) {
      console.error('Failed to send:', err);
      setMessages(ms => ms.filter(m => m._id !== tempId));
      setPendingFiles(prev => [...filesNow, ...prev]);
      setNewMessage(content);
    }
  };

  const toggleReaction = async (msg, emoji) => {
    const getUid = (r) => (typeof r.userId === 'string' ? r.userId : r.userId?._id);
    const mine = msg.reactions.find(r => getUid(r) === userId);
    if (mine && mine.emoji === emoji) {
      await api.delete(`/messages/${msg._id}/reactions`, { data: { userId, emoji }, headers });
    } else {
      if (mine) await api.delete(`/messages/${msg._id}/reactions`, { data: { userId, emoji: mine.emoji }, headers });
      await api.post(`/messages/${msg._id}/reactions`, { userId, emoji }, { headers });
    }
  };

  const handleKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } };
  const handleLogout = () => { localStorage.clear(); navigate('/'); };

  const handleUserSearch = (e) => {
    const q = e.target.value.toLowerCase();
    setUserSearch(q);
    setFilteredUsers(availableUsers.filter(u => getDisplayName(u).toLowerCase().includes(q)));
  };
  const toggleSelectUser = (id) => setSelectedUsers(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  const createGroup = async () => {
    const members = [userId, ...selectedUsers];
    const { data: newChat } = await api.post('/chats', { name: groupName, users: members, isGroup: true }, { headers });
    // Inject synthetic lastMessage if backend returns none
    let enriched = newChat;
    if (enriched && !enriched.lastMessage) {
      let created = enriched.createdAt || enriched.updatedAt;
      if (!created && /^[a-f0-9]{24}$/.test(enriched._id || '')) {
        created = new Date(parseInt(enriched._id.substring(0,8),16) * 1000).toISOString();
      }
      let tsNum = 0;
      if (created) tsNum = typeof created === 'number' ? created : (Date.parse(created) || 0);
      if (!tsNum) tsNum = Date.now();
      enriched = { ...enriched, lastMessage: { content: '', timestamp: created || new Date().toISOString(), tsNum, seq: ++seqRef.current, sender: null, attachments: [], seen: [] } };
    }
    // Optimistically add to list at correct sorted position
    setChatList(list => sortChatList([enriched, ...list.filter(c => c._id !== enriched._id)]));
    setShowGroupModal(false); setGroupName(''); setUserSearch(''); setSelectedUsers([]);
    setSelectedChat(enriched); navigate(`/${baseSegment}/chat/${enriched._id}`);
    // Refresh from server (keeps order but ensures any server-side fields are present)
    reloadChats();
  };

  const startEditGroupName = () => { setNewGroupName(selectedChat.name); setEditingGroupName(true); };
  const saveGroupName = async () => {
    if (!newGroupName.trim() || newGroupName === selectedChat.name) { setEditingGroupName(false); return; }
    try {
      await api.put(`/chats/${selectedChat._id}`, { name: newGroupName.trim() }, { headers });
      setSelectedChat(prev => ({ ...prev, name: newGroupName.trim() }));
      await reloadChats();
      setEditingGroupName(false);
    } catch (e) { console.error(e); }
  };
  const cancelEditGroupName = () => { setEditingGroupName(false); setNewGroupName(''); };

  const loadAvailableMembers = async () => {
    try {
      const { data } = await api.get('/users?limit=100', { headers });
      const currentIds = selectedChat.users.map(u => u._id);
      setAvailableMembers((data || []).filter(u => !currentIds.includes(u._id)));
      setSelectedNewMembers([]);
    } catch (e) { console.error(e); }
  };
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
      // Optimistic local update (avoid extra GET that can race with server)
      setSelectedChat(prev => prev ? { ...prev, users: Array.from(new Set([...prev.users.map(u => u._id ? u._id : u), ...selectedNewMembers]))
        .map(id => prev.users.find(u => u._id === id) || { _id: id, name: '' }) } : prev);
      await reloadChats();
      setShowAddMembers(false); setSelectedNewMembers([]);
    } catch (e) {
      console.error('Add members failed:', e);
    }
  };
  const removeMemberFromGroup = async (memberId) => {
    if (!selectedChat?.isGroup) return;
    if (memberId === userId) return; // don't remove self via this button
    // Prevent rapid double-clicks causing duplicate requests
    if (removeMemberFromGroup._busy) return;
    removeMemberFromGroup._busy = true;
    try {
      let removed = false;
      try {
        const { data } = await api.post(`/chats/${selectedChat._id}/remove-member`, { memberId }, { headers });
        if (data?.chat) { setSelectedChat(data.chat); removed = true; }
        else removed = true; // assume success if no error thrown
      } catch (err) {
        // Only fallback if explicit 403 from remove-member (lack of creator rights) – otherwise rethrow
        if (err?.response?.status === 403) {
          try {
            const remaining = selectedChat.users.filter(u => u._id !== memberId).map(u => u._id);
            await api.put(`/chats/${selectedChat._id}`, { users: remaining }, { headers });
            removed = true;
          } catch (putErr) {
            throw putErr; // surface final failure
          }
        } else {
          throw err;
        }
      }
      if (removed) {
        // Locally filter out the removed member to avoid a GET that may 403 during propagation
        setSelectedChat(prev => prev ? { ...prev, users: prev.users.filter(u => u._id !== memberId) } : prev);
        await reloadChats();
      }
    } catch (e) {
      if (e?.response?.status === 403) {
        // Only show if we truly failed to remove
        alert(e.response.data?.error || 'You are not allowed to remove members from this group.');
      }
      console.error('Remove member failed:', e);
    } finally {
      removeMemberFromGroup._busy = false;
    }
  };

  // Leave group (reassign creator handled server-side)
  const handleLeaveGroup = async () => {
    if (!selectedChat?.isGroup) return;
    const ok = window.confirm('Leave this group chat?');
    if (!ok) return;
    try {
      await api.post(`/chats/${selectedChat._id}/leave`, {}, { headers });
      // Remove from local list and clear selection
      setChatList(list => list.filter(c => c._id !== selectedChat._id));
      setSelectedChat(null);
      navigate(`/${baseSegment}/chat`);
    } catch (e) {
      alert(e?.response?.data?.error || 'Failed to leave group');
    }
  };

  const activeList = searchQuery.trim() ? searchResults : chatList;
  // Derive unique members for selected group chat (avoid duplicates / missing _id entries inflating count)
  const uniqueMembers = useMemo(() => {
    if (!selectedChat?.isGroup) return [];
    return (selectedChat.users || []).reduce((acc, curr) => {
      if (!curr?._id) return acc; // skip invalid
      if (!acc.map.has(curr._id)) { acc.map.set(curr._id, true); acc.list.push(curr); }
      return acc;
    }, { map: new Map(), list: [] }).list;
  }, [selectedChat]);

  return (
    <>
    <div className="area-chat-wrapper">
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
              {filteredUsers.map((u, i) => (
                <label key={`${u._id}-${i}`} className="user-item">
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
      {/* FORWARD MODAL */}
      {showForwardModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth:420 }}>
            <h3>Forward Message</h3>
            <div style={{ fontSize:12, marginBottom:8, opacity:.7 }}>Select chats to forward to</div>
            <div className="user-list" style={{ maxHeight:220 }}>
              {chatList.filter(c => c._id !== selectedChat?._id).map(c => {
                const name = c.isGroup ? c.name : getDisplayName(c.users.find(u => u._id !== userId));
                return (
                  <label key={c._id} className="user-item">
                    <input type="checkbox" checked={forwardTargets.includes(c._id)} onChange={()=>setForwardTargets(t => t.includes(c._id) ? t.filter(id=>id!==c._id) : [...t, c._id])} />
                    {name}
                  </label>
                );
              })}
            </div>
            <div className="modal-buttons">
              <button className="btn-create" disabled={!forwardTargets.length} onClick={() => {
                if (!forwardMessage) return;
                const run = async () => {
                  try {
                    for (const cid of forwardTargets) {
                      const atts = Array.isArray(forwardMessage.attachments) ? forwardMessage.attachments : [];
                      if (atts.length) {
                        // Re-upload each attachment by fetching the existing URL & appending as File
                        const fd = new FormData();
                        fd.append('conversation', cid);
                        if (forwardMessage.content) fd.append('content', forwardMessage.content);
                        fd.append('forwardOf', forwardMessage._id);
                        for (const att of atts) {
                          if (!att?.url) continue;
                          try {
                            const res = await fetch(att.url);
                            const blob = await res.blob();
                            const nameGuess = att.name || att.url.split('?')[0].split('/').pop() || 'attachment';
                            const file = new File([blob], nameGuess, { type: blob.type || att.mime || 'application/octet-stream' });
                            fd.append('files', file);
                          } catch { /* ignore individual attachment failure */ }
                        }
                        await api.post('/messages', fd, { headers: { ...headers, 'Content-Type': 'multipart/form-data' } });
                      } else {
                        await api.post('/messages', { conversation: cid, content: forwardMessage.content, forwardOf: forwardMessage._id }, { headers });
                      }
                    }
                    setShowForwardModal(false); setForwardMessage(null); setForwardTargets([]);
                    if (!forwardTargets.includes(selectedChat?._id)) reloadChats();
                  } catch (e) {
                    alert('Forward failed');
                  }
                };
                run();
              }}>Forward</button>
              <button className="btn-cancel" onClick={() => { setShowForwardModal(false); setForwardMessage(null); setForwardTargets([]); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      {/* Context action popover */}
      {actionMenu.open && (
        <div
          className="msg-action-popover"
          style={{ position:'fixed', top: actionMenu.y - 10, left: actionMenu.x, transform:'translate(-50%, -100%)', background:'#18191a', color:'#e4e6eb', padding:'6px 0', borderRadius:12, minWidth:140, boxShadow:'0 8px 24px rgba(0,0,0,.4)', zIndex:2000, fontSize:13 }}
        >
          <div style={{ position:'absolute', bottom:-6, left:'50%', transform:'translateX(-50%)', width:0, height:0, borderLeft:'6px solid transparent', borderRight:'6px solid transparent', borderTop:'6px solid #18191a' }} />
          {(() => {
            const msg = messages.find(m => m._id === actionMenu.msgId);
            if (!msg) return null;
            const close = () => setActionMenu(m => ({ ...m, open:false }));
            return (
              <>
                {msg.isOwn && (
                  <button className="popover-item" onClick={()=>{ close(); if(window.confirm('Unsend this message?')) api.delete(`/messages/${msg._id}`, { headers }).then(()=> setMessages(ms=>ms.filter(m=>m._id!==msg._id))); }}>
                    Unsend
                  </button>
                )}
                <button className="popover-item" onClick={()=>{ close(); setForwardMessage(msg); setForwardTargets([]); setShowForwardModal(true); }}>
                  Forward
                </button>
              </>
            );
          })()}
        </div>
      )}

  {/* Unified header; for HR pass explicit nav to avoid blanks during migration */}
  <AppHeader 
    roleSegment={baseSegment === 'hr' ? 'hr' : baseSegment}
    overrideNav={baseSegment === 'hr' ? [
      { to: '/hr/dash', label: 'Dashboard', icon: <FaTachometerAlt/>, match: '/hr/dash' },
      { to: '/hr/chat', label: 'Chat', icon: <FaComments/>, match: '/hr/chat' },
      { to: '/hr/mlist', label: 'Manpower', icon: <FaUsers/>, match: '/hr/mlist' },
      { to: '/hr/movement', label: 'Movement', icon: <FaExchangeAlt/>, match: '/hr/movement' },
      { to: '/hr/project-records', label: 'Projects', icon: <FaProjectDiagram/>, match: '/hr/project-records' },
      { to: '/hr/attendance', label: 'Attendance', icon: <FaCalendarAlt/>, match: '/hr/attendance' }
    ] : undefined}
  />

      {/* BODY */}
      <div className="area-chat-content">
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
            {(searchQuery.trim() ? searchResults : chatList).length === 0 ? (
              <div className="modern-no-chats">No chats found.</div>
            ) : (
              (searchQuery.trim() ? searchResults : chatList).map((item) => {
                const isUser = item.type === 'user';
                const isGroup = item.isGroup;
                const other = isGroup ? null : item.users?.find(u => u._id !== userId) || {};
                const name = isUser ? getDisplayName(item) : isGroup ? item.name : getDisplayName(other);
                // Improved preview logic: prioritize last message content, then last non-system message, else empty
                let preview = '';
                if (item.lastMessage?.content) {
                  preview = item.lastMessage.content;
                } else if (Array.isArray(item.messages) && item.messages.length) {
                  const lastUserMsg = [...item.messages].reverse().find(m => !m.system && m.content);
                  preview = lastUserMsg?.content || '';
                }
                // Attachment indicator if no text OR last event is attachments
                const lastAttachments = item.lastMessage?.attachments || (Array.isArray(item.messages) ? [...item.messages].reverse().find(m=>Array.isArray(m.attachments)&&m.attachments.length)?.attachments : []);
                if ((!preview || /^https?:\/\//.test(preview)) && lastAttachments && lastAttachments.length) {
                  // Determine if all attachments are images
                  const allImages = lastAttachments.every(a => (a?.mimetype||'').startsWith('image/'));
                  if (allImages) {
                    const count = lastAttachments.length;
                    preview = count === 1 ? '🖼 Photo' : `🖼 ${count} Photos`;
                  } else {
                    const count = lastAttachments.length;
                    const fileWord = count === 1 ? 'File' : 'Files';
                    preview = count === 1 ? '📎 Attachment' : `📎 ${count} ${fileWord}`;
                  }
                }
                if (!preview) preview = '(no messages yet)';

                // Sender prefix (show who sent last message). For own message show "You:".
                let senderPrefix = '';
                if (item.lastMessage && (preview !== '(no messages yet)')) {
                  const rawSender = item.lastMessage.sender;
                  const senderId = typeof rawSender === 'string' ? rawSender : (rawSender && rawSender._id);
                  if (senderId) {
                    if (String(senderId) === String(userId)) {
                      senderPrefix = 'You: ';
                    } else {
                      // find sender in chat users list
                      const senderUser = (item.users || []).find(u => u._id === senderId);
                      if (senderUser) {
                        const disp = getDisplayName(senderUser) || '';
                        senderPrefix = (disp.split(' ')[0] || disp) + ': ';
                      }
                    }
                  }
                }

                preview = senderPrefix + preview;
                preview = preview.length > 60 ? preview.slice(0,57) + '…' : preview;
                const timeStr = item.lastMessage?.timestamp ? formatTime(item.lastMessage.timestamp) : '';
                // Determine unread: lastMessage exists and either (a) current user not in seen array OR (b) lastMessage.sender not current user and timestamp newer than a stored read marker (if provided)
                const lastMsg = item.lastMessage;
                const seenArr = Array.isArray(lastMsg?.seen) ? lastMsg.seen : [];
                // Unread: lastMessage exists, not by me, and (a) I haven't seen or (b) its timestamp newer than stored lastRead
                let isUnread = false;
                if (lastMsg && lastMsg.sender !== userId) {
                  const hasSeenArr = seenArr.map(s=>String(s.userId||s._id||s)).includes(String(userId));
                  const lmTime = (typeof lastMsg.timestamp === 'number' ? lastMsg.timestamp : (lastMsg.timestamp ? Date.parse(lastMsg.timestamp) : lastMsg.tsNum)) || 0;
                  const lr = lastRead[item._id] || 0;
                  if (lr && lmTime <= lr) {
                    isUnread = false;
                  } else {
                    isUnread = (!hasSeenArr) || (lmTime > lr);
                  }
                }
                // Highlight brand new chats (no messages yet) as 'new'
                const isNewChat = !lastMsg;
                // Presence: assume for 1-1 chat we can check other.online || other.isOnline; for groups show nothing for now
                const isOnline = !isGroup && other && onlineUsers.has(String(other._id));
                return (
                  <div
                    key={item._id}
                    className={`modern-chat-item ${selectedChat?._id === item._id ? 'active' : ''} ${isUnread ? 'unread' : ''} ${isNewChat ? 'new-chat' : ''}`}
                    onClick={() => openChat(item)}
                    style={isUnread ? { background:'#eff6ff' } : undefined}
                  >
                    <div className="modern-chat-avatar" style={{ position:'relative' }}>
                      {isGroup ? <FaUsers /> : name.charAt(0).toUpperCase()}
                      {!isGroup && (
                        <span
                          className="presence-dot"
                          style={{
                            position:'absolute',
                            bottom: -2,
                            right: -2,
                            width:10,
                            height:10,
                            borderRadius:'50%',
                            background: isOnline ? '#10b981' : '#9ca3af',
                            border:'2px solid #fff',
                            boxSizing:'content-box'
                          }}
                          title={isOnline ? 'Online' : 'Offline'}
                        />
                      )}
                    </div>
                    <div className="modern-chat-info">
                      <div className="modern-chat-name" style={isUnread ? { fontWeight:600 } : undefined}>
                        {name}
                        {isNewChat && <span style={{ marginLeft:6, fontSize:10, background:'#2563eb', color:'#fff', padding:'2px 6px', borderRadius:12 }}>NEW</span>}
                      </div>
                      <div className="modern-chat-preview" style={isUnread ? { fontWeight:500, color:'#1e3a8a' } : undefined}>{preview}</div>
                    </div>
                    {timeStr && <div className="modern-chat-time" style={isUnread ? { fontWeight:600 } : undefined}>{timeStr}</div>}
                    {isUnread && <div style={{ width:8, height:8, borderRadius:'50%', background:'#2563eb', marginLeft:8 }} />}
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
                          : getDisplayName(selectedChat.users.find(u => u._id !== userId)).charAt(0).toUpperCase()}
                      </div>
                      <div className="modern-chat-header-info">
                        <h3>{selectedChat.isGroup ? selectedChat.name : getDisplayName(selectedChat.users.find(u => u._id !== userId))}</h3>
                        <div className="message-search-inline" style={{ display:'flex', gap:4, alignItems:'center', marginTop:4 }}>
                          <div style={{ position:'relative', display:'flex', alignItems:'center', background:'#f1f3f6', borderRadius:16, padding:'2px 6px' }}>
                            <FaSearch style={{ fontSize:12, opacity:.6 }} />
                            <input
                              style={{ border:'none', outline:'none', background:'transparent', fontSize:12, padding:'2px 4px', width:140 }}
                              placeholder="Search in chat"
                              value={messageSearch}
                              onChange={(e)=>setMessageSearch(e.target.value)}
                            />
                            {messageSearch && <FaTimes style={{ cursor:'pointer', fontSize:12, opacity:.6 }} onClick={()=>setMessageSearch('')} />}
                          </div>
                          {messageSearch && (
                            <div style={{ display:'flex', gap:4, alignItems:'center' }}>
                              <button disabled={!searchMatches.length} onClick={()=>gotoMatch(-1)} className="mini-nav-btn" title="Previous"><FaArrowUp /></button>
                              <button disabled={!searchMatches.length} onClick={()=>gotoMatch(1)} className="mini-nav-btn" title="Next"><FaArrowDown /></button>
                              <span style={{ fontSize:11, opacity:.7 }}>{searchMatches.length ? (searchIndex+1) : 0}/{searchMatches.length}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <button className="modern-info-btn" onClick={() => setShowInfoSidebar(s => !s)}>i</button>
                  </div>

                  {/* Reply banner relocated to input container for consistency */}

                  {/* Messages */}
                  <div className="modern-chat-messages">
                    {loadingMessages ? (
                      <div className="messages-loading">Loading messages…</div>
              ) : (
                // filter out messages that have no visible content to avoid blank bubbles
                dedupedMessages
                  .filter(m => {
                    // Only render if there is actual visible content (text or attachments).
                    // Avoid showing blank bubbles that only have metadata (seen/reactions).
                    const hasText = typeof m.content === 'string' && m.content.trim().length > 0;
                    const hasAttachments = Array.isArray(m.attachments) && m.attachments.length > 0;
                    return hasText || hasAttachments;
                  })
                  .map((msg, idx) => {
                        // Determine if we need to show sender name (group chats, not own message, and previous message different sender)
                        let showSenderName = false;
                        let senderName = '';
                        if (selectedChat.isGroup && !msg.isOwn) {
                          const prev = dedupedMessages[idx - 1];
                          const prevSender = prev ? (prev.senderId || (prev.isOwn ? userId : prev.senderId)) : null;
                          const thisSender = msg.senderId || (msg.isOwn ? userId : msg.senderId);
                          showSenderName = !prev || prevSender !== thisSender;
                          if (msg.senderId) {
                            // find user in chat list or selectedChat users
                            const u = (selectedChat.users || []).find(u => u._id === msg.senderId);
                            if (u) senderName = getDisplayName(u);
                          }
                          if (!senderName && msg.forwardOf && msg.forwardOf?.senderId) {
                            const u2 = (selectedChat.users || []).find(u => u._id === msg.forwardOf.senderId);
                            if (u2) senderName = getDisplayName(u2);
                          }
                        }
                        const counts = msg.reactions.reduce((a, r) => { a[r.emoji] = (a[r.emoji] || 0) + 1; return a; }, {});
                        const isLastOwn = msg.isOwn && idx === messages.length - 1;
                        const seenByRecipient = isLastOwn && msg.seen?.length > 0;
                        const seenNames = getSeenDisplayNames(msg.seen);
                        const hasSeen = msg.seen?.length > 0;
                        const isMostRecentSeen = hasSeen && (() => {
                          if (!selectedChat.isGroup) return isLastOwn;
                          const later = messages.slice(idx + 1);
                          return !later.some(l => {
                            if (!l.seen?.length) return false;
                            const laterIds = l.seen.map(s => s.userId);
                            const ids = msg.seen.map(s => s.userId);
                            return ids.every(id => laterIds.includes(id));
                          });
                        })();

                        const rawText = (msg.content || '').replace(/<[^>]+>/g,'');
                        const hasSpaces = /\s/.test(rawText);
                        const isVeryLongUnbroken = rawText.length > 120 && !hasSpaces; // continuous string
                        const bubbleMax = isVeryLongUnbroken ? 420 : 560; // narrower for unbroken
                        return (
                          <div key={`${String(msg._id)}-${idx}`} data-msg-index={idx} className={`modern-message-wrapper ${msg.isOwn ? 'own' : 'other'} ${searchMatches.includes(idx) ? 'search-hit' : ''}`}>
                            {showSenderName && senderName && (
                              <div className="group-sender-label" style={{ fontSize:11, fontWeight:600, margin: msg.isOwn ? '0 8px 2px auto' : '0 0 2px 4px', color:'#374151' }}>{senderName}</div>
                            )}
                            <div className={`modern-message ${msg.isOwn ? 'own' : 'other'}`}
                                 style={{maxWidth: bubbleMax, width:'fit-content', wordBreak: isVeryLongUnbroken ? 'break-all' : 'break-word', overflowWrap:'anywhere'}}>
                              <div className="modern-message-content">
                                {/* Forward label */}
                                {msg.forwardOf && <div className="forward-label" style={{ fontSize:10, opacity:.6, marginBottom:2 }}>Forwarded</div>}
                                {/* Reply reference */}
                                {msg.replyTo && (
                                  <div className="reply-ref" onClick={()=>{ const el = document.querySelector(`[data-reply-id='${msg.replyTo}']`) || document.querySelector(`[data-msg-index='${dedupedMessages.findIndex(m=>m._id===msg.replyTo)}']`); if(el) el.scrollIntoView({behavior:'smooth', block:'center'}); }} style={{ cursor:'pointer', background:'rgba(0,0,0,0.05)', borderLeft:'3px solid #4a68d4', padding:'4px 6px', borderRadius:4, fontSize:11, marginBottom:4 }}>
                                    {(dedupedMessages.find(r => r._id === msg.replyTo)?.content || '[Original message]')?.slice(0,120)}
                                  </div>
                                )}
                                {/* Text with highlight */}
                                {msg.content && <div className="msg-text" dangerouslySetInnerHTML={{ __html: highlightMessage(msg.content) }} />}

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
                                          if (href) {
                                            const idxInViewer = mediaImageIndexByUrl.get(href);
                                            return (
                                              <button
                                                key={i}
                                                type="button"
                                                className="att-link img"
                                                onClick={() => { if (typeof idxInViewer === 'number') openMediaViewer(idxInViewer); }}
                                                style={{ border:'none', background:'transparent', padding:0, cursor:'pointer' }}
                                              >
                                                <img src={href} alt={a.name} className="att-image" />
                                              </button>
                                            );
                                          }
                                          return <div key={i} className="att-placeholder">Image (loading){a.name ? `: ${a.name}` : ''}</div>;
                                        }
                                        if (isVid) return (
                                          href ? <div key={i} className="att-video"><video src={href} controls /></div>
                                              : <div key={i} className="att-placeholder">Video (loading){a.name ? `: ${a.name}` : ''}</div>
                                        );
                                        if (isAud) return (
                                          href ? <div key={i} className="att-audio"><audio src={href} controls /></div>
                                              : <div key={i} className="att-placeholder">Audio (loading){a.name ? `: ${a.name}` : ''}</div>
                                        );
                                        return (
                                          <a
                                            key={i}
                                            href={href || '#'}
                                            download
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="att-doc"
                                          >📎 <span style={{ overflow:'hidden', textOverflow:'ellipsis' }}>{a.name || 'File'}</span></a>
                                        );
                                    })}
                                  </div>
                                )}

                                {/* Removed single-check seen tick per request */}
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
                                  const hasReacted = msg.reactions.some(r => (typeof r.userId === 'string' ? r.userId : r.userId?._id) === userId && r.emoji === e);
                                  return (
                                    <button key={e} className={`reaction-pill ${hasReacted ? 'reacted' : ''}`} onClick={() => toggleReaction(msg, e)} title={`${e} ${c > 1 ? `(${c})` : ''}`}>
                                      <span className="reaction-emoji">{e}</span>{c > 1 && <span className="reaction-count">{c}</span>}
                                    </button>
                                  );
                                })}
                              </div>

                              {/* Removed legacy hover-reactions-bar to avoid duplicate emoji palette (now using floating layer) */}
                            </div>
                            {/* Floating outside toolbars (Messenger-style) */}
                            <div className={`msg-floating-layer ${msg.isOwn ? 'own' : 'other'}`}>
                              <div className="msg-reaction-palette">
                                {['👍','❤️','😂','😮','😢','👎'].map(em => (
                                  <button key={em} className="react-quick" onClick={()=>toggleReaction(msg, em)} title={em}>{em}</button>
                                ))}
                              </div>
                              <div className="msg-float-actions">
                                <button className="float-act-btn" title="Reply" onClick={()=>setReplyTo(msg)}><FaReply /></button>
                                <button className="float-act-btn msg-action-trigger" title="More" onClick={(e)=>{ e.stopPropagation(); const rect=e.currentTarget.getBoundingClientRect(); setActionMenu({ open:true, msgId: msg._id, x: rect.left + rect.width/2, y: rect.top }); }}><FaEllipsisH /></button>
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
                    <button className="scroll-to-bottom-btn" onClick={scrollToBottom} title="Scroll to latest messages">↓</button>
                  )}

                  {/* INPUT */}
                  <div className="modern-message-input-container">
                    {replyTo && (
                      <div className="reply-banner">
                        Replying to: <strong>{(replyTo.content||'').slice(0,80) || '[attachment]'}</strong>
                        <button className="reply-cancel" onClick={()=>setReplyTo(null)}>×</button>
                      </div>
                    )}
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
                            if (arr.length) setPendingFiles(prev => [...prev, ...arr]);
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
                                <button className="remove-pending" onClick={() => setPendingFiles(p => p.filter((_, idx) => idx !== i))}>×</button>
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
                        onPaste={async (e) => {
                          try {
                            const items = e.clipboardData?.items || [];
                            const files = [];
                            for (const it of items) {
                              if (it.kind === 'file' && it.type.startsWith('image/')) {
                                const f = it.getAsFile();
                                if (f) files.push(f);
                              }
                            }
                            // If no file items but there is a textual image URL, attempt fetch & convert
                            if (!files.length) {
                              const text = e.clipboardData.getData('text/plain');
                              if (text && /^https?:\/\//i.test(text) && /(\.png|\.jpe?g|\.gif|\.webp|\.bmp|\.svg)(\?|#|$)/i.test(text)) {
                                try {
                                  const resp = await fetch(text, { mode: 'cors' });
                                  const blob = await resp.blob();
                                  if (blob && blob.type.startsWith('image/')) {
                                    const fname = 'pasted-' + Date.now() + (blob.type === 'image/png' ? '.png' : '.img');
                                    const file = new File([blob], fname, { type: blob.type });
                                    files.push(file);
                                  }
                                } catch { /* ignore */ }
                              }
                            }
                            if (files.length) {
                              e.preventDefault();
                              setPendingFiles(prev => [...prev, ...files]);
                            }
                          } catch { /* ignore */ }
                        }}
                      />

                      {/* Emoji */}
                      <button className="modern-emoji-btn" onClick={() => setShowEmojiPicker(p => !p)}>😊</button>
                      {showEmojiPicker && (
                        <div className="modern-emoji-picker">
                          {/* emoji-picker-react v4 passes (emojiData, event); use first param */}
                          <EmojiPicker
                            emojiStyle="native"
                            onEmojiClick={(emojiData) => setNewMessage(m => (m || '') + (emojiData?.emoji || ''))}
                            height={360}
                            width={300}
                          />
                        </div>
                      )}

                      {/* Send */}
                      <button className="modern-send-btn" onClick={sendMessage} disabled={!newMessage.trim() && pendingFiles.length === 0}>
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
                        <button className="action-btn add-members-btn" onClick={() => setShowAddMembers(true)}>
                          <FaUserPlus />
                        </button>
                        <button className="action-btn leave-btn" onClick={handleLeaveGroup}>
                          <FaSignOutAlt />
                        </button>
                      </>
                    )}
                  </div>

                  <div className="details-section">
                    <h5>Details</h5>
                    {selectedChat.isGroup ? (
                      <>
                        <div className="detail-item"><span className="detail-label">Group Name</span><span className="detail-value">{selectedChat.name}</span></div>
                        <div className="detail-item"><span className="detail-label">Members</span><span className="detail-value">{uniqueMembers.length} people</span></div>
                      </>
                    ) : (
                      <>
                        <div className="detail-item"><span className="detail-label">Name</span><span className="detail-value">{getDisplayName(selectedChat.users.find(u => u._id !== userId))}</span></div>
                        <div className="detail-item"><span className="detail-label">Email</span><span className="detail-value">{selectedChat.users.find(u => u._id !== userId)?.email}</span></div>
                      </>
                    )}

                    {/* Media / Files tabs */}
                    <div style={{ marginTop: 12 }}>
                      <div className="info-tab-buttons">
                        <button className={showInfoTab === 'media' ? 'active' : ''} onClick={() => setShowInfoTab('media')}>Media</button>
                        <button className={showInfoTab === 'files' ? 'active' : ''} onClick={() => setShowInfoTab('files')}>Files</button>
                      </div>

                      {showInfoTab === 'media' && (
                        <div className="info-media-grid" style={{ maxHeight:200, overflowY:'auto', display:'flex', flexWrap:'wrap', gap:6, paddingTop:6 }}>
                          {mediaImages.map((a,i) => (
                            <div key={i} className="info-media-item" style={{ width:60, height:60, overflow:'hidden', borderRadius:4, cursor:'pointer', background:'#f8f9fa', border:'1px solid #e5e7eb' }} onClick={() => openMediaViewer(i)}>
                              <img src={a.url} alt={a.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                            </div>
                          ))}
                          {mediaImages.length === 0 && <div style={{ fontSize:12, opacity:0.6 }}>No images</div>}
                        </div>
                      )}

                      {showInfoTab === 'files' && (
                        <div className="info-files-list" style={{ maxHeight:200, overflowY:'auto', display:'flex', flexDirection:'column', gap:4, paddingTop:6 }}>
                          {messages.flatMap(m => (m.attachments || [])).filter(a => !(a.mime && a.mime.startsWith('image/'))).map((a, i) => (
                            <a key={i} href={a.url} download style={{ textDecoration: 'none', color: '#0b5fff', fontSize:12, background:'#f8f9fa', padding:'4px 6px', borderRadius:6, border:'1px solid #e5e7eb' }}>📎 {a.name}</a>
                          ))}
                          {messages.flatMap(m => (m.attachments || [])).filter(a => !(a.mime && a.mime.startsWith('image/'))).length === 0 && (
                            <div style={{ fontSize:12, opacity:.6 }}>No files</div>
                          )}
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
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          width: '100%', background: 'transparent', border: 'none', padding: '6px 0',
                          cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#222',
                          borderBottom: '1px solid rgba(0,0,0,0.08)', marginTop: 12
                        }}
                      >
                        <span style={{ display:'flex', alignItems:'center', gap:6 }}>
                          <span style={{ letterSpacing: '.5px' }}>Members</span>
                          <span style={{ fontSize:11, background:'#e5e7eb', padding:'2px 6px', borderRadius:12, color:'#111' }}>{uniqueMembers.length}</span>
                        </span>
                        <span style={{ fontSize: 12, opacity:.7 }}>{showMembersList ? '▲' : '▼'}</span>
                      </button>
                      {showMembersList && (
                        <div className="members-list">
                          {(() => {
                            return uniqueMembers.map((u, i) => {
                              const isCreator = selectedChat.creator && (selectedChat.creator === u._id || selectedChat.creator?._id === u._id);
                              return (
                                <div key={`${u._id}-${i}`} className="member-item">
                                  <div className="member-avatar">{getDisplayName(u).charAt(0).toUpperCase()}</div>
                                  <div className="member-info">
                                    <span className="member-name">{getDisplayName(u)}</span>
                                    {u._id === userId && <span className="member-badge">You</span>}
                                    {isCreator && <span className="member-badge admin">Admin</span>}
                                  </div>
                                  {u._id !== userId && (selectedChat.creator === userId || selectedChat.creator?._id === userId || selectedChat.users?.[0]?._id === userId) && (
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
                    <div className="modal-header add-members-header" style={{ display:'flex', flexDirection:'column', gap:8 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                        <h4 style={{ flex:1, margin:0 }}>Add Members</h4>
                        <button className="close-modal-btn" onClick={() => setShowAddMembers(false)} aria-label="Close">×</button>
                      </div>
                      <div className="search-row" style={{ width:'100%' }}>
                        <input
                          type="text"
                          placeholder="Search users..."
                          className="search-input"
                          value={addMembersSearch}
                          onChange={(e) => setAddMembersSearch(e.target.value)}
                          style={{ width:'100%' }}
                        />
                      </div>
                    </div>
                    <div className="modal-content">
                      <div className="users-list">
                        {filteredAvailableMembers.map((u, i) => (
                          <label key={`${u._id}-${i}`} className="user-checkbox-item">
                            <input
                              type="checkbox"
                              checked={selectedNewMembers.includes(u._id)}
                              onChange={() => {
                                setSelectedNewMembers(prev =>
                                  prev.includes(u._id) ? prev.filter(id => id !== u._id) : [...prev, u._id]
                                );
                              }}
                            />
                            <div className="user-avatar">{getDisplayName(u).charAt(0).toUpperCase()}</div>
                            <span className="user-name">{getDisplayName(u)}</span>
                          </label>
                        ))}
                        {filteredAvailableMembers.length === 0 && (
                          <div style={{ fontSize:12, opacity:.6, padding:'4px 2px' }}>No users found.</div>
                        )}
                      </div>
                      <div className="modal-actions">
                        <button className="add-members-submit-btn" onClick={addMembersToGroup} disabled={selectedNewMembers.length === 0}>
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
    </>
  );
};

export default AreaChat;
