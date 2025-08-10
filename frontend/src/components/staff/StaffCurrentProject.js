import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import api from '../../api/axiosInstance';
import NotificationBell from '../NotificationBell';
import { FaRegCommentDots, FaRegFileAlt, FaRegListAlt, FaPlus } from 'react-icons/fa';
import "../style/pic_style/Pic_Project.css";

/** ---- Socket endpoint setup ----
 * REACT_APP_API_URL is usually like https://api.example.com or http://localhost:5000
 * We want to connect to the ORIGIN (no trailing /api).
 */
const RAW = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
const SOCKET_ORIGIN = RAW.replace(/\/api$/, ''); // strip trailing /api if present
const SOCKET_PATH = '/socket.io'; // must match server

const chats = [
  { id: 1, name: 'Rychea Miralles', initial: 'R', message: 'Hello Good Morning po! As...', color: '#4A6AA5' },
  { id: 2, name: 'Third Castellar', initial: 'T', message: 'Hello Good Morning po! As...', color: '#2E7D32' },
  { id: 3, name: 'Zenarose Miranda', initial: 'Z', message: 'Hello Good Morning po! As...', color: '#9C27B0' }
];

// simple client-side highlight
const highlightMentions = (text = '') =>
  text.replace(/\B@([a-zA-Z0-9._-]+)/g, '<span class="mention">@$1</span>');

