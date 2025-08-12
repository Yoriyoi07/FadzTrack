import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../../api/axiosInstance';
import NotificationBell from '../NotificationBell';
import { FaRegCommentDots, FaRegFileAlt, FaRegListAlt, FaPlus } from 'react-icons/fa';
import { io } from 'socket.io-client';
import "../style/pic_style/Pic_Project.css";

// ---- Socket endpoint setup ----
const RAW = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
const SOCKET_ORIGIN = RAW.replace(/\/api$/, ''); // strip trailing /api if present
const SOCKET_PATH = '/socket.io';

// Sidebar Chats Data (static sample; wire to your chat API when ready)
const chats = [
  { id: 1, name: 'Rychea Miralles', initial: 'R', message: 'Hello Good Morning po! As...', color: '#4A6AA5' },
  { id: 2, name: 'Third Castellar',  initial: 'T', message: 'Hello Good Morning po! As...', color: '#2E7D32' },
  { id: 3, name: 'Zenarose Miranda', initial: 'Z', message: 'Hello Good Morning po! As...', color: '#9C27B0' }
];

// render @mentions without using dangerouslySetInnerHTML
function renderMessageText(text = '') {
  const parts = text.split(/(@[\w\s]+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('@')) {
      return <span key={i} className="mention" style={{ color: '#1976d2', fontWeight: 600 }}>{part}</span>;
    }
    return <span key={i}>{part}</span>;
  });
}

