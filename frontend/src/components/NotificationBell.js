import React, { useState, useRef, useEffect } from "react";
import { useNotifications } from "../context/NotificationContext";
import { FaBell } from "react-icons/fa";
import './style/NotificationBell.css';

const NotificationBell = () => {
  const {
    notifications,
    unread,
    markAllRead,
  } = useNotifications();

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

  const getNotificationType = (type) => {
    switch (type) {
      case "discussion":
        return "New discussion posted";
      case "reply":
        return "New reply to your discussion";
      case "mention":
        return "You were mentioned";
      case "manpower":
        return "New manpower request";
      case "task":
        return "Task update";
      case "system":
        return "System update";
      default:
        return "General notification";
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
              notifications.slice(0, 8).map((n, i) => (
                <div
                  className={`notif-item${n.status === "unread" ? " unread" : ""}`}
                  key={(n && n._id ? String(n._id) : `notif-${i}`) + `-${i}`}
                >
                  <div className="notif-msg">
                    {getNotificationType(n.type)}: {n.message}
                  </div>
                  <div className="notif-date">
                    {new Date(n.createdAt).toLocaleString()}
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