import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../../api/axiosInstance';
import NotificationBell from '../NotificationBell';
import { FaRegCommentDots, FaRegFileAlt, FaRegListAlt, FaPlus } from 'react-icons/fa';
import { io } from 'socket.io-client';
import "../style/pic_style/Pic_Project.css"; // reuse styles with the left-chat layout

// ---- Socket endpoint setup ----
const RAW = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
const SOCKET_ORIGIN = RAW.replace(/\/api$/, ''); // strip trailing /api if present
const SOCKET_PATH = '/socket.io';

// Static sample chats in left sidebar (replace with your real chats list if you have one)
const chats = [
  { id: 1, name: 'HR Ops',        initial: 'H', message: 'Payroll questions…',     color: '#4A6AA5' },
  { id: 2, name: 'Recruitment',   initial: 'R', message: 'Screening updates…',     color: '#2E7D32' },
  { id: 3, name: 'Compliance',    initial: 'C', message: 'New memo draft…',        color: '#9C27B0' },
];

// --- Helpers for mentions ---
function renderMessageText(text = '') {
  const parts = text.split(/(@[\w\s]+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('@')) {
      return <span key={i} style={{ color: '#1976d2', fontWeight: 600 }}>{part}</span>;
    }
    return part;
  });
}

const HRCurrentProject = () => {
  const { id } = useParams(); // optional: project id
  const navigate = useNavigate();

  // --- Stable user (no re-parse per render)
  const userRef = useRef(null);
  if (userRef.current === null) {
    try {
      const raw = localStorage.getItem('user');
      userRef.current = raw ? JSON.parse(raw) : null;
    } catch {
      userRef.current = null;
    }
  }
  const user = userRef.current;
  const userId = user?._id || null;
  const [userName] = useState(user?.name || 'HR');
  const token = localStorage.getItem('token');

  // Header/profile
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  // Project + tabs
  const [project, setProject] = useState(null);
  const [activeTab, setActiveTab] = useState('Details');
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);
  const [toggleLoading, setToggleLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  // Discussions
  const [messages, setMessages] = useState([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [replyInputs, setReplyInputs] = useState({});
  const [showNewMsgInput, setShowNewMsgInput] = useState(false);
  const textareaRef = useRef();

  // Mention autocomplete
  const [mentionDropdown, setMentionDropdown] = useState({
    open: false,
    options: [],
    query: '',
    position: { top: 0, left: 0 }
  });

  // Files
  const [docSignedUrls, setDocSignedUrls] = useState([]);

  // Fallback: purchase orders / totals if you want to show financials
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [totalPO, setTotalPO] = useState(0);

  // ---- SOCKET REFS (for realtime) ----
  const socketRef = useRef(null);
  const joinedRoomRef = useRef(null);
  const projectIdRef = useRef(null); // avoid stale closures

  // Build staff list for mentions (PM, PIC, HR - Site, Staff)
  const staffList = useMemo(() => {
    if (!project) return [];
    let staff = [];

    if (project.projectmanager && typeof project.projectmanager === 'object') {
      staff.push({ _id: project.projectmanager._id, name: project.projectmanager.name });
    }
    if (Array.isArray(project.pic)) {
      staff = staff.concat(project.pic.map(p => ({ _id: p._id, name: p.name })));
    }
    if (Array.isArray(project.hrsite)) {
      staff = staff.concat(project.hrsite.map(h => ({ _id: h._id, name: h.name })));
    }
    if (Array.isArray(project.staff)) {
      staff = staff.concat(project.staff.map(s => ({ _id: s._id, name: s.name })));
    }

    // Deduplicate by _id
    const seen = new Set();
    return staff.filter(u => u._id && !seen.has(u._id) && seen.add(u._id));
  }, [project]);

  // Keep a ref of current project id (prefer actual loaded project, fallback to route id)
  useEffect(() => {
    const pid = project?._id ? String(project._id) : (id ? String(id) : null);
    projectIdRef.current = pid;
  }, [project?._id, id]);

  // Connect socket once
  useEffect(() => {
    if (socketRef.current) return;

    const sock = io(SOCKET_ORIGIN, {
      path: SOCKET_PATH,
      withCredentials: true,
      transports: ['websocket'],
      auth: { userId }, // lets server also put us in user:<id> room
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.5,
    });
    socketRef.current = sock;

    const onConnect = () => {
      if (joinedRoomRef.current) {
        sock.emit('joinProject', joinedRoomRef.current);
      }
    };

    const onNewDiscussion = (payload) => {
      const currentPid = projectIdRef.current;
      if (!currentPid || payload?.projectId !== currentPid) return;
      setMessages(prev => [payload.message, ...prev]);
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

    const onMention = (payload) => {
      // hook into your NotificationBell / toast if desired
      console.log('[HRCurrentProject mentionNotification]', payload);
    };

    sock.on('connect', onConnect);
    sock.on('project:newDiscussion', onNewDiscussion);
    sock.on('project:newReply', onNewReply);
    sock.on('mentionNotification', onMention);

    return () => {
      sock.off('connect', onConnect);
      sock.off('project:newDiscussion', onNewDiscussion);
      sock.off('project:newReply', onNewReply);
      sock.off('mentionNotification', onMention);
      sock.disconnect();
      socketRef.current = null;
      joinedRoomRef.current = null;
    };
  }, [userId]);

  // Compute and join/leave desired room when Discussions tab is open
  useEffect(() => {
    const sock = socketRef.current;
    if (!sock) return;

    const pid = project?._id || id;
    const desiredRoom = activeTab === 'Discussions' && pid ? `project:${pid}` : null;

    if (joinedRoomRef.current === desiredRoom) return;

    if (joinedRoomRef.current && (!desiredRoom || joinedRoomRef.current !== desiredRoom)) {
      const prev = joinedRoomRef.current;
      sock.emit('leaveProject', prev);
      joinedRoomRef.current = null;
    }
    if (desiredRoom && joinedRoomRef.current !== desiredRoom) {
      sock.emit('joinProject', desiredRoom);
      joinedRoomRef.current = desiredRoom;
    }
  }, [project?._id, id, activeTab]);

  // Fetch project (specific by id OR fallback to current assigned ongoing)
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        if (id) {
          const { data } = await api.get(`/projects/${id}`);
          if (cancelled) return;
          setProject(data);
          setStatus(data?.status || '');
          try {
            const progressRes = await api.get(`/daily-reports/project/${id}/progress`);
            const completed = progressRes?.data?.progress?.find(p => p.name === 'Completed');
            setProgress(completed ? completed.value : 0);
          } catch { /* ignore */ }
        } else {
          if (!userId) throw new Error('Missing user');
          const res = await api.get(`/projects/assigned/allroles/${userId}`);
          if (cancelled) return;
          const ongoing = (res.data || []).find(p => p.status === 'Ongoing') || (res.data || [])[0] || null;
          setProject(ongoing);
          setStatus(ongoing?.status || '');
          if (ongoing?._id) {
            try {
              const progressRes = await api.get(`/daily-reports/project/${ongoing._id}/progress`);
              const completed = progressRes?.data?.progress?.find(p => p.name === 'Completed');
              setProgress(completed ? completed.value : 0);
            } catch { /* ignore */ }
          }
        }
      } catch {
        if (!cancelled) setProject(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [id, userId]);

  // Discussions fetch when tab active (initial load)
  useEffect(() => {
    if (!project?._id || activeTab !== 'Discussions') return;
    const controller = new AbortController();
    setLoadingMsgs(true);
    api.get(`/projects/${project._id}/discussions`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(res => setMessages(res.data || []))
      .catch(() => setMessages([]))
      .finally(() => setLoadingMsgs(false));
    return () => controller.abort();
  }, [project?._id, activeTab, token]);

  // Files: get signed URLs initially and auto-refresh every 4.5 minutes while on Files
  useEffect(() => {
    let intervalId;
    async function fetchSignedUrls() {
      if (project?.documents?.length) {
        const urls = await Promise.all(
          project.documents.map(async docPath => {
            try {
              const { data } = await api.get(`/photo-signed-url?path=${encodeURIComponent(docPath)}`);
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
      intervalId = setInterval(fetchSignedUrls, 270000); // 4.5 minutes
    }
    return () => clearInterval(intervalId);
  }, [activeTab, project]);

  // Optional: purchase orders summary
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

  // Mention logic
  const handleTextareaInput = (e) => {
    const value = e.target.value;
    setNewMessage(value);
    const caret = e.target.selectionStart;
    const textUpToCaret = value.slice(0, caret);
    const match = /(^|\s)@(\w*)$/.exec(textUpToCaret);
    if (match) {
      const query = match[2].toLowerCase();
      const options = staffList.filter(u => (u.name || '').toLowerCase().includes(query));
      const rect = e.target.getBoundingClientRect();
      setMentionDropdown({
        open: true,
        options,
        query,
        position: { top: rect.top + e.target.offsetHeight, left: rect.left + 10 }
      });
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

  // Post new message (discussion) — rely on socket event to append
  const handlePostMessage = async () => {
    if (!newMessage.trim() || !project?._id) return;
    try {
      await api.post(`/projects/${project._id}/discussions`,
        { text: newMessage, userName },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setNewMessage('');
      setShowNewMsgInput(false);
      // 'project:newDiscussion' will arrive and prepend it
    } catch {
      alert('Failed to post message');
    }
  };

  // Post reply — rely on socket event to append
  const handlePostReply = async (msgId) => {
    const replyText = replyInputs[msgId];
    if (!replyText?.trim() || !project?._id) return;
    try {
      await api.post(`/projects/${project._id}/discussions/${msgId}/reply`,
        { text: replyText, userName },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setReplyInputs(prev => ({ ...prev, [msgId]: '' }));
      // 'project:newReply' will arrive and append it
    } catch {
      alert('Failed to post reply');
    }
  };

  // UI helpers
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

  if (loading) return <div>Loading...</div>;
  if (!project) {
    return (
      <>
        {/* HEADER */}
        <header className="header">
          <div className="logo-container">
            <img src={require('../../assets/images/FadzLogo1.png')} alt="FadzTrack Logo" className="logo-img" />
            <h1 className="brand-name">FadzTrack</h1>
          </div>
          <nav className="nav-menu">
            <Link to="/hr-site/current-project" className="nav-link">Dashboard</Link>
            <Link to="/hr-site/attendance-report" className="nav-link">Report</Link>
            <Link to="/hr-site/all-projects" className="nav-link">My Projects</Link>
            <Link to="/hr/chat" className="nav-link">Chat</Link>
          </nav>
          <div className="profile-menu-container" style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <NotificationBell />
            <div className="profile-circle" onClick={() => setProfileMenuOpen(!profileMenuOpen)}>
              {userName?.charAt(0).toUpperCase() || 'U'}
            </div>
            {profileMenuOpen && (
              <div className="profile-menu">
                <button onClick={handleLogout}>Logout</button>
              </div>
            )}
          </div>
        </header>

        {/* LAYOUT with left chats kept */}
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
              <p>Your HR - Site account doesn’t have an active project yet.</p>
              <p>Please wait for an assignment or contact your manager.</p>
            </div>
          </main>
        </div>
      </>
    );
  }

  // Derived fields for Details tab
  const start = project?.startDate ? new Date(project.startDate).toLocaleDateString() : 'N/A';
  const end   = project?.endDate ? new Date(project.endDate).toLocaleDateString() : 'N/A';
  const contractor =
    typeof project?.contractor === 'string' && project.contractor.trim().length > 0
      ? project.contractor : 'N/A';
  const locationLabel = project?.location?.name
    ? `${project.location.name}${project.location?.region ? ` (${project.location.region})` : ''}`
    : 'N/A';
  const manpowerText =
    Array.isArray(project?.manpower) && project.manpower.length > 0
      ? project.manpower
          .map(mp => [mp?.name, mp?.position].filter(Boolean).join(' (') + (mp?.position ? ')' : ''))
          .join(', ')
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
          <Link to="/hr-site/current-project" className="nav-link">Dashboard</Link>
          <Link to="/hr-site/attendance-report" className="nav-link">Report</Link>
          <Link to="/hr-site/all-projects" className="nav-link">My Projects</Link>
          <Link to="/hr/chat" className="nav-link">Chat</Link>
        </nav>
        <div className="profile-menu-container" style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <NotificationBell />
          <div className="profile-circle" onClick={() => setProfileMenuOpen(!profileMenuOpen)}>
            {userName?.charAt(0).toUpperCase() || 'U'}
          </div>
          {profileMenuOpen && (
            <div className="profile-menu">
              <button onClick={handleLogout}>Logout</button>
            </div>
          )}
        </div>
      </header>

      {/* LAYOUT with left chats kept */}
      <div className="dashboard-layout">
        {/* LEFT SIDEBAR: CHATS */}
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
          <div className="project-detail-container">
            <div className="project-image-container" style={{ marginBottom: 12, position: 'relative' }}>
              <img
                src={(project.photos && project.photos[0]) || 'https://placehold.co/800x300?text=No+Photo'}
                alt={project.projectName}
                className="responsive-photo"
              />
              {/* Optional: allow toggle only when complete */}
              {progress === 100 && (
                <button
                  onClick={async () => {
                    setToggleLoading(true);
                    try {
                      const res = await api.patch(`/projects/${project._id}/toggle-status`);
                      setStatus(res.data?.status || status);
                    } finally {
                      setToggleLoading(false);
                    }
                  }}
                  disabled={toggleLoading}
                  style={{
                    background: status === 'Completed' ? '#4CAF50' : '#f57c00',
                    color: 'white',
                    padding: '8px 16px',
                    borderRadius: 6,
                    border: 'none',
                    cursor: 'pointer',
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    zIndex: 10,
                    fontSize: '14px',
                  }}
                >
                  {status === 'Completed' ? 'Mark as Ongoing' : 'Mark as Completed'}
                </button>
              )}
            </div>

            <h1 className="project-title">{project.projectName}</h1>

            {/* Tabs (match AreaViewSpecific style) */}
            <div className="tabs-row">
              <button
                className={`tab-btn${activeTab === 'Discussions' ? ' active' : ''}`}
                onClick={() => setActiveTab('Discussions')}
                type="button"
              >
                <FaRegCommentDots /> Discussions
              </button>
              <button
                className={`tab-btn${activeTab === 'Details' ? ' active' : ''}`}
                onClick={() => setActiveTab('Details')}
                type="button"
              >
                <FaRegListAlt /> Details
              </button>
              <button
                className={`tab-btn${activeTab === 'Files' ? ' active' : ''}`}
                onClick={() => setActiveTab('Files')}
                type="button"
              >
                <FaRegFileAlt /> Files
              </button>
              <button
                className={`tab-btn${activeTab === 'Reports' ? ' active' : ''}`}
                onClick={() => setActiveTab('Reports')}
                type="button"
              >
                <FaRegFileAlt /> Reports
              </button>
            </div>

            {/* --- Discussions --- */}
            {activeTab === 'Discussions' && (
              <div className="discussions-card">
                {loadingMsgs ? (
                  <div style={{ textAlign: "center", color: "#aaa" }}>Loading discussions…</div>
                ) : messages.length === 0 && !showNewMsgInput ? (
                  <div style={{ color: '#bbb', fontSize: 28, textAlign: 'center', marginTop: 120, userSelect: 'none' }}>
                    Start a conversation
                  </div>
                ) : (
                  <div>
                    {messages.map(msg => (
                      <div key={msg._id} className="discussion-msg">
                        <div className="discussion-user">
                          <div className="discussion-avatar">{msg.userName?.charAt(0) ?? '?'}</div>
                          <div className="discussion-user-info">
                            <span className="discussion-user-name">{msg.userName || 'Unknown'}</span>
                            <span className="discussion-timestamp">
                              {msg.timestamp ? new Date(msg.timestamp).toLocaleString() : ''}
                            </span>
                          </div>
                        </div>
                        <div className="discussion-text">{renderMessageText(msg.text)}</div>

                        {/* Replies */}
                        <div className="discussion-replies">
                          {msg.replies?.map(reply => (
                            <div key={reply._id} className="discussion-reply">
                              <div className="reply-avatar">{reply.userName?.charAt(0) ?? '?'}</div>
                              <div className="reply-info">
                                <span className="reply-name">{reply.userName || 'Unknown'}</span>
                                <span className="reply-timestamp">
                                  {reply.timestamp ? new Date(reply.timestamp).toLocaleString() : ''}
                                </span>
                                <span className="reply-text">{reply.text}</span>
                              </div>
                            </div>
                          ))}

                          {/* Reply input */}
                          <div className="reply-input-row">
                            <input
                              type="text"
                              value={replyInputs[msg._id] || ''}
                              onChange={e => setReplyInputs(prev => ({ ...prev, [msg._id]: e.target.value }))}
                              placeholder="Reply..."
                            />
                            <button onClick={() => handlePostReply(msg._id)}>Reply</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Floating add discussion button */}
                <button
                  className="discussion-plus-btn"
                  onClick={() => setShowNewMsgInput(v => !v)}
                  title="Start a new conversation"
                >
                  <FaPlus />
                </button>

                {/* New message input modal/box with @-mentions autocomplete */}
                {showNewMsgInput && (
                  <div className="new-msg-modal" onClick={() => setShowNewMsgInput(false)}>
                    <div className="new-msg-box" onClick={e => e.stopPropagation()}>
                      <h3 style={{ margin: 0, marginBottom: 16 }}>Start a new conversation</h3>
                      <textarea
                        value={newMessage}
                        onChange={handleTextareaInput}
                        ref={textareaRef}
                        placeholder="Type your message..."
                      />
                      {mentionDropdown.open && (
                        <div
                          className="mention-dropdown"
                          style={{ top: mentionDropdown.position.top, left: mentionDropdown.position.left }}
                        >
                          {mentionDropdown.options.map(u => (
                            <div
                              key={u._id}
                              className="mention-option"
                              onClick={() => handleMentionSelect(u)}
                            >
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
                      <p className="detail-value">
                        {start} — {end}
                      </p>
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
                          : (userName || 'N/A')}
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
              <div className="project-files-list">
                {project?.documents && project.documents.length > 0 ? (
                  <div>
                    <h3 style={{ marginBottom: 18 }}>Project Documents</h3>
                    <ul>
                      {project.documents.map((docPath, idx) => {
                        const fileName = docPath.split('/').pop();
                        const url = docSignedUrls[idx];
                        return (
                          <li key={idx}>
                            <FaRegFileAlt style={{ marginRight: 4 }} />
                            <span style={{ flex: 1 }}>{fileName}</span>
                            {url ? (
                              <a
                                href={url}
                                download={fileName}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                View Document
                              </a>
                            ) : (
                              <span style={{ color: '#aaa' }}>Loading link…</span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : (
                  <div style={{ color: '#888', fontSize: 20 }}>No documents uploaded for this project.</div>
                )}
              </div>
            )}

            {/* --- Reports --- */}
            {activeTab === 'Reports' && (
              <div className="project-reports-placeholder">
                <h3 style={{ marginBottom: 18 }}>Project Reports</h3>
                <div style={{ color: '#888', fontSize: 20 }}>
                  No reports are currently available.
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
};

export default HRCurrentProject;
