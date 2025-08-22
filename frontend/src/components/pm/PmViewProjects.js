import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import api from '../../api/axiosInstance';
import NotificationBell from '../NotificationBell';
import { FaRegCommentDots, FaRegFileAlt, FaRegListAlt, FaDownload, FaCalendarAlt, FaMapMarkerAlt, FaUsers, FaUserTie, FaBuilding, FaMoneyBillWave, FaCheckCircle, FaClock } from 'react-icons/fa';
import { exportProjectDetails } from '../../utils/projectPdf';
// Nav icons
import { FaTachometerAlt, FaComments, FaBoxes, FaUsers as FaUsersNav, FaEye, FaClipboardList, FaChartBar, FaCalendarAlt as FaCalendarAltNav } from 'react-icons/fa';
import "../style/pm_style/Pm_Dash.css";
import "../style/pm_style/Pm_ViewProjects.css";

/* ---------- Socket.IO setup ---------- */
const SOCKET_ORIGIN = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace('/api', '');
const SOCKET_PATH = '/socket.io';

/* ---------- File handling utilities ---------- */
/** Open a private doc via a signed URL (backend returns JSON with {signedUrl}) */
async function openSignedPath(path) {
  try {
    const { data } = await api.get(`/photo-signed-url?path=${encodeURIComponent(path)}`);
    const url = data?.signedUrl;
    if (!url) throw new Error('No signedUrl in response');
    window.open(url, '_blank', 'noopener,noreferrer');
  } catch (e) {
    alert('Failed to open attachment.');
  }
}

/* ---------- Filename helper ---------- */
function extractOriginalNameFromPath(path) {
  const base = (path || '').split('/').pop() || '';
  const underscore = base.indexOf('_');
  if (underscore !== -1 && underscore < base.length - 1) return base.slice(underscore + 1);
  const m = base.match(/^project-\d{8,}-(.+)$/i);
  if (m && m[1]) return m[1];
  return base;
}

/* ---------- Mention rendering (inline chips) ---------- */
function renderMessageText(text = '', meName = '') {
  const meSlug = (meName || '').trim().toLowerCase().replace(/\s+/g, '');
  if (!meSlug || !text) return text;
  
  const regex = new RegExp(`@${meSlug}\\b`, 'gi');
  const parts = text.split(regex);
  const matches = text.match(regex) || [];
  
  if (parts.length === 1) return text;
  
  return parts.map((part, i) => {
    if (i === 0) return part;
    return (
      <React.Fragment key={i}>
        <span style={{ 
          background: '#f6c343', 
          color: '#3a2f00', 
          padding: '2px 6px', 
          borderRadius: '4px', 
          fontWeight: 'bold',
          fontSize: '0.9em'
        }}>
          @{meName}
        </span>
        {part}
      </React.Fragment>
    );
  });
}

/* ---------- Check if message mentions current user ---------- */
function isMentioned(text = '', meName = '') {
  const meSlug = (meName || '').trim().toLowerCase().replace(/\s+/g, '');
  if (!meSlug || !text) return false;
  
  const collapsed = text.toLowerCase().replace(/\s+/g, '');
  return collapsed.includes(`@${meSlug}`);
}

const mentionRowStyles = {
  container: {
    position: 'relative',
    background: '#fffbe6',
    border: '1px solid #f6c343',
    boxShadow: '0 0 0 2px rgba(246,195,67,.25) inset',
    borderRadius: 10,
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    fontSize: 12,
    lineHeight: '16px',
    background: '#f6c343',
    color: '#3a2f00',
    borderRadius: 999,
    padding: '2px 8px',
    fontWeight: 700,
  }
};

const peso = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/* ---------- Contractor label ---------- */
function readContractor(p) {
  const c = p?.contractor;
  if (!c) return 'N/A';
  if (typeof c === 'string') return c.trim() || 'N/A';
  if (Array.isArray(c)) {
    const names = c
      .map(x => (typeof x === 'string' ? x : x?.name || x?.company || x?.companyName || ''))
      .map(s => (typeof s === 'string' ? s.trim() : ''))
      .filter(Boolean);
    return names.length ? names.join(', ') : 'N/A';
  }
  if (typeof c === 'object') {
    const candidates = [c.name, c.company, c.companyName, c.title, c.fullName];
    for (const v of candidates) if (typeof v === 'string' && v.trim()) return v.trim();
  }
  if (typeof p?.contractorName === 'string' && p.contractorName.trim()) return p.contractorName.trim();
  return 'N/A';
}

