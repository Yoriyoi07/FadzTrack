import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../../api/axiosInstance';
import NotificationBell from '../NotificationBell';
import { FaRegCommentDots, FaRegFileAlt, FaRegListAlt, FaTrash, FaCamera } from 'react-icons/fa';
import { io } from 'socket.io-client';
import "../style/pic_style/Pic_Project.css";
// Reuse PM view styling for unified look & feel
import "../style/pm_style/Pm_ViewProjects.css";
import "../style/pm_style/Pm_ViewProjects_Wide.css";
// Nav icons
import { 
  FaTachometerAlt, 
  FaComments, 
  FaClipboardList, 
  FaEye, 
  FaProjectDiagram,
  FaUsers,
  FaChartBar,
  FaCalendarAlt,
  FaBoxes
} from 'react-icons/fa';

/* ---------- Socket endpoint setup ---------- */
const RAW = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
const SOCKET_ORIGIN = RAW.replace(/\/api$/, '');
const SOCKET_PATH = '/socket.io';

/* ---------- Signed URL opener (Files helper) ---------- */
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

/* ---------- Reports signed URL helper ---------- */
async function openReportSignedPath(path) {
  try {
    const { data } = await api.get(`/projects/${encodeURIComponent('dummy')}/reports-signed-url`, {
      // backend ignores :id in this handler; pass dummy, keep query path param
      params: { path }
    });
    const url = data?.signedUrl;
    if (!url) throw new Error('No signedUrl in response');
    window.open(url, '_blank', 'noopener,noreferrer');
  } catch {
    alert('Failed to open report file.');
  }
}

/* ---------- Chats stub (left sidebar) ---------- */
const chats = [
  { id: 1, name: 'Rychea Miralles', initial: 'R', message: 'Hello Good Morning po! As...', color: '#4A6AA5' },
  { id: 2, name: 'Third Castellar',  initial: 'T', message: 'Hello Good Morning po! As...', color: '#2E7D32' },
  { id: 3, name: 'Zenarose Miranda', initial: 'Z', message: 'Hello Good Morning po! As...', color: '#9C27B0' }
];

/* ---------- Mention rendering ---------- */
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


/* ---------- Mention helpers ---------- */
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

/* ---------- Path + meta helpers ---------- */
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

/* ===========================================================
   PIC - Current Project
   =========================================================== */