const StaffCurrentProject = () => {
  const navigate = useNavigate();

  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Details');

  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [totalPO, setTotalPO] = useState(0);

  // 🔒 Freeze user once to avoid new object each render
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

  // Socket refs
  const socketRef = useRef(null);
  const joinedRoomRef = useRef(null);
  const projectIdRef = useRef(null); // prevents stale closures in socket handlers

  // keep ref in sync with current project id
  useEffect(() => {
    projectIdRef.current = project?._id ? String(project._id) : null;
  }, [project?._id]);

  // Create socket once; keep listeners once
  useEffect(() => {
    if (socketRef.current) return;

    const sock = io(SOCKET_ORIGIN, {
      path: SOCKET_PATH,
      withCredentials: true,
      transports: ['websocket'], // reduce polling flicker behind proxies
      auth: { userId },          // 👈 lets server put us in user:{id} room
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
      // TODO: integrate with your NotificationBell / toast
      // Example: toast(`${payload.fromUserName} mentioned you`);
      console.log('🔔 mentionNotification:', payload);
    };

    sock.on('connect', onConnect);
    sock.on('project:newDiscussion', onNewDiscussion);
    sock.on('project:newReply', onNewReply);
    sock.on('mentionNotification', onMention);

    // Optional debug
    // sock.on('connect_error', (e) => console.log('[socket] connect_error:', e?.message || e));
    // sock.on('disconnect', (r) => console.log('[socket] disconnect:', r));

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

  // Stable primitives
  const projectId = project?._id || null;

  // Compute desired room string from primitives (stable)
  const desiredRoom = useMemo(() => {
    if (!projectId) return null;
    if (activeTab !== 'Discussions') return null;
    return `project:${projectId}`;
  }, [projectId, activeTab]);

  // Join/leave only when desiredRoom **changes**
  useEffect(() => {
    const sock = socketRef.current;
    if (!sock) return;

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
  }, [desiredRoom]);

  // Fetch current project — depend on userId only
  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await api.get(`/projects/assigned/allroles/${userId}`);
        if (cancelled) return;
        const ongoing = res.data?.find(p => p.status === 'Ongoing');
        setProject(ongoing || null);
      } catch {
        if (!cancelled) setProject(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [userId]);

  // Budget PO math — depend only on projectId
  useEffect(() => {
    if (!projectId) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await api.get('/requests');
        if (cancelled) return;
        const approved = (res.data || []).filter(r =>
          r.project?._id === projectId && r.status === 'Approved' && r.totalValue
        );
        setPurchaseOrders(approved);
        setTotalPO(approved.reduce((s, r) => s + (Number(r.totalValue) || 0), 0));
      } catch {
        if (!cancelled) { setPurchaseOrders([]); setTotalPO(0); }
      }
    })();

    return () => { cancelled = true; };
  }, [projectId]);

  // Initial discussions fetch (once per project when opening tab)
  useEffect(() => {
    if (!projectId || activeTab !== 'Discussions' || hasLoadedDiscussions) return;

    const controller = new AbortController();
    setLoadingMsgs(true);

    api.get(`/projects/${projectId}/discussions`, {
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
  }, [projectId, activeTab, token, hasLoadedDiscussions]);

  // Reset guard if project changes
  useEffect(() => { setHasLoadedDiscussions(false); }, [projectId]);

  // Files – fetch signed URLs only when tab open & list changed
  useEffect(() => {
    if (
      activeTab === 'Files' &&
      project?.documents?.length &&
      JSON.stringify(project.documents) !== JSON.stringify(lastDocs)
    ) {
      setLastDocs(project.documents);
      Promise.all(
        project.documents.map(async docPath => {
          try {
            const { data } = await api.get(`/photo-signed-url?path=${encodeURIComponent(docPath)}`);
            return data.signedUrl;
          } catch { return null; }
        })
      ).then(setDocSignedUrls);
    }
  }, [activeTab, project, lastDocs]);

  // Post discussion
  const handlePostMessage = async () => {
    if (!newMessage.trim()) return;
    await api.post(
      `/projects/${projectId}/discussions`,
      { text: newMessage, userName },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    setNewMessage('');
    setShowNewMsgInput(false);
    // socket event will inject it
  };

  // Post reply
  const handlePostReply = async (msgId) => {
    const replyText = replyInputs[msgId];
    if (!replyText?.trim()) return;
    await api.post(
      `/projects/${projectId}/discussions/${msgId}/reply`,
      { text: replyText, userName },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    setReplyInputs(prev => ({ ...prev, [msgId]: '' }));
  };

  // Profile menu blur
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

  // Helpers
  const start = project?.startDate ? new Date(project.startDate).toLocaleDateString() : 'N/A';
  const end = project?.endDate ? new Date(project.endDate).toLocaleDateString() : 'N/A';
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

  const showSpinner = loadingMsgs && messages.length === 0;

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
            {userName?.charAt(0).toUpperCase() || 'Z'}
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
        {/* SIDEBAR CHATS */}
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
              <p>Your account doesn’t have an active project yet.</p>
              <p>Please wait for an assignment or contact your manager.</p>
            </div>
          ) : (
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

              {/* Discussions */}
              {activeTab === 'Discussions' && (
                <div className="discussions-card">
                  {showSpinner ? (
                    <div>Loading…</div>
                  ) : (
                    messages.length === 0 && !showNewMsgInput ? (
                      <div style={{ textAlign: 'center', color: '#bbb', padding: 40 }}>Start a conversation</div>
                    ) : (
                      messages.map(msg => {
                        const ts = msg?.timestamp ? new Date(msg.timestamp).toLocaleString() : '';
                        return (
                          <div key={msg._id} className="discussion-msg">
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                              <div style={{ fontWeight: 600 }}>{msg.userName}</div>
                              {ts && <div style={{ color: '#888', fontSize: 12 }}>{ts}</div>}
                            </div>
                            <div
                              className="message-text"
                              dangerouslySetInnerHTML={{ __html: highlightMentions(msg.text) }}
                            />
                            {msg.replies?.map(reply => {
                              const rts = reply?.timestamp ? new Date(reply.timestamp).toLocaleString() : '';
                              return (
                                <div key={reply._id} style={{ marginLeft: 16, paddingLeft: 10, borderLeft: '2px solid #eee' }}>
                                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                                    <b>{reply.userName}:</b>
                                    {rts && <span style={{ color: '#888', fontSize: 12 }}>{rts}</span>}
                                  </div>
                                  <div
                                    className="message-text"
                                    dangerouslySetInnerHTML={{ __html: highlightMentions(reply.text) }}
                                  />
                                </div>
                              );
                            })}
                            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                              <input
                                className="reply-input"
                                value={replyInputs[msg._id] || ''}
                                onChange={e => setReplyInputs(prev => ({ ...prev, [msg._id]: e.target.value }))}
                                placeholder="Reply… (you can @john or @all)"
                              />
                              <button onClick={() => handlePostReply(msg._id)}>Reply</button>
                            </div>
                          </div>
                        );
                      })
                    )
                  )}
                  <button className="discussion-plus-btn" onClick={() => setShowNewMsgInput(true)} title="Start a new conversation">
                    <FaPlus />
                  </button>
                  {showNewMsgInput && (
                    <div className="new-msg-modal" onClick={() => setShowNewMsgInput(false)}>
                      <div className="new-msg-box" onClick={e => e.stopPropagation()}>
                        <h3 style={{ margin: 0, marginBottom: 16 }}>Start a new conversation</h3>
                        <textarea
                          value={newMessage}
                          onChange={e => setNewMessage(e.target.value)}
                          placeholder="Type your message... (you can @john or @all)"
                        />
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

export default StaffCurrentProject;
