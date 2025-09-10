import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from 'react-router-dom';
import { useNotifications } from "../context/NotificationContext";
import { FaBell, FaCheckCircle, FaExclamationTriangle, FaTimesCircle, FaInfoCircle } from "react-icons/fa";
import './style/NotificationBell.css';

const NotificationBell = () => {
  const {
  notifications,
  unread,
    markAllRead,
    markAsRead
  } = useNotifications();
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const bellRef = useRef();
  // Prefer explicit 'userId' key, fallback to parsing stored 'user' JSON (keeps behavior consistent with App.js)
  let userId = localStorage.getItem("userId");
  if (!userId) {
    try {
      const u = JSON.parse(localStorage.getItem('user') || 'null');
      if (u && (u._id || u.id)) userId = String(u._id || u.id);
    } catch {
      userId = null;
    }
  }

  // No local socket here — NotificationContext manages the socket and updates
  // the shared notifications state. This component only renders the list.

  useEffect(() => {
    const handleClick = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const iconFor = (severity, iconKey) => {
    if (iconKey) {
      // allow mapped custom icons later
    }
    switch (severity) {
      case 'success': return <FaCheckCircle className="notif-icon success"/>;
      case 'warning': return <FaExclamationTriangle className="notif-icon warning"/>;
      case 'error': return <FaTimesCircle className="notif-icon error"/>;
      default: return <FaInfoCircle className="notif-icon info"/>;
    }
  };

  const userRole = (()=>{ try { return JSON.parse(localStorage.getItem('user')||'null')?.role || ''; } catch { return ''; } })();
  const deriveFallbackUrl = (n) => {
    const id = n.requestId?._id || n.requestId; // request reference (MaterialRequest or similar)
    const projectId = n.projectId?._id || n.projectId; // project reference
    const role = (userRole||'').toLowerCase();

    const isPIC = role.includes('person in charge') || role==='pic';
    const isPM = role.includes('project manager') || role==='pm';
    const isAM = role.includes('area manager') || role==='am';
    const isCEO = role==='ceo';
    const isIT = role==='it';
    const isHR = role==='hr' && !role.includes('site');
    const isHRSite = role.includes('hr - site');
    const isStaff = role==='staff';

    const materialTypes = ['material_request_created','pending_approval','approved','denied','nudge'];
    if(materialTypes.includes(n.type) && id){
      if(isPIC) return `/pic/material-request/${id}`;
      if(isPM) return `/pm/material-request/${id}`;
      if(isAM) return `/am/material-request/${id}`;
      if(isCEO) return `/ceo/material-request/${id}`;
      if(isIT) return `/it/material-request/${id}`;
      // HR rarely receives material request approvals; if so no dedicated route
    }
    // Treat these as project-context types
    const projectTypes = ['discussion','reply','mention','task','system','general','manpower','project_created'];
    if(projectTypes.includes(n.type) && projectId){
      if(isPIC) return `/pic/${projectId}`;
      if(isPM) return `/pm/viewprojects/${projectId}`;
      if(isAM) return `/am/projects/${projectId}`;
      if(isCEO) return `/ceo/proj/${projectId}`;
      if(isIT) return `/it/projects`;
      if(isHR) return `/hr/project-records/${projectId}`;
      if(isHRSite) return `/hr-site/current-project`;
      if(isStaff) return `/staff/current-project`;
    }
    // Fallback dashboards by role
    if(isPIC) return '/pic';
    if(isPM) return '/pm';
    if(isAM) return '/am';
    if(isCEO) return '/ceo/dash';
    if(isIT) return '/it';
    if(isHR) return '/hr/dash';
    if(isHRSite) return '/hr-site';
    if(isStaff) return '/staff';
    return '/';
  };

  const clickNotification = (n) => {
    if (n.status === 'unread') {
      // optimistic mark read via context
      if (markAsRead) markAsRead(n._id);
    }
    let target;
  // project_created now handled by deriveFallbackUrl; override only if missing actionUrl
    if (!target) target = n.actionUrl || deriveFallbackUrl(n);
    if(target){
      if(target.startsWith('http')) window.location.href = target;
      else navigate(target);
    }
  };

  // Exclude chat/discussion style notifications from bell
  // Keep discussions/replies/mentions; suppress only real-time chat message notifications if any
  const filtered = notifications.filter(n => !['chat','chat_message','message'].includes(String(n.type||'').toLowerCase()));
  const filteredUnread = filtered.filter(n=> n.status==='unread').length;

  // If unread derived differs from context unread (because context still counts chats) adjust markAllRead effect locally
  const handleBellClick = () => {
    setOpen(v=> !v);
    if (filteredUnread > 0) {
      // mark only filtered unread as read
      filtered.filter(n=> n.status==='unread').forEach(n=> markAsRead && markAsRead(n._id));
    }
  };

  return (
    <div className="notif-bell-container" ref={bellRef}>
      <div
        className="notif-bell-icon"
        onClick={handleBellClick}
      >
        <FaBell size={22} color="white" />
        {filteredUnread > 0 && <span className="notif-badge">{filteredUnread}</span>}
      </div>

      {open && (
        <div className="notif-popup">
          <div className="notif-popup-header">
            <span>Notifications</span>
            {notifications.length > 0 && (
              <button className="notif-markread-btn" onClick={markAllRead}>
                Mark all as read
              </button>
            )}
          </div>

          <div className="notif-popup-list">
            {filtered.length === 0 ? (
              <div className="notif-empty">No notifications</div>
            ) : (
              filtered.slice(0, 12).map((n, i) => (
                <div
                  className={`notif-item rich${n.status === 'unread' ? ' unread' : ''}`}
                  key={(n && n._id ? String(n._id) : `notif-${i}`) + `-${i}`}
                  onClick={() => clickNotification(n)}
                  role="button"
                  tabIndex={0}
                  onKeyPress={(e)=>{ if(e.key==='Enter') clickNotification(n);} }
                >
                  <div className="notif-left">
                    {iconFor(n.severity, n.icon)}
                  </div>
                  <div className="notif-body">
                    <div className="notif-title-row">
                      <span className={`notif-title sev-${n.severity||'info'}`}>{n.title || 'Notification'}</span>
                      {n.status==='unread' && <span className="badge-dot"/>}
                    </div>
                    <div className="notif-message">{n.message}</div>
                    <div className="notif-meta-line">
                      <span className="notif-date">{new Date(n.createdAt).toLocaleString()}</span>
                      {n.projectId?.projectName && <span className="notif-project">{n.projectId.projectName}</span>}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;