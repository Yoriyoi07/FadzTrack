// src/components/staff/StaffCurrentProject.jsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api/axiosInstance';
import NotificationBell from '../NotificationBell';
import { FaRegCommentDots, FaRegFileAlt, FaRegListAlt, FaPlus } from 'react-icons/fa';
import '../style/pic_style/Pic_Project.css';
import { io } from 'socket.io-client';

// Use your API URL; keep websocket transport
const SOCKET_URL =
  (process.env.REACT_APP_API_URL?.replace(/\/+$/, '') || 'http://localhost:5000');

const chats = [
  { id: 1, name: 'Rychea Miralles', initial: 'R', message: 'Hello Good Morning po! As...', color: '#4A6AA5' },
  { id: 2, name: 'Third Castellar', initial: 'T', message: 'Hello Good Morning po! As...', color: '#2E7D32' },
  { id: 3, name: 'Zenarose Miranda', initial: 'Z', message: 'Hello Good Morning po! As...', color: '#9C27B0' }
];

function fmt(ts) {
  if (!ts) return '';
  try { return new Date(ts).toLocaleString(); } catch { return ''; }
}

const StaffCurrentProject = () => {
  const navigate = useNavigate();

  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Details');

  // PO totals for budget math
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [totalPO, setTotalPO] = useState(0);

  const storedUser = localStorage.getItem('user');
  const user = storedUser ? JSON.parse(storedUser) : null;
  const [userName] = useState(user?.name || '');
  const token = localStorage.getItem('token');

  // Discussions
  const [messages, setMessages] = useState([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [hasLoadedDiscussions, setHasLoadedDiscussions] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [replyInputs, setReplyInputs] = useState({});
  const [showNewMsgInput, setShowNewMsgInput] = useState(false);
  const textareaRef = useRef();

  // Files
  const [docSignedUrls, setDocSignedUrls] = useState([]);
  const [lastDocs, setLastDocs] = useState([]);

  // Socket
  const socketRef = useRef(null);

  // Mention list (PM + PICs) — unchanged
  const staffList = useMemo(() => {
    if (!project) return [];
    let staff = [];
    if (project.projectmanager && typeof project.projectmanager === 'object') {
      staff.push({ _id: project.projectmanager._id, name: project.projectmanager.name });
    }
    if (Array.isArray(project.pic)) {
      staff = staff.concat(project.pic.map(p => ({ _id: p._id, name: p.name })));
    }
    const seen = new Set();
    return staff.filter(u => u._id && !seen.has(u._id) && seen.add(u._id));
  }, [project]);

  // Fetch user's current ongoing project (any role)
  useEffect(() => {
    if (!user?._id) return;
    api.get(`/projects/assigned/allroles/${user._id}`)
      .then(res => {
        const ongoing = res.data.find(p => p.status === 'Ongoing');
        setProject(ongoing || null);
        setLoading(false);
      })
      .catch(() => {
        setProject(null);
        setLoading(false);
      });
  }, [user]);

  // Reset discussions-loaded guard when the project changes
  useEffect(() => {
    setHasLoadedDiscussions(false);
  }, [project?._id]);

  // Socket setup & room join per project
  useEffect(() => {
    if (!project?._id) return;

    if (!socketRef.current) {
      socketRef.current = io(SOCKET_URL, {
        transports: ['websocket'],
        withCredentials: true
      });
    }
    const sock = socketRef.current;
    const room = `project:${project._id}`;

    sock.emit('joinProject', room);

    const onNewDiscussion = (payload) => {
      if (payload?.projectId !== project._id) return;
      const msg = payload.message || {};
      // Ensure timestamp exists
      const withTs = { ...msg, timestamp: msg.timestamp || Date.now() };
      setMessages(prev => [withTs, ...prev]);
    };

    const onNewReply = (payload) => {
      if (payload?.projectId !== project._id) return;
      const rep = payload.reply || {};
      const withTs = { ...rep, timestamp: rep.timestamp || Date.now() };
      setMessages(prev => {
        const clone = prev.map(m => ({ ...m, replies: [...(m.replies || [])] }));
        const idx = clone.findIndex(m => m._id === payload.msgId);
        if (idx !== -1) clone[idx].replies.push(withTs);
        return clone;
      });
    };

    sock.on('project:newDiscussion', onNewDiscussion);
    sock.on('project:newReply', onNewReply);

    return () => {
      sock.off('project:newDiscussion', onNewDiscussion);
      sock.off('project:newReply', onNewReply);
      sock.emit('leaveProject', room);
    };
  }, [project?._id]);

  // Fetch POs for budget math once we have the project
  useEffect(() => {
    if (!project?._id) return;
    api.get('/requests')
      .then(res => {
        const approvedPOs = res.data.filter(
          req => req.project?._id === project._id && req.status === 'Approved' && req.totalValue
        );
        setPurchaseOrders(approvedPOs);
        const total = approvedPOs.reduce((sum, req) => sum + (Number(req.totalValue) || 0), 0);
        setTotalPO(total);
      })
      .catch(() => {
        setPurchaseOrders([]);
        setTotalPO(0);
      });
  }, [project]);

  // Discussions fetch (guarded)
  useEffect(() => {
    if (!project?._id || activeTab !== 'Discussions' || hasLoadedDiscussions) return;

    let cancelled = false;
    setLoadingMsgs(true);

    api.get(`/projects/${project._id}/discussions`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => {
        if (!cancelled) {
          // Ensure every doc has a .timestamp (fallback to createdAt or now)
          const list = (res.data || []).map(m => ({
            ...m,
            timestamp: m.timestamp || m.createdAt || Date.now(),
            replies: (m.replies || []).map(r => ({
              ...r,
              timestamp: r.timestamp || r.createdAt || Date.now()
            }))
          }));
          setMessages(list);
        }
      })
      .catch(() => { if (!cancelled) setMessages([]); })
      .finally(() => {
        if (!cancelled) {
          setLoadingMsgs(false);
          setHasLoadedDiscussions(true);
        }
      });

    return () => { cancelled = true; };
  }, [project?._id, activeTab, token, hasLoadedDiscussions]);

  // Signed URLs (guarded) for private docs
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
          } catch {
            return null;
          }
        })
      ).then(setDocSignedUrls);
    }
  }, [activeTab, project, lastDocs]);

  // Discussions actions
  const handlePostMessage = async () => {
    if (!newMessage.trim()) return;
    await api.post(
      `/projects/${project._id}/discussions`,
      { text: newMessage, userName },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    setNewMessage('');
    setShowNewMsgInput(false);
    // socket will push; fallback if socket missing:
    if (!socketRef.current) {
      const { data } = await api.get(`/projects/${project._id}/discussions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessages(data || []);
    }
  };

  const handlePostReply = async (msgId) => {
    const replyText = replyInputs[msgId];
    if (!replyText?.trim()) return;
    await api.post(
      `/projects/${project._id}/discussions/${msgId}/reply`,
      { text: replyText, userName },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    setReplyInputs({ ...replyInputs, [msgId]: '' });
    if (!socketRef.current) {
      const { data } = await api.get(`/projects/${project._id}/discussions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessages(data || []);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.profile-menu-container')) {
        setProfileMenuOpen(false);
      }
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

  // Helpers
  const start = project?.startDate ? new Date(project.startDate).toLocaleDateString() : 'N/A';
  const end = project?.endDate ? new Date(project.endDate).toLocaleDateString() : 'N/A';
  const budgetNum = Number(project?.budget || 0);
  const remaining = Math.max(budgetNum - Number(totalPO || 0), 0);
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
              {/* Project photo */}
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
                      messages.map(msg => (
                        <div key={msg._id} className="discussion-msg">
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                            <div style={{ fontWeight: 600 }}>{msg.userName}</div>
                            <small style={{ color: '#999' }}>{fmt(msg.timestamp)}</small>
                          </div>

                          <div style={{ margin: '6px 0 10px' }}>{msg.text}</div>

                          {msg.replies?.map(reply => (
                            <div
                              key={reply._id}
                              style={{ marginLeft: 16, paddingLeft: 10, borderLeft: '2px solid #eee', marginBottom: 8 }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                                <b>{reply.userName}</b>
                                <small style={{ color: '#999' }}>{fmt(reply.timestamp)}</small>
                              </div>
                              <div>{reply.text}</div>
                            </div>
                          ))}

                          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                            <input
                              className="reply-input"
                              value={replyInputs[msg._id] || ''}
                              onChange={e => setReplyInputs({ ...replyInputs, [msg._id]: e.target.value })}
                              placeholder="Reply…"
                            />
                            <button onClick={() => handlePostReply(msg._id)}>Reply</button>
                          </div>
                        </div>
                      ))
                    )
                  )}

                  <button
                    className="discussion-plus-btn"
                    onClick={() => setShowNewMsgInput(true)}
                    title="Start a new conversation"
                  >
                    <FaPlus />
                  </button>

                  {showNewMsgInput && (
                    <div className="new-msg-modal" onClick={() => setShowNewMsgInput(false)}>
                      <div className="new-msg-box" onClick={e => e.stopPropagation()}>
                        <h3 style={{ margin: 0, marginBottom: 16 }}>Start a new conversation</h3>
                        <textarea
                          value={newMessage}
                          onChange={e => setNewMessage(e.target.value)}
                          ref={textareaRef}
                          placeholder="Type your message..."
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
                        {project.location?.name
                          ? `${project.location.name}${project.location?.region ? ` (${project.location.region})` : ''}`
                          : 'N/A'}
                      </p>

                      <div className="detail-group">
                        <p className="detail-label">Project Manager:</p>
                        <p className="detail-value">{project.projectmanager?.name || 'N/A'}</p>
                      </div>

                      <div className="detail-group">
                        <p className="detail-label">Contractor:</p>
                        <p className="detail-value">{project.contractor || 'N/A'}</p>
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
                          {Array.isArray(project.pic) && project.pic.length > 0
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
                    <p className="manpower-list">
                      {Array.isArray(project.manpower) && project.manpower.length > 0
                        ? project.manpower.map(mp => `${mp.name} (${mp.position})`).join(', ')
                        : 'No Manpower Assigned'}
                    </p>
                  </div>

                  <p><b>Status:</b> {project.status || 'N/A'}</p>
                </div>
              )}

              {/* Files */}
              {activeTab === 'Files' && (
                <div className="project-files-list">
                  {project.documents && project.documents.length > 0 ? (
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
