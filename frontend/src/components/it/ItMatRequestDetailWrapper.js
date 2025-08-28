import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaTachometerAlt, FaComments, FaBoxes, FaUsers, FaClipboardList } from 'react-icons/fa';
import MaterialRequestDetailView from '../material/MaterialRequestDetailView';

const ITHeader = () => {
  const navigate = useNavigate();
  const stored = localStorage.getItem('user');
  const user = stored ? JSON.parse(stored) : {};
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);

  useEffect(()=>{ const onScroll=()=>{ const st=window.pageYOffset||document.documentElement.scrollTop; setIsHeaderCollapsed(st>50); }; window.addEventListener('scroll', onScroll); return ()=>window.removeEventListener('scroll', onScroll); },[]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  return (
    <header className={`dashboard-header ${isHeaderCollapsed ? 'collapsed' : ''}`}>
      <div className="header-top">
        <div className="logo-section">
          <img src={require('../../assets/images/FadzLogo1.png')} alt="FadzTrack Logo" className="header-logo" />
          <h1 className="header-brand">FadzTrack</h1>
        </div>
        <div className="user-profile" onClick={()=>setProfileMenuOpen(o=>!o)}>
          <div className="profile-avatar">{user?.name ? user.name.charAt(0).toUpperCase() : 'I'}</div>
          <div className={`profile-info ${isHeaderCollapsed ? 'hidden' : ''}`}>
            <span className="profile-name">{user?.name||'User'}</span>
            <span className="profile-role">{user?.role||'IT'}</span>
          </div>
          {profileMenuOpen && (
            <div className="profile-dropdown">
              <button onClick={handleLogout} className="logout-btn"><span>Logout</span></button>
            </div>) }
        </div>
      </div>
      <div className="header-bottom">
        <nav className="header-nav">
          <Link to="/it" className="nav-item"><FaTachometerAlt /><span className={isHeaderCollapsed? 'hidden':''}>Dashboard</span></Link>
          <Link to="/it/chat" className="nav-item"><FaComments /><span className={isHeaderCollapsed? 'hidden':''}>Chat</span></Link>
          <Link to="/it/material-list" className="nav-item active"><FaBoxes /><span className={isHeaderCollapsed? 'hidden':''}>Materials</span></Link>
          <Link to="/it/manpower-list" className="nav-item"><FaUsers /><span className={isHeaderCollapsed? 'hidden':''}>Manpower</span></Link>
          <Link to="/it/auditlogs" className="nav-item"><FaClipboardList /><span className={isHeaderCollapsed? 'hidden':''}>Audit Logs</span></Link>
          <Link to="/it/projects" className="nav-item"><FaClipboardList /><span className={isHeaderCollapsed? 'hidden':''}>Projects</span></Link>
        </nav>
      </div>
    </header>
  );
};

const ItMatRequestDetailWrapper = () => {
  return (
    <MaterialRequestDetailView
      role="IT"
      rootClass="it-request-detail"
      customHeader={<ITHeader />}
      headerTitle="Material Request Detail"
      headerSubtitle="Full lifecycle view (IT)"
    />
  );
};

export default ItMatRequestDetailWrapper;
