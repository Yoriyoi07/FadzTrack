import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../../api/axiosInstance';
import NotificationBell from '../NotificationBell';
import { 
  FaRegCommentDots, 
  FaRegFileAlt, 
  FaRegListAlt, 
  FaTrash,
  FaProjectDiagram,
  FaComments,
  FaClipboardList,
  FaMoneyBillWave,
  FaCalendarAlt,
  FaMapMarkerAlt,
  FaBuilding,
  FaUsers,
  FaCheckCircle,
  FaClock,
  FaDownload,
  FaChartBar
} from 'react-icons/fa';
import { io } from 'socket.io-client';
import "../style/hr_style/HrSite_Dash.css";
import "../style/pm_style/Pm_ViewProjects.css";
import "../style/hr_style/HrSite_ViewProject.css";
import { getUser } from '../../api/userStore';

const HrSiteCurrentProject = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = getUser();
  const userId = user?._id || user?.id || null;
  const [userName] = useState(user?.name || 'HR-Site');
  const token = localStorage.getItem('token');

  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [project, setProject] = useState(null);
  const [activeTab, setActiveTab] = useState('Discussions');
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);
  const [toggleLoading, setToggleLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);

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
  const [mentionDropdown, setMentionDropdown] = useState({
    open: false, options: [], query: '', position: { top: 0, left: 0 }
  });

  // Files
  const [docSignedUrls, setDocSignedUrls] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState('');
  const [pendingFiles, setPendingFiles] = useState(null);
  const [duplicateNames, setDuplicateNames] = useState([]);
  const [showDupModal, setShowDupModal] = useState(false);

  // Optional POs
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [totalPO, setTotalPO] = useState(0);

  // ---- SOCKET REFS
  const socketRef = useRef(null);
  const joinedRoomRef = useRef(null);
  const projectIdRef = useRef(null);

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

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.user-profile')) setProfileMenuOpen(false);
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
      <div className="dashboard-container hr-site-view-root">
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
                {userName ? userName.charAt(0).toUpperCase() : 'H'}
              </div>
              <div className="profile-info">
                <span className="profile-name">{userName}</span>
                <span className="profile-role">HR-Site</span>
              </div>
              {profileMenuOpen && (
                <div className="profile-dropdown">
                  <button className="logout-btn" onClick={handleLogout}>
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Row: Navigation */}
          <div className="header-bottom">
            <nav className="header-nav">
              <Link to="/hr-site" className="nav-item">
                <FaProjectDiagram />
                <span className={isHeaderCollapsed ? 'hidden' : ''}>Project</span>
              </Link>
              <Link to="/hr-site/chat" className="nav-item">
                <FaComments />
                <span className={isHeaderCollapsed ? 'hidden' : ''}>Chat</span>
              </Link>
              <Link to="/hr-site/projects" className="nav-item active">
                <FaClipboardList />
                <span className={isHeaderCollapsed ? 'hidden' : ''}>My Projects</span>
              </Link>
            </nav>
            
            <NotificationBell />
          </div>
        </header>

        {/* MAIN CONTENT */}
        <main className="dashboard-main">
          <div className="no-project-message">
            <h2>No assigned project</h2>
            <p>Your HR - Site account doesn't have an active project yet.</p>
            <p>Please wait for an assignment or contact your manager.</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="dashboard-container hr-site-view-root">
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
              {userName ? userName.charAt(0).toUpperCase() : 'H'}
            </div>
            <div className="profile-info">
              <span className="profile-name">{userName}</span>
              <span className="profile-role">HR-Site</span>
            </div>
            {profileMenuOpen && (
              <div className="profile-dropdown">
                <button className="logout-btn" onClick={handleLogout}>
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Row: Navigation */}
        <div className="header-bottom">
          <nav className="header-nav">
            <Link to="/hr-site" className="nav-item">
              <FaProjectDiagram />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Project</span>
            </Link>
            <Link to="/hr-site/chat" className="nav-item">
              <FaComments />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>Chat</span>
            </Link>
            <Link to="/hr-site/projects" className="nav-item">
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
          <h1 className="project-title">{project?.projectName || 'Project Details'}</h1>
          
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
            <button
              className={`tab-btn${activeTab === 'Reports' ? ' active' : ''}`}
              onClick={() => setActiveTab('Reports')}
              type="button"
            >
              <FaRegFileAlt /> Reports
            </button>
          </div>

          {/* Tab Content */}
          <div className="tab-content">
            {activeTab === 'Discussions' && (
              <div className="discussions-container">
                <h3>Discussions</h3>
                <p>Discussion functionality will be implemented here.</p>
              </div>
            )}

            {activeTab === 'Details' && (
              <div className="project-details-content">
                <h3>Project Details</h3>
                <p>Project details will be displayed here.</p>
              </div>
            )}

            {activeTab === 'Files' && (
              <div className="files-container">
                <h3>Project Files</h3>
                <p>File management will be implemented here.</p>
              </div>
            )}

            {activeTab === 'Reports' && (
              <div className="reports-container">
                <h3>Project Reports</h3>
                <p>Reports functionality will be implemented here.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default HrSiteCurrentProject;
