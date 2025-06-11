import React, { useState, useRef, useEffect } from "react";
import { useNotifications } from "../context/NotificationContext";
import { FaBell } from "react-icons/fa";
import './style/NotificationBell.css';

const NotificationBell = () => {
  const { notifications, unread, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const bellRef = useRef();

  useEffect(() => {
    // Click outside closes popup
    const handleClick = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="notif-bell-container" ref={bellRef}>
      <div className="notif-bell-icon" onClick={() => { setOpen((v) => !v); if (unread > 0) markAllRead(); }}>
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
              notifications.slice(0, 8).map((n) => (
                <div className={`notif-item${n.read ? "" : " unread"}`} key={n._id}>
                  <div className="notif-msg">{n.message}</div>
                  <div className="notif-date">{new Date(n.createdAt).toLocaleString()}</div>
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
