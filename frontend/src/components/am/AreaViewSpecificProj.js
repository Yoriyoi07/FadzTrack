import React, { useState, useEffect, useRef, useMemo } from 'react';
import "../style/ceo_style/Ceo_ViewSpecific.css";
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../../api/axiosInstance'; 
import NotificationBell from '../NotificationBell';
import { FaRegCommentDots, FaRegFileAlt, FaRegListAlt, FaPlus } from 'react-icons/fa';
import { io } from 'socket.io-client';

const RAW = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
const SOCKET_ORIGIN = RAW.replace(/\/api$/, ''); // strip trailing /api if present
const SOCKET_PATH = '/socket.io';

const AreaViewSpecificProj = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const stored = localStorage.getItem('user');
  const user = stored ? JSON.parse(stored) : null;
  const userId = user?._id;
  const [userName] = useState(user?.name || 'ALECK');
  const token = localStorage.getItem('token');

  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [project, setProject] = useState(null);
  const [activeTab, setActiveTab] = useState('Details');
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [toggleLoading, setToggleLoading] = useState(false);

  // Discussions
  const [messages, setMessages] = useState([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [replyInputs, setReplyInputs] = useState({});
  const [showNewMsgInput, setShowNewMsgInput] = useState(false);
  const textareaRef = useRef();

  // Files
  const [docSignedUrls, setDocSignedUrls] = useState([]);

  // ---- SOCKET REFS (for realtime) ----
  const socketRef = useRef(null);
  const joinedRoomRef = useRef(null);
  const projectIdRef = useRef(null);

  useEffect(() => {
    projectIdRef.current = id ? String(id) : null;
  }, [id]);

  // Connect socket once
  useEffect(() => {
    if (socketRef.current) return;

    const sock = io(SOCKET_ORIGIN, {
      path: SOCKET_PATH,
      withCredentials: true,
      transports: ['websocket'],
      auth: { userId }, // lets server also put us in user:<id> room
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
        const next = prev.map(m => ({ ...m, replies: [...(m.replies || [])] }));
        const idx = next.findIndex(m => String(m._id) === String(payload.msgId));
        if (idx !== -1) next[idx].replies.push(payload.reply);
        return next;
      });
    };

    sock.on('connect', onConnect);
    sock.on('project:newDiscussion', onNewDiscussion);
    sock.on('project:newReply', onNewReply);

    return () => {
      sock.off('connect', onConnect);
      sock.off('project:newDiscussion', onNewDiscussion);
      sock.off('project:newReply', onNewReply);
      sock.disconnect();
      socketRef.current = null;
      joinedRoomRef.current = null;
    };
  }, [userId]);

  // Join/leave project room only on Discussions tab
  useEffect(() => {
    const sock = socketRef.current;
    if (!sock) return;
    const desiredRoom = activeTab === 'Discussions' && id ? `project:${id}` : null;

    if (joinedRoomRef.current === desiredRoom) return;

    if (joinedRoomRef.current && (!desiredRoom || joinedRoomRef.current !== desiredRoom)) {
      sock.emit('leaveProject', joinedRoomRef.current);
      joinedRoomRef.current = null;
    }
    if (desiredRoom && joinedRoomRef.current !== desiredRoom) {
      sock.emit('joinProject', desiredRoom);
      joinedRoomRef.current = desiredRoom;
    }
  }, [id, activeTab]);

  // Staff list for mention autocomplete
  const staffList = useMemo(() => {
    if (!project) return [];
    let staff = [];
    if (project.projectmanager && typeof project.projectmanager === 'object') {
      staff.push({ _id: project.projectmanager._id, name: project.projectmanager.name });
    }
    if (Array.isArray(project.pic)) {
      staff = staff.concat(project.pic.map(p => ({ _id: p._id, name: p.name })));
    }
    // Remove duplicates by _id
    const seen = new Set();
    return staff.filter(u => u._id && !seen.has(u._id) && seen.add(u._id));
  }, [project]);

  // Mention autocomplete
  const [mentionDropdown, setMentionDropdown] = useState({ open: false, options: [], query: '', position: { top: 0, left: 0 } });

  // Fetch project
  useEffect(() => {
    const fetchProject = async () => {
      try {
        const { data } = await api.get(`/projects/${id}`);
        setProject(data);
        setStatus(data.status);
        // Fetch progress for status toggle
        api.get(`/daily-reports/project/${id}/progress`).then(progressRes => {
          const completed = progressRes.data.progress.find(p => p.name === 'Completed');
          setProgress(completed ? completed.value : 0);
        });
      } catch (err) {
        setProject(null);
      }
    };
    fetchProject();
  }, [id]);

  // Fetch discussions (initial + when tab opens)
  useEffect(() => {
    if (!id || activeTab !== 'Discussions') return;
    const fetchMessages = async () => {
      setLoadingMsgs(true);
      try {
        const { data } = await api.get(`/projects/${id}/discussions`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setMessages(data || []);
      } catch {
        setMessages([]);
      }
      setLoadingMsgs(false);
    };
    fetchMessages();
  }, [id, activeTab, token]);

  // Fetch signed URLs for documents (private bucket)
  useEffect(() => {
    async function fetchSignedUrls() {
      if (project?.documents?.length) {
        const promises = project.documents.map(async docPath => {
          try {
            const { data } = await api.get(`/photo-signed-url?path=${encodeURIComponent(docPath)}`);
            return data.signedUrl;
          } catch {
            return null;
          }
        });
        const urls = await Promise.all(promises);
        setDocSignedUrls(urls);
      } else {
        setDocSignedUrls([]);
      }
    }
    fetchSignedUrls();
  }, [project]);

  // Auto-refresh signed URLs on Files tab
  useEffect(() => {
    let intervalId;
    if (activeTab === 'Files' && project?.documents?.length) {
      const fetchSignedUrls = async () => {
        const promises = project.documents.map(async docPath => {
          try {
            const { data } = await api.get(`/photo-signed-url?path=${encodeURIComponent(docPath)}`);
            return data.signedUrl;
          } catch {
            return null;
          }
        });
        const urls = await Promise.all(promises);
        setDocSignedUrls(urls);
      };
      fetchSignedUrls();
      intervalId = setInterval(fetchSignedUrls, 270000); // 4.5 minutes
      return () => clearInterval(intervalId);
    }
    return () => clearInterval(intervalId);
  }, [activeTab, project]);

  // Mention logic
  const handleTextareaInput = (e) => {
    const value = e.target.value;
    setNewMessage(value);
    const caret = e.target.selectionStart;
    theTextUpToCaret:
    {
      const textUpToCaret = value.slice(0, caret);
      const match = /(^|\s)@(\w*)$/.exec(textUpToCaret);
      if (match) {
        const query = match[2].toLowerCase();
        const options = staffList.filter(u => u.name.toLowerCase().includes(query));
        const rect = e.target.getBoundingClientRect();
        setMentionDropdown({
          open: true,
          options,
          query,
          position: { top: rect.top + e.target.offsetHeight, left: rect.left + 10 }
        });
        break theTextUpToCaret;
      }
      setMentionDropdown({ open: false, options: [], query: '', position: { top: 0, left: 0 } });
    }
  };

  const handleMentionSelect = (user) => {
    if (!textareaRef.current) return;
    const value = newMessage;
    const caret = textareaRef.current.selectionStart;
    const textUpToCaret = value.slice(0, caret);
    const match = /(^|\s)@(\w*)$/.exec(textUpToCaret);
    if (!match) return;
    const before = value.slice(0, match.index + match[1].length);
    const after = value.slice(caret);
    const mentionText = `@${user.name} `;
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

  function renderMessageText(text) {
    const parts = text.split(/(@[\w\s]+)/g);
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        return <span key={i} style={{ color: '#1976d2', fontWeight: 600 }}>{part}</span>;
      }
      return part;
    });
  }

  // Post new message (discussion) — rely on socket event to append
  const handlePostMessage = async () => {
    if (!newMessage.trim()) return;
    try {
      await api.post(`/projects/${id}/discussions`, {
        text: newMessage,
        userName: userName
      }, { headers: { Authorization: `Bearer ${token}` } });
      setNewMessage('');
      setShowNewMsgInput(false);
      // socket 'project:newDiscussion' will insert it
    } catch (err) {
      alert("Failed to post message");
    }
  };

  // Post reply to a message — rely on socket event to append
  const handlePostReply = async (msgId) => {
    const replyText = replyInputs[msgId];
    if (!replyText || !replyText.trim()) return;
    try {
      await api.post(`/projects/${id}/discussions/${msgId}/reply`, {
        text: replyText,
        userName: userName
      }, { headers: { Authorization: `Bearer ${token}` } });
      setReplyInputs(prev => ({ ...prev, [msgId]: '' }));
      // socket 'project:newReply' will insert it
    } catch (err) {
      alert("Failed to post reply");
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest(".profile-menu-container")) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  if (!project) return <div>Loading...</div>;

  return (
    <div>
      {/* Header */}
      <header className="header">
        <div className="logo-container">
          <img src={require('../../assets/images/FadzLogo1.png')} alt="FadzTrack Logo" className="logo-img" />
          <h1 className="brand-name">FadzTrack</h1>
        </div>
        <nav className="nav-menu">
          <Link to="/am" className="nav-link">Dashboard</Link>
          <Link to="/am/chat" className="nav-link">Chat</Link>
          <Link to="/am/matreq" className="nav-link">Material</Link>
          <Link to="/am/manpower-requests" className="nav-link">Manpower</Link>
          <Link to="/am/viewproj" className="nav-link">Projects</Link>
          <Link to="/logs" className="nav-link">Logs</Link>
          <Link to="/reports" className="nav-link">Reports</Link>
        </nav>
        <div className="profile-menu-container" style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <NotificationBell />
          <div className="profile-circle" onClick={() => setProfileMenuOpen(!profileMenuOpen)}>
            {userName ? userName.charAt(0).toUpperCase() : 'Z'}
          </div>
          {profileMenuOpen && (
            <div className="profile-menu">
              <button onClick={handleLogout}>Logout</button>
            </div>
          )}
        </div>
      </header>

      <main className="main">
        <div className="project-detail-container">
          <div className="back-button" onClick={() => navigate('/am/viewproj')} style={{ cursor: 'pointer' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24">
              <path d="M19 12H5"></path>
              <path d="M12 19l-7-7 7-7"></path>
            </svg>
          </div>
          <div className="project-image-container">
            <img
              src={project.photos && project.photos.length > 0 ? project.photos[0] : 'https://placehold.co/400x250?text=No+Photo'}
              alt={project.projectName}
              className="responsive-photo"
            />
            {progress === 100 && (
              <button
                onClick={async () => {
                  setToggleLoading(true);
                  try {
                    const res = await api.patch(`/projects/${project._id}/toggle-status`);
                    setStatus(res.data.status);
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

          {/* Tabs */}
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

            {/* New Reports tab */}
            <button
              className={`tab-btn${activeTab === 'Reports' ? ' active' : ''}`}
              onClick={() => setActiveTab('Reports')}
              type="button"
            >
              <FaRegFileAlt /> Reports
            </button>
          </div>

          {/* Tab Content */}
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
                          <span className="discussion-timestamp">{msg.timestamp ? new Date(msg.timestamp).toLocaleString() : ''}</span>
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
                              <span className="reply-timestamp">{reply.timestamp ? new Date(reply.timestamp).toLocaleString() : ''}</span>
                              <span className="reply-text">{reply.text}</span>
                            </div>
                          </div>
                        ))}
                        <div className="reply-input-row">
                          <input
                            type="text"
                            value={replyInputs[msg._id] || ''}
                            onChange={e => setReplyInputs({ ...replyInputs, [msg._id]: e.target.value })}
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
              {/* New message input modal/box */}
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
                        style={{
                          top: mentionDropdown.position.top,
                          left: mentionDropdown.position.left
                        }}
                      >
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
                    <div className="new-msg-actions">
                      <button className="cancel-btn" onClick={() => setShowNewMsgInput(false)}>Cancel</button>
                      <button className="post-btn" onClick={handlePostMessage}>Post</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'Details' && (
            <div>
              <div className="project-details-grid">
                <div className="details-column">
                  <p className="detail-item">
                    <span className="detail-label">Location:</span>
                    {project.location?.name
                      ? `${project.location.name} (${project.location.region})`
                      : 'No Location'}
                  </p>
                  <div className="detail-group">
                    <p className="detail-label">Project Manager:</p>
                    <p className="detail-value">{project.projectmanager?.name || "N/A"}</p>
                  </div>
                  <div className="detail-group">
                    <p className="detail-label">Contractor:</p>
                    <p className="detail-value">{project.contractor}</p>
                  </div>
                  <div className="detail-group">
                    <p className="detail-label">Target Date:</p>
                    <p className="detail-value">
                      {project.startDate && project.endDate
                        ? `${new Date(project.startDate).toLocaleDateString()} to ${new Date(project.endDate).toLocaleDateString()}`
                        : "N/A"}
                    </p>
                  </div>
                </div>
                <div className="details-column">
                  <div className="budget-container">
                    <p className="budget-amount">{project.budget?.toLocaleString()}</p>
                    <p className="budget-label">Estimated Budget</p>
                  </div>
                  <div className="detail-group">
                    <p className="detail-label">PIC:</p>
                    <p className="detail-value">{project.pic && project.pic.length > 0
                      ? project.pic.map(p => p.name).join(', ')
                      : 'N/A'}</p>
                  </div>
                </div>
              </div>
              <div className="manpower-section">
                <p className="detail-label">Manpower:</p>
                <p className="manpower-list">
                  {Array.isArray(project.manpower) && project.manpower.length > 0
                    ? project.manpower.map(mp => `${mp.name} (${mp.position})`).join(', ')
                    : 'No Manpower Assigned'}
                </p>
              </div>
              <p>
                <b>Status:</b> {status}
              </p>
            </div>
          )}

          {activeTab === 'Files' && (
            <div className="project-files-list">
              {project.documents && project.documents.length > 0 ? (
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
  );
};

export default AreaViewSpecificProj;
