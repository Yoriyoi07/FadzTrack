import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import api from '../../api/axiosInstance';
import NotificationBell from '../NotificationBell';
import { FaRegCommentDots, FaRegFileAlt, FaRegListAlt, FaDownload, FaCalendarAlt, FaMapMarkerAlt, FaUsers, FaUserTie, FaBuilding, FaMoneyBillWave, FaCheckCircle, FaClock, FaTrash, FaCamera } from 'react-icons/fa';
import { exportProjectDetails } from '../../utils/projectPdf';
// Nav icons
import { FaTachometerAlt, FaComments, FaBoxes, FaUsers as FaUsersNav, FaProjectDiagram, FaClipboardList, FaChartBar, FaCalendarAlt as FaCalendarAltNav } from 'react-icons/fa';
import "../style/pm_style/Pm_Dash.css";
import "../style/pm_style/Pm_ViewProjects.css";
import "../style/pm_style/Pm_ViewProjects_Wide.css"; // wide layout overrides

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

/* ---------- Filename helper ---------- */
function extractOriginalNameFromPath(path) {
  const base = (path || '').split('/').pop() || '';
  const underscore = base.indexOf('_');
  if (underscore !== -1 && underscore < base.length - 1) return base.slice(underscore + 1);
  const m = base.match(/^project-\d{8,}-(.+)$/i);
  if (m && m[1]) return m[1];
  return base;
}

/* ---------- File management helpers ---------- */
function getFileType(fileName) {
  const extension = fileName.split('.').pop()?.toLowerCase();
  const typeMap = {
    'pdf': 'PDF',
    'doc': 'DOC',
    'docx': 'DOCX',
    'xls': 'XLS',
    'xlsx': 'XLSX',
    'ppt': 'PPT',
    'pptx': 'PPTX',
    'txt': 'TXT',
    'rtf': 'RTF',
    'csv': 'CSV',
    'jpg': 'JPG',
    'jpeg': 'JPEG',
    'png': 'PNG',
    'gif': 'GIF',
    'bmp': 'BMP',
    'svg': 'SVG'
  };
  return typeMap[extension] || 'FILE';
}

function getFileSize(fileName) {
  // Since we don't have actual file sizes from the backend, we'll show a placeholder
  // In a real implementation, you'd want to store file sizes in the database
  return 'N/A';
}

function getFileIcon(fileType) {
  const iconMap = {
    'PDF': '📄',
    'DOC': '📝',
    'DOCX': '📝',
    'XLS': '📊',
    'XLSX': '📊',
    'PPT': '📈',
    'PPTX': '📈',
    'TXT': '📄',
    'RTF': '📄',
    'CSV': '📊',
    'JPG': '🖼️',
    'JPEG': '🖼️',
    'PNG': '🖼️',
    'GIF': '🖼️',
    'BMP': '🖼️',
    'SVG': '🖼️',
    'FILE': '📁'
  };
  return iconMap[fileType] || '��';
}

/* ---------- Fetch signed URLs for image files ---------- */
async function fetchSignedUrlsForImages(files) {
  const imageFiles = files.filter(file => {
    const fileName = typeof file === 'string' 
      ? extractOriginalNameFromPath(file) 
      : file.name || extractOriginalNameFromPath(file.path);
    const fileType = getFileType(fileName);
    return ['JPG', 'JPEG', 'PNG', 'GIF', 'BMP', 'SVG'].includes(fileType);
  });

  const signedUrls = {};
  
  for (const file of imageFiles) {
    const filePath = typeof file === 'string' ? file : file.path;
    try {
      const { data } = await api.get(`/photo-signed-url?path=${encodeURIComponent(filePath)}`);
      if (data?.signedUrl) {
        signedUrls[filePath] = data.signedUrl;
      }
    } catch (error) {
      console.warn('Failed to fetch signed URL for:', filePath, error);
    }
  }
  
  return signedUrls;
}

