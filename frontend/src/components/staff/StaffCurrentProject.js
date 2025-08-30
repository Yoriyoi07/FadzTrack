import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import api from '../../api/axiosInstance';
import NotificationBell from '../NotificationBell';
import { FaRegCommentDots, FaRegFileAlt, FaRegListAlt, FaDownload, FaCalendarAlt, FaMapMarkerAlt, FaUsers, FaUserTie, FaBuilding, FaMoneyBillWave, FaCheckCircle, FaClock, FaTrash, FaCamera, FaChartBar } from 'react-icons/fa';
import { exportProjectDetails } from '../../utils/projectPdf';
// Nav icons
import { FaTachometerAlt, FaComments, FaBoxes, FaUsers as FaUsersNav, FaProjectDiagram, FaClipboardList } from 'react-icons/fa';
import "../style/staff_style/Staff_Dash.css";
import "../style/pm_style/Pm_ViewProjects.css";
import "../style/staff_style/Staff_ViewProject.css";

/* ---------- Socket.IO setup ---------- */
const SOCKET_ORIGIN = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace('/api', '');
const SOCKET_PATH = '/socket.io';

/* ---------- File handling utilities ---------- */
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

function extractOriginalNameFromPath(path) {
  const base = (path || '').split('/').pop() || '';
  const underscore = base.indexOf('_');
  if (underscore !== -1 && underscore < base.length - 1) return base.slice(underscore + 1);
  const m = base.match(/^project-\d{8,}-(.+)$/i);
  if (m && m[1]) return m[1];
  return base;
}

function getFileType(fileName) {
  const extension = fileName.split('.').pop()?.toLowerCase();
  const typeMap = {
    'pdf': 'PDF', 'doc': 'DOC', 'docx': 'DOCX', 'xls': 'XLS', 'xlsx': 'XLSX',
    'ppt': 'PPT', 'pptx': 'PPTX', 'txt': 'TXT', 'rtf': 'RTF', 'csv': 'CSV',
    'jpg': 'JPG', 'jpeg': 'JPEG', 'png': 'PNG', 'gif': 'GIF', 'bmp': 'BMP', 'svg': 'SVG'
  };
  return typeMap[extension] || 'FILE';
}

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
      const isMe = slug === meSlug;
      nodes.push(
        <span key={i} style={{ 
          background: isMe ? '#f6c343' : isEveryone ? '#3b82f6' : '#e5e7eb',
          color: isMe ? '#3a2f00' : isEveryone ? 'white' : '#374151',
          padding: '2px 6px', 
          borderRadius: '4px', 
          fontWeight: 'bold',
          fontSize: '0.9em'
        }}>
          {tag}
        </span>
      );
    }
    if (parts[i]) nodes.push(parts[i]);
  }
  return nodes;
}

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
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

function readContractor(project) {
  if (typeof project?.contractor === 'string' && project.contractor.trim().length > 0) {
    return project.contractor;
  }
  return 'N/A';
}

