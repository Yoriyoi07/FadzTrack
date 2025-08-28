import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FaTachometerAlt, FaComments, FaClipboardList, FaProjectDiagram, FaPlus } from 'react-icons/fa';
import '../style/pm_style/Pm_Dash.css';

const PicMaterialHeader = ({ title, subtitle }) => {
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [activeProject, setActiveProject] = useState(null);
  const user = (()=>{ try { return JSON.parse(localStorage.getItem('user'))||null; } catch { return null; } })();
  const userName = user?.name || 'PIC';
  const userRole = user?.role || 'Person in Charge';
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(()=>{ const onScroll=()=> setIsHeaderCollapsed((window.pageYOffset||document.documentElement.scrollTop)>50); window.addEventListener('scroll',onScroll); return ()=>window.removeEventListener('scroll',onScroll); },[]);
  useEffect(()=>{ if(!user?._id) return; fetch(`/projects/by-user-status?userId=${user._id}&role=pic&status=Ongoing`, { headers:{ Authorization: `Bearer ${localStorage.getItem('token')}` } }) .then(r=>r.ok?r.json():Promise.reject()) .then(d=> setActiveProject(d?.[0]||null)) .catch(()=> setActiveProject(null)); },[user?._id]);

  const navItems = [
    { to: '/pic', icon: <FaTachometerAlt />, label: 'Dashboard' },
    { to: '/pic/chat', icon: <FaComments />, label: 'Chat' },
    { to: '/pic/requests', icon: <FaClipboardList />, label: 'Requests' },
    { to: '/pic/projects', icon: <FaProjectDiagram />, label: 'My Projects' }
  ];

  return (
    <header className={`dashboard-header ${isHeaderCollapsed ? 'collapsed' : ''}`}>
      <div className="header-top">
        <div className="logo-section">
          <img src={require('../../assets/images/FadzLogo1.png')} alt="FadzTrack Logo" className="header-logo" />
          <h1 className="header-brand">FadzTrack</h1>
        </div>
        <div className="user-profile" onClick={()=>setProfileMenuOpen(o=>!o)}>
          <div className="profile-avatar">{userName.charAt(0).toUpperCase()}</div>
          <div className={`profile-info ${isHeaderCollapsed ? 'hidden' : ''}`}>
            <span className="profile-name">{userName}</span>
            <span className="profile-role">{userRole}</span>
          </div>
          {profileMenuOpen && (
            <div className="profile-dropdown">
              <button onClick={()=>{ localStorage.removeItem('token'); localStorage.removeItem('user'); window.location.href='/'; }} className="logout-btn"><span>Logout</span></button>
            </div>
          )}
        </div>
      </div>
      <div className="header-bottom">
        <nav className="header-nav">
          {navItems.map(item => (
            <Link key={item.to} to={item.to} className={`nav-item ${location.pathname.startsWith(item.to) ? 'active':''}`}>
              {item.icon}
              <span className={isHeaderCollapsed ? 'hidden' : ''}>{item.label}</span>
            </Link>
          ))}
          {activeProject && (
            <button type="button" className="nav-item" style={{ background:'transparent', border:'none', cursor:'pointer' }} onClick={()=> navigate(`/pic/projects/${activeProject._id}/request`)} title="New Request">
              <FaPlus />
              <span className={isHeaderCollapsed ? 'hidden' : ''}>New Request</span>
            </button>
          )}
        </nav>
        <div className="header-page-titles">
          <h2 className="header-title" style={{margin:0}}>{title}</h2>
          <p className="header-subtitle" style={{margin:0}}>{subtitle}</p>
        </div>
      </div>
    </header>
  );
};

export default PicMaterialHeader;
