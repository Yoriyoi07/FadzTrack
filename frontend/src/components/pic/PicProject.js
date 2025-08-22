import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../../api/axiosInstance';
import NotificationBell from '../NotificationBell';
import { FaRegCommentDots, FaRegFileAlt, FaRegListAlt, FaTrash } from 'react-icons/fa';
import { io } from 'socket.io-client';
import "../style/pic_style/Pic_Project.css";
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

  // Fetch project (+progress)
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

        if (id) {
          try {
            const pr = await api.get(`/daily-reports/project/${id}/progress`);
            const completed = pr?.data?.progress?.find(p => p.name === 'Completed');
            setProgress(completed ? completed.value : 0);
          } catch {}
        }
      } catch {
        if (!cancelled) setProject(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, userId]);

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

  /* ---------- Reports Tab actions ---------- */
{activeTab === 'Reports' && (
  <div className="project-reports" style={{ textAlign: 'left' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
      <h3 style={{ marginBottom: 18 }}>Project Reports</h3>

      {canUploadOrDelete && (
        <div>
          <label
            htmlFor="report-uploader"
            style={{
              cursor: reportUploading ? 'not-allowed' : 'pointer',
              padding: '8px 12px',
              borderRadius: 6,
              border: '1px solid #ddd',
              background: reportUploading ? '#f3f3f3' : '#fff',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              fontSize: 14,
              userSelect: 'none',
            }}
            title={reportUploading ? 'Uploading…' : 'Upload .pptx report'}
          >
            {reportUploading ? 'Uploading…' : 'Upload Report (.pptx)'}
          </label>
          <input
            id="report-uploader"
            type="file"
            accept=".pptx"
            style={{ display: 'none' }}
            disabled={reportUploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              if (!/\.pptx$/i.test(f.name)) {
                alert('Please upload a .pptx file.');
                return;
              }
              handleUploadReport(f);
            }}
          />
        </div>
      )}
    </div>

    {reports.length === 0 ? (
      <div style={{ color: '#888', fontSize: 16 }}>No reports yet.</div>
    ) : (
      <div style={{ overflowX: 'auto' }}>
        <table className="files-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid #eee', background: '#fafafa', fontWeight: 600 }}>Name</th>
              <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid #eee', background: '#fafafa', fontWeight: 600 }}>Uploaded By</th>
              <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid #eee', background: '#fafafa', fontWeight: 600 }}>Uploaded At</th>
              <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid #eee', background: '#fafafa', fontWeight: 600 }}>Status</th>
              <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid #eee', background: '#fafafa', fontWeight: 600, width: 420 }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((rep) => {
              const uploadedAt = rep?.uploadedAt ? new Date(rep.uploadedAt).toLocaleString() : '—';
              const isOpen = openReportIds.has(String(rep._id));
              return (
                <React.Fragment key={rep._id}>
                  <tr>
                    <td style={{ padding: '10px 12px', borderTop: '1px solid #f1f1f1' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                        <FaRegFileAlt style={{ marginRight: 6 }} />
                        {rep?.name || 'Report.pptx'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', borderTop: '1px solid #f1f1f1' }}>{rep?.uploadedByName || 'Unknown'}</td>
                    <td style={{ padding: '10px 12px', borderTop: '1px solid #f1f1f1' }}>{uploadedAt}</td>
                    <td style={{ padding: '10px 12px', borderTop: '1px solid #f1f1f1', textTransform: 'capitalize' }}>
                      {rep?.status || 'pending'}
                    </td>
                    <td style={{ padding: '10px 12px', borderTop: '1px solid #f1f1f1' }}>
                      <button
                        onClick={() => toggleReportOpen(rep._id)}
                        style={{ marginRight: 10, border: '1px solid #ddd', background: '#fff', padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}
                      >
                        {isOpen ? 'Hide Details' : 'Show Details'}
                      </button>

                      {rep?.path ? (
                        <button
                          onClick={() => openReportSignedPath(rep.path)}
                          style={{ marginRight: 10, border: '1px solid #ddd', background: '#fff', padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}
                        >
                          View PPT
                        </button>
                      ) : <span style={{ color: '#aaa', marginRight: 10 }}>No PPT</span>}

{rep?.pdfPath ? (
  <button
    onClick={() =>
      downloadReportPdf(
        rep.pdfPath,
        extractOriginalNameFromPath(rep.pdfPath) || 'AI-Report.pdf'
      )
    }
    style={{ marginRight: 10, border: '1px solid #ddd', background: '#fff',
             padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}
  >
    Download AI PDF
  </button>
) : (
  <span style={{ color: '#aaa', marginRight: 10 }}>No PDF</span>
)}


                      {rep?.pdfPath ? (
                        <button
                          onClick={() => openReportSignedPath(rep.pdfPath)}
                          style={{ marginRight: 10, border: '1px solid #ddd', background: '#fff', padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}
                        >
                          View AI PDF
                        </button>
                      ) : <span style={{ color: '#aaa', marginRight: 10 }}>No PDF</span>}

                      {canUploadOrDelete && (
                        <button
                          onClick={() => handleDeleteReport(rep)}
                          style={{ border: '1px solid #e5e5e5', background: '#fff', padding: '6px 10px', borderRadius: 6, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                          title="Delete report"
                        >
                          <FaTrash /> Delete
                        </button>
                      )}
                    </td>
                  </tr>

                  {/* Collapsible AI analysis per report */}
                  {isOpen && (
                    <tr>
                      <td colSpan={5} style={{ padding: 0, borderTop: 'none' }}>
                        <div style={{ margin: '8px 12px 16px', padding: 12, border: '1px solid #eee', borderRadius: 10 }}>
                          <h4 style={{ marginTop: 0 }}>AI Analysis</h4>
                          {!rep.ai ? (
                            <div style={{ color: '#777' }}>No AI data yet.</div>
                          ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                              <div>
                                <b>Summary of Work Done</b>
                                <ul style={{ marginTop: 6 }}>
                                  {(rep.ai.summary_of_work_done || []).map((x, i) => <li key={i}>{x}</li>)}
                                </ul>
                              </div>
                              <div>
                                <b>Completed Tasks</b>
                                <ul style={{ marginTop: 6 }}>
                                  {(rep.ai.completed_tasks || []).map((x, i) => <li key={i}>{x}</li>)}
                                </ul>
                              </div>
                              <div>
                                <b>Critical Path (3)</b>
                               <ol style={{ marginTop: 6 }}>
  {(rep.ai.critical_path_analysis || []).slice(0, 3).map((c, i) => {
  const days = aiEstimatedDays(c);   // << strictly from AI

  if (process.env.NODE_ENV !== 'production') {
    console.debug('[CPA row]', { reportId: rep._id, index: i, path_type: c?.path_type, days, item: c });
  }

  return (
    <li key={i} style={{ marginBottom: 6 }}>
      <div>
        <b>{`${i + 1}. ${cpaLabel(c, i)}`}</b>
        {Number.isFinite(days) ? ` — ${days} days` : ''}   {/* show only if AI provided */}
      </div>

      {Array.isArray(c?.blockers) && c.blockers.length > 0 && (
        <div><i>Blockers:</i> {c.blockers.join('; ')}</div>
      )}
      {c?.risk && <div><i>Risk:</i> {c.risk}</div>}
      {Array.isArray(c?.next) && c.next.length > 0 && (
        <div><i>Next:</i> {c.next.join('; ')}</div>
      )}
    </li>
  );
})}

</ol>
{(rep.ai.critical_path_analysis || []).slice(0,3).map((c, i) => {
  const days = readDays(c);
  if (days === null) console.log('No days parsed for item', i, c);
})}

                              </div>
                              <div>
                                <b>PiC Performance</b>
                                <p style={{ marginTop: 6 }}>{rep.ai.pic_performance_evaluation?.text || '—'}</p>
                                {typeof rep.ai.pic_performance_evaluation?.score === 'number' && (
                                  <p>Score: {rep.ai.pic_performance_evaluation.score}/100</p>
                                )}
                                <p>PiC Contribution: {Math.round(Number(rep.ai.pic_contribution_percent) || 0)}%</p>
                                {typeof rep.ai.confidence === 'number' && (
                                  <p>Model Confidence: {(rep.ai.confidence * 100).toFixed(0)}%</p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    )}
  </div>
)}


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
    <div className="loading-container">
      <p>Loading project details...</p>
    </div>
  );

  if (!project) {
    return (
      <div className="dashboard-container">
        {/* Modern Header */}
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
              <Link to="/pic" className="nav-item">
                <FaTachometerAlt />
                <span className={isHeaderCollapsed ? 'hidden' : ''}>Dashboard</span>
              </Link>
              <Link to="/pic/chat" className="nav-item">
                <FaComments />
                <span className={isHeaderCollapsed ? 'hidden' : ''}>Chat</span>
              </Link>
              <Link to="/pic/request/:id" className="nav-item">
                <FaBoxes />
                <span className={isHeaderCollapsed ? 'hidden' : ''}>Material</span>
              </Link>
              <Link to="/pic/manpower-list" className="nav-item">
                <FaUsers />
                <span className={isHeaderCollapsed ? 'hidden' : ''}>Manpower</span>
              </Link>
              <Link to="/pic/daily-logs" className="nav-item">
                <FaClipboardList />
                <span className={isHeaderCollapsed ? 'hidden' : ''}>Logs</span>
              </Link>
              <Link to="/pic/daily-logs-list" className="nav-item">
                <FaCalendarAlt />
                <span className={isHeaderCollapsed ? 'hidden' : ''}>Daily Logs</span>
              </Link>
            </nav>
            
            <NotificationBell />
          </div>
        </header>

        <div className="dashboard-layout">
          <div className="sidebar">
            <div className="chats-section">
              <h3 className="chats-title">Chats</h3>
              <div className="chats-list">
                {chats.map(chat => (
                  <div key={chat.id} className="chat-item">
                    <div className="chat-avatar" style={{ backgroundColor: chat.color }}>
                      {chat.initial}
                    </div>
                    <div className="chat-info">
                      <div className="chat-name">{chat.name}</div>
                      <div className="chat-message">{chat.message}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <main className="main1">
            <div className="no-project-message">
              <h2>No assigned project</h2>
              <p>Your PIC account doesn’t have an active project yet.</p>
              <p>Please wait for an assignment or contact your manager.</p>
            </div>
          </main>
        </div>
      </div>
    );
  }

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
    <div className="dashboard-container">
      {/* Modern Header */}
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
            <Link to="/pic" className="nav-item">
              <FaTachometerAlt />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Dashboard</span>
            </Link>
            <Link to="/pic/chat" className="nav-item">
              <FaComments />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Chat</span>
            </Link>
            <Link to="/pic/request/:id" className="nav-item">
              <FaBoxes />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Material</span>
            </Link>
            <Link to="/pic/manpower-list" className="nav-item">
              <FaUsers />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Manpower</span>
            </Link>
            {project && (
              <Link to={`/pic/viewprojects/${project._id || project.id}`} className="nav-item">
                <FaEye />
                <span className={isHeaderCollapsed ? 'hidden' : ''}>View Project</span>
              </Link>
            )}
            <Link to="/pic/daily-logs" className="nav-item">
              <FaClipboardList />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Logs</span>
            </Link>
            {project && (
              <Link to={`/pic/progress-report/${project._id}`} className="nav-item">
                <FaChartBar />
                <span className={isHeaderCollapsed ? 'hidden' : ''}>Reports</span>
              </Link>
            )}
            <Link to="/pic/daily-logs-list" className="nav-item">
              <FaCalendarAlt />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Daily Logs</span>
            </Link>
          </nav>
          
          <NotificationBell />
        </div>
      </header>

      {/* LAYOUT */}
      <div className="dashboard-layout">
        {/* Sidebar (Chats) */}
        <div className="sidebar">
          <div className="chats-section">
            <h3 className="chats-title">Chats</h3>
            <div className="chats-list">
              {chats.map(chat => (
                <div key={chat.id} className="chat-item">
                  <div className="chat-avatar" style={{ backgroundColor: chat.color }}>
                    {chat.initial}
                  </div>
                  <div className="chat-info">
                    <div className="chat-name">{chat.name}</div>
                    <div className="chat-message">{chat.message}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* MAIN CONTENT */}
        <main className="main1">
          {/* Project Metrics */}
          <div className="project-metrics">
            <div className="metric-card">
              <div className="metric-header">
                <span className="metric-title">Project Progress</span>
                <div className="metric-icon" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                  <FaChartBar />
                </div>
              </div>
              <div className="metric-value">{progress}%</div>
              <div className="metric-description">Overall project completion</div>
              <div className="progress-container">
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${progress}%` }}></div>
                </div>
                <div className="progress-text">{progress}% Complete</div>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <span className="metric-title">Project Status</span>
                <div className="metric-icon" style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' }}>
                  <FaEye />
                </div>
              </div>
              <div className="metric-value">{status || 'Active'}</div>
              <div className="metric-description">Current project status</div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <span className="metric-title">Team Members</span>
                <div className="metric-icon" style={{ background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)' }}>
                  <FaUsers />
                </div>
              </div>
              <div className="metric-value">
                {Array.isArray(project?.manpower) ? project.manpower.length : 0}
              </div>
              <div className="metric-description">Assigned manpower</div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <span className="metric-title">Documents</span>
                <div className="metric-icon" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
                  <FaRegFileAlt />
                </div>
              </div>
              <div className="metric-value">
                {Array.isArray(project?.documents) ? project.documents.length : 0}
              </div>
              <div className="metric-description">Project documents</div>
            </div>
          </div>

          <div className="project-detail-container">
            <div className="project-image-container">
              <img
                src={(project.photos && project.photos[0]) || 'https://placehold.co/800x300?text=No+Photo'}
                alt={project.projectName}
                className="responsive-photo"
              />
            </div>

            <h1 className="project-title">{project.projectName}</h1>

            {/* Tabs */}
            <div className="tabs-row">
              <button className={`tab-btn${activeTab === 'Discussions' ? ' active' : ''}`} onClick={() => setActiveTab('Discussions')} type="button">
                <FaRegCommentDots /> Discussions
              </button>
              <button className={`tab-btn${activeTab === 'Details' ? ' active' : ''}`} onClick={() => setActiveTab('Details')} type="button">
                <FaRegListAlt /> Details
              </button>
              <button className={`tab-btn${activeTab === 'Files' ? ' active' : ''}`} onClick={() => setActiveTab('Files')} type="button">
                <FaRegFileAlt /> Files
              </button>
              <button className={`tab-btn${activeTab === 'Reports' ? ' active' : ''}`} onClick={() => setActiveTab('Reports')} type="button">
                <FaRegFileAlt /> Reports
              </button>
            </div>

            {/* --- Discussions --- */}
            {activeTab === 'Discussions' && (
              <div className="discussions-card" style={{ display: 'flex', flexDirection: 'column', height: 540 }}>
                <div ref={listScrollRef} style={{ flex: 1, overflowY: 'auto', paddingRight: 4 }}>
                  {/* ... (unchanged discussions UI) ... */}
                  {/* Kept exactly as your original for brevity */}
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

                              {/* Replies, input, etc — unchanged */}
                            </div>
                          );
                        })
                      )}
                      <div ref={listBottomRef} />
                    </>
                  )}
                </div>

                {/* Composer with drag & drop (unchanged) */}
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
                      onKeyDown={handleKeyDownComposer}
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

                  {/* Attachment picker row */}
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
                      <p className="detail-value">{readContractor(project)}</p>
                    </div>
                    <div className="detail-group">
                      <p className="detail-label">Target Date:</p>
                      <p className="detail-value">{start} — {end}</p>
                    </div>
                  </div>

                  <div className="details-column">
                    <div className="detail-group">
                      <p className="detail-label">PIC:</p>
                      <p className="detail-value">
                        {Array.isArray(project?.pic) && project.pic.length > 0
                          ? project.pic.map(p => p?.name).filter(Boolean).join(', ')
                          : 'N/A'}
                      </p>
                    </div>
                    <div className="detail-group">
                      <p className="detail-label">HR - Site:</p>
                      <p className="detail-value">
                        {Array.isArray(project?.hrsite) && project.hrsite.length > 0
                          ? project.hrsite.map(h => h?.name).filter(Boolean).join(', ')
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
                  <p className="manpower-list">
                    {manpowerText}
                  </p>
                </div>

                <p><b>Status:</b> {status || project?.status || 'N/A'}</p>
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
                          <th style={{ textAlign: 'left', padding: '10px 12px',borderBottom: '1px solid #eee', background: '#fafafa', fontWeight: 600 }}>
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
                  <div style={{ color: '#888', fontSize: 20 }}>No documents uploaded for this project.</div>
                )}
              </div>
            )}

            {/* --- Reports --- */}
            {activeTab === 'Reports' && (
              <div className="project-reports" style={{ textAlign: 'left' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <h3 style={{ marginBottom: 18 }}>Project Reports</h3>

                  {canUploadOrDelete && (
                    <div>
                      <label
                        htmlFor="report-uploader"
                        style={{
                          cursor: reportUploading ? 'not-allowed' : 'pointer',
                          padding: '8px 12px',
                          borderRadius: 6,
                          border: '1px solid #ddd',
                          background: reportUploading ? '#f3f3f3' : '#fff',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                          fontSize: 14,
                          userSelect: 'none',
                        }}
                        title={reportUploading ? 'Uploading…' : 'Upload .pptx report'}
                      >
                        {reportUploading ? 'Uploading…' : 'Upload Report (.pptx)'}
                      </label>
                      <input
                        id="report-uploader"
                        type="file"
                        accept=".pptx"
                        style={{ display: 'none' }}
                        disabled={reportUploading}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          e.target.value = '';
                          if (!f) return;
                          if (!/\.pptx$/i.test(f.name)) {
                            alert('Please upload a .pptx file.');
                            return;
                          }
                          handleUploadReport(f);
                        }}
                      />
                    </div>
                  )}
                </div>

                {reports.length === 0 ? (
                  <div style={{ color: '#888', fontSize: 16 }}>No reports yet.</div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="files-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid #eee', background: '#fafafa', fontWeight: 600 }}>Name</th>
                          <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid #eee', background: '#fafafa', fontWeight: 600 }}>Uploaded By</th>
                          <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid #eee', background: '#fafafa', fontWeight: 600 }}>Uploaded At</th>
                          <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid #eee', background: '#fafafa', fontWeight: 600 }}>Status</th>
                          <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid #eee', background: '#fafafa', fontWeight: 600, width: 280 }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reports.map((rep) => {
                          const uploadedAt = rep?.uploadedAt ? new Date(rep.uploadedAt).toLocaleString() : '—';
                          return (
                            <tr key={rep._id}>
                              <td style={{ padding: '10px 12px', borderTop: '1px solid #f1f1f1' }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                                  <FaRegFileAlt style={{ marginRight: 6 }} />
                                  {rep?.name || 'Report.pptx'}
                                </span>
                              </td>
                              <td style={{ padding: '10px 12px', borderTop: '1px solid #f1f1f1' }}>{rep?.uploadedByName || 'Unknown'}</td>
                              <td style={{ padding: '10px 12px', borderTop: '1px solid #f1f1f1' }}>{uploadedAt}</td>
                              <td style={{ padding: '10px 12px', borderTop: '1px solid #f1f1f1', textTransform: 'capitalize' }}>
                                {rep?.status || 'pending'}
                              </td>
                              <td style={{ padding: '10px 12px', borderTop: '1px solid #f1f1f1' }}>
                                {/* View PPT */}
                                {rep?.path ? (
                                  <button
                                    onClick={() => openReportSignedPath(rep.path)}
                                    style={{ marginRight: 10, border: '1px solid #ddd', background: '#fff', padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}
                                  >
                                    View PPT
                                  </button>
                                ) : (
                                  <span style={{ color: '#aaa', marginRight: 10 }}>No PPT</span>
                                )}

                            {rep?.pdfPath ? (
  <button
    onClick={() =>
      downloadReportPdf(
        rep.pdfPath,
        rep.name?.replace(/\.pptx$/i, '_AI.pdf') || 'AI-Report.pdf'
      )
    }
    style={{ marginRight: 10, border: '1px solid #ddd', background: '#fff',
             padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}
  >
    Download AI PDF
  </button>
) : (
  <span style={{ color: '#aaa', marginRight: 10 }}>No PDF</span>
)}


                                {/* Delete */}
                                {canUploadOrDelete && (
                                  <button
                                    onClick={() => handleDeleteReport(rep)}
                                    style={{ border: '1px solid #e5e5e5', background: '#fff', padding: '6px 10px', borderRadius: 6, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                                    title="Delete report"
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

                    {/* Optional: quick readout of AI for newest report */}
    {/* Latest AI Summary (richer view) */}
{reports[0]?.ai && (
  <div style={{ marginTop: 16, padding: 16, border: '1px solid #eee', borderRadius: 10 }}>
    <h4 style={{ marginTop: 0 }}>Latest AI Summary</h4>

    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 16
      }}
    >
      <div style={{ minWidth: 0 }}>
        <b>Summary of Work Done</b>
        <ul style={{ marginTop: 6 }}>
          {(reports[0].ai.summary_of_work_done || []).map((x, i) => <li key={i}>{x}</li>)}
        </ul>
      </div>

      <div style={{ minWidth: 0 }}>
        <b>Completed Tasks</b>
        <ul style={{ marginTop: 6 }}>
          {(reports[0].ai.completed_tasks || []).map((x, i) => <li key={i}>{x}</li>)}
        </ul>
      </div>
<div style={{ minWidth: 0 }}>
  <b>Critical Path (3)</b>
  <div style={{ marginTop: 6 }}>
  {(reports[0].ai.critical_path_analysis || []).slice(0,3).map((c, i) => {
  const days = aiEstimatedDays(c);   // << strictly from AI

  if (process.env.NODE_ENV !== 'production') {
    console.debug('[CPA latest]', { index: i, path_type: c?.path_type, days, item: c });
  }

  return (
    <div key={i} style={{ marginBottom: 8 }}>
      <b>{`${i + 1}. ${cpaLabel(c, i)}`}</b>
      {Number.isFinite(days) && <span>{` — ${days} days`}</span>}

      <ul style={{ marginTop: 4, marginBottom: 4 }}>
        {Number.isFinite(days) && <li><b>Duration:</b> {days} days</li>}
        {c?.risk && <li><b>Risk:</b> {c.risk}</li>}
        {c?.blockers?.length > 0 && <li><b>Blockers:</b> {c.blockers.join('; ')}</li>}
        {c?.next?.length > 0 && <li><b>Next:</b> {c.next.join('; ')}</li>}
      </ul>
    </div>
  );
})}



  </div>
</div>



      <div style={{ minWidth: 0 }}>
        <b>PiC Performance</b>
        <p style={{ marginTop: 6 }}>
          {reports[0].ai.pic_performance_evaluation?.text ||
            'Progress is steady across scopes with some pending areas; schedule attention noted.'}
        </p>
        {typeof reports[0].ai.pic_performance_evaluation?.score === 'number' && (
          <p>Score: {reports[0].ai.pic_performance_evaluation.score}/100</p>
        )}
        <p>PiC Contribution: {Math.round(Number(reports[0].ai.pic_contribution_percent) || 0)}%</p>
        {typeof reports[0].ai.confidence === 'number' && (
          <p>Model Confidence: {(reports[0].ai.confidence * 100).toFixed(0)}%</p>
        )}
      </div>
    </div>
  </div>
)}

                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* ===== Duplicate Modal (Files) ===== */}
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