const Pm_Project = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  // Stable user
  const userRef = useRef(null);
  if (userRef.current === null) {
    try { userRef.current = JSON.parse(localStorage.getItem('user')); }
    catch { userRef.current = null; }
  }
  const user = userRef.current;
  const userId = user?._id || null;
  const [userName] = useState(user?.name || 'PM');

  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);

  const [project, setProject] = useState(null);
  const [activeTab, setActiveTab] = useState('Details');
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(true);

  // POs (optional summary)
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [totalPO, setTotalPO] = useState(0);

  // Discussions
  const [messages, setMessages] = useState([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [replyInputs, setReplyInputs] = useState({});
  const [posting, setPosting] = useState(false);
  const [composerFiles, setComposerFiles] = useState([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState('');
  const listScrollRef = useRef(null);
  const listBottomRef = useRef(null);
  const textareaRef = useRef(null);

  // Mentions
  const [mentionDropdown, setMentionDropdown] = useState({ 
    open: false, 
    options: [], 
    query: '', 
    position: { top: 0, left: 0 },
    activeInputId: null // Track which input triggered the dropdown
  });
  const [projectUsers, setProjectUsers] = useState([]);


  // Scroll handler for header collapse
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const shouldCollapse = scrollTop > 50;
      setIsHeaderCollapsed(shouldCollapse);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  /* ---------------- Fetch project (+progress) ---------------- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get(`/projects/${id}`);
        if (cancelled) return;
        setProject(data);
        setStatus(data?.status || '');

        // progress (for toggle availability)
        try {
          const pr = await api.get(`/daily-reports/project/${id}/progress`);
          const completed = pr?.data?.progress?.find(p => p.name === 'Completed');
          setProgress(completed ? completed.value : 0);
        } catch {}
      } catch {
        if (!cancelled) setProject(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  /* ---------------- Purchases summary ---------------- */
  useEffect(() => {
    if (!project?._id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get('/requests');
        if (cancelled) return;
        const approved = (res.data || []).filter(r =>
          String(r?.project?._id || '') === String(project._id) &&
          r.status === 'Approved' &&
          r.totalValue
        );
        setPurchaseOrders(approved);
        setTotalPO(approved.reduce((s, r) => s + (Number(r.totalValue) || 0), 0));
      } catch {
        if (!cancelled) { setPurchaseOrders([]); setTotalPO(0); }
      }
    })();
    return () => { cancelled = true; };
  }, [project?._id]);

  /* ---------------- Discussions initial fetch ---------------- */
  useEffect(() => {
    if (!project?._id || activeTab !== 'Discussions') return;
    const controller = new AbortController();
    setLoadingMsgs(true);
    api.get(`/projects/${project._id}/discussions`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(res => {
        const list = Array.isArray(res.data) ? [...res.data].sort(
          (a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0)
        ) : [];
        console.log('📥 Fetched discussions:', list);
        console.log('📥 Discussions with labels:', list.filter(msg => msg.label));
        setMessages(list);
      })
      .catch(() => setMessages([]))
      .finally(() => setLoadingMsgs(false));
    return () => controller.abort();
  }, [project?._id, activeTab, token]);

  // Auto-scroll to bottom on message change
  useEffect(() => {
    if (activeTab !== 'Discussions') return;
    requestAnimationFrame(() => {
      if (listBottomRef.current) listBottomRef.current.scrollIntoView();
      else if (listScrollRef.current) listScrollRef.current.scrollTop = listScrollRef.current.scrollHeight;
    });
  }, [messages, activeTab]);

  /* ---------------- Fetch project users for mentions ---------------- */
  useEffect(() => {
    if (!project?._id || activeTab !== 'Discussions') return;
    let cancelled = false;
    (async () => {
      try {
        console.log('🔍 Fetching project users for project:', project._id);
        console.log('🔍 API URL:', `/projects/${project._id}/users`);
        const res = await api.get(`/projects/${project._id}/users`);
        if (cancelled) return;
        console.log('✅ Project users response:', res.data);
        console.log('✅ Response status:', res.status);
        setProjectUsers(res.data || []);
      } catch (error) {
        console.error('❌ Error fetching project users:', error);
        console.error('❌ Error response:', error.response?.data);
        console.error('❌ Error status:', error.response?.status);
        if (!cancelled) setProjectUsers([]);
      }
    })();
    return () => { cancelled = true; };
  }, [project?._id, activeTab]);

  /* ---------------- misc ---------------- */
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.profile-menu-container')) setProfileMenuOpen(false);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  /* ---------------- Socket.IO for real-time updates ---------------- */
  useEffect(() => {
    if (!project?._id || activeTab !== 'Discussions') return;

    console.log('🔌 Setting up Socket.IO connection for project:', project._id);
    
    // Track processed message IDs to prevent duplicates
    const processedMessageIds = new Set();

    // Create socket connection
    const socket = io(SOCKET_ORIGIN, {
      path: SOCKET_PATH,
      transports: ['websocket'],
      auth: { userId: userId }
    });

    // Connection event handlers
    socket.on('connect', () => {
      console.log('✅ Socket.IO connected:', socket.id);
    });

    socket.on('connect_error', (error) => {
      console.error('❌ Socket.IO connection error:', error);
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 Socket.IO disconnected:', reason);
    });

    // Join project room
    socket.emit('joinProject', `project:${project._id}`);
    console.log('🏠 Joined project room:', `project:${project._id}`);

    // Handle new discussion
    const handleNewDiscussion = (data) => {
      console.log('📨 Received new discussion:', data);
      console.log('📨 Comparing projectId:', data.projectId, 'with project._id:', project._id);
      console.log('📨 Types - data.projectId:', typeof data.projectId, 'project._id:', typeof project._id);
      console.log('📨 Message ID:', data.message?._id);
      console.log('📨 Message label:', data.message?.label);
      
      if (String(data.projectId) === String(project._id) && data.message) {
        const messageId = String(data.message._id);
        
        // Check if we've already processed this message ID
        if (processedMessageIds.has(messageId)) {
          console.log('⚠️ Message ID already processed, skipping:', messageId);
          return;
        }
        
        console.log('✅ Adding new discussion to state');
        setMessages(prev => {
          console.log('📊 Current messages count:', prev.length);
          console.log('📊 Current message IDs:', prev.map(msg => msg._id));
          
          // Check if this message already exists to prevent duplicates
          const exists = prev.some(msg => String(msg._id) === messageId);
          if (exists) {
            console.log('⚠️ Message already exists in state, skipping duplicate');
            console.log('⚠️ Existing message ID:', messageId);
            return prev;
          }
          
          console.log('✅ Message is new, adding to state');
          const newList = [...prev, data.message];
          const sortedList = newList.sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));
          console.log('📊 New messages count:', sortedList.length);
          
          // Mark this message ID as processed
          processedMessageIds.add(messageId);
          
          return sortedList;
        });
      } else {
        console.log('❌ Project ID mismatch or no message data');
      }
    };

    // Handle new reply
    const handleNewReply = (data) => {
      console.log('📨 Received new reply:', data);
      console.log('📨 Comparing projectId:', data.projectId, 'with project._id:', project._id);
      if (String(data.projectId) === String(project._id) && data.msgId && data.reply) {
        console.log('✅ Adding new reply to state');
        setMessages(prev => prev.map(msg => {
          if (String(msg._id) === String(data.msgId)) {
            // Check if this reply already exists to prevent duplicates
            const replyExists = (msg.replies || []).some(reply => String(reply._id) === String(data.reply._id));
            if (replyExists) {
              console.log('⚠️ Reply already exists, skipping duplicate');
              return msg;
            }
            return {
              ...msg,
              replies: [...(msg.replies || []), data.reply]
            };
          }
          return msg;
        }));
      } else {
        console.log('❌ Project ID mismatch or missing reply data');
      }
    };

    // Listen for events
    socket.on('project:newDiscussion', handleNewDiscussion);
    socket.on('project:newReply', handleNewReply);

    // Cleanup
    return () => {
      console.log('🧹 Cleaning up Socket.IO connection');
      socket.off('project:newDiscussion', handleNewDiscussion);
      socket.off('project:newReply', handleNewReply);
      socket.off('connect');
      socket.off('connect_error');
      socket.off('disconnect');
      socket.emit('leaveProject', `project:${project._id}`);
      socket.disconnect();
    };
  }, [project?._id, activeTab, userId]);
  
  /* ---------------- Discussion posting and replies ---------------- */
  const handlePostMessage = async () => {
    if ((!newMessage.trim() && composerFiles.length === 0) || posting || !project?._id) return;
    
    // Prevent rapid duplicate submissions
    if (posting) {
      console.log('⚠️ Already posting, ignoring duplicate submission');
      return;
    }
    
    try {
      setPosting(true);
      const fd = new FormData();
      if (newMessage.trim()) fd.append('text', newMessage.trim());
      if (selectedLabel) fd.append('label', selectedLabel);
      composerFiles.forEach(f => fd.append('files', f));
      
      console.log('📤 Frontend sending label:', selectedLabel);
      console.log('📤 Frontend FormData contents:');
      for (let [key, value] of fd.entries()) {
        console.log('📤', key, ':', value);
      }
      
      const response = await api.post(`/projects/${project._id}/discussions`, fd, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('📝 Posted discussion response:', response.data);
      console.log('📝 Label in response:', response.data.label);
      
      // Clear form after successful post
      setNewMessage('');
      setComposerFiles([]);
      setSelectedLabel('');
      
      console.log('✅ Message posted successfully');
         } catch (error) {
       console.error('❌ Failed to post message:', error);
       console.error('❌ Error details:', {
         message: error.message,
         status: error.response?.status,
         data: error.response?.data,
         config: error.config
       });
       
       // Only show alert for actual critical errors
       if (error.response?.status >= 500) {
         // Server error (5xx) - show alert
         alert(`Server error: ${error.response?.data?.error || error.message}`);
       } else if (error.code === 'NETWORK_ERROR' || error.code === 'ERR_NETWORK') {
         // Network error - show alert
         alert('Network error. Please check your connection and try again.');
       } else if (error.message?.includes('timeout')) {
         // Timeout error - show alert
         alert('Request timed out. Please try again.');
       } else {
         // Client errors (4xx) and other errors - don't show alert, just log
         console.log('⚠️ Non-critical error, message may have been posted successfully');
         console.log('⚠️ Error type:', error.constructor.name);
         console.log('⚠️ Error message:', error.message);
         console.log('⚠️ Response status:', error.response?.status);
       }
     } finally {
       setPosting(false);
     }
  };

  const handlePostReply = async (msgId) => {
    const replyText = (replyInputs[msgId] || '').trim();
    const filesKey = `_replyFiles_${msgId}`;
    const replyFiles = (replyInputs[filesKey] || []);
    
    if ((!replyText && replyFiles.length === 0) || !project?._id) return;
    
    try {
      const fd = new FormData();
      if (replyText) fd.append('text', replyText);
      replyFiles.forEach(f => fd.append('files', f));
      
      const response = await api.post(`/projects/${project._id}/discussions/${msgId}/reply`, fd, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Clear reply form after successful post
      setReplyInputs(prev => ({ ...prev, [msgId]: '', [filesKey]: [] }));
      console.log('✅ Reply posted successfully');
    } catch (error) {
      console.error('❌ Failed to post reply:', error);
      console.error('❌ Error details:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      
      // Only show alert for actual critical errors
      if (error.response?.status >= 500) {
        alert(`Server error: ${error.response?.data?.error || error.message}`);
      } else if (error.code === 'NETWORK_ERROR' || error.code === 'ERR_NETWORK') {
        alert('Network error. Please check your connection and try again.');
      } else {
        console.log('⚠️ Non-critical error, reply may have been posted successfully');
        console.log('⚠️ Error type:', error.constructor.name);
        console.log('⚠️ Error message:', error.message);
        console.log('⚠️ Response status:', error.response?.status);
      }
    }
  };

  const handleKeyDownComposer = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!posting && (newMessage.trim() || composerFiles.length > 0)) {
        handlePostMessage();
      }
    }
  };

  /* ---------------- File handling ---------------- */
  const acceptTypes = ".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.txt,.rtf,.csv,image/*";
  
  const addComposerFiles = (files) => {
    if (!files?.length) return;
    const arr = Array.from(files);
    setComposerFiles(prev => [...prev, ...arr]);
  };

  const addReplyFiles = (msgId, fileList) => {
    const filesKey = `_replyFiles_${msgId}`;
    const arr = Array.from(fileList || []);
    setReplyInputs(prev => ({ ...prev, [filesKey]: [...(prev[filesKey] || []), ...arr] }));
  };

  const onDragOverComposer = (e) => { e.preventDefault(); setIsDragOver(true); };
  const onDragLeaveComposer = (e) => { e.preventDefault(); setIsDragOver(false); };
  const onDropComposer = (e) => {
    e.preventDefault(); 
    setIsDragOver(false);
    if (e.dataTransfer?.files?.length) addComposerFiles(e.dataTransfer.files);
  };

  /* ---------------- Mention handling ---------------- */
  const handleTextareaInput = (e) => {
    const value = e.target.value;
    setNewMessage(value);
    const caret = e.target.selectionStart;
    const textUpToCaret = value.slice(0, caret);
    const match = /(^|\s)@(\w*)$/.exec(textUpToCaret);
    if (match) {
      const query = match[2].toLowerCase();
      console.log('🔍 Mention query:', query);
      console.log('👥 Available project users:', projectUsers);
      const options = projectUsers
        .concat([{ _id: '_all_', name: 'all' }, { _id: '_everyone_', name: 'everyone' }])
        .filter(u => (u.name || '').toLowerCase().includes(query));
      console.log('📋 Filtered options:', options);
      
      setMentionDropdown({ 
        open: true, 
        options, 
        query, 
        position: { top: 0, left: 0 }, // We'll use CSS positioning instead
        activeInputId: e.target.id // Set active input ID
      });
    } else {
      setMentionDropdown({ open: false, options: [], query: '', position: { top: 0, left: 0 }, activeInputId: null });
    }
  };

  const handleMentionSelect = (selUser) => {
    if (!textareaRef.current) return;
    const value = newMessage;
    const caret = textareaRef.current.selectionStart;
    const textUpToCaret = value.slice(0, caret);
    const match = /(^|\s)@(\w*)$/.exec(textUpToCaret);
    if (!match) return;
    const before = value.slice(0, match.index + match[1].length);
    const after = value.slice(caret);
    const mentionText = `@${selUser.name} `;
    const newVal = before + mentionText + after;
    setNewMessage(newVal);
    setMentionDropdown({ open: false, options: [], query: '', position: { top: 0, left: 0 }, activeInputId: null });
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.selectionStart = textareaRef.current.selectionEnd = (before + mentionText).length;
      }
    }, 0);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  if (loading) return (
    <div className="dashboard-container">
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🔄</div>
          <div style={{ fontSize: '1.2rem', color: '#64748b' }}>Loading project details...</div>
        </div>
      </div>
    </div>
  );
  
  if (!project) return (
    <div className="dashboard-container">
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>❌</div>
          <div style={{ fontSize: '1.2rem', color: '#64748b' }}>Project not found</div>
        </div>
      </div>
    </div>
  );

  // Derived labels
  const start = project?.startDate ? new Date(project.startDate).toLocaleDateString() : 'N/A';
  const end   = project?.endDate ? new Date(project.endDate).toLocaleDateString() : 'N/A';
  const contractor = readContractor(project);
  const locationLabel = project?.location?.name
    ? `${project.location.name}${project.location?.region ? ` (${project.location.region})` : ''}`
    : 'N/A';
  const manpowerText =
    Array.isArray(project?.manpower) && project.manpower.length > 0
      ? project.manpower.map(mp => [mp?.name, mp?.position].filter(Boolean).join(' (') + (mp?.position ? ')' : '')).join(', ')
      : 'No Manpower Assigned';
  const budgetNum = Number(project?.budget || 0);
  const remaining = Math.max(budgetNum - Number(totalPO || 0), 0);

  return (
    <div className="dashboard-container">
      {/* HEADER */}
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
              {userName ? userName.charAt(0).toUpperCase() : 'P'}
            </div>
            <div className="profile-info">
              <span className="profile-name">{userName}</span>
              <span className="profile-role">Project Manager</span>
            </div>
            {profileMenuOpen && (
              <div className="profile-menu">
                <button onClick={handleLogout}>Logout</button>
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
            <Link to="/pm/chat" className="nav-item">
              <FaComments />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Chat</span>
            </Link>
            <Link to="/pm/request/:id" className="nav-item">
              <FaBoxes />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Material</span>
            </Link>
            <Link to="/pm/manpower-list" className="nav-item">
              <FaUsersNav />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Manpower</span>
            </Link>
            <Link to={`/pm/viewprojects/${project._id || project.id}`} className="nav-item active">
              <FaEye />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>View Project</span>
            </Link>
            <Link to="/pm/daily-logs" className="nav-item">
              <FaClipboardList />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Logs</span>
            </Link>
            <Link to={`/pm/progress-report/${project._id}`} className="nav-item">
              <FaChartBar />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Reports</span>
            </Link>
            <Link to="/pm/daily-logs-list" className="nav-item">
              <FaCalendarAltNav />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Daily Logs</span>
            </Link>
          </nav>
          
          <NotificationBell />
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="dashboard-main">
        <div className="project-view-container">
          {/* Project Header */}
          <div className="project-header">
            <div className="project-image-section">
              <img
                src={(project.photos && project.photos[0]) || 'https://placehold.co/1200x400?text=Project+Image'}
                alt={project.projectName}
                className="project-hero-image"
              />
              
              {/* Status Toggle Button */}
              {progress === 100 && (
                <button
                  onClick={async () => {
                    try {
                      const res = await api.patch(`/projects/${project._id}/toggle-status`);
                      setStatus(res.data?.status || status);
                    } catch {
                      alert('Failed to toggle project status.');
                    }
                  }}
                  className={`status-toggle-btn ${status === 'Completed' ? 'completed' : 'ongoing'}`}
                >
                  {status === 'Completed' ? 'Mark as Ongoing' : 'Mark as Completed'}
                </button>
              )}
            </div>

            <div className="project-title-section">
              <h1 className="project-title">{project.projectName}</h1>
              <div className="project-status-badge">
                <span className={`status-indicator ${status === 'Completed' ? 'completed' : 'ongoing'}`}>
                  {status === 'Completed' ? <FaCheckCircle /> : <FaClock />}
                </span>
                <span className="status-text">{status || project?.status || 'N/A'}</span>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="project-tabs">
            <button 
              className={`project-tab ${activeTab === 'Details' ? 'active' : ''}`} 
              onClick={() => setActiveTab('Details')}
            >
              <FaRegListAlt />
              <span>Project Details</span>
            </button>
            <button 
              className={`project-tab ${activeTab === 'Discussions' ? 'active' : ''}`} 
              onClick={() => setActiveTab('Discussions')}
            >
              <FaRegCommentDots />
              <span>Discussions</span>
            </button>
            <button 
              className={`project-tab ${activeTab === 'Files' ? 'active' : ''}`} 
              onClick={() => setActiveTab('Files')}
            >
              <FaRegFileAlt />
              <span>Files</span>
            </button>
          </div>

          {/* Tab Content */}
          <div className="tab-content">
            {/* --- Project Details Tab --- */}
            {activeTab === 'Details' && (
              <div className="project-details-content">
                {/* Action Buttons */}
                <div className="action-buttons">
                  <button
                    onClick={() =>
                      exportProjectDetails(project, {
                        contextTitle: 'Project Details — Project Manager',
                        includeBudget: true,
                        includePM: true,
                        includeAM: true,
                        includePIC: true,
                        includeHrSite: true, 
                        includeStaff: true
                      })
                    }
                    className="export-btn"
                  >
                    <FaDownload />
                    <span>Export PDF</span>
                  </button>
                </div>

                {/* Project Overview Cards */}
                <div className="overview-grid">
                  {/* Budget Card */}
                  <div className="overview-card budget-card">
                    <div className="card-icon">
                      <FaMoneyBillWave />
                    </div>
                    <div className="card-content">
                      <h3 className="card-title">Budget Overview</h3>
                      <div className="budget-amount">
                        {peso.format(budgetNum || 0)}
                        {totalPO > 0 && (
                          <span className="po-deduction">
                            − {peso.format(totalPO)} (POs)
                          </span>
                        )}
                      </div>
                      {totalPO > 0 && (
                        <div className="remaining-budget">
                          Remaining: {peso.format(remaining)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Timeline Card */}
                  <div className="overview-card timeline-card">
                    <div className="card-icon">
                      <FaCalendarAlt />
                    </div>
                    <div className="card-content">
                      <h3 className="card-title">Project Timeline</h3>
                      <div className="timeline-dates">
                        <div className="date-item">
                          <span className="date-label">Start:</span>
                          <span className="date-value">{start}</span>
                        </div>
                        <div className="date-item">
                          <span className="date-label">End:</span>
                          <span className="date-value">{end}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Location Card */}
                  <div className="overview-card location-card">
                    <div className="card-icon">
                      <FaMapMarkerAlt />
                    </div>
                    <div className="card-content">
                      <h3 className="card-title">Location</h3>
                      <div className="location-value">{locationLabel}</div>
                    </div>
                  </div>

                  {/* Contractor Card */}
                  <div className="overview-card contractor-card">
                    <div className="card-icon">
                      <FaBuilding />
                    </div>
                    <div className="card-content">
                      <h3 className="card-title">Contractor</h3>
                      <div className="contractor-value">{contractor}</div>
                    </div>
                  </div>
                </div>

                {/* Project Team Section */}
                <div className="team-section">
                  <h2 className="section-title">Project Team</h2>
                  <div className="team-grid">
                    <div className="team-member">
                      <div className="member-avatar">
                        <FaUserTie />
                      </div>
                      <div className="member-info">
                        <h4 className="member-role">Project Manager</h4>
                        <p className="member-name">{project?.projectmanager?.name || 'N/A'}</p>
                      </div>
                    </div>

                    <div className="team-member">
                      <div className="member-avatar">
                        <FaUsers />
                      </div>
                      <div className="member-info">
                        <h4 className="member-role">Person in Charge</h4>
                        <p className="member-name">
                          {Array.isArray(project?.pic) && project.pic.length > 0
                            ? project.pic.map(p => p?.name).filter(Boolean).join(', ')
                            : 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Manpower Section */}
                <div className="manpower-section">
                  <h2 className="section-title">Assigned Manpower</h2>
                  <div className="manpower-content">
                    <p className="manpower-text">{manpowerText}</p>
                  </div>
                </div>



                {/* Purchase Orders Section */}
                {purchaseOrders.length > 0 && (
                  <div className="purchase-orders-section">
                    <h2 className="section-title">Purchase Orders</h2>
                    <div className="po-list">
                      {purchaseOrders.map(po => (
                        <div key={po._id} className="po-item">
                          <span className="po-number">PO#: {po.purchaseOrder}</span>
                          <span className="po-amount">{peso.format(Number(po.totalValue))}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* --- Discussions Tab --- */}
            {activeTab === 'Discussions' && (
              <div className="discussions-container">
                {/* Messages List */}
                <div className="messages-list" ref={listScrollRef}>
                  {loadingMsgs ? (
                    <div className="loading-messages">
                      <div className="loading-spinner"></div>
                      <span>Loading discussions...</span>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="empty-discussions">
                      <FaRegCommentDots />
                      <h3>No discussions yet</h3>
                      <p>Be the first to start a conversation about this project!</p>
                    </div>
                  ) : (
                    messages.map(msg => {
                      const mentionedMe = isMentioned(msg.text, userName);
                      console.log('🎨 Rendering message with label:', msg.label, 'for message ID:', msg._id);
                      console.log('🎨 Full message object:', msg);
                      console.log('🎨 Label type:', typeof msg.label);
                      console.log('🎨 Label truthy check:', !!msg.label);
                      console.log('🎨 Label length:', msg.label ? msg.label.length : 0);
                      
                      return (
                        <div 
                          key={msg._id} 
                          className={`message-item ${msg.label ? `labeled-${msg.label.toLowerCase()}` : ''}`}
                          style={{
                            ...(mentionedMe ? mentionRowStyles.container : {}),
                            ...(msg.label === 'Important' ? { borderLeft: '4px solid #ef4444', background: 'linear-gradient(135deg, #fef2f2 0%, #ffffff 100%)' } : {}),
                            ...(msg.label === 'Announcement' ? { borderLeft: '4px solid #f59e0b', background: 'linear-gradient(135deg, #fffbeb 0%, #ffffff 100%)' } : {}),
                            ...(msg.label === 'Update' ? { borderLeft: '4px solid #3b82f6', background: 'linear-gradient(135deg, #eff6ff 0%, #ffffff 100%)' } : {}),
                            ...(msg.label === 'Reminder' ? { borderLeft: '4px solid #8b5cf6', background: 'linear-gradient(135deg, #f3f4f6 0%, #ffffff 100%)' } : {}),
                            ...(msg.label === 'Urgent' ? { borderLeft: '4px solid #000000', background: 'linear-gradient(135deg, #f3f4f6 0%, #ffffff 100%)' } : {})
                          }}
                          data-label={msg.label || 'none'}
                          data-class={msg.label ? `labeled-${msg.label.toLowerCase()}` : 'no-label'}
                        >
                          {mentionedMe && (
                            <div style={mentionRowStyles.badge}>
                              MENTIONED
                            </div>
                          )}
                          {msg.label && (
                            <div 
                              className={`message-label ${msg.label.toLowerCase()}`}
                              style={{
                                position: 'absolute',
                                top: '10px',
                                right: '10px',
                                padding: '4px 8px',
                                borderRadius: '12px',
                                fontSize: '11px',
                                fontWeight: '600',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                                zIndex: 10,
                                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                                ...(msg.label === 'Important' ? { background: '#ef4444', color: 'white' } : {}),
                                ...(msg.label === 'Announcement' ? { background: '#f59e0b', color: 'white' } : {}),
                                ...(msg.label === 'Update' ? { background: '#3b82f6', color: 'white' } : {}),
                                ...(msg.label === 'Reminder' ? { background: '#8b5cf6', color: 'white' } : {}),
                                ...(msg.label === 'Urgent' ? { background: '#000000', color: 'white' } : {})
                              }}
                            >
                              {msg.label}
                            </div>
                          )}
                          <div className="message-header">
                            <div className="message-avatar">
                              {msg.userName?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                            <div className="message-info">
                              <span className="message-author">{msg.userName || 'Unknown'}</span>
                              <span className="message-time">
                                {msg.timestamp ? new Date(msg.timestamp).toLocaleString() : ''}
                              </span>
                            </div>
                          </div>
                          
                          <div className="message-content">
                            {msg.text && (
                              <p className="message-text">
                                {renderMessageText(msg.text, userName)}
                              </p>
                            )}
                            
                            {/* Attachments */}
                            {Array.isArray(msg.attachments) && msg.attachments.length > 0 && (
                              <div className="message-attachments">
                                {msg.attachments.map((att, i) => (
                                  <div key={i} className="attachment-item">
                                    <FaRegFileAlt />
                                    <a 
                                      href="#" 
                                      onClick={(e) => { 
                                        e.preventDefault(); 
                                        openSignedPath(att.path); 
                                      }} 
                                      title={att.name}
                                    >
                                      {att.name || extractOriginalNameFromPath(att.path)}
                                    </a>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Replies */}
                          {Array.isArray(msg.replies) && msg.replies.length > 0 && (
                            <div className="replies-container">
                              {msg.replies.map(reply => {
                                const replyMentionedMe = isMentioned(reply.text, userName);
                                
                                return (
                                  <div 
                                    key={reply._id} 
                                    className="reply-item"
                                    style={replyMentionedMe ? mentionRowStyles.container : {}}
                                  >
                                    {replyMentionedMe && (
                                      <div style={mentionRowStyles.badge}>
                                        MENTIONED
                                      </div>
                                    )}
                                    <div className="reply-header">
                                      <div className="reply-avatar">
                                        {reply.userName?.charAt(0)?.toUpperCase() || '?'}
                                      </div>
                                      <div className="reply-info">
                                        <span className="reply-author">{reply.userName || 'Unknown'}</span>
                                        <span className="reply-time">
                                          {reply.timestamp ? new Date(reply.timestamp).toLocaleString() : ''}
                                        </span>
                                      </div>
                                    </div>
                                    
                                    <div className="reply-content">
                                      {reply.text && (
                                        <p className="reply-text">
                                          {renderMessageText(reply.text, userName)}
                                        </p>
                                      )}
                                      
                                      {/* Reply Attachments */}
                                      {Array.isArray(reply.attachments) && reply.attachments.length > 0 && (
                                        <div className="reply-attachments">
                                          {reply.attachments.map((att, i) => (
                                            <div key={i} className="attachment-item">
                                              <FaRegFileAlt />
                                              <a 
                                                href="#" 
                                                onClick={(e) => { 
                                                  e.preventDefault(); 
                                                  openSignedPath(att.path); 
                                                }} 
                                                title={att.name}
                                              >
                                                {att.name || extractOriginalNameFromPath(att.path)}
                                              </a>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Reply Input */}
                          <div className="reply-input-container">
                            <div className="reply-input-row">
                              <input
                                type="text"
                                id={`reply-input-${msg._id}`}
                                value={replyInputs[msg._id] || ''}
                                onChange={e => {
                                  const value = e.target.value;
                                  setReplyInputs(prev => ({ ...prev, [msg._id]: value }));
                                  
                                  // Handle mentions for reply input
                                  const caret = e.target.selectionStart;
                                  const textUpToCaret = value.slice(0, caret);
                                  const match = /(^|\s)@(\w*)$/.exec(textUpToCaret);
                                  if (match) {
                                    const query = match[2].toLowerCase();
                                    const options = projectUsers
                                      .concat([{ _id: '_all_', name: 'all' }, { _id: '_everyone_', name: 'everyone' }])
                                      .filter(u => (u.name || '').toLowerCase().includes(query));
                                    
                                    setMentionDropdown({ 
                                      open: true, 
                                      options, 
                                      query, 
                                      position: { top: 0, left: 0 }, // We'll use CSS positioning instead
                                      activeInputId: e.target.id // Set active input ID
                                    });
                                  } else {
                                    setMentionDropdown({ open: false, options: [], query: '', position: { top: 0, left: 0 }, activeInputId: null });
                                  }
                                }}
                                onKeyDown={e => {
                                  if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handlePostReply(msg._id);
                                  }
                                }}
                                placeholder="Write a reply..."
                                className="reply-input"
                              />
                              {mentionDropdown.open && mentionDropdown.activeInputId === `reply-input-${msg._id}` && (
                                <div className="mention-dropdown">
                                  {mentionDropdown.options.map(user => (
                                    <div 
                                      key={user._id} 
                                      className="mention-option" 
                                      onClick={() => handleMentionSelect(user)}
                                    >
                                      {user.name}
                                    </div>
                                  ))}
                                </div>
                              )}
                              <label
                                htmlFor={`reply-attachments-${msg._id}`}
                                className="attachment-label"
                              >
                                <FaRegFileAlt />
                              </label>
                              <input
                                id={`reply-attachments-${msg._id}`}
                                type="file"
                                multiple
                                accept={acceptTypes}
                                style={{ display: 'none' }}
                                onChange={(e) => {
                                  addReplyFiles(msg._id, e.target.files);
                                  e.target.value = '';
                                }}
                              />
                              <button 
                                onClick={() => handlePostReply(msg._id)}
                                className="reply-button"
                              >
                                Reply
                              </button>
                            </div>
                            
                            {/* Reply Files Preview */}
                            {(replyInputs[`_replyFiles_${msg._id}`] || []).map((f, i) => (
                              <div key={i} className="file-preview">
                                <span>📎 {f.name}</span>
                                <button 
                                  onClick={() => {
                                    const filesKey = `_replyFiles_${msg._id}`;
                                    setReplyInputs(prev => ({
                                      ...prev,
                                      [filesKey]: prev[filesKey].filter((_, idx) => idx !== i)
                                    }));
                                  }}
                                  className="remove-file-btn"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={listBottomRef} />
                </div>

                {/* Message Composer */}
                <div className="message-composer">
                  <div
                    className={`composer-area ${isDragOver ? 'drag-over' : ''}`}
                    onDragOver={onDragOverComposer}
                    onDragLeave={onDragLeaveComposer}
                    onDrop={onDropComposer}
                  >
                    {/* Label Selector */}
                    <div className="label-selector">
                      <select
                        value={selectedLabel}
                        onChange={(e) => setSelectedLabel(e.target.value)}
                        className="label-dropdown"
                      >
                        <option value="">No Label</option>
                        <option value="Important">Important</option>
                        <option value="Announcement">Announcement</option>
                        <option value="Update">Update</option>
                        <option value="Reminder">Reminder</option>
                        <option value="Urgent">Urgent</option>
                      </select>
                    </div>
                    
                    <textarea
                      ref={textareaRef}
                      id="main-composer-textarea"
                      value={newMessage}
                      onChange={handleTextareaInput}
                      onKeyDown={handleKeyDownComposer}
                      placeholder="Type your message here..."
                      className="composer-textarea"
                    />
                    {mentionDropdown.open && mentionDropdown.activeInputId === textareaRef.current?.id && (
                      <div className="mention-dropdown">
                        {mentionDropdown.options.map(user => (
                          <div 
                            key={user._id} 
                            className="mention-option" 
                            onClick={() => handleMentionSelect(user)}
                          >
                            {user.name}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div className="composer-actions">
                    <div className="composer-left">
                      <label htmlFor="composer-attachments" className="attachment-button">
                        <FaRegFileAlt />
                        <span>Attach Files</span>
                      </label>
                      <input
                        id="composer-attachments"
                        type="file"
                        multiple
                        accept={acceptTypes}
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          addComposerFiles(e.target.files);
                          e.target.value = '';
                        }}
                      />
                      
                      {/* File Previews */}
                      {composerFiles.map((f, i) => (
                        <div key={i} className="file-preview">
                          <span>📎 {f.name}</span>
                          <button 
                            onClick={() => setComposerFiles(prev => prev.filter((_, idx) => idx !== i))}
                            className="remove-file-btn"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                    
                    <div className="composer-right">
                      <button
                        onClick={handlePostMessage}
                        disabled={posting || (!newMessage.trim() && composerFiles.length === 0)}
                        className="send-button"
                      >
                        {posting ? 'Sending...' : 'Send Message'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* --- Files Tab (Placeholder) --- */}
            {activeTab === 'Files' && (
              <div className="files-placeholder">
                <div className="placeholder-content">
                  <FaRegFileAlt />
                  <h3>Project Files</h3>
                  <p>File management feature will be implemented in the next phase.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Pm_Project;
