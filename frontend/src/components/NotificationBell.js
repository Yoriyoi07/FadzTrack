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

    const projectTypes = ['discussion','reply','mention','task','system'];
    if(projectTypes.includes(n.type) && projectId){
      if(isPIC) return `/pic/${projectId}`;
      if(isPM) return `/pm/viewprojects/${projectId}`;
      if(isAM) return `/am/viewproj/${projectId}`;
      if(isCEO) return `/ceo/proj/${projectId}`;
      if(isIT) return `/it/projects`; // no per-id route defined
      if(isHR) return `/hr/project-records/${projectId}`;
      if(isHRSite) return `/hr-site/current-project`; // simplified
      if(isStaff) return `/staff/current-project`;
    }
    return null;
  };

  const clickNotification = (n) => {
    if (n.status === 'unread') {
      // optimistic mark read via context
      if (markAsRead) markAsRead(n._id);
    }
    const target = n.actionUrl || deriveFallbackUrl(n);
    if(target){
      if(target.startsWith('http')) window.location.href = target;
      else navigate(target);
    }
  };

  return (
    <div className="notif-bell-container" ref={bellRef}>
      <div
        className="notif-bell-icon"
        onClick={() => {
          setOpen((v) => !v);
          if (unread > 0) markAllRead();
        }}
      >
        <FaBell size={22} color="#666" />
        {unread > 0 && <span className="notif-badge">{unread}</span>}
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
            {notifications.length === 0 ? (
              <div className="notif-empty">No notifications</div>
            ) : (
              notifications.slice(0, 12).map((n, i) => (
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