const PicProject = () => {
  const { id } = useParams(); // optional project id route param
  const navigate = useNavigate();

  // Profile menu
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  // Project + tabs
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Details');

  // Purchase Orders summary
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [totalPO, setTotalPO] = useState(0);

  // Stable user (no re-parse each render)
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
  const [userName] = useState(user?.name || '');

  const token = localStorage.getItem('token');

  // Discussions
  const [messages, setMessages] = useState([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [hasLoadedDiscussions, setHasLoadedDiscussions] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [replyInputs, setReplyInputs] = useState({});
  const [showNewMsgInput, setShowNewMsgInput] = useState(false);

  // Files
  const [docSignedUrls, setDocSignedUrls] = useState([]);
  const [lastDocs, setLastDocs] = useState([]);

  // --- Realtime (Socket.IO)
  const socketRef = useRef(null);
  const joinedRoomRef = useRef(null);
  const projectIdRef = useRef(null); // avoid stale closures in handlers

  // Mention autocomplete (same UX as HR/Staff)
  const textareaRef = useRef();
  const [mentionDropdown, setMentionDropdown] = useState({
    open: false,
    options: [],
    query: '',
    position: { top: 0, left: 0 }
  });

  // Build staff list for @-mentions (PM, PICs, HR - Site, Staff)
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
    const seen = new Set();
    return staff.filter(u => u._id && !seen.has(u._id) && seen.add(u._id));
  }, [project]);

  /* -------------------- Keep current project id in a ref -------------------- */
  useEffect(() => {
    const pid = project?._id ? String(project._id) : (id ? String(id) : null);
    projectIdRef.current = pid;
  }, [project?._id, id]);

  /* -------------------- Create socket & listeners (once) -------------------- */
  useEffect(() => {
    if (socketRef.current) return;

    const sock = io(SOCKET_ORIGIN, {
      path: SOCKET_PATH,
      withCredentials: true,
      transports: ['websocket'],
      auth: { userId },  // allows server to place us in user:<id> room
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
      // hook to NotificationBell / toast if desired
      console.log('[PicProject mentionNotification]', payload);
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

  /* -------- Join/leave project room when Discussions tab is active -------- */
  useEffect(() => {
    const sock = socketRef.current;
    if (!sock) return;

    const pid = project?._id || id;
    const desiredRoom = (activeTab === 'Discussions' && pid) ? `project:${pid}` : null;

    if (joinedRoomRef.current === desiredRoom) return;

    // leave previous
    if (joinedRoomRef.current && (!desiredRoom || joinedRoomRef.current !== desiredRoom)) {
      const prev = joinedRoomRef.current;
      sock.emit('leaveProject', prev);
      joinedRoomRef.current = null;
    }

    // join new
    if (desiredRoom && joinedRoomRef.current !== desiredRoom) {
      sock.emit('joinProject', desiredRoom);
      joinedRoomRef.current = desiredRoom;
    }
  }, [project?._id, id, activeTab]);

  /* -------------------- Fetch Project -------------------- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (id) {
          const { data } = await api.get(`/projects/${id}`);
          if (cancelled) return;
          setProject(data || null);
        } else {
          if (!userId) throw new Error('Missing user');
          const res = await api.get(`/projects/assigned/allroles/${userId}`);
          if (cancelled) return;
          const ongoing = (res.data || []).find(p => p.status === 'Ongoing') || (res.data || [])[0] || null;
          setProject(ongoing);
        }
      } catch {
        if (!cancelled) setProject(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, userId]);

  /* -------------------- Purchase Orders -------------------- */
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

  /* -------------------- Discussions (initial fetch on open) -------------------- */
  useEffect(() => {
    if (!project?._id || activeTab !== 'Discussions' || hasLoadedDiscussions) return;
    const controller = new AbortController();
    setLoadingMsgs(true);
    api.get(`/projects/${project._id}/discussions`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(res => setMessages(res.data || []))
      .catch(() => setMessages([]))
      .finally(() => {
        setLoadingMsgs(false);
        setHasLoadedDiscussions(true);
      });
    return () => controller.abort();
  }, [project?._id, activeTab, token, hasLoadedDiscussions]);

  useEffect(() => { setHasLoadedDiscussions(false); }, [project?._id]);

  /* -------------------- Post discussion / reply (no refetch; socket updates) -------------------- */
  const handlePostMessage = async () => {
    if (!newMessage.trim() || !project?._id) return;
    try {
      await api.post(
        `/projects/${project._id}/discussions`,
        { text: newMessage, userName },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setNewMessage('');
      setShowNewMsgInput(false);
      // The new discussion will arrive via 'project:newDiscussion'
    } catch {
      alert('Failed to post message');
    }
  };

  const handlePostReply = async (msgId) => {
    const replyText = replyInputs[msgId];
    if (!replyText?.trim() || !project?._id) return;
    try {
      await api.post(
        `/projects/${project._id}/discussions/${msgId}/reply`,
        { text: replyText, userName },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setReplyInputs(prev => ({ ...prev, [msgId]: '' }));
      // The reply will arrive via 'project:newReply'
    } catch {
      alert('Failed to post reply');
    }
  };

  // Mentions input & dropdown
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

  /* -------------------- Files: signed URLs -------------------- */
  useEffect(() => {
    let intervalId;
    async function fetchSignedUrls() {
      if (project?.documents?.length) {
        const urls = await Promise.all(
          project.documents.map(async docPath => {
            try {
              const { data } = await api.get(`/photo-signed-url?path=${encodeURIComponent(docPath)}`);
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
      // only fetch if list changed to avoid loops
      if (JSON.stringify(project?.documents || []) !== JSON.stringify(lastDocs)) {
        setLastDocs(project?.documents || []);
        fetchSignedUrls();
      }
      intervalId = setInterval(fetchSignedUrls, 270000); // 4.5 minutes
    }
    return () => clearInterval(intervalId);
  }, [activeTab, project, lastDocs]);

  // Profile menu blur
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest(".profile-menu-container")) setProfileMenuOpen(false);
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  if (loading) return <div>Loading...</div>;

  // Derived fields for Details tab
  const start = project?.startDate ? new Date(project.startDate).toLocaleDateString() : 'N/A';
  const end   = project?.endDate ? new Date(project.endDate).toLocaleDateString() : 'N/A';
  const budgetNum = Number(project?.budget || 0);
  const remaining = Math.max(budgetNum - Number(totalPO || 0), 0);
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
          <Link to="/pic" className="nav-link">Dashboard</Link>
          {project && (<Link to={`/pic/projects/${project._id}/request`} className="nav-link">Requests</Link>)}
          {project && (<Link to={`/pic/${project._id}`} className="nav-link">View Project</Link>)}
          <Link to="/pic/projects" className="nav-link">My Projects</Link>
          <Link to="/pic/chat" className="nav-link">Chat</Link>
        </nav>
        <div className="profile-menu-container" style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <NotificationBell />
          <div className="profile-circle" onClick={() => setProfileMenuOpen(!profileMenuOpen)}>
            {userName?.charAt(0).toUpperCase() || 'Z'}
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
        {/* Sidebar with Chats */}
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
          {!project ? (
            <div className="no-project-message">
              <h2>No assigned project</h2>
              <p>Your PIC account doesn’t have an active project yet.</p>
              <p>Please wait for an assignment or contact your manager.</p>
            </div>
          ) : (
            <div className="project-detail-container">
              <div className="back-button" onClick={() => navigate('/pic')} style={{ cursor: 'pointer' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24">
                  <path d="M19 12H5" stroke="currentColor" strokeWidth="2" fill="none"></path>
                  <path d="M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" fill="none"></path>
                </svg>
              </div>

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

              {/* Discussions */}
              {activeTab === 'Discussions' && (
                <div className="discussions-card">
                  {loadingMsgs ? (
                    <div style={{ textAlign: 'center', color: '#aaa' }}>Loading discussions…</div>
                  ) : messages.length === 0 && !showNewMsgInput ? (
                    <div style={{ textAlign: 'center', color: '#bbb', padding: 40 }}>Start a conversation</div>
                  ) : (
                    messages.map(msg => {
                      const ts = msg?.timestamp ? new Date(msg.timestamp).toLocaleString() : '';
                      return (
                        <div key={msg._id} className="discussion-msg">
                          <div className="discussion-user">
                            <div className="discussion-avatar">{msg.userName?.charAt(0) ?? '?'}</div>
                            <div className="discussion-user-info">
                              <span className="discussion-user-name">{msg.userName || 'Unknown'}</span>
                              <span className="discussion-timestamp">{ts}</span>
                            </div>
                          </div>

                          <div className="discussion-text">{renderMessageText(msg.text)}</div>

                          {/* Replies */}
                          <div className="discussion-replies">
                            {msg.replies?.map(reply => {
                              const rts = reply?.timestamp ? new Date(reply.timestamp).toLocaleString() : '';
                              return (
                                <div key={reply._id} className="discussion-reply">
                                  <div className="reply-avatar">{reply.userName?.charAt(0) ?? '?'}</div>
                                  <div className="reply-info">
                                    <span className="reply-name">{reply.userName || 'Unknown'}</span>
                                    <span className="reply-timestamp">{rts}</span>
                                    <span className="reply-text">{reply.text}</span>
                                  </div>
                                </div>
                              );
                            })}

                            {/* Reply input */}
                            <div className="reply-input-row">
                              <input
                                type="text"
                                value={replyInputs[msg._id] || ''}
                                onChange={e => setReplyInputs(prev => ({ ...prev, [msg._id]: e.target.value }))}
                                placeholder="Reply... (you can @Name)"
                              />
                              <button onClick={() => handlePostReply(msg._id)}>Reply</button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}

                  {/* Floating add discussion button */}
                  <button className="discussion-plus-btn" onClick={() => setShowNewMsgInput(v => !v)} title="Start a new conversation">
                    <FaPlus />
                  </button>

                  {/* New message input modal/box with @-mentions */}
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

              {/* Details */}
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

              {/* Files */}
              {activeTab === 'Files' && (
                <div className="project-files-list">
                  {project?.documents && project.documents.length > 0 ? (
                    <ul>
                      {project.documents.map((docPath, idx) => {
                        const fileName = docPath.split('/').pop();
                        const url = docSignedUrls[idx];
                        return (
                          <li key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <FaRegFileAlt />
                            <span style={{ flex: 1 }}>{fileName}</span>
                            {url ? (
                              <a href={url} download={fileName} target="_blank" rel="noopener noreferrer">
                                View
                              </a>
                            ) : (
                              <span style={{ color: '#aaa' }}>Loading link…</span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <div style={{ color: '#888', fontSize: 16 }}>No documents uploaded for this project.</div>
                  )}
                </div>
              )}

              {/* Reports */}
              {activeTab === 'Reports' && (
                <div className="project-reports-placeholder">
                  <h3 style={{ marginBottom: 12 }}>Project Reports</h3>
                  <div style={{ color: '#888' }}>No reports are currently available.</div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </>
  );
};

export default PicProject;
