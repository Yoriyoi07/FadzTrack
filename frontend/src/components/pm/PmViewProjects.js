import React, { useState, useEffect } from 'react';
import api from '../../api/axiosInstance'; // <--- Make sure the path is correct
import "../style/pic_style/Pic_Project.css";
import NotificationBell from '../NotificationBell';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FaRegCommentDots, FaRegFileAlt, FaRegListAlt, FaPlus } from 'react-icons/fa';

const Pm_Project = () => {
  const {id} = useParams();
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const stored = localStorage.getItem('user');
  const user = stored ? JSON.parse(stored) : null;
  const userId = user?._id;

  const [userName, setUserName] = useState(user?.name || 'ALECK');
  const [userRole, setUserRole] = useState(user?.role || '');
  const [project, setProject] = useState(null);
  const [projects, setProjects] = useState([]);

  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [showEditFields, setShowEditFields] = useState(false);
  const [editTasks, setEditTasks] = useState([{ name: '', percent: '' }]);

  // Tab state
  const [activeTab, setActiveTab] = useState('Details');

  // Discussions state (start empty)
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [replyInputs, setReplyInputs] = useState({});
  const [showNewMsgInput, setShowNewMsgInput] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(Date.now()); // for resetting file input

  // Mention/autocomplete state
  const [mentionDropdown, setMentionDropdown] = useState({ open: false, options: [], query: '', position: { top: 0, left: 0 } });
  const textareaRef = React.useRef();

  // Build staff list (PM + PICs, no manpower)
  const staffList = React.useMemo(() => {
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

  // Single project fetch by ID
  useEffect(() => {
    if (!id) return;
    const fetchProject = async () => {
      try {
        const res = await api.get(`/projects/${id}`);
        setProject(res.data);
        console.log('Fetched Project:', res.data);
      } catch (err) {
        setProject(null);
      }
    };
    fetchProject();
  }, [id]);

  useEffect(() => {
    if (!token || !user) return;
    const fetchProjects = async () => {
      try {
        const { data } = await api.get('/projects');
        const filtered = data.filter(p =>
          (typeof p.projectmanager === 'object' &&
            (p.projectmanager._id === userId || p.projectmanager.id === userId)) ||
          p.projectManager === userId
        );
        setProjects(filtered);
      } catch (err) {
        setProjects([]);
      }
    };
    fetchProjects();
  }, [token, user, userId]);

  // Fetch assigned project
  useEffect(() => {
    if (!token || !userId) return;
    const fetchAssigned = async () => {
      try {
        const { data } = await api.get(`/projects/assigned/${userId}`);
        console.log('Assigned project data:', data);
        setProject(data[0] || null);
      } catch (err) {
        setProject(null);
      }
    };
    fetchAssigned();
  }, [token, userId]);

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

  // ---- TASK PERCENT VALIDATION ----
  // Calculate the total percent of all fields
  const totalPercent = editTasks.reduce(
    (sum, task) => sum + (parseInt(task.percent) || 0),
    0
  );

  // Handler for each task's name or percent field
  const handleEditTaskChange = (idx, field, value) => {
    setEditTasks(tasks =>
      tasks.map((t, i) => {
        if (i !== idx) return t;
        if (field === 'percent') {
          // Calculate sum of all except this task
          const otherTotal = tasks.reduce(
            (sum, task, j) => (j === idx ? sum : sum + (parseInt(task.percent) || 0)),
            0
          );
          let valNum = Number(value);
          if (otherTotal + valNum > 100) {
            valNum = 100 - otherTotal;
          }
          if (valNum < 0) valNum = 0;
          return { ...t, percent: valNum.toString() };
        }
        return { ...t, [field]: value };
      })
    );
  };

  // Add a new empty task field
  const handleAddTaskField = () => {
    setEditTasks(tasks => [...tasks, { name: '', percent: '' }]);
  };

const handleSubmitTasks = async () => {
  try {
    // Make sure all fields filled and total 100%
    if (
      editTasks.some(t => !t.name.trim() || t.percent === '') ||
      totalPercent !== 100
    ) {
      alert('Fill all fields and make sure total percent is 100%.');
      return;
    }
    // Prepare data as array of { name, percent: Number }
    const formattedTasks = editTasks.map(t => ({
      name: t.name,
      percent: Number(t.percent)
    }));
    await api.patch(`/projects/${project._id}/tasks`, { tasks: formattedTasks });

    // Refresh project data from backend (so UI reflects changes)
    const res = await api.get(`/projects/${project._id}`);
    setProject(res.data);

    setShowEditFields(false);
    alert('Tasks updated successfully!');
  } catch (err) {
    alert('Failed to update tasks!');
    console.error(err);
  }
};

  // --- Mention Autocomplete Logic ---
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

  // --- Parse mentions and send notifications ---
  const handlePostMessage = async () => {
    if (!newMessage.trim()) return;
    // Find all @mentions in the message
    const mentionRegex = /@([\w\s]+)/g;
    const mentionedNames = Array.from(newMessage.matchAll(mentionRegex)).map(m => m[1].trim());
    // Map to staff users
    const mentionedUsers = staffList.filter(u => mentionedNames.includes(u.name));
    // Post message as before
    setMessages([
      ...messages,
      {
        id: Date.now(),
        user: { name: userName, initials: userName.charAt(0).toUpperCase() },
        text: newMessage,
        timestamp: new Date().toISOString(),
        replies: [],
      },
    ]);
    setNewMessage('');
    setShowNewMsgInput(false);
    // Send notifications to mentioned users
    for (const u of mentionedUsers) {
      try {
        await api.post('/notifications', {
          type: 'mention',
          toUserId: u._id,
          message: `${userName} mentioned you in a project discussion: "${newMessage}"`,
          projectId: project._id
        });
      } catch (err) {
        // Ignore notification errors
      }
    }
  };

  // Add reply to a message
  const handlePostReply = (msgId) => {
    const replyText = replyInputs[msgId];
    if (!replyText || !replyText.trim()) return;
    setMessages(messages.map(msg =>
      msg.id === msgId
        ? {
            ...msg,
            replies: [
              ...msg.replies,
              {
                id: Date.now(),
                user: { name: userName, initials: userName.charAt(0).toUpperCase() },
                text: replyText,
                timestamp: new Date().toISOString(),
              },
            ],
          }
        : msg
    ));
    setReplyInputs({ ...replyInputs, [msgId]: '' });
  };

  // --- Highlight mentions in message display ---
  function renderMessageText(text) {
    const parts = text.split(/(@[\w\s]+)/g);
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        return <span key={i} style={{ color: '#1976d2', fontWeight: 600 }}>{part}</span>;
      }
      return part;
    });
  }


  if (!project) return <div>Loading...</div>;

  return (
    <div>
      <header className="header">
        <div className="logo-container">
          <img src={require('../../assets/images/FadzLogo1.png')} alt="FadzTrack Logo" className="logo-img" />
          <h1 className="brand-name">FadzTrack</h1>
        </div>
        <nav className="nav-menu">
          <Link to="/pm" className="nav-link">Dashboard</Link>
          <Link to="/pm/chat" className="nav-link">Chat</Link>
          <Link to="/pm/request/:id" className="nav-link">Material</Link>
          <Link to="/pm/manpower-list" className="nav-link">Manpower</Link>
          {project && (
            <Link to={`/pm/viewprojects/${project._id || project.id}`} className="nav-link">View Project</Link>
          )}
          <Link to="/pm/daily-logs" className="nav-link">Logs</Link>
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
          <div className="back-button" onClick={() => navigate('/pm')} style={{ cursor: 'pointer' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24">
              <path d="M19 12H5"></path>
              <path d="M12 19l-7-7 7-7"></path>
            </svg>
          </div>

          <div className="project-image-container">
            <img 
              alt={project.projectName} 
              className="project-image"
            />
            <button className="favorite-button">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
            </button>
          </div>

          <h1 className="project-title">{project.projectName}</h1>

          {/* Tab Navigation */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 40, margin: '32px 0 24px 0', fontSize: '1.3rem', fontWeight: 500 }}>
            <div
              style={{
                borderBottom: activeTab === 'Discussions' ? '3px solid #1976d2' : 'none',
                color: activeTab === 'Discussions' ? '#1976d2' : '#222',
                cursor: 'pointer',
                paddingBottom: 6,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
              onClick={() => setActiveTab('Discussions')}
            >
              <FaRegCommentDots /> Discussions
            </div>
            <div
              style={{
                borderBottom: activeTab === 'Details' ? '3px solid #1976d2' : 'none',
                color: activeTab === 'Details' ? '#1976d2' : '#222',
                cursor: 'pointer',
                paddingBottom: 6,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
              onClick={() => setActiveTab('Details')}
            >
              <FaRegListAlt /> Details
            </div>
            <div
              style={{
                borderBottom: activeTab === 'Files' ? '3px solid #1976d2' : 'none',
                color: activeTab === 'Files' ? '#1976d2' : '#222',
                cursor: 'pointer',
                paddingBottom: 6,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
              onClick={() => setActiveTab('Files')}
            >
              <FaRegFileAlt /> Files
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === 'Discussions' && (
            <div style={{ maxWidth: 800, margin: '0 auto', background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px #0001', padding: 32, position: 'relative', minHeight: 400 }}>
              {/* If no messages, show background text */}
              {messages.length === 0 && !showNewMsgInput && (
                <div style={{ color: '#bbb', fontSize: 28, textAlign: 'center', marginTop: 120, userSelect: 'none' }}>
                  Start a conversation
                </div>
              )}
              {/* List of messages */}
              <div>
                {messages.map(msg => (
                  <div key={msg.id} style={{ marginBottom: 32, borderBottom: '1px solid #eee', paddingBottom: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#e3e6f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18, color: '#444' }}>{msg.user.initials}</div>
                      <div>
                        <div style={{ fontWeight: 600 }}>{msg.user.name}</div>
                        <div style={{ fontSize: 13, color: '#888' }}>{new Date(msg.timestamp).toLocaleString()}</div>
                      </div>
                    </div>
                    <div style={{ margin: '12px 0 0 52px', fontSize: 17 }}>{renderMessageText(msg.text)}</div>
                    {/* Replies */}
                    <div style={{ marginLeft: 52, marginTop: 16 }}>
                      {msg.replies.map(reply => (
                        <div key={reply.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                          <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#f3f6fa', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 15, color: '#555' }}>{reply.user.initials}</div>
                          <div>
                            <div style={{ fontWeight: 500 }}>{reply.user.name}</div>
                            <div style={{ fontSize: 12, color: '#aaa' }}>{new Date(reply.timestamp).toLocaleString()}</div>
                            <div style={{ fontSize: 15, marginTop: 2 }}>{reply.text}</div>
                          </div>
                        </div>
                      ))}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                        <input
                          type="text"
                          value={replyInputs[msg.id] || ''}
                          onChange={e => setReplyInputs({ ...replyInputs, [msg.id]: e.target.value })}
                          placeholder="Reply..."
                          style={{ flex: 1, borderRadius: 8, border: '1px solid #ccc', padding: 8, fontSize: '1rem' }}
                        />
                        <button
                          onClick={() => handlePostReply(msg.id)}
                          style={{ background: '#1976d2', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 18px', fontWeight: 600, cursor: 'pointer' }}
                        >
                          Reply
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {/* Floating add discussion button */}
              <button
                onClick={() => setShowNewMsgInput(v => !v)}
                style={{
                  position: 'fixed',
                  bottom: 48,
                  right: 48,
                  background: '#1976d2',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '50%',
                  width: 56,
                  height: 56,
                  boxShadow: '0 2px 8px #0002',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 28,
                  zIndex: 10,
                  cursor: 'pointer',
                }}
                title="Start a new conversation"
              >
                <FaPlus />
              </button>
              {/* New message input modal/box */}
              {showNewMsgInput && (
                <div style={{
                  position: 'fixed',
                  left: 0, top: 0, right: 0, bottom: 0,
                  background: 'rgba(0,0,0,0.18)',
                  zIndex: 100,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                  onClick={() => setShowNewMsgInput(false)}
                >
                  <div style={{ background: '#fff', borderRadius: 12, padding: 32, minWidth: 350, maxWidth: 500, width: '100%', boxShadow: '0 2px 16px #0002' }} onClick={e => e.stopPropagation()}>
                    <h3 style={{ margin: 0, marginBottom: 16 }}>Start a new conversation</h3>
                    <textarea
                      value={newMessage}
                      onChange={handleTextareaInput}
                      ref={textareaRef}
                      placeholder="Type your message..."
                      style={{ width: '100%', minHeight: 60, borderRadius: 8, border: '1px solid #ccc', padding: 12, fontSize: '1rem' }}
                    />
                    {mentionDropdown.open && (
                      <div style={{
                        position: 'absolute',
                        top: mentionDropdown.position.top,
                        left: mentionDropdown.position.left,
                        background: '#fff',
                        border: '1px solid #ccc',
                        borderRadius: 8,
                        boxShadow: '0 2px 8px #0001',
                        zIndex: 1000,
                        maxHeight: 200,
                        overflowY: 'auto',
                        width: 'calc(100% - 20px)', // Adjust width to account for padding
                      }}>
                        {mentionDropdown.options.map(user => (
                          <div
                            key={user._id}
                            style={{
                              padding: '8px 12px',
                              cursor: 'pointer',
                              borderBottom: '1px solid #eee',
                            }}
                            onClick={() => handleMentionSelect(user)}
                          >
                            {user.name}
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
                      <button onClick={() => setShowNewMsgInput(false)} style={{ background: '#eee', color: '#333', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
                      <button
                        onClick={handlePostMessage}
                        style={{ background: '#1976d2', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 24px', fontWeight: 600, cursor: 'pointer' }}
                      >
                        Post
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'Details' && (
            <div>
              {/* Existing project details grid and edit task UI here */}
              <div className="project-details-grid">
                <div className="details-column">
                  <p className="detail-item">
                    <span className="detail-label">Location:</span> 
                    {typeof project.location === 'object'
                      ? project.location.name 
                      : project.location}
                  </p>
                  <div className="detail-group">
                    <p className="detail-label">Project Manager:</p>
                    <p className="detail-value">{project.projectmanager?.name || 'N/A'}</p>
                  </div>
                  <div className="detail-group">
                    <p className="detail-label">Contractor:</p>
                    <p className="detail-value">{project.contractor}</p>
                  </div>
                 <div className="detail-group">
                    <span className="detail-label">Target Date:</span><br/>
                      <span className="detail-value">
                      {project.startDate ? new Date(project.startDate).toLocaleDateString() : 'N/A'}
                      {" - "}
                      {project.endDate ? new Date(project.endDate).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                </div>

                <div className="details-column">
                  <div className="budget-container">
                    <p className="budget-amount">{project.budget?.toLocaleString() || '0'}</p>
                    <p className="budget-label">Estimated Budget</p>
                  </div>
               <div className="detail-group">
                <span className="detail-label">PIC:</span><br/>
                <span className="detail-value">
                  {project.pic && project.pic.length > 0 
                    ? project.pic.map(p => p.name).join(', ') 
                    : 'N/A'}
                </span>
              </div>


                  {/* Edit Task Button and Fields */}
                  <button
                    className="edit-task-btn"
                    style={{
                      background: "#2E7D32",
                      color: "white",
                      padding: "10px 28px",
                      border: "none",
                      borderRadius: "8px",
                      fontWeight: "bold",
                      fontSize: "1rem",
                      cursor: "pointer",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                      marginTop: 10
                    }}
                   onClick={() => {
                    setShowEditFields(!showEditFields);
                    // When opening, preload tasks from project (if any), or default
                    if (!showEditFields) {
                      if (project.tasks && project.tasks.length > 0) {
                        setEditTasks(project.tasks.map(t => ({
                          name: t.name,
                          percent: t.percent.toString()
                        })));
                      } else {
                        setEditTasks([{ name: '', percent: '' }]);
                      }
                    }
                  }}
                >
                  Edit Task
                </button>

                  {showEditFields && (
                    <div style={{ marginTop: 16 }}>
                      {editTasks.map((task, idx) => {
                        // Calc total without current field for max percent input
                        const othersTotal = editTasks.reduce(
                          (sum, t, i) => (i === idx ? sum : sum + (parseInt(t.percent) || 0)), 0
                        );
                        const maxValue = 100 - othersTotal;
                        return (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                            <input
                              type="text"
                              value={task.name}
                              onChange={e => handleEditTaskChange(idx, 'name', e.target.value)}
                              placeholder="Enter Task"
                              style={{
                                padding: "10px",
                                borderRadius: "8px",
                                border: "1px solid #ccc",
                                fontSize: "1rem",
                                minWidth: "250px"
                              }}
                            />
                            <input
                              type="number"
                              min="0"
                              max={maxValue}
                              value={task.percent}
                              onChange={e => handleEditTaskChange(idx, 'percent', e.target.value)}
                              placeholder="%"
                              style={{
                                padding: "10px",
                                borderRadius: "8px",
                                border: "1px solid #ccc",
                                fontSize: "1rem",
                                width: "80px"
                              }}
                            />
                            {/* Plus button only on last field */}
                            {idx === editTasks.length - 1 && (
                              <button
                                onClick={handleAddTaskField}
                                style={{
                                  background: "#1976d2",
                                  color: "white",
                                  border: "none",
                                  borderRadius: "50%",
                                  width: 36,
                                  height: 36,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: "1.5rem",
                                  cursor: totalPercent >= 100 ? "not-allowed" : "pointer",
                                  opacity: totalPercent >= 100 ? 0.5 : 1
                                }}
                                type="button"
                                title="Add Task Field"
                                disabled={totalPercent >= 100}
                              >
                                +
                              </button>
                            )}
                          </div>
                        );
                      })}
                      <div style={{ marginTop: 8, fontWeight: 500 }}>
                        Total: {totalPercent}%
                      </div>
                      <button
                        onClick={handleSubmitTasks}
                        style={{
                          marginTop: 8,
                          background: "#388e3c",
                          color: "white",
                          padding: "8px 32px",
                          border: "none",
                          borderRadius: "8px",
                          fontWeight: "bold",
                          fontSize: "1rem",
                          cursor: "pointer"
                        }}
                      >
                        Submit Task
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="manpower-section">
                <p className="detail-label">Manpower:</p>
                <p className="manpower-list">
                  {Array.isArray(project.manpower)
                    ? project.manpower.map(m => m.name + (m.position ? ` (${m.position})` : '')).join(', ')
                    : (typeof project.manpower === 'object' ? project.manpower.name : project.manpower)}
                </p>
              </div>
            </div>
          )}

          {activeTab === 'Files' && (
            <div style={{ textAlign: 'center', padding: 40, color: '#888', fontSize: 20 }}>
              <div style={{ marginBottom: 16 }}><FaRegFileAlt size={40} /></div>
              <div style={{ marginBottom: 24 }}>Files feature coming soon...</div>
              <input
                key={fileInputKey}
                type="file"
                style={{ display: 'none' }}
                id="file-upload-input"
                onChange={e => {
                  // For now, just reset input
                  setFileInputKey(Date.now());
                  // You can handle file upload logic here
                }}
              />
              <label htmlFor="file-upload-input">
                <button
                  style={{ background: '#1976d2', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 28px', fontWeight: 600, fontSize: 18, cursor: 'pointer' }}
                >
                  Upload File
                </button>
              </label>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Pm_Project;
