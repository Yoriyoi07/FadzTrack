import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import api from '../../api/axiosInstance';
import NotificationBell from '../NotificationBell';
import { FaRegCommentDots, FaRegFileAlt, FaRegListAlt, FaPlus, FaTrash } from 'react-icons/fa';
import "../style/pic_style/Pic_Project.css";

/* ---------- Socket endpoint setup ---------- */
const RAW = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
const SOCKET_ORIGIN = RAW.replace(/\/api$/, '');
const SOCKET_PATH = '/socket.io';

/* ---------- Open private file (attachments) ---------- */
async function openSignedPath(path) {
  try {
    const { data } = await api.get(`/photo-signed-url?path=${encodeURIComponent(path)}`);
    const url = data?.signedUrl;
    if (!url) throw new Error('No signedUrl in response');
    window.open(url, '_blank', 'noopener,noreferrer');
  } catch {
    alert('Failed to open attachment.');
  }
}

/* ---------- Mentions: render + highlight ---------- */
function renderMessageText(text = '', meName = '') {
  const meSlug = (meName || '').trim().toLowerCase().replace(/\s+/g, '');
  const re = /@[\w.-]+/g;
  const parts = (text || '').split(re);
  const tags = (text || '').match(re) || [];
  const nodes = [];
  for (let i = 0; i < parts.length; i++) {
    if (i > 0) {
      const tag = tags[i - 1];
      const raw = tag.slice(1);
      const slug = raw.toLowerCase().replace(/\s+/g, '');
      const isEveryone = slug === 'all' || slug === 'everyone';
      const isMe = meSlug && slug === meSlug;
      nodes.push(
        <span
          key={`m${i}`}
          style={{
            background: isMe ? 'rgba(25,118,210,.15)' : isEveryone ? 'rgba(76,175,80,.15)' : 'rgba(25,118,210,.08)',
            border: '1px solid rgba(25,118,210,.25)',
            color: '#1976d2',
            padding: '1px 4px',
            borderRadius: 4,
            fontWeight: 600,
            marginRight: 2
          }}
        >
          {tag}
        </span>
      );
    }
    nodes.push(<span key={`t${i}`}>{parts[i]}</span>);
  }
  return nodes;
}
function isMentioned(text = '', meName = '') {
  if (!text || !meName) return false;
  if (/@(all|everyone)\b/i.test(text)) return true;
  const collapsed = text.toLowerCase().replace(/\s+/g, '');
  const meSlug = meName.trim().toLowerCase().replace(/\s+/g, '');
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

/* ---------- Filename / timestamp + meta helpers ---------- */
function extractOriginalNameFromPath(path) {
  const base = (path || '').split('/').pop() || '';
  const underscore = base.indexOf('_');
  if (underscore !== -1 && underscore < base.length - 1) return base.slice(underscore + 1);
  const m = base.match(/^project-\d{8,}-(.+)$/i);
  if (m && m[1]) return m[1];
  return base;
}
function parseTimestampFromPath(path = '') {
  const base = (path || '').split('/').pop() || '';
  const m = base.match(/^(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)_/);
  if (!m) return null;
  const iso = m[1].replace(/T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z/, (_, hh, mm, ss, ms) => `T${hh}:${mm}:${ss}.${ms}Z`);
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}
const fmt = d => { try { return d?.toLocaleString() || ''; } catch { return ''; } };

function readUploadedBy(doc) {
  if (!doc || typeof doc !== 'object') return 'N/A';
  for (const key of ['uploadedByName','uploaderName','addedByName','ownerName','createdByName','name']) {
    const v = doc[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  const nested = doc.uploadedBy || doc.uploader || doc.addedBy || doc.owner || doc.createdBy || doc.user;
  if (nested && typeof nested === 'object') {
    const v = nested.name || nested.fullName || nested.username || nested.email;
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  const looksLikeId = s => typeof s === 'string' && /^[a-f0-9]{24}$/i.test(s);
  for (const c of [doc.uploadedBy, doc.uploader, doc.addedBy, doc.owner, doc.createdBy, doc.user]) {
    if (typeof c === 'string' && c.trim() && !looksLikeId(c)) return c.trim();
  }
  return 'N/A';
}
function readUploadedAt(doc, path) {
  let t = null;
  if (doc && typeof doc === 'object') {
    t = doc.uploadedAt || doc.createdAt || doc.timestamp || doc.addedAt || doc.date || doc.time || null;
  }
  if (t) {
    const dt = new Date(t);
    if (!isNaN(dt.getTime())) return fmt(dt);
  }
  const fromPath = parseTimestampFromPath(path);
  if (fromPath) return fmt(fromPath);
  return '';
}

const StaffCurrentProject = () => {
  const navigate = useNavigate();

  // Profile + nav state
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('Details');

  // Project + budgets
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [totalPO, setTotalPO] = useState(0);

  // Stable user
  const userRef = useRef(null);
  if (userRef.current === null) {
    try { userRef.current = JSON.parse(localStorage.getItem('user')); }
    catch { userRef.current = null; }
  }
  const user = userRef.current;
  const userId = user?._id || null;
  const [userName] = useState(user?.name || 'Staff');
  const token = localStorage.getItem('token');

  // Discussions
  const [messages, setMessages] = useState([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [hasLoadedDiscussions, setHasLoadedDiscussions] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [replyInputs, setReplyInputs] = useState({});
  const [showNewMsgInput, setShowNewMsgInput] = useState(false);

  // Attachments (new message + replies)
  const [composerFiles, setComposerFiles] = useState([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [posting, setPosting] = useState(false);

  // Mentions
  const textareaRef = useRef();
  const [mentionDropdown, setMentionDropdown] = useState({ open: false, options: [], query: '', position: { top: 0, left: 0 } });

  // Files tab
  const [docSignedUrls, setDocSignedUrls] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState('');
  const [pendingFiles, setPendingFiles] = useState(null);
  const [duplicateNames, setDuplicateNames] = useState([]);
  const [showDupModal, setShowDupModal] = useState(false);

  // Sockets
  const socketRef = useRef(null);
  const joinedRoomRef = useRef(null);
  const projectIdRef = useRef(null);

  // keep ref synced
  useEffect(() => {
    projectIdRef.current = project?._id ? String(project._id) : null;
  }, [project?._id]);

  // Build staff list for mentions (PM, PIC, Staff, HR - Site)
  const staffList = useMemo(() => {
    if (!project) return [];
    let staff = [];
    if (project.projectmanager && typeof project.projectmanager === 'object') {
      staff.push({ _id: project.projectmanager._id, name: project.projectmanager.name });
    }
    if (Array.isArray(project.pic)) staff = staff.concat(project.pic.map(p => ({ _id: p._id, name: p.name })));
    if (Array.isArray(project.staff)) staff = staff.concat(project.staff.map(s => ({ _id: s._id, name: s.name })));
    if (Array.isArray(project.hrsite)) staff = staff.concat(project.hrsite.map(h => ({ _id: h._id, name: h.name })));
    const seen = new Set();
    return staff.filter(u => u._id && !seen.has(u._id) && seen.add(u._id));
  }, [project]);

  // Can upload/delete docs?
  const canUploadOrDelete = useMemo(() => {
    if (!user || !project) return false;
    const allowed = new Set(['Person in Charge', 'Area Manager', 'Project Manager', 'Staff', 'HR - Site']);
    const roleName = (user.role || user.userType || user.position || user.designation || '').toString().trim();
    const byRole = roleName && [...allowed].some(r => roleName.toLowerCase().includes(r.toLowerCase()));
    const uid = String(userId || '');
    const isPM = String(project.projectmanager?._id || project.projectmanager || '') === uid;
    const isAM = String(project.areamanager?._id || project.areamanager || '') === uid;
    const inPIC = Array.isArray(project.pic) && project.pic.some(p => String(p._id || p) === uid);
    const inStaff = Array.isArray(project.staff) && project.staff.some(p => String(p._id || p) === uid);
    const inHR = Array.isArray(project.hrsite) && project.hrsite.some(p => String(p._id || p) === uid);
    return byRole || isPM || isAM || inPIC || inStaff || inHR;
  }, [user, project, userId]);

  /* -------------------- Socket (once) -------------------- */
  useEffect(() => {
    if (socketRef.current) return;

    const sock = io(SOCKET_ORIGIN, {
      path: SOCKET_PATH,
      withCredentials: true,
      transports: ['websocket'],
      auth: { userId },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.5,
    });
    socketRef.current = sock;

    const onConnect = () => {
      if (joinedRoomRef.current) sock.emit('joinProject', joinedRoomRef.current);
    };
    const onNewDiscussion = (payload) => {
      const currentPid = projectIdRef.current;
      if (!currentPid || payload?.projectId !== currentPid) return;
      setMessages(prev => [...prev, payload.message]);
    };
    const onNewReply = (payload) => {
      const currentPid = projectIdRef.current;
      if (!currentPid || payload?.projectId !== currentPid) return;
      setMessages(prev => {
        const clone = prev.map(m => ({ ...m, replies: [...(m.replies || [])] }));
        const idx = clone.findIndex(m => String(m._id) === String(payload.msgId));
        if (idx !== -1) clone[idx].replies.push(payload.reply);
        return clone;
      });
    };
    const onDocsUpdated = async () => {
      if (!projectIdRef.current) return;
      try {
        const { data } = await api.get(`/projects/${projectIdRef.current}`);
        const normalizedDocs = Array.isArray(data?.documents)
          ? data.documents.map(d => (typeof d === 'string'
              ? { path: d, uploadedByName: 'Unknown', uploadedAt: parseTimestampFromPath(d) || null }
              : d))
          : [];
        setProject(prev => ({ ...data, documents: normalizedDocs }));
      } catch {}
    };

    sock.on('connect', onConnect);
    sock.on('project:newDiscussion', onNewDiscussion);
    sock.on('project:newReply', onNewReply);
    sock.on('project:documentsUpdated', onDocsUpdated);

    return () => {
      sock.off('connect', onConnect);
      sock.off('project:newDiscussion', onNewDiscussion);
      sock.off('project:newReply', onNewReply);
      sock.off('project:documentsUpdated', onDocsUpdated);
      sock.disconnect();
      socketRef.current = null;
      joinedRoomRef.current = null;
    };
  }, [userId]);

  /* -------- Join/leave project room when Discussions tab is active -------- */
  const projectId = project?._id || null;
  useEffect(() => {
    const sock = socketRef.current;
    if (!sock) return;
    const desiredRoom = (activeTab === 'Discussions' && projectId) ? `project:${projectId}` : null;

    if (joinedRoomRef.current === desiredRoom) return;
    if (joinedRoomRef.current && (!desiredRoom || joinedRoomRef.current !== desiredRoom)) {
      sock.emit('leaveProject', joinedRoomRef.current);
      joinedRoomRef.current = null;
    }
    if (desiredRoom && joinedRoomRef.current !== desiredRoom) {
      sock.emit('joinProject', desiredRoom);
      joinedRoomRef.current = desiredRoom;
    }
  }, [projectId, activeTab]);

  /* -------------------- Fetch current project (by assigned) -------------------- */
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get(`/projects/assigned/allroles/${userId}`);
        if (cancelled) return;
        const ongoing = (res.data || []).find(p => p.status === 'Ongoing') || (res.data || [])[0] || null;

        // normalize legacy docs (string → object)
        const normalizedDocs = Array.isArray(ongoing?.documents)
          ? ongoing.documents.map(d => (typeof d === 'string'
              ? { path: d, uploadedByName: 'Unknown', uploadedAt: parseTimestampFromPath(d) || null }
              : d))
          : [];
        setProject(ongoing ? { ...ongoing, documents: normalizedDocs } : null);
      } catch {
        if (!cancelled) setProject(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  /* -------------------- Purchase Orders -------------------- */
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get('/requests');
        if (cancelled) return;
        const approved = (res.data || []).filter(r =>
          String(r?.project?._id || '') === String(projectId) &&
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
  }, [projectId]);

  /* -------------------- Discussions initial fetch -------------------- */
  useEffect(() => {
    if (!projectId || activeTab !== 'Discussions' || hasLoadedDiscussions) return;
    const controller = new AbortController();
    setLoadingMsgs(true);
    api.get(`/projects/${projectId}/discussions`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(res => setMessages(Array.isArray(res.data) ? res.data : []))
      .catch(() => setMessages([]))
      .finally(() => {
        setLoadingMsgs(false);
        setHasLoadedDiscussions(true);
      });
    return () => controller.abort();
  }, [projectId, activeTab, token, hasLoadedDiscussions]);
  useEffect(() => { setHasLoadedDiscussions(false); }, [projectId]);

  /* -------------------- Files: signed URLs -------------------- */
  useEffect(() => {
    let intervalId;
    async function fetchSignedUrls() {
      const docs = Array.isArray(project?.documents) ? project.documents : [];
      if (docs.length) {
        const urls = await Promise.all(
          docs.map(async d => {
            const p = typeof d === 'string' ? d : d?.path;
            if (!p) return null;
            try {
              const { data } = await api.get(`/photo-signed-url?path=${encodeURIComponent(p)}`);
              return data.signedUrl;
            } catch { return null; }
          })
        );
        setDocSignedUrls(urls);
      } else {
        setDocSignedUrls([]);
      }
    }
    if (activeTab === 'Files') {
      fetchSignedUrls();
      intervalId = setInterval(fetchSignedUrls, 270000);
    }
    return () => clearInterval(intervalId);
  }, [activeTab, project]);

  /* -------------------- Mentions -------------------- */
  const handleTextareaInput = (e) => {
    const value = e.target.value;
    setNewMessage(value);
    const caret = e.target.selectionStart;
    const textUpToCaret = value.slice(0, caret);
    const match = /(^|\s)@(\w*)$/.exec(textUpToCaret);
    if (match) {
      const query = match[2].toLowerCase();
      const options = staffList
        .concat([{ _id: '_all_', name: 'all' }, { _id: '_everyone_', name: 'everyone' }])
        .filter(u => (u.name || '').toLowerCase().includes(query));
      const rect = e.target.getBoundingClientRect();
      setMentionDropdown({ open: true, options, query, position: { top: rect.top + e.target.offsetHeight, left: rect.left + 10 } });
    } else {
      setMentionDropdown({ open: false, options: [], query: '', position: { top: 0, left: 0 } });
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
    const after  = value.slice(caret);
    const mentionText = `@${selUser.name} `;
    const newVal = before + mentionText + after;
    setNewMessage(newVal);
    setMentionDropdown({ open: false, options: [], query: '', position: { top: 0, left: 0 } });
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.selectionStart = textareaRef.current.selectionEnd = (before + mentionText).length;
      }
    }, 0);
  };

  /* -------------------- Discussions: post & reply (with attachments) -------------------- */
  const acceptTypes = ".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.txt,.rtf,.csv,image/*";
  const disabledPost = (!newMessage.trim() && composerFiles.length === 0) || posting || !projectId;

  function addComposerFiles(files) {
    if (!files?.length) return;
    const arr = Array.from(files);
    setComposerFiles(prev => [...prev, ...arr]);
  }
  const onDragOverComposer = (e) => { e.preventDefault(); setIsDragOver(true); };
  const onDragLeaveComposer = (e) => { e.preventDefault(); setIsDragOver(false); };
  const onDropComposer = (e) => {
    e.preventDefault(); setIsDragOver(false);
    if (e.dataTransfer?.files?.length) addComposerFiles(e.dataTransfer.files);
  };
  const addReplyFiles = (msgId, fileList) => {
    const filesKey = `_replyFiles_${msgId}`;
    const arr = Array.from(fileList || []);
    setReplyInputs(prev => ({ ...prev, [filesKey]: [...(prev[filesKey] || []), ...arr] }));
  };

  const handlePostMessage = async () => {
    if (disabledPost) return;
    try {
      setPosting(true);
      const fd = new FormData();
      if (newMessage.trim()) fd.append('text', newMessage.trim());
      composerFiles.forEach(f => fd.append('attachments', f));
      await api.post(`/projects/${projectId}/discussions`, fd, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNewMessage('');
      setComposerFiles([]);
      setShowNewMsgInput(false);
    } catch {
      alert('Failed to post message');
    } finally {
      setPosting(false);
    }
  };

  const handlePostReply = async (msgId) => {
    const replyText = (replyInputs[msgId] || '').trim();
    const filesKey = `_replyFiles_${msgId}`;
    const replyFiles = (replyInputs[filesKey] || []);
    const disabledReply = (!replyText && replyFiles.length === 0) || !projectId;
    if (disabledReply) return;
    try {
      const fd = new FormData();
      if (replyText) fd.append('text', replyText);
      replyFiles.forEach(f => fd.append('attachments', f));
      await api.post(`/projects/${projectId}/discussions/${msgId}/reply`, fd, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setReplyInputs(prev => ({ ...prev, [msgId]: '', [filesKey]: [] }));
    } catch {
      alert('Failed to post reply');
    }
  };

  /* -------------------- Files: upload / delete (permission-gated) -------------------- */
  const actuallyUpload = async (filesArr, useOverwrite = false) => {
    setUploading(true);
    setUploadErr('');
    try {
      const fd = new FormData();
      filesArr.forEach(f => fd.append('files', f));

      const { data } = await api.post(
        `/projects/${project._id}/documents${useOverwrite ? '?overwrite=1' : ''}`,
        fd,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const normalized = Array.isArray(data?.documents)
        ? data.documents.map(d => (typeof d === 'string'
            ? { path: d, uploadedByName: 'Unknown', uploadedAt: parseTimestampFromPath(d) || null }
            : d))
        : [];
      setProject(prev => ({ ...prev, documents: normalized }));

      if (data?.renamed?.length) {
        alert(data.renamed.map(r => `⚠️ ${r.from} already existed, uploaded as ${r.to}`).join('\n'));
      }
      if (data?.replaced?.length) {
        alert(data.replaced.map(r => `ℹ️ ${r.originalName} was replaced (${r.removed} old version(s) removed)`).join('\n'));
      }
    } catch {
      setUploadErr('Upload failed. Please try again.');
    } finally {
      setUploading(false);
      setPendingFiles(null);
      setDuplicateNames([]);
      setShowDupModal(false);
    }
  };

  const handlePrepareUpload = (files) => {
    if (!files?.length || !project) return;
    const existing = new Set(
      (project.documents || []).map(item => {
        const p = typeof item === 'string' ? item : item?.path || '';
        return extractOriginalNameFromPath(p).toLowerCase();
      })
    );
    const dups = [];
    files.forEach(f => { if (existing.has((f.name || '').toLowerCase())) dups.push(f.name); });
    if (dups.length) {
      setPendingFiles(files);
      setDuplicateNames(dups);
      setShowDupModal(true);
    } else {
      actuallyUpload(files, false);
    }
  };

  const handleDelete = async (docItem) => {
    if (!canUploadOrDelete) return;
    const path = typeof docItem === 'string' ? docItem : docItem?.path;
    const fileName = extractOriginalNameFromPath(path);
    const ok = window.confirm(`Delete "${fileName}" from this project?`);
    if (!ok) return;

    try {
      const { data } = await api.delete(`/projects/${project._id}/documents`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { path }
      });
      const normalized = Array.isArray(data?.documents)
        ? data.documents.map(d => (typeof d === 'string'
            ? { path: d, uploadedByName: 'Unknown', uploadedAt: parseTimestampFromPath(d) || null }
            : d))
        : [];
      setProject(prev => ({ ...prev, documents: normalized }));
    } catch {
      alert('Failed to delete file.');
    }
  };

  /* -------------------- UI misc -------------------- */
  useEffect(() => {
    const handleClickOutside = (e) => { if (!e.target.closest(".profile-menu-container")) setProfileMenuOpen(false); };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  if (loading) return <div>Loading...</div>;
  if (!project) {
    return (
      <>
        <header className="header">
          <div className="logo-container">
            <img src={require('../../assets/images/FadzLogo1.png')} alt="FadzTrack Logo" className="logo-img" />
            <h1 className="brand-name">FadzTrack</h1>
          </div>
          <nav className="nav-menu">
            <Link to="/staff/current-project" className="nav-link">Dashboard</Link>
            <Link to="/staff/all-projects" className="nav-link">My Projects</Link>
            <Link to="/staff/chat" className="nav-link">Chat</Link>
          </nav>
          <div className="profile-menu-container" style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <NotificationBell />
            <div className="profile-circle" onClick={() => setProfileMenuOpen(!profileMenuOpen)}>
              {userName?.charAt(0).toUpperCase() || 'S'}
            </div>
            {profileMenuOpen && (
              <div className="profile-menu">
                <button onClick={handleLogout}>Logout</button>
              </div>
            )}
          </div>
        </header>
        <main className="main1">
          <div className="no-project-message">
            <h2>No assigned project</h2>
            <p>Your account doesn’t have an active project yet.</p>
            <p>Please wait for an assignment or contact your manager.</p>
          </div>
        </main>
      </>
    );
  }

  // Derived helpers
  const start = project?.startDate ? new Date(project.startDate).toLocaleDateString() : 'N/A';
  const end   = project?.endDate ? new Date(project.endDate).toLocaleDateString() : 'N/A';
  const contractor =
    typeof project?.contractor === 'string' && project.contractor.trim().length > 0 ? project.contractor : 'N/A';
  const locationLabel = project?.location?.name
    ? `${project.location.name}${project.location?.region ? ` (${project.location.region})` : ''}`
    : 'N/A';
  const budgetNum = Number(project?.budget || 0);
  const remaining = Math.max(budgetNum - Number(totalPO || 0), 0);
  const manpowerText =
    Array.isArray(project?.manpower) && project.manpower.length > 0
      ? project.manpower.map(mp => [mp?.name, mp?.position].filter(Boolean).join(' (') + (mp?.position ? ')' : '')).join(', ')
      : 'No Manpower Assigned';

  return (
    <>
      {/* HEADER */}
      <header className="header">
        <div className="logo-container">
          <img src={require('../../assets/images/FadzLogo1.png')} alt="FadzTrack Logo" className="logo-img" />
          <h1 className="brand-name">FadzTrack</h1>
        </div>
        <nav className="nav-menu">
          <Link to="/staff/current-project" className="nav-link">Dashboard</Link>
          {project && (<Link to={`/staff/projects/${project._id}/request`} className="nav-link">Requests</Link>)}
          {project && (<Link to={`/staff/${project._id}`} className="nav-link">View Project</Link>)}
          <Link to="/staff/all-projects" className="nav-link">My Projects</Link>
          <Link to="/staff/chat" className="nav-link">Chat</Link>
        </nav>
        <div className="profile-menu-container" style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <NotificationBell />
          <div className="profile-circle" onClick={() => setProfileMenuOpen(!profileMenuOpen)}>
            {userName?.charAt(0).toUpperCase() || 'S'}
          </div>
          {profileMenuOpen && (
            <div className="profile-menu">
              <button onClick={handleLogout}>Logout</button>
            </div>
          )}
        </div>
      </header>

      {/* LAYOUT */}
      <div className="dashboard-layout">
        {/* Optional sidebar (kept simple / static) */}
        <div className="sidebar">
          <div className="chats-section">
            <h3 className="chats-title">Chats</h3>
            <div className="chats-list" />
          </div>
        </div>

        {/* MAIN CONTENT */}
        <main className="main1">
          <div className="project-detail-container">
            <div className="project-image-container" style={{ marginBottom: 12 }}>
              <img
                src={(project.photos && project.photos[0]) || 'https://placehold.co/800x300?text=No+Photo'}
                alt={project.projectName}
                className="responsive-photo"
              />
            </div>

            <h1 className="project-title">{project.projectName}</h1>

            {/* Tabs */}
            <div className="tabs-row">
              <button className={`tab-btn${activeTab === 'Discussions' ? ' active' : ''}`} onClick={() => setActiveTab('Discussions')}>
                <FaRegCommentDots /> Discussions
              </button>
              <button className={`tab-btn${activeTab === 'Details' ? ' active' : ''}`} onClick={() => setActiveTab('Details')}>
                <FaRegListAlt /> Details
              </button>
              <button className={`tab-btn${activeTab === 'Files' ? ' active' : ''}`} onClick={() => setActiveTab('Files')}>
                <FaRegFileAlt /> Files
              </button>
              <button className={`tab-btn${activeTab === 'Reports' ? ' active' : ''}`} onClick={() => setActiveTab('Reports')}>
                <FaRegFileAlt /> Reports
              </button>
            </div>

            {/* --- Discussions --- */}
            {activeTab === 'Discussions' && (
              <div className="discussions-card" style={{ display: 'flex', flexDirection: 'column', height: 540 }}>
                <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4 }}>
                  {loadingMsgs ? (
                    <div style={{ textAlign: "center", color: "#aaa" }}>Loading discussions…</div>
                  ) : (
                    <>
                      {messages.length === 0 ? (
                        <div style={{ color: '#bbb', fontSize: 18, textAlign: 'center', marginTop: 40, userSelect: 'none' }}>
                          No messages yet — be the first to post.
                        </div>
                      ) : (
                        messages.map(msg => {
                          const mentionedMe = isMentioned(msg.text, userName);
                          return (
                            <div
                              key={msg._id}
                              className="discussion-msg"
                              style={mentionedMe ? mentionRowStyles.container : undefined}
                            >
                              {mentionedMe && <span style={mentionRowStyles.badge}>Mentioned you</span>}

                              <div className="discussion-user">
                                <div className="discussion-avatar">{msg.userName?.charAt(0) ?? '?'}</div>
                                <div className="discussion-user-info">
                                  <span className="discussion-user-name">{msg.userName || 'Unknown'}</span>
                                  <span className="discussion-timestamp">
                                    {msg.timestamp ? new Date(msg.timestamp).toLocaleString() : ''}
                                  </span>
                                </div>
                              </div>

                              <div className="discussion-text">
                                {renderMessageText(msg.text, userName)}
                              </div>

                              {/* attachments on message */}
                              {Array.isArray(msg.attachments) && msg.attachments.length > 0 && (
                                <div style={{ marginTop: 6 }}>
                                  {msg.attachments.map((att, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                      <FaRegFileAlt />
                                      <a href="#" onClick={(e) => { e.preventDefault(); openSignedPath(att.path); }} title={att.name}>
                                        {att.name || extractOriginalNameFromPath(att.path)}
                                      </a>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Replies */}
                              <div className="discussion-replies">
                                {msg.replies?.map(reply => {
                                  const replyMentionedMe = isMentioned(reply.text, userName);
                                  return (
                                    <div key={reply._id} className="discussion-reply">
                                      <div className="reply-avatar">{reply.userName?.charAt(0) ?? '?'}</div>
                                      <div
                                        className="reply-info"
                                        style={replyMentionedMe ? { ...mentionRowStyles.container, padding: 8 } : undefined}
                                      >
                                        {replyMentionedMe && <span style={mentionRowStyles.badge}>Mentioned you</span>}
                                        <span className="reply-name">{reply.userName || 'Unknown'}</span>
                                        <span className="reply-timestamp">
                                          {reply.timestamp ? new Date(reply.timestamp).toLocaleString() : ''}
                                        </span>
                                        <span className="reply-text">{renderMessageText(reply.text, userName)}</span>

                                        {Array.isArray(reply.attachments) && reply.attachments.length > 0 && (
                                          <div style={{ marginTop: 4 }}>
                                            {reply.attachments.map((att, i) => (
                                              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <FaRegFileAlt />
                                                <a href="#" onClick={(e) => { e.preventDefault(); openSignedPath(att.path); }} title={att.name}>
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

                                {/* Reply input + files */}
                                <div className="reply-input-row" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                  <div style={{ display: 'flex', gap: 8 }}>
                                    <input
                                      type="text"
                                      value={replyInputs[msg._id] || ''}
                                      onChange={e => setReplyInputs(prev => ({ ...prev, [msg._id]: e.target.value }))}
                                      onKeyDown={e => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                          e.preventDefault();
                                          handlePostReply(msg._id);
                                        }
                                      }}
                                      placeholder="Reply…"
                                      style={{ flex: 1 }}
                                    />
                                    <label
                                      htmlFor={`reply-attachments-${msg._id}`}
                                      style={{
                                        cursor: 'pointer',
                                        padding: '6px 10px',
                                        borderRadius: 6,
                                        border: '1px solid #ddd',
                                        background: '#fff',
                                        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                                        fontSize: 14,
                                        userSelect: 'none',
                                        whiteSpace: 'nowrap'
                                      }}
                                    >
                                      Attach
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
                                    <button onClick={() => handlePostReply(msg._id)}>
                                      Reply
                                    </button>
                                  </div>
                                  {(replyInputs[`_replyFiles_${msg._id}`] || []).map((f, i) => (
                                    <div key={i} style={{ fontSize: 13, color: '#555' }}>
                                      • {f.name}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </>
                  )}
                </div>

                {/* Composer with drag & drop */}
                <div style={{ borderTop: '1px solid #eee', paddingTop: 10, marginTop: 10 }}>
                  <div
                    onDragOver={onDragOverComposer}
                    onDragLeave={onDragLeaveComposer}
                    onDrop={onDropComposer}
                    style={{
                      position: 'relative',
                      marginBottom: 8,
                      borderRadius: 10,
                      padding: 8,
                      transition: 'border-color .15s ease-in-out',
                      background: isDragOver ? 'rgba(25,118,210,.04)' : 'transparent'
                    }}
                  >
                    <textarea
                      ref={textareaRef}
                      value={newMessage}
                      onChange={handleTextareaInput}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          if (!disabledPost) handlePostMessage();
                        }
                      }}
                      placeholder="Type a message "
                      style={{
                        width: '100%',
                        minHeight: 70,
                        resize: 'vertical',
                        padding: 10,
                        borderRadius: 8,
                        border: '1px solid #ddd'
                      }}
                    />
                    {mentionDropdown.open && (
                      <div
                        className="mention-dropdown"
                        style={{
                          position: 'absolute',
                          left: 8,
                          bottom: 80,
                          background: '#fff',
                          border: '1px solid #e5e5e5',
                          borderRadius: 8,
                          padding: 6,
                          boxShadow: '0 6px 24px rgba(0,0,0,0.12)',
                          zIndex: 10
                        }}
                      >
                        {mentionDropdown.options.map(u => (
                          <div
                            key={u._id}
                            className="mention-option"
                            onClick={() => handleMentionSelect(u)}
                            style={{ padding: '6px 10px', cursor: 'pointer' }}
                          >
                            {u.name}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <label
                      htmlFor="discussion-attachments"
                      style={{
                        cursor: 'pointer',
                        padding: '6px 10px',
                        borderRadius: 6,
                        border: '1px solid #ddd',
                        background: '#fff',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                        fontSize: 14,
                        userSelect: 'none',
                      }}
                    >
                      Attach Files
                    </label>
                    <input
                      id="discussion-attachments"
                      type="file"
                      multiple
                      accept={acceptTypes}
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        addComposerFiles(e.target.files);
                        e.target.value = '';
                      }}
                    />
                    {composerFiles.map((f, i) => (
                      <div key={i} style={{ background: '#f3f6fb', border: '1px solid #e3e7f0', borderRadius: 999, padding: '6px 10px' }}>
                        {f.name}
                        <button onClick={() => setComposerFiles(prev => prev.filter((_, idx) => idx !== i))} style={{ marginLeft: 8 }} title="Remove">×</button>
                      </div>
                    ))}
                    {!!composerFiles.length && (
                      <button
                        onClick={() => setComposerFiles([])}
                        style={{ marginLeft: 'auto', border: '1px solid #ddd', background: '#fff', padding: '6px 10px', borderRadius: 6 }}
                      >
                        Clear
                      </button>
                    )}
                    <button
                      onClick={handlePostMessage}
                      disabled={disabledPost}
                      style={{
                        marginLeft: 'auto',
                        padding: '8px 16px',
                        borderRadius: 6,
                        border: disabledPost ? '1px solid #ccc' : '1px solid #1976d2',
                        background: disabledPost ? '#e9ecef' : '#1976d2',
                        color: disabledPost ? '#888' : '#fff',
                        cursor: disabledPost ? 'not-allowed' : 'pointer'
                      }}
                      title={disabledPost ? 'Type a message or attach files' : 'Post'}
                    >
                      {posting ? 'Posting…' : 'Post'}
                    </button>
                  </div>
                </div>

                {/* Floating add button for small screens, optional */}
                <button className="discussion-plus-btn" onClick={() => setShowNewMsgInput(v => !v)} title="Start a new conversation">
                  <FaPlus />
                </button>

                {/* Simple modal version (mobile) */}
                {showNewMsgInput && (
                  <div className="new-msg-modal" onClick={() => setShowNewMsgInput(false)}>
                    <div className="new-msg-box" onClick={e => e.stopPropagation()}>
                      <h3 style={{ margin: 0, marginBottom: 16 }}>Start a new conversation</h3>
                      <textarea
                        value={newMessage}
                        onChange={handleTextareaInput}
                        ref={textareaRef}
                        placeholder="Type your message... (you can @Name)"
                      />
                      {mentionDropdown.open && (
                        <div
                          className="mention-dropdown"
                          style={{ top: mentionDropdown.position.top, left: mentionDropdown.position.left }}
                        >
                          {mentionDropdown.options.map(u => (
                            <div key={u._id} className="mention-option" onClick={() => handleMentionSelect(u)}>
                              {u.name}
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="new-msg-actions">
                        <button className="cancel-btn" onClick={() => setShowNewMsgInput(false)}>Cancel</button>
                        <button className="post-btn" onClick={handlePostMessage}>Post</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* --- Details --- */}
            {activeTab === 'Details' && (
              <div>
                <div className="project-details-grid">
                  <div className="details-column">
                    <p className="detail-item">
                      <span className="detail-label">Location:</span>
                      {locationLabel}
                    </p>

                    <div className="detail-group">
                      <p className="detail-label">Project Manager:</p>
                      <p className="detail-value">{project?.projectmanager?.name || 'N/A'}</p>
                    </div>

                    <div className="detail-group">
                      <p className="detail-label">Contractor:</p>
                      <p className="detail-value">{contractor}</p>
                    </div>

                    <div className="detail-group">
                      <p className="detail-label">Target Date:</p>
                      <p className="detail-value">{start} — {end}</p>
                    </div>
                  </div>

                  <div className="details-column">
                    <div className="budget-container">
                      <p className="budget-amount">
                        ₱{(budgetNum || 0).toLocaleString()}
                        {totalPO > 0 && (
                          <span style={{ color: 'red', fontSize: 16, marginLeft: 8 }}>
                            - ₱{totalPO.toLocaleString()} (POs)
                          </span>
                        )}
                      </p>
                      <p className="budget-label">Estimated Budget</p>
                    </div>

                    {totalPO > 0 && (
                      <div style={{ color: '#219653', fontWeight: 600, marginBottom: 8 }}>
                        Remaining Budget: ₱{remaining.toLocaleString()}
                      </div>
                    )}

                    <div className="detail-group">
                      <p className="detail-label">PIC:</p>
                      <p className="detail-value">
                        {Array.isArray(project?.pic) && project.pic.length > 0
                          ? project.pic.map(p => p?.name).filter(Boolean).join(', ')
                          : 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>

                {purchaseOrders.length > 0 && (
                  <div style={{ color: 'red', fontSize: 13, marginBottom: 8 }}>
                    Purchase Orders:
                    <ul style={{ margin: 0, padding: '0 0 0 16px' }}>
                      {purchaseOrders.map(po => (
                        <li key={po._id}>
                          PO#: <b>{po.purchaseOrder}</b> — ₱{Number(po.totalValue).toLocaleString()}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="manpower-section">
                  <p className="detail-label">Manpower:</p>
                  <p className="manpower-list">{manpowerText}</p>
                </div>

                <p><b>Status:</b> {project?.status || 'N/A'}</p>
              </div>
            )}

            {/* --- Files --- */}
            {activeTab === 'Files' && (
              <div className="project-files-list" style={{ textAlign: 'left', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <h3 style={{ marginBottom: 18 }}>Project Documents</h3>

                  {canUploadOrDelete && (
                    <div>
                      <label
                        htmlFor="file-uploader"
                        style={{
                          cursor: uploading ? 'not-allowed' : 'pointer',
                          padding: '8px 12px',
                          borderRadius: 6,
                          border: '1px solid #ddd',
                          background: uploading ? '#f3f3f3' : '#fff',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                          fontSize: 14,
                          userSelect: 'none',
                        }}
                        title={uploading ? 'Uploading…' : 'Attach files'}
                      >
                        {uploading ? 'Uploading…' : 'Attach Files'}
                      </label>
                      <input
                        id="file-uploader"
                        type="file"
                        multiple
                        style={{ display: 'none' }}
                        disabled={uploading}
                        onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          if (!files.length) return;
                          handlePrepareUpload(files);
                          e.target.value = '';
                        }}
                      />
                    </div>
                  )}
                </div>

                {uploadErr && <div style={{ color: '#b00020', marginBottom: 10 }}>{uploadErr}</div>}

                {project?.documents && project.documents.length > 0 ? (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="files-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid #eee', background: '#fafafa', fontWeight: 600 }}>
                            File
                          </th>
                          <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid #eee', background: '#fafafa', fontWeight: 600 }}>
                            Uploaded By
                          </th>
                          <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid #eee', background: '#fafafa', fontWeight: 600 }}>
                            Uploaded At
                          </th>
                          <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid #eee', background: '#fafafa', fontWeight: 600, width: 220 }}>
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {project.documents.map((docItem, idx) => {
                          const path = typeof docItem === 'string' ? docItem : docItem?.path;
                          const fileName = extractOriginalNameFromPath(path);
                          const url = docSignedUrls[idx];

                          const uploadedBy = readUploadedBy(typeof docItem === 'object' ? docItem : null);
                          const uploadedAt = readUploadedAt(typeof docItem === 'object' ? docItem : null, path);

                          return (
                            <tr key={idx}>
                              <td style={{ padding: '10px 12px', borderTop: '1px solid #f1f1f1', verticalAlign: 'middle' }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                                  <FaRegFileAlt style={{ marginRight: 6 }} />
                                  {fileName}
                                </span>
                              </td>
                              <td style={{ padding: '10px 12px', borderTop: '1px solid #f1f1f1' }}>{uploadedBy || 'Unknown'}</td>
                              <td style={{ padding: '10px 12px', borderTop: '1px solid #f1f1f1' }}>{uploadedAt || '—'}</td>
                              <td style={{ padding: '10px 12px', borderTop: '1px solid #f1f1f1', verticalAlign: 'middle' }}>
                                {url ? (
                                  <a
                                    href={url}
                                    download={fileName}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ textDecoration: 'underline', marginRight: 14 }}
                                  >
                                    View
                                  </a>
                                ) : (
                                  <span style={{ color: '#aaa', marginRight: 14 }}>Loading link…</span>
                                )}

                                {canUploadOrDelete && (
                                  <button
                                    onClick={() => handleDelete(docItem)}
                                    style={{
                                      border: '1px solid #e5e5e5',
                                      background: '#fff',
                                      padding: '6px 10px',
                                      borderRadius: 6,
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 6
                                    }}
                                    title="Delete file"
                                  >
                                    <FaTrash /> Delete
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ color: '#888', fontSize: 16 }}>No documents uploaded for this project.</div>
                )}
              </div>
            )}

            {/* --- Reports --- */}
            {activeTab === 'Reports' && (
              <div className="project-reports-placeholder">
                <h3 style={{ marginBottom: 12 }}>Project Reports</h3>
                <div style={{ color: '#888' }}>No reports are currently available.</div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* ===== Duplicate Modal ===== */}
      {showDupModal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
          }}
          onClick={() => setShowDupModal(false)}
        >
          <div
            style={{
              background: '#fff', padding: 18, borderRadius: 10, minWidth: 360,
              maxWidth: 520, boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0, marginBottom: 10 }}>Duplicate file name(s) found</h3>
            <p style={{ marginTop: 0 }}>These files already exist in the project:</p>
            <ul style={{ marginTop: 4 }}>
              {duplicateNames.map((n, i) => <li key={i}>• {n}</li>)}
            </ul>
            <p style={{ marginTop: 10 }}>Choose what to do:</p>
            <div style={{ display: 'flex', gap: 10, marginTop: 12, justifyContent: 'flex-end' }}>
              <button
                onClick={() => { if (pendingFiles?.length) actuallyUpload(pendingFiles, false); }}
                style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #ddd', background: '#fff', cursor: 'pointer' }}
              >
                Yes — Upload renamed
              </button>
              <button
                onClick={() => { if (pendingFiles?.length) actuallyUpload(pendingFiles, true); }}
                style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #d9534f', background: '#d9534f', color: '#fff', cursor: 'pointer' }}
                title="Replace existing files with the same names"
              >
                Overwrite existing
              </button>
              <button
                onClick={() => { setShowDupModal(false); setPendingFiles(null); setDuplicateNames([]); }}
                style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #ddd', background: '#fff', cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default StaffCurrentProject;