/* ---------- File thumbnail generation ---------- */
function generateFileThumbnail(fileName, filePath, fileType, signedUrl = null) {
  const isImage = ['JPG', 'JPEG', 'PNG', 'GIF', 'BMP', 'SVG'].includes(fileType);
  
  if (isImage) {
    // Use signed URL if available, otherwise fall back to file path
    const imageSrc = signedUrl || filePath;
    return (
      <div className="file-thumbnail image-thumbnail">
        <img 
          src={imageSrc} 
          alt={fileName}
          onError={(e) => {
            e.target.style.display = 'none';
            e.target.nextSibling.style.display = 'flex';
          }}
        />
        <div className="fallback-icon" style={{ display: 'none' }}>
          {getFileIcon(fileType)}
        </div>
      </div>
    );
  }
  
  // For non-image files, create styled thumbnails based on file type
  const thumbnailStyles = {
    'PDF': { background: 'linear-gradient(135deg, #ff6b6b, #ee5a52)', icon: '📄' },
    'DOC': { background: 'linear-gradient(135deg, #4ecdc4, #44a08d)', icon: '📝' },
    'DOCX': { background: 'linear-gradient(135deg, #4ecdc4, #44a08d)', icon: '📝' },
    'XLS': { background: 'linear-gradient(135deg, #45b7d1, #96c93d)', icon: '📊' },
    'XLSX': { background: 'linear-gradient(135deg, #45b7d1, #96c93d)', icon: '📊' },
    'PPT': { background: 'linear-gradient(135deg, #f093fb, #f5576c)', icon: '📈' },
    'PPTX': { background: 'linear-gradient(135deg, #f093fb, #f5576c)', icon: '📈' },
    'TXT': { background: 'linear-gradient(135deg, #a8edea, #fed6e3)', icon: '📄' },
    'RTF': { background: 'linear-gradient(135deg, #a8edea, #fed6e3)', icon: '📄' },
    'CSV': { background: 'linear-gradient(135deg, #ffecd2, #fcb69f)', icon: '📊' },
    'FILE': { background: 'linear-gradient(135deg, #667eea, #764ba2)', icon: '📁' }
  };
  
  const style = thumbnailStyles[fileType] || thumbnailStyles['FILE'];
  
  return (
    <div 
      className="file-thumbnail document-thumbnail"
      style={{ background: style.background }}
    >
      <span className="thumbnail-icon">{style.icon}</span>
      <span className="thumbnail-extension">{fileType}</span>
    </div>
  );
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
  const [picContributions, setPicContributions] = useState(null);

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

  // File management state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState('');

  // Project image upload state
  const [imageUploading, setImageUploading] = useState(false);
  const [imageUploadProgress, setImageUploadProgress] = useState(0);
  const [imageUploadError, setImageUploadError] = useState('');

  // Mentions
  const [mentionDropdown, setMentionDropdown] = useState({ 
    open: false, 
    options: [], 
    query: '', 
    position: { top: 0, left: 0 },
    activeInputId: null // Track which input triggered the dropdown
  });
  const [projectUsers, setProjectUsers] = useState([]);
  const [fileSignedUrls, setFileSignedUrls] = useState({});
  const [fileSearchTerm, setFileSearchTerm] = useState('');

  // Reports state
  const [reports, setReports] = useState([]);


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
  // We'll defer progress & contributions to report-based calculation below
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
    // Enable real-time updates for Discussions AND Reports (reports need live refresh on upload)
    if (!project?._id || (activeTab !== 'Discussions' && activeTab !== 'Reports')) return;
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

  /* ---------------- Fetch reports ---------------- */
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
      // Derive progress & pseudo contributions from reports
      const reportsArr = data?.reports || [];
      if (reportsArr.length) {
        // Sort newest first by uploadedAt
        const sorted = [...reportsArr].sort((a,b) => new Date(b.uploadedAt||0)-new Date(a.uploadedAt||0));
        // Distinct latest per uploader
        const byUser = new Map();
        for (const rep of sorted) {
          const key = rep.uploadedBy || rep.uploadedByName || rep._id; // fallback
            if (!byUser.has(key)) byUser.set(key, rep);
        }
        const repsForAvg = [...byUser.values()];
        let values = repsForAvg.map(r => Number(r?.ai?.pic_contribution_percent)).filter(v => isFinite(v) && v>=0);
        if (!values.length) {
          // fallback heuristic
          values = repsForAvg.map(r => {
            const done = r?.ai?.completed_tasks?.length || 0;
            const total = done + (r?.ai?.summary_of_work_done?.length || 0);
            return total>0 ? (done/total)*100 : 0;
          });
        }
        if (values.length) {
          const avg = values.reduce((s,v)=>s+v,0)/values.length;
          setProgress(Number(Math.min(100, Math.max(0, avg)).toFixed(1)));
          setPicContributions({
            averageContribution: Number(avg.toFixed(1)),
            picContributions: repsForAvg.map(r => ({
              picId: r.uploadedBy || r._id,
              picName: r.uploadedByName || 'Unknown',
              contribution: Math.round(Number(r?.ai?.pic_contribution_percent) || 0),
              hasReport: true,
              lastReportDate: r.uploadedAt || null
            })),
            totalPics: repsForAvg.length,
            reportingPics: repsForAvg.length,
            pendingPics: 0
          });
        }
      }
    } catch {
      setReports([]);
    }
  };

  // Eagerly fetch reports once project loads (instead of only when Reports tab active)
  useEffect(() => {
    if (!project?._id) return;
    fetchReports(project._id);
  }, [project?._id]);

  // Keep previous tab-triggered fetch to allow manual refresh when switching (cheap safeguard)
  useEffect(() => {
    if (activeTab === 'Reports' && project?._id && reports.length === 0) {
      fetchReports(project._id);
    }
  }, [activeTab, project?._id]);

  // Optional periodic refresh every 2 minutes to reflect new uploads while on Details tab
  useEffect(() => {
    if (!project?._id) return;
    const idInt = setInterval(() => fetchReports(project._id), 120000); // 2 min
    return () => clearInterval(idInt);
  }, [project?._id]);

  // Auto-scroll to bottom on message change
  useEffect(() => {
    if (activeTab !== 'Discussions') return;
    requestAnimationFrame(() => {
      if (listBottomRef.current) listBottomRef.current.scrollIntoView();
      else if (listScrollRef.current) listScrollRef.current.scrollTop = listScrollRef.current.scrollHeight;
    });
  }, [messages, activeTab]);

  /* ---------------- Fetch signed URLs for image files ---------------- */
  useEffect(() => {
    if (!project?._id) return;
    let cancelled = false;
    (async () => {
      try {
        // Collect all files that need signed URLs
        const allFiles = [];
        
        // Add project documents
        if (project.documents && Array.isArray(project.documents)) {
          allFiles.push(...project.documents);
        }
        
        // Add message attachments
        if (messages && Array.isArray(messages)) {
          messages.forEach(msg => {
            if (msg.attachments && Array.isArray(msg.attachments)) {
              allFiles.push(...msg.attachments);
            }
            if (msg.replies && Array.isArray(msg.replies)) {
              msg.replies.forEach(reply => {
                if (reply.attachments && Array.isArray(reply.attachments)) {
                  allFiles.push(...reply.attachments);
                }
              });
            }
          });
        }
        
        if (allFiles.length > 0) {
          const signedUrls = await fetchSignedUrlsForImages(allFiles);
          if (!cancelled) {
            setFileSignedUrls(prev => ({ ...prev, ...signedUrls }));
          }
        }
      } catch (error) {
        console.warn('Failed to fetch signed URLs for images:', error);
      }
    })();
    return () => { cancelled = true; };
  }, [project?.documents, messages]);

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
      if (!event.target.closest('.user-profile')) setProfileMenuOpen(false);
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

  // Join project room (shared for discussions + reports)
  socket.emit('joinProject', `project:${project._id}`);

    // Handle new discussion