const PicCurrentProject = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  // Stable user
  const userRef = useRef(null);
  if (userRef.current === null) {
    try { userRef.current = JSON.parse(localStorage.getItem('user')); }
    catch { userRef.current = null; }
  }
  const user = userRef.current;
  const userId = user?._id || null;
  const [userName] = useState(user?.name || 'PIC');
  const [userRole] = useState(user?.role || 'Person in Charge');
  const token = localStorage.getItem('token');

  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);

  const [project, setProject] = useState(null);
  const [activeTab, setActiveTab] = useState('Discussions');
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(true);

  // Discussions
  const [messages, setMessages] = useState([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [replyInputs, setReplyInputs] = useState({});
  const textareaRef = useRef();

  // Composer attachments + drag/drop
  const [composerFiles, setComposerFiles] = useState([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [posting, setPosting] = useState(false);
  const listScrollRef = useRef(null);
  const listBottomRef = useRef(null);

  // Mentions
  const [mentionDropdown, setMentionDropdown] = useState({ open: false, options: [], query: '', position: { top: 0, left: 0 } });

  // Files tab state
  const [docSignedUrls, setDocSignedUrls] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState('');
  const [pendingFiles, setPendingFiles] = useState(null);
  const [duplicateNames, setDuplicateNames] = useState([]);
  const [showDupModal, setShowDupModal] = useState(false);

  // Reports tab state
  const [reports, setReports] = useState([]);
  const [reportUploading, setReportUploading] = useState(false);

  // Project image upload state (restored like PM view)
  const [imageUploading, setImageUploading] = useState(false);
  const [imageUploadProgress, setImageUploadProgress] = useState(0);
  const [imageUploadError, setImageUploadError] = useState('');

  const [openReportIds, setOpenReportIds] = useState(() => new Set());
const toggleReportOpen = (id) => {
  setOpenReportIds(prev => {
    const next = new Set(prev);
    const k = String(id);
    if (next.has(k)) next.delete(k); else next.add(k);
    return next;
  });
};

const CPA_LABELS = ['Optimistic Path', 'Realistic Path', 'Pessimistic Path'];
const cpaLabel = (c, i) => {
  const t = String(c?.path_type || '').toLowerCase();
  if (t === 'optimistic' || t === 'realistic' || t === 'pessimistic') {
    return `${t.charAt(0).toUpperCase()}${t.slice(1)} Path`;
  }
  // fallback by index
  return CPA_LABELS[i] || 'Path';
};

function readDays(c) {
  if (!c || typeof c !== 'object') return null;

  // 1) Explicit numeric fields first (unchanged)
  const numericKeys = [
    'duration_days','days','estimated_days','estimate_days','durationInDays','time_days'
  ];
  for (const k of numericKeys) {
    const v = c?.[k];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    // also allow numeric strings like "30"
    if (typeof v === 'string' && v.trim() && Number.isFinite(+v)) return +v;
  }

  // 2) Structured objects { days }, { value, unit }, { hours }, possibly with text
  const structuredKeys = ['duration','estimatedDuration','estimate','meta','time','timeline'];
  for (const k of structuredKeys) {
    const v = c?.[k];
    if (v && typeof v === 'object') {
      if (typeof v.days === 'number' && Number.isFinite(v.days)) return v.days;
      if (typeof v.days === 'string' && Number.isFinite(+v.days)) return +v.days;

      if (typeof v.value === 'number' && /day/i.test(String(v.unit || ''))) return v.value;
      if (typeof v.value === 'string' && Number.isFinite(+v.value) && /day/i.test(String(v.unit || ''))) return +v.value;

      if (typeof v.hours === 'number' && Number.isFinite(v.hours)) return +(v.hours / 24).toFixed(2);
      if (typeof v.hours === 'string' && Number.isFinite(+v.hours)) return +(+v.hours / 24).toFixed(2);

      // NEW: parse nested text fields for "30 days"
      for (const tKey of ['text','label','name','title','details','desc','description','summary']) {
        const t = v?.[tKey];
        if (typeof t === 'string' && t.trim()) {
          const parsed = parseDaysFromText(t);
          if (Number.isFinite(parsed)) return parsed;
        }
      }
    }
  }

  // 3) NEW: parse top-level string fields for "30 days"
  const textKeys = [
    'duration','estimatedDuration','estimate','time','timeline',
    'duration_text','estimated_text','notes','desc','description','summary','label','title','name'
  ];
  for (const k of textKeys) {
    const t = c?.[k];
    if (typeof t === 'string' && t.trim()) {
      const parsed = parseDaysFromText(t);
      if (Number.isFinite(parsed)) return parsed;
    }
  }

  // 4) NEW: last-resort scan — any string-valued property with explicit "days"/"hours"
  for (const [_, val] of Object.entries(c)) {
    if (typeof val === 'string' && val.trim()) {
      const parsed = parseDaysFromText(val);
      if (Number.isFinite(parsed)) return parsed;
    }
  }

  // Avoid guessing from plain numbers without units (prevents "Floors 20-23" → 21.5)
  return null;
}

function getDays(c) {
  if (!c) return null;

  // direct numeric-style fields
  if (Number.isFinite(c?.estimated_days)) return c.estimated_days;
  if (Number.isFinite(c?.days)) return c.days;

  // numeric strings
  if (typeof c?.estimated_days === 'string' && Number.isFinite(+c.estimated_days)) return +c.estimated_days;
  if (typeof c?.days === 'string' && Number.isFinite(+c.days)) return +c.days;

  // general reader (now handles strings & nested)
  const fromReader = readDays(c);
  if (Number.isFinite(fromReader)) return fromReader;

  // explicit text fallbacks commonly used by some backends
  for (const k of ['duration_text','path_duration','timeline_text']) {
    const t = c?.[k];
    if (typeof t === 'string') {
      const parsed = parseDaysFromText(t);
      if (Number.isFinite(parsed)) return parsed;
    }
  }

  return null;
}


function parseDaysFromText(raw) {
  const s = String(raw).toLowerCase().replace(/[–—]/g, '-').trim();

  // 1) Require explicit unit for ranges (e.g., "30-45 days" or "30 to 45 days")
  const mRange = s.match(
    /(\d+(?:\.\d+)?)\s*(?:-|to)\s*(\d+(?:\.\d+)?)(?:\s*(?:d|day|days)\b)/i
  );
  if (mRange) {
    const a = parseFloat(mRange[1]), b = parseFloat(mRange[2]);
    if (Number.isFinite(a) && Number.isFinite(b)) {
      return Math.round(((a + b) / 2) * 10) / 10;
    }
  }

  // 2) Single value with explicit days (e.g., "30d", "30 days")
  const mDays = s.match(/(\d+(?:\.\d+)?)\s*(?:d|day|days)\b/i);
  if (mDays) return parseFloat(mDays[1]);

  // 3) Hours -> days (explicit hours only)
  const mHours = s.match(/(\d+(?:\.\d+)?)\s*(?:h|hour|hours)\b/i);
  if (mHours) return +(parseFloat(mHours[1]) / 24).toFixed(2);

  // IMPORTANT: No generic number fallback — avoid misreading "Floors 20–23"
  return NaN;
}

// Read days from AI only. If missing, return null (render nothing).
function aiEstimatedDays(c) {
  return Number.isFinite(c?.estimated_days) ? c.estimated_days : null;
}



  // Optional POs
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [totalPO, setTotalPO] = useState(0);

  // Sockets
  const socketRef = useRef(null);
  const joinedRoomRef = useRef(null);
  const projectIdRef = useRef(null);

  // staff list for mentions
  const staffList = useMemo(() => {
    if (!project) return [];
    let staff = [];
    if (project.projectmanager && typeof project.projectmanager === 'object') {
      staff.push({ _id: project.projectmanager._id, name: project.projectmanager.name });
    }
    if (Array.isArray(project.pic)) staff = staff.concat(project.pic.map(p => ({ _id: p._id, name: p.name })));
    if (Array.isArray(project.hrsite)) staff = staff.concat(project.hrsite.map(h => ({ _id: h._id, name: h.name })));
    if (Array.isArray(project.staff)) staff = staff.concat(project.staff.map(s => ({ _id: s._id, name: s.name })));
    const seen = new Set();
    return staff.filter(u => u._id && !seen.has(u._id) && seen.add(u._id));
  }, [project]);
// put inside PicCurrentProject()
const fetchReports = async (pid = project?._id) => {
  if (!pid) return;
  try {
    const { data } = await api.get(`/projects/${pid}/reports`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setReports(data?.reports || []);
    if (process.env.NODE_ENV !== 'production') {
  console.debug('[reports payload]', data?.reports);
}
  } catch {
    setReports([]);
  }
};

// 1) when project changes (initial load/route change)
useEffect(() => {
  if (!reports?.length) return;
  const ai = reports[0]?.ai;
  console.log('[AI] full first report:', reports[0]);
  console.log('[AI] critical_path_analysis:', ai?.critical_path_analysis);
}, [reports]);

// 2) and whenever the Reports tab is entered
useEffect(() => {
  if (activeTab === 'Reports' && project?._id) fetchReports(project._id);
}, [activeTab, project?._id]); // eslint-disable-line

// NEW: Auto-fetch reports as soon as the project loads so progress/metrics show immediately
useEffect(() => {
  if (project?._id) fetchReports(project._id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [project?._id]);

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

  useEffect(() => {
    const pid = project?._id ? String(project._id) : (id ? String(id) : null);
    projectIdRef.current = pid;
  }, [project?._id, id]);

  // Socket init
  useEffect(() => {
    if (socketRef.current) return;
    const sock = io(SOCKET_ORIGIN, {
      path: SOCKET_PATH,
      withCredentials: true,
      transports: ['websocket'],
      auth: { userId },
      reconnection: true,
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
        setProject({ ...data, documents: normalizedDocs });
      } catch {}
    };
    const onReportsUpdated = async () => {
      if (!projectIdRef.current) return;
      try {
        const { data } = await api.get(`/projects/${projectIdRef.current}/reports`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setReports(data?.reports || []);
      } catch {}
    };




    sock.on('connect', onConnect);
    sock.on('project:newDiscussion', onNewDiscussion);
    sock.on('project:newReply', onNewReply);
    sock.on('project:documentsUpdated', onDocsUpdated);
    sock.on('project:reportsUpdated', onReportsUpdated);

    return () => {
      sock.off('connect', onConnect);
      sock.off('project:newDiscussion', onNewDiscussion);
      sock.off('project:newReply', onNewReply);
      sock.off('project:documentsUpdated', onDocsUpdated);
      sock.off('project:reportsUpdated', onReportsUpdated);
      sock.disconnect();
      socketRef.current = null;
      joinedRoomRef.current = null;
    };
  }, [userId, token]);

  // Join/leave room by tab
  useEffect(() => {
    const sock = socketRef.current;
    const pid = project?._id || id;
    const desiredRoom = (activeTab === 'Discussions' || activeTab === 'Reports') && pid ? `project:${pid}` : null;

    if (!sock) return;
    if (joinedRoomRef.current === desiredRoom) return;
    if (joinedRoomRef.current && (!desiredRoom || joinedRoomRef.current !== desiredRoom)) {
      sock.emit('leaveProject', joinedRoomRef.current);
      joinedRoomRef.current = null;
    }
    if (desiredRoom && joinedRoomRef.current !== desiredRoom) {
      sock.emit('joinProject', desiredRoom);
      joinedRoomRef.current = desiredRoom;
    }
  }, [project?._id, id, activeTab]);

  // Fetch project (progress derived later from reports)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (id) {
          const { data } = await api.get(`/projects/${id}`);
          if (cancelled) return;
          const normalizedDocs = Array.isArray(data?.documents)
            ? data.documents.map(d => (typeof d === 'string'
                ? { path: d, uploadedByName: 'Unknown', uploadedAt: parseTimestampFromPath(d) || null }
                : d))
            : [];
          setProject({ ...data, documents: normalizedDocs });
          setStatus(data?.status || '');
        } else {
          if (!userId) throw new Error('Missing user');
          const res = await api.get(`/projects/assigned/allroles/${userId}`);
          if (cancelled) return;
          const ongoing = (res.data || []).find(p => p.status === 'Ongoing') || (res.data || [])[0] || null;
          const normalized = ongoing
            ? {
                ...ongoing,
                documents: Array.isArray(ongoing.documents)
                  ? ongoing.documents.map(d => (typeof d === 'string'
                      ? { path: d, uploadedByName: 'Unknown', uploadedAt: parseTimestampFromPath(d) || null }
                      : d))
                  : []
              }
            : null;
          setProject(normalized);
          setStatus(ongoing?.status || '');
        }
      } catch {
        if (!cancelled) setProject(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, userId]);

  // Derive progress from latest report per uploader (averaged)
  useEffect(() => {
    if (!reports || !reports.length) { setProgress(0); return; }
    // pick latest per uploader
    const latestByUser = {};
    for (const r of reports) {
      const uid = r.uploader?._id || r.uploader || 'unknown';
      if (!latestByUser[uid]) latestByUser[uid] = r;
      else {
        const prev = latestByUser[uid];
        if (new Date(r.createdAt || r.timestamp || 0) > new Date(prev.createdAt || prev.timestamp || 0)) {
          latestByUser[uid] = r;
        }
      }
    }
    const list = Object.values(latestByUser);
    if (!list.length) { setProgress(0); return; }
    const vals = list.map(r => {
      const pct = r?.ai?.pic_contribution_percent;
      if (typeof pct === 'number' && isFinite(pct)) return pct;
      const done = Array.isArray(r?.ai?.completed_tasks) ? r.ai.completed_tasks.length : 0;
      const total = done + (Array.isArray(r?.ai?.pending_tasks) ? r.ai.pending_tasks.length : 0);
      if (total > 0) return (done / total) * 100;
      return 0;
    });
    const avg = vals.reduce((s,v)=>s+v,0)/vals.length;
    const clamped = Math.min(100, Math.max(0, avg));
    setProgress(Number(clamped.toFixed(1)));
  }, [reports]);

  // Discussions initial fetch (oldest → newest)
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
        setMessages(list);
      })
      .catch(() => setMessages([]))
      .finally(() => setLoadingMsgs(false));
    return () => controller.abort();
  }, [project?._id, activeTab, token]);

  // Auto-scroll
  useEffect(() => {
    if (activeTab !== 'Discussions') return;
    requestAnimationFrame(() => {
      if (listBottomRef.current) listBottomRef.current.scrollIntoView();
      else if (listScrollRef.current) listScrollRef.current.scrollTop = listScrollRef.current.scrollHeight;
    });
  }, [messages, activeTab]);

  // Files: signed URLs
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
            } catch {
              return null;
            }
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

  // POs (optional)
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

  /* ---------- Mentions ---------- */
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
      setMentionDropdown({ open: true, options, query, position: { top: rect.top - 150, left: rect.left + 10 } });
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

  /* ---------- Discussions actions ---------- */
  const disabledPost = (!newMessage.trim() && composerFiles.length === 0) || posting || !project?._id;
  const handlePostMessage = async () => {
    if (disabledPost) return;
    try {
      setPosting(true);
      const fd = new FormData();
      if (newMessage.trim()) fd.append('text', newMessage.trim());
      composerFiles.forEach(f => fd.append('attachments', f));
      await api.post(`/projects/${project._id}/discussions`, fd, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNewMessage('');
      setComposerFiles([]);
    } catch {
      alert('Failed to post message.');
    } finally {
      setPosting(false);
    }
  };
  const handleKeyDownComposer = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!disabledPost) handlePostMessage();
    }
  };
  const handlePostReply = async (msgId) => {
    const replyText = (replyInputs[msgId] || '').trim();
    const filesKey = `_replyFiles_${msgId}`;
    const replyFiles = (replyInputs[filesKey] || []);
    const disabledReply = (!replyText && replyFiles.length === 0) || !project?._id;
    if (disabledReply) return;
    try {
      const fd = new FormData();
      if (replyText) fd.append('text', replyText);
      replyFiles.forEach(f => fd.append('attachments', f));
      await api.post(`/projects/${project._id}/discussions/${msgId}/reply`, fd, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setReplyInputs(prev => ({ ...prev, [msgId]: '', [filesKey]: [] }));
    } catch {
      alert('Failed to post reply');
    }
  };

  /* ---------- Files Tab Upload/Delete ---------- */
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

  /* ---------- Reports Tab actions ---------- */
const handleUploadReport = async (file) => {
  if (!project?._id) return;
  setReportUploading(true);
  try {
    const fd = new FormData();
    fd.append('report', file);
    await api.post(`/projects/${project._id}/reports`, fd, {
      headers: { Authorization: `Bearer ${token}` }
    });
    // refresh list
    const { data } = await api.get(`/projects/${project._id}/reports`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setReports(data?.reports || []);
  } catch (e) {
    alert('Failed to upload report.');
  } finally {
    setReportUploading(false);
  }
};

const handleDeleteReport = async (rep) => {
  if (!project?._id || !rep?._id) return;
  const ok = window.confirm(`Delete report "${rep.name || 'Report'}"?`);
  if (!ok) return;
  try {
    const { data } = await api.delete(`/projects/${project._id}/reports/${rep._id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setReports(data?.reports || []);
  } catch (e) {
    alert('Failed to delete report.');
  }
};

const downloadReportPdf = async (path, filename = 'AI-Report.pdf') => {
  try {
    const { data } = await api.get(
      `/projects/${encodeURIComponent('dummy')}/reports-signed-url`,
      { params: { path } }
    );
    const signed = data?.signedUrl;
    if (!signed) throw new Error('No signed url');

    const resp = await fetch(signed);
    if (!resp.ok) throw new Error('Fetch failed');
    const blob = await resp.blob();

    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(a.href);
    a.remove();
  } catch (e) {
    alert('Failed to download AI PDF.');
  }
};


  /* ---------- Drag & Drop helpers ---------- */
  const acceptTypes = ".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.txt,.rtf,.csv,image/*";
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

  /* ---------- misc ---------- */
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.profile-menu-container')) setProfileMenuOpen(false);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  if (loading) return (
    <div className="dashboard-container pm-view-root">
      <div className="professional-loading-screen">
        <div className="loading-content">
          <div className="loading-logo">
            <img
              src={require('../../assets/images/FadzLogo1.png')}
              alt="FadzTrack Logo"
              className="loading-logo-img"
            />
          </div>
          <div className="loading-spinner-container">
            <div className="loading-spinner" />
          </div>
          <div className="loading-text">
            <h2 className="loading-title">Loading Project Details</h2>
            <p className="loading-subtitle">Please wait while we fetch your project information...</p>
          </div>
          <div className="loading-progress">
            <div className="progress-bar"><div className="progress-fill" /></div>
          </div>
        </div>
      </div>
    </div>
  );

  if (!project) return (
    <div className="dashboard-container pm-view-root">
      <div className="professional-loading-screen">
        <div className="loading-content">
          <div className="loading-logo">
            <img
              src={require('../../assets/images/FadzLogo1.png')}
              alt="FadzTrack Logo"
              className="loading-logo-img"
            />
          </div>
          <div className="loading-text">
            <h2 className="loading-title" style={{ color: '#ef4444' }}>No Assigned Project</h2>
            <p className="loading-subtitle">Your account doesn’t have an active project yet. Please wait for an assignment.</p>
          </div>
          <div style={{ marginTop: '2rem' }}>
            <button 
              onClick={() => navigate('/pic')}
              style={{
                background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '8px',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                transition: 'all 0.2s ease'
              }}
              onMouseOver={(e) => {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.4)';
              }}
              onMouseOut={(e) => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
              }}
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Derived labels
  const start = project?.startDate ? new Date(project.startDate).toLocaleDateString() : 'N/A';
  const end   = project?.endDate ? new Date(project.endDate).toLocaleDateString() : 'N/A';
  const locationLabel = project?.location?.name
    ? `${project.location.name}${project.location?.region ? ` (${project.location.region})` : ''}`
    : 'N/A';
  const manpowerText =
    Array.isArray(project?.manpower) && project.manpower.length > 0
      ? project.manpower.map(mp => [mp?.name, mp?.position].filter(Boolean).join(' (') + (mp?.position ? ')' : '')).join(', ')
      : 'No Manpower Assigned';

  return (
    <div className="dashboard-container pm-view-root">
      {/* HEADER (mirrors PM styling) */}
      <header className={`dashboard-header ${isHeaderCollapsed ? 'collapsed' : ''}`}>
        <div className="header-top">
          <div className="logo-section">
            <img src={require('../../assets/images/FadzLogo1.png')} alt="FadzTrack Logo" className="header-logo" />
            <h1 className="header-brand">FadzTrack</h1>
          </div>
          <div className="user-profile" onClick={() => setProfileMenuOpen(!profileMenuOpen)}>
            <div className="profile-avatar">{userName ? userName.charAt(0).toUpperCase() : 'P'}</div>
            <div className="profile-info">
              <span className="profile-name">{userName}</span>
              <span className="profile-role">{userRole}</span>
            </div>
            {profileMenuOpen && (
              <div className="profile-menu">
                <button onClick={handleLogout}>Logout</button>
              </div>
            )}
          </div>
        </div>
        <div className="header-bottom">
          <nav className="header-nav">
            <Link to="/pic" className="nav-item"><FaTachometerAlt /><span className={isHeaderCollapsed ? 'hidden' : ''}>Dashboard</span></Link>
            <Link to="/pic/chat" className="nav-item"><FaComments /><span className={isHeaderCollapsed ? 'hidden' : ''}>Chat</span></Link>
            <Link to="/pic/requests" className="nav-item"><FaClipboardList /><span className={isHeaderCollapsed ? 'hidden' : ''}>Requests</span></Link>
            <Link to={`/pic/viewprojects/${project._id}`} className="nav-item active"><FaProjectDiagram /><span className={isHeaderCollapsed ? 'hidden' : ''}>View Project</span></Link>
          </nav>
          <NotificationBell />
        </div>
      </header>
      {/* MAIN */}
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
              {canUploadOrDelete && (
                <div className="image-upload-overlay">
                  <input
                    type="file"
                    id="pic-project-image-upload"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (!file.type.startsWith('image/')) { alert('Please select an image file.'); e.target.value=''; return; }
                      if (file.size > 5 * 1024 * 1024) { alert('Image must be < 5MB.'); e.target.value=''; return; }
                      try {
                        setImageUploading(true);
                        setImageUploadProgress(0);
                        setImageUploadError('');
                        const formData = new FormData();
                        formData.append('photo', file);
                        const resp = await api.post(`/projects/${project._id}/photo`, formData, {
                          headers: { 'Content-Type': 'multipart/form-data' },
                          onUploadProgress: (pe) => {
                            if (pe.total) {
                              const pct = Math.round((pe.loaded * 100) / pe.total);
                              setImageUploadProgress(pct);
                            }
                          }
                        });
                        if (resp.data?.photoUrl) {
                          setProject(prev => ({ ...prev, photos: [resp.data.photoUrl, ...(prev.photos||[]).slice(1)] }));
                        }
                      } catch (err) {
                        console.error('Image upload failed', err);
                        setImageUploadError('Upload failed. Try again.');
                      } finally {
                        setImageUploading(false);
                        setTimeout(()=>setImageUploadProgress(0), 800);
                        e.target.value='';
                      }
                    }}
                  />
                  <label htmlFor="pic-project-image-upload" className="change-image-btn">
                    <FaCamera />
                    <span>{imageUploading ? 'Uploading...' : 'Change Image'}</span>
                  </label>
                  {imageUploading && (
                    <div className="image-upload-progress">
                      <div className="progress-bar"><div className="progress-fill" style={{ width: `${imageUploadProgress}%` }} /></div>
                      <p className="progress-text">{imageUploadProgress}%</p>
                    </div>
                  )}
                  {imageUploadError && (
                    <div className="image-upload-error"><p>{imageUploadError}</p></div>
                  )}
                </div>
              )}
            </div>
            <div className="project-title-section">
              <h1 className="project-title" style={{ wordBreak: 'break-word' }}>{project.projectName}</h1>
              <div className="project-status-badge">
                <span className={`status-indicator ${status === 'Completed' ? 'completed' : 'ongoing'}`}>{status || project?.status || 'N/A'}</span>
              </div>
            </div>
          </div>
          {/* Metrics (restored) */}
          <div className="pm-overview-grid" style={{ marginTop: 20, marginBottom: 24 }}>
            {/* Progress */}
            <div className="pm-overview-card pm-budget-card" style={{ position:'relative' }}>
              <div className="card-icon"><FaChartBar /></div>
              <div className="card-content">
                <h3 className="card-title">Project Progress</h3>
                <div style={{ display:'flex', alignItems:'baseline', gap:8 }}>
                  <div style={{ fontSize:32, fontWeight:700, background:'linear-gradient(90deg,#3b82f6,#6366f1)', WebkitBackgroundClip:'text', color:'transparent' }}>{Math.round(progress)}%</div>
                  {progress >= 100 && <span style={{ fontSize:12, background:'#16a34a', color:'#fff', padding:'2px 8px', borderRadius:14, letterSpacing:.5 }}>COMPLETED</span>}
                </div>
                <div style={{ marginTop:10 }}>
                  <div style={{ height:10, background:'#e2e8f0', borderRadius:6, overflow:'hidden' }}>
                    <div style={{ width:`${progress}%`, height:'100%', background:'linear-gradient(90deg,#3b82f6,#6366f1,#8b5cf6)', transition:'width .5s' }} />
                  </div>
                  <small style={{ opacity:.7 }}>Average PIC contribution</small>
                </div>
              </div>
            </div>
            {/* Status */}
            <div className="pm-overview-card pm-timeline-card">
              <div className="card-icon"><FaEye /></div>
              <div className="card-content">
                <h3 className="card-title">Status</h3>
                <div style={{ fontSize:28, fontWeight:600 }}>{status || project?.status || 'N/A'}</div>
                <small style={{ opacity:.7 }}>Current project state</small>
              </div>
            </div>
            {/* Manpower Count */}
            <div className="pm-overview-card pm-location-card">
              <div className="card-icon"><FaUsers /></div>
              <div className="card-content">
                <h3 className="card-title">Manpower</h3>
                <div style={{ fontSize:28, fontWeight:600 }}>{Array.isArray(project?.manpower) ? project.manpower.length : 0}</div>
                <small style={{ opacity:.7 }}>Assigned workers</small>
              </div>
            </div>
            {/* Documents */}
            <div className="pm-overview-card pm-contractor-card">
              <div className="card-icon"><FaRegFileAlt /></div>
              <div className="card-content">
                <h3 className="card-title">Documents</h3>
                <div style={{ fontSize:28, fontWeight:600 }}>{Array.isArray(project?.documents) ? project.documents.length : 0}</div>
                <small style={{ opacity:.7 }}>Uploaded files</small>
              </div>
            </div>
          </div>
          {/* Tabs */}
          <div className="project-tabs">
            <button className={`project-tab ${activeTab === 'Details' ? 'active' : ''}`} onClick={() => setActiveTab('Details')}><FaRegListAlt /><span>Details</span></button>
            <button className={`project-tab ${activeTab === 'Discussions' ? 'active' : ''}`} onClick={() => setActiveTab('Discussions')}><FaRegCommentDots /><span>Discussions</span></button>
            <button className={`project-tab ${activeTab === 'Files' ? 'active' : ''}`} onClick={() => setActiveTab('Files')}><FaRegFileAlt /><span>Files</span></button>
            <button className={`project-tab ${activeTab === 'Reports' ? 'active' : ''}`} onClick={() => setActiveTab('Reports')}><FaRegFileAlt /><span>Reports</span></button>
          </div>
          <div className="tab-content">
            {/* Details Tab (adapts original PIC details) */}
            {activeTab === 'Details' && (
              <div className="project-details-content">
                <div className="pm-overview-grid">
                  <div className="pm-overview-card pm-budget-card">
                    <div className="card-icon"><FaChartBar /></div>
                    <div className="card-content">
                      <h3 className="card-title">Overall Progress</h3>
                      <div className="budget-amount">{Math.round(progress)}%</div>
                      <div style={{ marginTop: 8 }}>
                        <div style={{ height: 10, background: '#e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                          <div style={{ width: `${progress}%`, background: 'linear-gradient(90deg,#3b82f6,#6366f1)', height: '100%' }} />
                        </div>
                        <small style={{ opacity: .75 }}>Average PIC contribution</small>
                      </div>
                    </div>
                  </div>
                  <div className="pm-overview-card pm-timeline-card">
                    <div className="card-icon"><FaCalendarAlt /></div>
                    <div className="card-content">
                      <h3 className="card-title">Timeline</h3>
                      <div className="timeline-dates">
                        <div className="date-item"><span className="date-label">Start:</span><span className="date-value">{start}</span></div>
                        <div className="date-item"><span className="date-label">End:</span><span className="date-value">{end}</span></div>
                      </div>
                    </div>
                  </div>
                  <div className="pm-overview-card pm-location-card">
                    <div className="card-icon"><FaEye /></div>
                    <div className="card-content">
                      <h3 className="card-title">Status</h3>
                      <div className="location-value">{status || project?.status || 'N/A'}</div>
                    </div>
                  </div>
                  <div className="pm-overview-card pm-contractor-card">
                    <div className="card-icon"><FaUsers /></div>
                    <div className="card-content">
                      <h3 className="card-title">Manpower Count</h3>
                      <div className="contractor-value">{Array.isArray(project?.manpower) ? project.manpower.length : 0}</div>
                    </div>
                  </div>
                </div>
                <div className="team-section" style={{ marginTop: 32 }}>
                  <h2 className="section-title">Project Team</h2>
                  <div className="team-grid">
                    <div className="team-member"><div className="member-avatar"><FaUsers /></div><div className="member-info"><h4 className="member-role">Project Manager</h4><p className="member-name">{project?.projectmanager?.name || 'N/A'}</p></div></div>
                    <div className="team-member"><div className="member-avatar"><FaUsers /></div><div className="member-info"><h4 className="member-role">PIC</h4><p className="member-name">{Array.isArray(project?.pic) && project.pic.length ? project.pic.map(p=>p?.name).filter(Boolean).join(', ') : 'N/A'}</p></div></div>
                    <div className="team-member"><div className="member-avatar"><FaUsers /></div><div className="member-info"><h4 className="member-role">HR - Site</h4><p className="member-name">{Array.isArray(project?.hrsite) && project.hrsite.length ? project.hrsite.map(h=>h?.name).filter(Boolean).join(', ') : 'N/A'}</p></div></div>
                  </div>
                </div>
                <div className="manpower-section" style={{ marginTop: 32 }}>
                  <h2 className="section-title">Assigned Manpower</h2>
                  <div className="manpower-content"><p className="manpower-text">{manpowerText}</p></div>
                </div>
              </div>
            )}
            {/* Discussions Tab */}
            {activeTab === 'Discussions' && (
              <div className="discussions-container">
                <div className="messages-list" ref={listScrollRef}>
                  {loadingMsgs ? (
                    <div className="loading-messages"><div className="loading-spinner" /><span>Loading discussions...</span></div>
                  ) : messages.length === 0 ? (
                    <div className="empty-discussions"><FaRegCommentDots /><h3>No discussions yet</h3><p>Be the first to start a conversation about this project!</p></div>
                  ) : (
                    messages.map(msg => {
                      const mentionedMe = isMentioned(msg.text, userName);
                      return (
                        <div key={msg._id} className="message-item" style={mentionedMe ? mentionRowStyles.container : {}}>
                          {mentionedMe && <div style={mentionRowStyles.badge}>MENTIONED</div>}
                          <div className="message-header">
                            <div className="message-avatar">{msg.userName?.charAt(0)?.toUpperCase() || '?'}</div>
                            <div className="message-info"><span className="message-author">{msg.userName || 'Unknown'}</span><span className="message-time">{msg.timestamp ? new Date(msg.timestamp).toLocaleString() : ''}</span></div>
                          </div>
                          <div className="message-content">
                            {msg.text && <p className="message-text">{renderMessageText(msg.text, userName)}</p>}
                            {Array.isArray(msg.attachments) && msg.attachments.length > 0 && (
                              <div className="message-attachments">
                                {msg.attachments.map((att,i)=>(
                                  <div key={i} className="attachment-item" style={{ display:'flex',alignItems:'center',gap:8 }}>
                                    <FaRegFileAlt />
                                    <a href="#" onClick={(e)=>{e.preventDefault();openSignedPath(att.path);}}>{att.name || extractOriginalNameFromPath(att.path)}</a>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={listBottomRef} />
                </div>
                <div className="message-composer">
                  <div className={`composer-area ${isDragOver ? 'drag-over' : ''}`} onDragOver={onDragOverComposer} onDragLeave={onDragLeaveComposer} onDrop={onDropComposer}>
                    <textarea ref={textareaRef} value={newMessage} onChange={handleTextareaInput} onKeyDown={handleKeyDownComposer} placeholder="Type your message here..." className="composer-textarea" />
                    {mentionDropdown.open && (
                      <div className="mention-dropdown">
                        {mentionDropdown.options.map(u => <div key={u._id} className="mention-option" onClick={()=>handleMentionSelect(u)}>{u.name}</div>)}
                      </div>
                    )}
                  </div>
                  <div className="composer-actions">
                    <div className="composer-left">
                      <label htmlFor="composer-attachments" className="attachment-button"><FaRegFileAlt /><span>Attach Files</span></label>
                      <input id="composer-attachments" type="file" multiple accept={acceptTypes} style={{ display:'none' }} onChange={(e)=>{addComposerFiles(e.target.files); e.target.value='';}} />
                      {composerFiles.map((f,i)=>(
                        <div key={i} className="file-preview"><span>📎 {f.name}</span><button className="remove-file-btn" onClick={()=>setComposerFiles(prev=>prev.filter((_,idx)=>idx!==i))}>×</button></div>
                      ))}
                    </div>
                    <div className="composer-right">
                      <button onClick={handlePostMessage} disabled={disabledPost} className="send-button">{posting ? 'Sending...' : 'Send Message'}</button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {/* Files Tab */}
            {activeTab === 'Files' && (
              <div className="files-container">
                <div className="files-header">
                  <div className="files-title-section"><h2 className="files-title">Project Files</h2><p className="files-subtitle">Manage project documents</p></div>
                  {canUploadOrDelete && (
                    <div className="files-actions">
                      <label htmlFor="file-upload" className="upload-btn"><FaRegFileAlt /><span>Upload Files</span></label>
                      <input id="file-upload" type="file" multiple accept={acceptTypes} style={{ display:'none' }} disabled={uploading} onChange={(e)=>{const files=Array.from(e.target.files||[]); if(files.length) handlePrepareUpload(files); e.target.value='';}} />
                    </div>
                  )}
                </div>
                {uploadErr && <div style={{ color:'#b00020', marginBottom:12 }}>{uploadErr}</div>}
                {project?.documents && project.documents.length > 0 ? (
                  <div className="files-table-container">
                    <table className="files-table">
                      <thead><tr><th>File</th><th>Uploaded By</th><th>Uploaded At</th><th>Action</th></tr></thead>
                      <tbody>
                        {project.documents.map((docItem,idx)=>{
                          const path = typeof docItem === 'string' ? docItem : docItem?.path;
                          const fileName = extractOriginalNameFromPath(path);
                          const url = docSignedUrls[idx];
                          const uploadedBy = readUploadedBy(typeof docItem === 'object' ? docItem : null);
                          const uploadedAt = readUploadedAt(typeof docItem === 'object' ? docItem : null, path);
                          return (
                            <tr key={idx} className="table-row">
                              <td className="table-cell file-name"><span style={{ display:'inline-flex',alignItems:'center' }}><FaRegFileAlt style={{ marginRight:6 }} />{fileName}</span></td>
                              <td className="table-cell">{uploadedBy || 'Unknown'}</td>
                              <td className="table-cell">{uploadedAt || '—'}</td>
                              <td className="table-cell">
                                {url ? <a href={url} target="_blank" rel="noopener noreferrer" style={{ marginRight:10 }}>View</a> : <span style={{ color:'#94a3b8', marginRight:10 }}>Link…</span>}
                                {canUploadOrDelete && <button onClick={()=>handleDelete(docItem)} className="action-btn delete-btn" title="Delete"><FaTrash /></button>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : <div className="empty-files"><FaRegFileAlt /><h3>No files uploaded yet</h3><p>Upload project documents to get started</p></div>}
              </div>
            )}
            {/* Reports Tab */}
            {activeTab === 'Reports' && (
              <div className="project-reports" style={{ textAlign:'left' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
                  <h3 style={{ marginBottom:18 }}>Project Reports</h3>
                  {canUploadOrDelete && (
                    <div>
                      <label htmlFor="report-uploader" style={{ cursor: reportUploading ? 'not-allowed' : 'pointer', padding:'8px 12px', borderRadius:8, background: reportUploading ? '#f1f5f9' : '#ffffff', border:'1px solid #e2e8f0', fontWeight:600 }}>
                        {reportUploading ? 'Uploading…' : 'Upload Report (.pptx)'}
                      </label>
                      <input id="report-uploader" type="file" accept=".pptx" style={{ display:'none' }} disabled={reportUploading} onChange={(e)=>{const f=e.target.files?.[0]; e.target.value=''; if(!f) return; if(!/\.pptx$/i.test(f.name)){alert('Please upload a .pptx file.'); return;} handleUploadReport(f);}} />
                    </div>
                  )}
                </div>
                {reports.length === 0 ? <div style={{ color:'#64748b', fontSize:16 }}>No reports yet.</div> : (
                  <div style={{ overflowX:'auto' }}>
                    <table className="files-table" style={{ width:'100%' }}>
                      <thead><tr><th>Name</th><th>Uploaded By</th><th>Uploaded At</th><th>Status</th><th>Action</th></tr></thead>
                      <tbody>
                        {reports.map(rep=>{
                          const uploadedAt = rep?.uploadedAt ? new Date(rep.uploadedAt).toLocaleString() : '—';
                          return (
                            <tr key={rep._id}>
                              <td><span style={{ display:'inline-flex',alignItems:'center' }}><FaRegFileAlt style={{ marginRight:6 }} />{rep?.name || 'Report.pptx'}</span></td>
                              <td>{rep?.uploadedByName || 'Unknown'}</td>
                              <td>{uploadedAt}</td>
                              <td style={{ textTransform:'capitalize' }}>{rep?.status || 'pending'}</td>
                              <td>
                                {rep?.path ? <button onClick={()=>openReportSignedPath(rep.path)} className="action-btn download-btn" style={{ marginRight:10 }}>View PPT</button> : <span style={{ color:'#94a3b8', marginRight:10 }}>No PPT</span>}
                                {rep?.pdfPath ? <button onClick={()=>downloadReportPdf(rep.pdfPath, rep.name?.replace(/\.pptx$/i,'_AI.pdf')||'AI-Report.pdf')} className="action-btn download-btn" style={{ marginRight:10 }}>AI PDF</button> : <span style={{ color:'#94a3b8', marginRight:10 }}>No PDF</span>}
                                {canUploadOrDelete && <button onClick={()=>handleDeleteReport(rep)} className="action-btn delete-btn"><FaTrash /></button>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {reports[0]?.ai && (
                      <div style={{ marginTop:16, padding:16, border:'1px solid #e2e8f0', borderRadius:12 }}>
                        <h4 style={{ marginTop:0 }}>Latest AI Summary</h4>
                        <div style={{ display:'grid', gap:16, gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))' }}>
                          <div><b>Summary of Work Done</b><ul style={{ marginTop:6 }}>{(reports[0].ai.summary_of_work_done||[]).map((x,i)=><li key={i}>{x}</li>)}</ul></div>
                          <div><b>Completed Tasks</b><ul style={{ marginTop:6 }}>{(reports[0].ai.completed_tasks||[]).map((x,i)=><li key={i}>{x}</li>)}</ul></div>
                          <div><b>Critical Path (3)</b><div style={{ marginTop:6 }}>{(reports[0].ai.critical_path_analysis||[]).slice(0,3).map((c,i)=>{const days=aiEstimatedDays(c);return (<div key={i} style={{ marginBottom:8 }}><b>{`${i+1}. ${cpaLabel(c,i)}`}</b>{Number.isFinite(days)&&<span>{` — ${days} days`}</span>}<ul style={{ marginTop:4, marginBottom:4 }}>{Number.isFinite(days)&&<li><b>Duration:</b> {days} days</li>}{c?.risk&&<li><b>Risk:</b> {c.risk}</li>}{c?.blockers?.length>0&&<li><b>Blockers:</b> {c.blockers.join('; ')}</li>}{c?.next?.length>0&&<li><b>Next:</b> {c.next.join('; ')}</li>}</ul></div>);})}</div></div>
                          <div><b>PiC Performance</b><p style={{ marginTop:6 }}>{reports[0].ai.pic_performance_evaluation?.text || 'Performance summary unavailable.'}</p>{typeof reports[0].ai.pic_performance_evaluation?.score==='number'&&<p>Score: {reports[0].ai.pic_performance_evaluation.score}/100</p>}<p>PiC Contribution: {Math.round(Number(reports[0].ai.pic_contribution_percent)||0)}%</p>{typeof reports[0].ai.confidence==='number'&&<p>Model Confidence: {(reports[0].ai.confidence*100).toFixed(0)}%</p>}</div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
      {/* Duplicate File Modal */}
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
    </div>
  );
};

export default PicCurrentProject;
