import React, { useState, useEffect, useRef, useMemo } from 'react';
import "../style/ceo_style/Ceo_ViewSpecific.css";
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../../api/axiosInstance'; 

const HrViewSpecific = () => {
  const stored = localStorage.getItem('user');
  const user = stored ? JSON.parse(stored) : null;
  const userName = user?.name || 'HR';
  const token = localStorage.getItem('token');

  const { id } = useParams();
  const navigate = useNavigate();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [project, setProject] = useState(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [toggleLoading, setToggleLoading] = useState(false);

  // Tabs
  const [activeTab, setActiveTab] = useState('Details');

  // Files
  const [docSignedUrls, setDocSignedUrls] = useState([]);

  // Discussions
  const [messages, setMessages] = useState([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [replyInputs, setReplyInputs] = useState({});
  const [showNewMsgInput, setShowNewMsgInput] = useState(false);
  const textareaRef = useRef();

  // Staff list for @mention
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

  // Mention dropdown
  const [mentionDropdown, setMentionDropdown] = useState({ open: false, options: [], query: '', position: { top: 0, left: 0 } });

  useEffect(() => {
    const fetchProject = async () => {
      try {
        const { data } = await api.get(`/projects/${id}`);
        setProject(data);
        setStatus(data.status);

        // Progress
        api.get(`/daily-reports/project/${id}/progress`).then(progressRes => {
          const completed = progressRes.data.progress.find(p => p.name === 'Completed');
          setProgress(completed ? completed.value : 0);
        });
      } catch (err) {
        console.error("Failed to fetch project:", err);
      }
    };
    fetchProject();
  }, [id]);

  // Fetch discussions
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

  // Fetch files signed URLs
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

  // Profile menu click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest(".profile-menu-container")) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  // Handle @mention input
  const handleTextareaInput = (e) => {
    const value = e.target.value;
    setNewMessage(value);
    const caret = e.target.selectionStart;
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
    } else {
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

  const renderMessageText = (text) => {
    const parts = text.split(/(@[\w\s]+)/g);
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        return <span key={i} style={{ color: '#1976d2', fontWeight: 600 }}>{part}</span>;
      }
      return part;
    });
  };

  const handlePostMessage = async () => {
    if (!newMessage.trim()) return;
    try {
      await api.post(`/projects/${id}/discussions`, {
        text: newMessage,
        userName
      }, { headers: { Authorization: `Bearer ${token}` } });
      setNewMessage('');
      setShowNewMsgInput(false);
      const { data } = await api.get(`/projects/${id}/discussions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessages(data || []);
    } catch (err) {
      alert("Failed to post message");
    }
  };

  const handlePostReply = async (msgId) => {
    const replyText = replyInputs[msgId];
    if (!replyText || !replyText.trim()) return;
    try {
      await api.post(`/projects/${id}/discussions/${msgId}/reply`, {
        text: replyText,
        userName
      }, { headers: { Authorization: `Bearer ${token}` } });
      setReplyInputs({ ...replyInputs, [msgId]: '' });
      const { data } = await api.get(`/projects/${id}/discussions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessages(data || []);
    } catch (err) {
      alert("Failed to post reply");
    }
  };

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
          <Link to="/hr/dash" className="nav-link">Dashboard</Link>
          <Link to="/hr/chat" className="nav-link">Chat</Link>
          <Link to="/hr/mlist" className="nav-link">Manpower</Link>
          <Link to="/hr/movement" className="nav-link">Movement</Link>
          <Link to="/hr/project-records" className="nav-link">Projects</Link>
        </nav>
        <div className="profile-menu-container" style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div className="profile-circle" onClick={() => setProfileMenuOpen(!profileMenuOpen)}>
            {userName.charAt(0).toUpperCase() || 'Z'}
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

          {/* Back */}
          <div className="back-button" onClick={() => navigate('/hr/project-records')} style={{ cursor: 'pointer' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24">
              <path d="M19 12H5"></path>
              <path d="M12 19l-7-7 7-7"></path>
            </svg>
          </div>

          {/* Project Image */}
          <div className="project-image-container">
            <img
              src={
                project.photos && project.photos.length > 0
                  ? `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}${project.photos[0]}`
                  : 'https://placehold.co/400x250?text=No+Photo'
              }
              alt={project.projectName}
              className="project-image"
              width={250}
              height={150}
              style={{ objectFit: "cover", borderRadius: 8 }}
            />
          </div>

          <h1 className="project-title">{project.projectName}</h1>

          {/* Tabs */}
          <div className="tabs-row">
            <button className={`tab-btn${activeTab === 'Discussions' ? ' active' : ''}`} onClick={() => setActiveTab('Discussions')}>Discussions</button>
            <button className={`tab-btn${activeTab === 'Details' ? ' active' : ''}`} onClick={() => setActiveTab('Details')}>Details</button>
            <button className={`tab-btn${activeTab === 'Files' ? ' active' : ''}`} onClick={() => setActiveTab('Files')}>Files</button>
            <button className={`tab-btn${activeTab === 'Reports' ? ' active' : ''}`} onClick={() => setActiveTab('Reports')}>Reports</button>
          </div>

          {/* --- Tab Content --- */}

          {/* Details */}
          {activeTab === 'Details' && (
            <>
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

              <p><b>Status:</b> {status}</p>
            </>
          )}

          {/* Discussions */}
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
                +
              </button>

              {/* New message input modal */}
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

          {/* Files */}
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

          {/* Reports */}
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

export default HrViewSpecific;