const handleNewDiscussion = (data) => {
      if (String(data.projectId) === String(project._id) && data.message) {
        const messageId = String(data.message._id);
        if (processedMessageIds.has(messageId)) return;
        
        setMessages(prev => {
          const newList = [...prev, data.message];
          return newList.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        });
        processedMessageIds.add(messageId);
      }
    };

const handleNewReply = (data) => {
      if (String(data.projectId) === String(project._id) && data.msgId && data.reply) {
        setMessages(prev => prev.map(msg => {
          if (String(msg._id) === data.msgId) {
            const replyExists = msg.replies?.some(reply => String(reply._id) === String(data.reply._id));
            if (!replyExists) {
              return { ...msg, replies: [...msg.replies, data.reply] };
            }
          }
          return msg;
        }));
      }
    };


    // Handle reports updated (trigger refetch)
    const handleReportsUpdated = (data) => {
      if (String(data.projectId) === String(project._id)) {
        fetchReports(project._id);
      }
    };

    // Listen for events
    socket.on('project:newDiscussion', handleNewDiscussion);
    socket.on('project:newReply', handleNewReply);
    socket.on('project:reportsUpdated', handleReportsUpdated);



    // Cleanup
    return () => {
      console.log('🧹 Cleaning up Socket.IO connection');
  socket.off('project:newDiscussion', handleNewDiscussion);
  socket.off('project:newReply', handleNewReply);
  socket.off('project:reportsUpdated', handleReportsUpdated);
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

  try {
    setPosting(true);
    const fd = new FormData();
    if (newMessage.trim()) fd.append('text', newMessage.trim());
    if (selectedLabel) fd.append('label', selectedLabel);
    composerFiles.forEach(f => fd.append('files', f));
    
    const response = await api.post(`/projects/${project._id}/discussions`, fd, {
      headers: { Authorization: `Bearer ${token}` }
    });

    // After posting the message, add it to the local state `messages`
    setMessages(prev => {
      const newMessage = response.data;
      return [...prev, newMessage].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    });

    // Clear the form after posting
    setNewMessage('');
    setComposerFiles([]);
    setSelectedLabel('');
    
    console.log('✅ Message posted successfully');
  } catch (error) {
    console.error('❌ Failed to post message:', error);
  } finally {
    setPosting(false);
  }
};



  const handlePostReply = async (msgId) => {
    const replyText = (replyInputs[msgId] || '').trim();
    
    if (!replyText || posting || !project?._id) return;

    setPosting(true);
    try {
      const fd = new FormData();
      fd.append('text', replyText);
      
      const response = await api.post(`/projects/${project._id}/discussions/${msgId}/reply`, fd, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setMessages(prev => prev.map(msg => {
        if (String(msg._id) === msgId) {
          const updatedMsg = { ...msg, replies: [...msg.replies, response.data] };
          return updatedMsg;
        }
        return msg;
      }));

      setReplyInputs(prev => ({ ...prev, [msgId]: '' }));
    } catch (error) {
      console.error('Failed to post reply:', error);
    } finally {
      setPosting(false);
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

  /* ---------------- File management handlers ---------------- */
  const handleFileUpload = async (files) => {
    if (!files?.length || !project?._id) return;
    
    setUploading(true);
    setUploadProgress(0);
    setUploadError('');
    
    try {
      const formData = new FormData();
      files.forEach(file => formData.append('files', file));
      
      // Simulate progress (in real implementation, you'd track actual upload progress)
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);
      
      const response = await api.post(`/projects/${project._id}/documents`, formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      // Update project documents
      if (response.data?.documents) {
        setProject(prev => ({
          ...prev,
          documents: response.data.documents
        }));
      }
      
      // Show success message for renamed/replaced files
      if (response.data?.renamed?.length) {
        const renamedMsg = response.data.renamed.map(r => 
          `⚠️ "${r.from}" renamed to "${r.to}"`
        ).join('\n');
        alert(renamedMsg);
      }
      
      if (response.data?.replaced?.length) {
        const replacedMsg = response.data.replaced.map(r => 
          `ℹ️ "${r.originalName}" replaced (${r.removed} old version(s) removed)`
        ).join('\n');
        alert(replacedMsg);
      }
      
      setTimeout(() => {
        setUploading(false);
        setUploadProgress(0);
      }, 1000);
      
    } catch (error) {
      console.error('File upload error:', error);
      setUploadError('Upload failed. Please try again.');
      setUploading(false);
      setUploadProgress(0);
      
      if (error.response?.status === 403) {
        alert('You do not have permission to upload files to this project.');
      } else {
        alert('Upload failed. Please try again.');
      }
    }
  };

const handleDeleteFile = async (doc, index) => {
    if (!project?._id || !window.confirm('Are you sure you want to delete this file?')) return;
    
    try {
      const filePath = typeof doc === 'string' ? doc : doc.path;
      const fileName = typeof doc === 'string' 
        ? extractOriginalNameFromPath(doc) 
        : doc.name || extractOriginalNameFromPath(doc.path);
      
      await api.delete(`/projects/${project._id}/documents`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { path: filePath }
      });
      
      setProject(prev => ({
        ...prev,
        documents: prev.documents.filter((_, i) => i !== index)
      }));
      
    } catch (error) {
      console.error('File delete error:', error);
      alert('Failed to delete file. Please try again.');
    }
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
            <div className="loading-spinner"></div>
          </div>
          <div className="loading-text">
            <h2 className="loading-title">Loading Project Details</h2>
            <p className="loading-subtitle">Please wait while we fetch your project information...</p>
          </div>
          <div className="loading-progress">
            <div className="progress-bar">
              <div className="progress-fill"></div>
            </div>
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
            <h2 className="loading-title" style={{ color: '#ef4444' }}>Project Not Found</h2>
            <p className="loading-subtitle">The project you're looking for doesn't exist or you don't have access to it.</p>
          </div>
          <div style={{ marginTop: '2rem' }}>
            <button 
              onClick={() => navigate('/pm')}
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
    <div className="dashboard-container pm-view-root">
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
              <FaProjectDiagram />
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
              
              {/* Image Upload Overlay */}
              <div className="image-upload-overlay">
                <input
                  type="file"
                  id="project-image-upload"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    
                    if (!file.type.startsWith('image/')) {
                      alert('Please select an image file.');
                      return;
                    }
                    
                    if (file.size > 5 * 1024 * 1024) { // 5MB limit
                      alert('Image size must be less than 5MB.');
                      return;
                    }
                    
                    try {
                      setImageUploading(true);
                      setImageUploadProgress(0);
                      setImageUploadError('');
                      
                      const formData = new FormData();
                      formData.append('photo', file);
                      
                      const response = await api.post(`/projects/${project._id}/photo`, formData, {
                        headers: {
                          'Content-Type': 'multipart/form-data',
                        },
                        onUploadProgress: (progressEvent) => {
                          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                          setImageUploadProgress(progress);
                        },
                      });
                      
                      // Update the project with new photo
                      setProject(prev => ({
                        ...prev,
                        photos: [response.data.photoUrl, ...(prev.photos || []).slice(1)]
                      }));
                      
                      alert('Project image updated successfully!');
                    } catch (error) {
                      console.error('Error uploading image:', error);
                      setImageUploadError('Failed to upload image. Please try again.');
                      alert('Failed to upload image. Please try again.');
                    } finally {
                      setImageUploading(false);
                      setImageUploadProgress(0);
                      e.target.value = ''; // Reset file input
                    }
                  }}
                />
                <label htmlFor="project-image-upload" className="change-image-btn">
                  <FaCamera />
                  <span>Change Image</span>
                </label>
                
                {/* Upload Progress */}
                {imageUploading && (
                  <div className="image-upload-progress">
                    <div className="progress-bar">
                      <div 
                        className="progress-fill" 
                        style={{ width: `${imageUploadProgress}%` }}
                      ></div>
                    </div>
                    <p className="progress-text">Uploading... {imageUploadProgress}%</p>
                  </div>
                )}
                
                {/* Upload Error */}
                {imageUploadError && (
                  <div className="image-upload-error">
                    <p>{imageUploadError}</p>
                  </div>
                )}
              </div>
              
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
            <button 
              className={`project-tab ${activeTab === 'Reports' ? 'active' : ''}`} 
              onClick={() => setActiveTab('Reports')}
            >
              <FaRegFileAlt />
              <span>Reports</span>
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
                <div className="pm-overview-grid">
                  {/* Budget Card */}
                  <div className="pm-overview-card pm-budget-card">
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
                  <div className="pm-overview-card pm-timeline-card">
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
                  <div className="pm-overview-card pm-location-card">
                    <div className="card-icon">
                      <FaMapMarkerAlt />
                    </div>
                    <div className="card-content">
                      <h3 className="card-title">Location</h3>
                      <div className="location-value">{locationLabel}</div>
                    </div>
                  </div>

                  {/* Contractor Card */}
                  <div className="pm-overview-card pm-contractor-card">
                    <div className="card-icon">
                      <FaBuilding />
                    </div>
                    <div className="card-content">
                      <h3 className="card-title">Contractor</h3>
                      <div className="contractor-value">{contractor}</div>
                    </div>
                  </div>
                </div>

                {/* Project Progress Section */}
                <div className="progress-section">
                  <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    Project Progress
                    {progress >= 100 && (
                      <span style={{
                        background: 'linear-gradient(90deg,#16a34a,#4ade80)',
                        color: '#fff',
                        padding: '4px 10px',
                        fontSize: 12,
                        borderRadius: 20,
                        letterSpacing: .5
                      }}>COMPLETED</span>
                    )}
                  </h2>
                  <div className="progress-grid" style={{ display: 'grid', gap: 18, gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))' }}>
                    {/* Overall Progress Card */}
                    <div className="progress-card overall-progress" style={{
                      background: '#0f172a',
                      color: '#f1f5f9',
                      borderRadius: 18,
                      padding: 20,
                      position: 'relative',
                      overflow: 'hidden'
                    }}>
                      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 30% 20%, rgba(59,130,246,.25), transparent 70%)' }} />
                      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, letterSpacing: .5 }}>Overall Progress</h3>
                          <FaChartBar style={{ opacity: .7 }} />
                        </div>
                        <div style={{ fontSize: 38, fontWeight: 700, lineHeight: 1, background: 'linear-gradient(90deg,#3b82f6,#06b6d4)', WebkitBackgroundClip: 'text', color: 'transparent' }}>
                          {Math.round(progress)}%
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <div style={{ height: 14, background: '#1e293b', borderRadius: 10, position: 'relative' }} aria-label={`Overall progress ${Math.round(progress)}%`} role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
                            <div style={{
                              position: 'absolute',
                              inset: 0,
                              background: 'linear-gradient(90deg,#3b82f6,#6366f1,#8b5cf6)',
                              width: `${progress}%`,
                              borderRadius: 10,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'flex-end',
                              boxShadow: '0 0 0 1px rgba(255,255,255,0.08),0 2px 8px rgba(0,0,0,0.35)',
                              transition: 'width .5s ease'
                            }} />
                          </div>
                          <small style={{ opacity: .8 }}>Average across all PiCs</small>
                        </div>
                        {picContributions && (
                          <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div style={{ fontSize: 12, letterSpacing: .5, opacity: .85, textTransform: 'uppercase' }}>Reporting Coverage</div>
                            <div style={{ display: 'flex', gap: 6 }}>
                              {Array.from({ length: picContributions.totalPics }).map((_, i) => {
                                const reported = i < picContributions.reportingPics;
                                return <div key={i} style={{ flex: 1, height: 6, background: reported ? 'linear-gradient(90deg,#10b981,#4ade80)' : '#334155', borderRadius: 4, transition: 'background .3s' }} />;
                              })}
                            </div>
                            <div style={{ fontSize: 12, opacity: .7 }}>{picContributions.reportingPics}/{picContributions.totalPics} submitted</div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* PiC Contributions Card */}
                    {(picContributions || (project?.pic && project.pic.length > 0)) && (
                      <div className="progress-card pic-contributions" style={{
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: 18,
                        padding: 20,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 12
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#0f172a' }}>PiC Contributions</h3>
                          <FaUsers style={{ color: '#475569' }} />
                        </div>
                        <div style={{ fontSize: 32, fontWeight: 700, color: '#0f172a', lineHeight: 1 }}>
                          {picContributions ? picContributions.averageContribution : 0}%
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {picContributions ? (
                            <>
                              <div style={{ fontSize: 13, color: '#475569', display: 'flex', justifyContent: 'space-between' }}>
                                <span>Reporting</span>
                                <span style={{ fontWeight: 600 }}>{picContributions.reportingPics}/{picContributions.totalPics}</span>
                              </div>
                              {picContributions.pendingPics > 0 && (
                                <div style={{ fontSize: 13, color: '#b45309', background: '#fffbeb', padding: '6px 10px', borderRadius: 8, display: 'flex', justifyContent: 'space-between' }}>
                                  <span>Pending</span>
                                  <span style={{ fontWeight: 600 }}>{picContributions.pendingPics}</span>
                                </div>
                              )}
                              {picContributions.reportingPics === 0 && project?.pic?.length > 0 && reports.length > 0 && (
                                <div style={{ fontSize: 12, lineHeight: 1.4, background: '#f1f5f9', padding: '8px 10px', borderRadius: 8, color: '#475569' }}>
                                  Reports exist in the Reports tab, but no Daily Reports have been submitted yet. PiC contributions are calculated from Daily Reports (AI field <code>pic_contribution_percent</code>). Ask PiCs to submit Daily Reports to populate this.
                                </div>
                              )}
                            </>
                          ) : (
                            <div style={{ fontSize: 12, lineHeight: 1.4, background: '#f1f5f9', padding: '8px 10px', borderRadius: 8, color: '#475569' }}>
                              No contribution data yet. This appears once PiCs submit their first Daily Report.
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Individual PiC Contributions */}
                  {picContributions && picContributions.picContributions.length > 0 && (
                    <div className="individual-contributions" style={{ marginTop: 24 }}>
                      <h3 className="subsection-title" style={{ fontSize: 16, fontWeight: 600, margin: '0 0 12px', color: '#0f172a' }}>Individual PiC Contributions</h3>
                      <div className="pic-list" style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
                        {picContributions.picContributions.map((pic, index) => (
                          <div key={index} className={`pic-item ${!pic.hasReport ? 'no-report' : ''}`} style={{
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderRadius: 14,
                            padding: 14,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 8,
                            position: 'relative'
                          }}>
                            {!pic.hasReport && (
                              <span style={{ position: 'absolute', top: 8, right: 10, background: '#fee2e2', color: '#b91c1c', fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 6, letterSpacing: .5 }}>NO REPORT</span>
                            )}
                            <div className="pic-info" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              <span className="pic-name" style={{ fontWeight: 600, fontSize: 14, color: '#0f172a' }}>{pic.picName}</span>
                              {pic.lastReportDate && (
                                <span className="last-report" style={{ fontSize: 11, color: '#64748b' }}>
                                  Last: {new Date(pic.lastReportDate).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                            <div className="pic-contribution" style={{ marginTop: 'auto' }}>
                              {pic.hasReport ? (
                                <span className="contribution-percent" style={{
                                  display: 'inline-block',
                                  background: 'linear-gradient(90deg,#3b82f6,#6366f1)',
                                  color: '#fff',
                                  fontSize: 13,
                                  padding: '4px 10px',
                                  borderRadius: 8,
                                  fontWeight: 600,
                                  letterSpacing: .5
                                }}>{pic.contribution}%</span>
                              ) : (
                                <span className="no-contribution" style={{
                                  display: 'inline-block',
                                  background: '#f1f5f9',
                                  color: '#475569',
                                  fontSize: 12,
                                  padding: '4px 10px',
                                  borderRadius: 8,
                                  fontWeight: 500
                                }}>No report</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
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
                                fontWeight: 600,
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
                                {msg.attachments.map((att, i) => {
                                  const attachmentName = att.name || extractOriginalNameFromPath(att.path);
                                  const attachmentType = getFileType(attachmentName);
                                  return (
                                    <div key={i} className="attachment-item">
                                      <div className="attachment-thumbnail">
                                        {generateFileThumbnail(attachmentName, att.path, attachmentType, fileSignedUrls[att.path])}
                                      </div>
                                      <div className="attachment-info">
                                        <a 
                                          href="#" 
                                          onClick={(e) => { 
                                            e.preventDefault(); 
                                            openSignedPath(att.path); 
                                          }} 
                                          title={attachmentName}
                                          className="attachment-name"
                                        >
                                          {attachmentName}
                                        </a>
                                        <span className="attachment-type">{attachmentType}</span>
                                      </div>
                                    </div>
                                  );
                                })}
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
                                          {reply.attachments.map((att, i) => {
                                            const attachmentName = att.name || extractOriginalNameFromPath(att.path);
                                            const attachmentType = getFileType(attachmentName);
                                            return (
                                              <div key={i} className="attachment-item">
                                                <div className="attachment-thumbnail">
                                                  {generateFileThumbnail(attachmentName, att.path, attachmentType, fileSignedUrls[att.path])}
                                                </div>
                                                <div className="attachment-info">
                                                  <a 
                                                    href="#" 
                                                    onClick={(e) => { 
                                                      e.preventDefault(); 
                                                      openSignedPath(att.path); 
                                                    }} 
                                                    title={attachmentName}
                                                    className="attachment-name"
                                                  >
                                                    {attachmentName}
                                                  </a>
                                                  <span className="attachment-type">{attachmentType}</span>
                                                </div>
                                              </div>
                                            );
                                          })}
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

            {/* --- Files Tab --- */}
            {activeTab === 'Files' && (
              <div className="files-container">
                {/* Files Header */}
                <div className="files-header">
                  <div className="files-title-section">
                    <h2 className="files-title">Project Files</h2>
                    <p className="files-subtitle">
                      {project?.documents && project.documents.length > 0 
                        ? `Showing ${Math.min(project.documents.filter(doc => {
                            if (!fileSearchTerm) return true;
                            const fileName = typeof doc === 'string' 
                              ? extractOriginalNameFromPath(doc) 
                              : doc.name || extractOriginalNameFromPath(doc.path);
                            return fileName.toLowerCase().includes(fileSearchTerm.toLowerCase());
                          }).length, 5)} of ${project.documents.length} files`
                        : 'Manage and organize project documents'
                      }
                    </p>
                  </div>
                  <div className="files-actions">
                    <div className="search-container">
                      <input
                        type="text"
                        placeholder="Search files..."
                        value={fileSearchTerm}
                        onChange={(e) => setFileSearchTerm(e.target.value)}
                        className="file-search-input"
                      />
                    </div>
                    <label htmlFor="file-upload" className="upload-btn">
                      <FaRegFileAlt />
                      <span>Upload Files</span>
                    </label>
                    <input
                      id="file-upload"
                      type="file"
                      multiple
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.rtf,.csv,image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        if (e.target.files?.length) {
                          handleFileUpload(Array.from(e.target.files));
                        }
                        e.target.value = '';
                      }}
                    />
                  </div>
                </div>

                {/* Upload Progress */}
                {uploading && (
                  <div className="upload-progress">
                    <div className="progress-bar">
                      <div 
                        className="progress-fill" 
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                    <span className="progress-text">Uploading... {uploadProgress}%</span>
                  </div>
                )}

                {/* Files Table */}
                <div className="files-table-container">
                  {project?.documents && project.documents.length > 0 ? (
                    <table className="files-table">
                      <thead className="table-header">
                        <tr>
                          <th className="header-cell file-name">File Name</th>
                          <th className="header-cell file-type">Type</th>
                          <th className="header-cell file-size">Size</th>
                          <th className="header-cell file-uploader">Uploaded By</th>
                          <th className="header-cell file-date">Date</th>
                          <th className="header-cell file-actions">Actions</th>
                        </tr>
                      </thead>
                      
                      <tbody className="table-body">
                        {project.documents
                          .filter((doc) => {
                            if (!fileSearchTerm) return true;
                            const fileName = typeof doc === 'string' 
                              ? extractOriginalNameFromPath(doc) 
                              : doc.name || extractOriginalNameFromPath(doc.path);
                            return fileName.toLowerCase().includes(fileSearchTerm.toLowerCase());
                          })
                          .slice(0, 5)
                          .map((doc, index) => {
                          const fileName = typeof doc === 'string' 
                            ? extractOriginalNameFromPath(doc) 
                            : doc.name || extractOriginalNameFromPath(doc.path);
                          const filePath = typeof doc === 'string' ? doc : doc.path;
                          const fileType = getFileType(fileName);
                          const fileSize = getFileSize(fileName);
                          const uploadedBy = typeof doc === 'string' ? 'Unknown' : (doc.uploadedByName || 'Unknown');
                          const uploadedAt = typeof doc === 'string' ? null : doc.uploadedAt;
                          
                          return (
                            <tr key={index} className="table-row">
                              <td className="table-cell file-name">
                                <div className="file-info">
                                  <div className="file-thumbnail-container">
                                    {generateFileThumbnail(fileName, filePath, fileType, fileSignedUrls[filePath])}
                                  </div>
                                  <span className="file-name-text" title={fileName}>
                                    {fileName}
                                  </span>
                                </div>
                              </td>
                              <td className="table-cell file-type">
                                <span className="file-type-badge">{fileType.toUpperCase()}</span>
                              </td>
                              <td className="table-cell file-size">
                                {fileSize}
                              </td>
                              <td className="table-cell file-uploader">
                                {uploadedBy}
                              </td>
                              <td className="table-cell file-date">
                                {uploadedAt ? new Date(uploadedAt).toLocaleDateString() : 'N/A'}
                              </td>
                              <td className="table-cell file-actions">
                                <div className="action-buttons">
                                  <button
                                    onClick={() => openSignedPath(filePath)}
                                    className="action-btn download-btn"
                                    title="Download"
                                  >
                                    <FaDownload />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteFile(doc, index)}
                                    className="action-btn delete-btn"
                                    title="Delete"
                                  >
                                    <FaTrash />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <div className="empty-files">
                      <FaRegFileAlt />
                      <h3>No files uploaded yet</h3>
                      <p>Upload project documents to get started</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* --- Reports Tab (mirrors PIC layout, read-only) --- */}
            {activeTab === 'Reports' && (
              <div className="project-reports" style={{ textAlign: 'left' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <h3 style={{ marginBottom: 18 }}>Project Reports</h3>
                  {/* No upload control for PM */}
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
                                {rep?.path ? (
                                  <button
                                    onClick={() => openReportSignedPath(rep.path)}
                                    style={{
                                      marginRight: 10,
                                      border: '1px solid #cbd5e1',
                                      background: '#f8fafc',
                                      padding: '6px 12px',
                                      borderRadius: 8,
                                      cursor: 'pointer',
                                      fontSize: 13,
                                      fontWeight: 600,
                                      color: '#0f172a',
                                      letterSpacing: .3,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 6,
                                      transition: 'all .2s'
                                    }}
                                    onMouseOver={(e) => { e.currentTarget.style.background = '#e2e8f0'; }}
                                    onMouseOut={(e) => { e.currentTarget.style.background = '#f8fafc'; }}
                                  >
                                    View PPT
                                  </button>
                                ) : (
                                  <span style={{ color: '#94a3b8', marginRight: 10, fontSize: 12 }}>No PPT</span>
                                )}
                                {rep?.pdfPath ? (
                                  <button
                                    onClick={() => openReportSignedPath(rep.pdfPath)}
                                    style={{
                                      marginRight: 10,
                                      border: '1px solid #cbd5e1',
                                      background: 'linear-gradient(90deg,#3b82f6,#6366f1)',
                                      padding: '6px 12px',
                                      borderRadius: 8,
                                      cursor: 'pointer',
                                      fontSize: 13,
                                      fontWeight: 600,
                                      color: '#ffffff',
                                      letterSpacing: .3,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 6,
                                      boxShadow: '0 4px 12px -2px rgba(59,130,246,0.35)',
                                      transition: 'all .25s'
                                    }}
                                    onMouseOver={(e) => { e.currentTarget.style.filter = 'brightness(1.08)'; }}
                                    onMouseOut={(e) => { e.currentTarget.style.filter = 'brightness(1)'; }}
                                  >
                                    Download AI PDF
                                  </button>
                                ) : (
                                  <span style={{ color: '#94a3b8', marginRight: 10, fontSize: 12 }}>No PDF</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    {/* Latest AI Summary (read-only) */}
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
                              {(reports[0].ai.critical_path_analysis || []).slice(0,3).map((c, i) => (
                                <div key={i} style={{ marginBottom: 8 }}>
                                  <b>{`${i + 1}. ${c?.path_type || 'Path ' + (i+1)}`}</b>
                                  <ul style={{ marginTop: 4, marginBottom: 4 }}>
                                    {c?.risk && <li><b>Risk:</b> {c.risk}</li>}
                                    {c?.blockers?.length > 0 && <li><b>Blockers:</b> {c.blockers.join('; ')}</li>}
                                    {c?.next?.length > 0 && <li><b>Next:</b> {c.next.join('; ')}</li>}
                                  </ul>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <b>PiC Performance</b>
                            <p style={{ marginTop: 6 }}>
                              {reports[0].ai.pic_performance_evaluation?.text || 'Performance summary unavailable.'}
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
        </div>
      </main>
    </div>
  );
};

export default Pm_Project;
