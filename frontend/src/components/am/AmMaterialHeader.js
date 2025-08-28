import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FaTachometerAlt, FaComments, FaBoxes, FaUsers, FaProjectDiagram, FaClipboardList } from 'react-icons/fa';
import '../style/pm_style/Pm_Dash.css';

const navItems = [
  { to: '/am', icon: <FaTachometerAlt />, label: 'Dashboard' },
  { to: '/am/chat', icon: <FaComments />, label: 'Chat' },
  { to: '/am/matreq', icon: <FaBoxes />, label: 'Material' },
  { to: '/am/manpower-requests', icon: <FaUsers />, label: 'Manpower' },
  { to: '/am/viewproj', icon: <FaProjectDiagram />, label: 'Projects' },
  { to: '/logs', icon: <FaClipboardList />, label: 'Logs' }
];

const AmMaterialHeader = ({ title, subtitle }) => {
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const user = (()=>{ try { return JSON.parse(localStorage.getItem('user'))||null; } catch { return null; } })();
  const userName = user?.name || 'AM';
  const userRole = user?.role || 'Area Manager';
  const location = useLocation();

  useEffect(()=>{ const onScroll=()=>{ const st=window.pageYOffset||document.documentElement.scrollTop; setIsHeaderCollapsed(st>50); }; window.addEventListener('scroll',onScroll); return ()=>window.removeEventListener('scroll',onScroll); },[]);

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
            <Link key={item.to} to={item.to} className={`nav-item ${location.pathname.startsWith(item.to.replace('/:id','')) ? 'active':''}`}>
              {item.icon}
              <span className={isHeaderCollapsed ? 'hidden' : ''}>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="header-page-titles">
          <h2 className="header-title" style={{margin:0}}>{title}</h2>
          <p className="header-subtitle" style={{margin:0}}>{subtitle}</p>
        </div>
      </div>
    </header>
  );
};

export default AmMaterialHeader;