const StaffCurrentProject = () => {
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
  const [userName] = useState(user?.name || 'Staff');

  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);

  const [project, setProject] = useState(null);
  const [activeTab, setActiveTab] = useState('Details');
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(true);

  // Discussions
  const [messages, setMessages] = useState([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [replyInputs, setReplyInputs] = useState({});
  const [posting, setPosting] = useState(false);
  const [composerFiles, setComposerFiles] = useState([]);
  const [selectedLabel, setSelectedLabel] = useState('');
  const listScrollRef = useRef(null);
  const listBottomRef = useRef(null);
  const textareaRef = useRef(null);

  // File management state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState('');
  const [fileSearchTerm, setFileSearchTerm] = useState('');

  // Mentions
  const [mentionDropdown, setMentionDropdown] = useState({ 
    open: false, 
    options: [], 
    query: '', 
    position: { top: 0, left: 0 },
    activeInputId: null
  });
  const [projectUsers, setProjectUsers] = useState([]);

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

  /* ---------------- Fetch specific project ---------------- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Get specific project by ID
        const { data } = await api.get(`/projects/${id}`);
        if (cancelled) return;
        setProject(data);
        setStatus(data?.status || '');
        setProgress(data?.progress || 0);
      } catch {
        if (!cancelled) setProject(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  /* ---------------- Discussions initial fetch ---------------- */
  useEffect(() => {
    if (!project?._id) return;
    
    let cancelled = false;
    (async () => {
      try {
        setLoadingMsgs(true);
        const { data } = await api.get(`/projects/${project._id}/messages`);
        if (cancelled) return;
        setMessages(data || []);
      } catch {
        if (!cancelled) setMessages([]);
      } finally {
        if (!cancelled) setLoadingMsgs(false);
      }
    })();
    return () => { cancelled = true; };
  }, [project?._id]);

  /* ---------------- Socket.IO connection ---------------- */
  useEffect(() => {
    if (!project?._id) return;
    
    const socket = io(SOCKET_ORIGIN, {
      path: SOCKET_PATH,
      query: { projectId: project._id }
    });

    socket.on('new-message', (message) => {
      setMessages(prev => [...prev, message]);
    });

    socket.on('new-reply', (reply) => {
      setMessages(prev => prev.map(msg => 
        msg._id === reply.messageId 
          ? { ...msg, replies: [...(msg.replies || []), reply] }
          : msg
      ));
    });

    return () => {
      socket.disconnect();
    };
  }, [project?._id]);

  /* ---------------- Project users for mentions ---------------- */
  useEffect(() => {
    if (!project?._id) return;
    
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get(`/projects/${project._id}/users`);
        if (cancelled) return;
        setProjectUsers(data || []);
      } catch {
        if (!cancelled) setProjectUsers([]);
      }
    })();
    return () => { cancelled = true; };
  }, [project?._id]);

  /* ---------------- Message posting ---------------- */
  const handlePostMessage = async () => {
    if (!newMessage.trim() && composerFiles.length === 0) return;
    if (!project?._id) return;
    
    setPosting(true);
    try {
      const formData = new FormData();
      formData.append('text', newMessage);
      composerFiles.forEach(file => formData.append('attachments', file));
      
      const { data } = await api.post(`/projects/${project._id}/messages`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setMessages(prev => [...prev, data]);
      setNewMessage('');
      setComposerFiles([]);
    } catch (error) {
      console.error('Failed to post message:', error);
      alert('Failed to post message. Please try again.');
    } finally {
      setPosting(false);
    }
  };

  /* ---------------- Reply posting ---------------- */
  const handlePostReply = async (messageId) => {
    const replyText = replyInputs[messageId];
    if (!replyText?.trim()) return;
    if (!project?._id) return;
    
    try {
      const { data } = await api.post(`/projects/${project._id}/messages/${messageId}/replies`, {
        text: replyText
      });
      
      setMessages(prev => prev.map(msg => 
        msg._id === messageId 
          ? { ...msg, replies: [...(msg.replies || []), data] }
          : msg
      ));
      
      setReplyInputs(prev => ({ ...prev, [messageId]: '' }));
    } catch (error) {
      console.error('Failed to post reply:', error);
      alert('Failed to post reply. Please try again.');
    }
  };

  /* ---------------- File upload ---------------- */
  const handleFileUpload = async (files) => {
    if (!files?.length || !project?._id) return;
    
    setUploading(true);
    setUploadProgress(0);
    setUploadError('');
    
    try {
      const formData = new FormData();
      files.forEach(file => formData.append('files', file));
      
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
      
      if (response.data?.documents) {
        setProject(prev => ({
          ...prev,
          documents: response.data.documents
        }));
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
      alert('Upload failed. Please try again.');
    }
  };

  /* ---------------- File deletion ---------------- */
  const handleDeleteFile = async (doc, index) => {
    if (!project?._id || !window.confirm('Are you sure you want to delete this file?')) return;
    
    try {
      const filePath = typeof doc === 'string' ? doc : doc.path;
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

  /* ---------------- Utility functions ---------------- */
  const addComposerFiles = (files) => {
    if (!files?.length) return;
    setComposerFiles(prev => [...prev, ...Array.from(files)]);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  if (loading) return (
    <div className="dashboard-container staff-view-root">
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
        </div>
      </div>
    </div>
  );
  
  if (!project) return (
    <div className="dashboard-container staff-view-root">
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
              {userName ? userName.charAt(0).toUpperCase() : 'S'}
            </div>
            <div className="profile-info">
              <span className="profile-name">{userName}</span>
              <span className="profile-role">Staff</span>
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
            <Link to="/staff" className="nav-item">
              <FaProjectDiagram />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Project</span>
            </Link>
            <Link to="/staff/chat" className="nav-item">
              <FaComments />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Chat</span>
            </Link>
            <Link to="/staff/projects" className="nav-item">
              <FaClipboardList />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>My Projects</span>
            </Link>
          </nav>
          
          <NotificationBell />
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="dashboard-main">
        <div className="project-view-container">
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
                <h2 className="loading-title" style={{ color: '#ef4444' }}>No Current Project</h2>
                <p className="loading-subtitle">You are not currently assigned to any project.</p>
              </div>
              <div style={{ marginTop: '2rem' }}>
                <button 
                  onClick={() => navigate('/staff')}
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
                >
                  Return to Dashboard
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );

  // Derived values
  const start = project?.startDate ? new Date(project.startDate).toLocaleDateString() : 'N/A';
  const end = project?.endDate ? new Date(project.endDate).toLocaleDateString() : 'N/A';
  const contractor = readContractor(project);
  const locationLabel = project?.location?.name
    ? `${project.location.name}${project.location?.region ? ` (${project.location.region})` : ''}`
    : 'N/A';
  const manpowerText =
    Array.isArray(project?.manpower) && project.manpower.length > 0
      ? project.manpower.map(mp => [mp?.name, mp?.position].filter(Boolean).join(' (') + (mp?.position ? ')' : '')).join(', ')
      : 'No Manpower Assigned';

  return (
    <div className="dashboard-container staff-view-root">
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
              {userName ? userName.charAt(0).toUpperCase() : 'S'}
            </div>
            <div className="profile-info">
              <span className="profile-name">{userName}</span>
              <span className="profile-role">Staff</span>
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
            <Link to="/staff" className="nav-item">
              <FaProjectDiagram />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Project</span>
            </Link>
            <Link to="/staff/chat" className="nav-item">
              <FaComments />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Chat</span>
            </Link>
            <Link to="/staff/projects" className="nav-item">
              <FaClipboardList />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>My Projects</span>
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

          {/* Action Buttons */}
          <div className="action-buttons">
            <button
              onClick={() => exportProjectDetails(project)}
              className="export-btn"
            >
              <FaDownload />
              Export Project Details
            </button>
          </div>

          {/* Project Tabs */}
          <div className="project-tabs">
            <button
              className={`project-tab ${activeTab === 'Details' ? 'active' : ''}`}
              onClick={() => setActiveTab('Details')}
            >
              <FaRegListAlt />
              Details
            </button>
            <button
              className={`project-tab ${activeTab === 'Discussions' ? 'active' : ''}`}
              onClick={() => setActiveTab('Discussions')}
            >
              <FaRegCommentDots />
              Discussions
            </button>
            <button
              className={`project-tab ${activeTab === 'Files' ? 'active' : ''}`}
              onClick={() => setActiveTab('Files')}
            >
              <FaRegFileAlt />
              Files
            </button>
            <button
              className={`project-tab ${activeTab === 'Reports' ? 'active' : ''}`}
              onClick={() => setActiveTab('Reports')}
            >
              <FaRegFileAlt />
              Reports
            </button>
          </div>

          {/* Tab Content */}
          <div className="tab-content">
            {/* --- Details Tab --- */}
            {activeTab === 'Details' && (
              <div className="project-details-content">
                {/* Overview Grid */}
                <div className="overview-grid">
                  <div className="overview-card budget-card">
                    <div className="card-icon">
                      <FaMoneyBillWave />
                    </div>
                    <h3 className="card-title">Budget</h3>
                    <div className="budget-amount">{peso.format(project?.budget || 0)}</div>
                  </div>

                  <div className="overview-card timeline-card">
                    <div className="card-icon">
                      <FaCalendarAlt />
                    </div>
                    <h3 className="card-title">Timeline</h3>
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

                  <div className="overview-card location-card">
                    <div className="card-icon">
                      <FaMapMarkerAlt />
                    </div>
                    <h3 className="card-title">Location</h3>
                    <div className="location-value">{locationLabel}</div>
                  </div>

                  <div className="overview-card contractor-card">
                    <div className="card-icon">
                      <FaBuilding />
                    </div>
                    <h3 className="card-title">Contractor</h3>
                    <div className="contractor-value">{contractor}</div>
                  </div>
                </div>

                {/* Project Progress Section */}
                <div className="progress-section">
                  <h2 className="section-title">Project Progress</h2>
                  <div className="progress-grid">
                    <div className="progress-card overall-progress">
                      <div className="progress-icon">
                        <FaChartBar />
                      </div>
                      <div className="progress-content">
                        <div className="progress-value">{progress}%</div>
                        <div className="progress-label">Overall Progress</div>
                      </div>
                    </div>
                    <div className="progress-card pic-contributions">
                      <div className="progress-icon">
                        <FaChartBar />
                      </div>
                      <div className="progress-content">
                        <div className="progress-value">85%</div>
                        <div className="progress-label">PiC Contributions</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Project Team Section */}
                <div className="team-section">
                  <h2 className="section-title">Project Team</h2>
                  <div className="team-grid">
                    {project?.projectManager && (
                      <div className="team-member">
                        <div className="member-avatar">
                          {project.projectManager.name?.charAt(0)?.toUpperCase() || 'P'}
                        </div>
                        <div className="member-info">
                          <h4 className="member-role">Project Manager</h4>
                          <p className="member-name">{project.projectManager.name || 'N/A'}</p>
                        </div>
                      </div>
                    )}
                    {project?.pic && Array.isArray(project.pic) && project.pic.length > 0 && (
                      <div className="team-member">
                        <div className="member-avatar">
                          {project.pic[0]?.name?.charAt(0)?.toUpperCase() || 'P'}
                        </div>
                        <div className="member-info">
                          <h4 className="member-role">Person in Charge</h4>
                          <p className="member-name">{project.pic[0]?.name || 'N/A'}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Assigned Manpower Section */}
                <div className="manpower-section">
                  <h2 className="section-title">Assigned Manpower</h2>
                  <div className="manpower-content">
                    <div className="manpower-card">
                      <p className="manpower-text">{manpowerText}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* --- Discussions Tab --- */}
            {activeTab === 'Discussions' && (
              <div className="discussions-container">
                <div className="messages-list">
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
                    <div>
                      {messages.map(msg => (
                        <div key={msg._id} className="message-item">
                          <div className="message-header">
                            <div className="message-avatar">
                              {msg.userName?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                            <div className="message-info">
                              <div className="message-author">{msg.userName || 'Unknown User'}</div>
                              <div className="message-timestamp">
                                {msg.timestamp ? new Date(msg.timestamp).toLocaleString() : ''}
                              </div>
                            </div>
                          </div>
                          <div className="message-content">
                            <div className="message-text">
                              {renderMessageText(msg.text, userName)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="message-composer">
                  <div className="composer-area">
                    <textarea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type your message here..."
                      className="composer-textarea"
                    />
                  </div>
                  <div className="composer-actions">
                    <div className="composer-left">
                      <button className="attachment-button">
                        <FaRegFileAlt />
                        <span>Attach Files</span>
                      </button>
                    </div>
                    <div className="composer-right">
                      <button
                        onClick={handlePostMessage}
                        disabled={posting || !newMessage.trim()}
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
                <div className="files-header">
                  <div className="files-title-section">
                    <h2>Project Files</h2>
                    <p className="files-subtitle">Manage and organize project documents</p>
                  </div>
                  <div className="files-actions">
                    <label htmlFor="file-upload" className="upload-btn">
                      <FaRegFileAlt />
                      Upload Files
                    </label>
                    <input
                      id="file-upload"
                      type="file"
                      multiple
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.rtf,.csv,image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => handleFileUpload(e.target.files)}
                    />
                  </div>
                </div>

                {uploading && (
                  <div className="upload-progress">
                    <div className="progress-bar">
                      <div 
                        className="progress-fill" 
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                    <p className="progress-text">Uploading... {uploadProgress}%</p>
                  </div>
                )}

                <div className="files-table-container">
                  {project?.documents && project.documents.length > 0 ? (
                    <table className="files-table">
                      <thead className="table-header">
                        <tr>
                          <th className="header-cell">File</th>
                          <th className="header-cell">Type</th>
                          <th className="header-cell">Size</th>
                          <th className="header-cell">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="table-body">
                        {project.documents.map((doc, index) => {
                          const fileName = typeof doc === 'string' ? extractOriginalNameFromPath(doc) : doc.name;
                          const fileType = getFileType(fileName);
                          return (
                            <tr key={index} className="table-row">
                              <td className="table-cell">
                                <div className="file-info">
                                  <div className="file-thumbnail-container">
                                    <div className="file-thumbnail">
                                      <FaRegFileAlt />
                                    </div>
                                  </div>
                                  <span className="file-name-text">{fileName}</span>
                                </div>
                              </td>
                              <td className="table-cell">
                                <span className="file-type-badge">{fileType}</span>
                              </td>
                              <td className="table-cell">N/A</td>
                              <td className="table-cell">
                                <div className="action-buttons">
                                  <button
                                    onClick={() => openSignedPath(typeof doc === 'string' ? doc : doc.path)}
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

            {/* --- Reports Tab --- */}
            {activeTab === 'Reports' && (
              <div className="reports-container">
                <div className="reports-placeholder">
                  <FaRegFileAlt />
                  <h3>Reports Coming Soon</h3>
                  <p>Project reports and analytics will be available here</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default StaffCurrentProject;
