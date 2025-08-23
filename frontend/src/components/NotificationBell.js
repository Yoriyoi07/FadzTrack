import React, { useState, useRef, useEffect } from "react";
import { useNotifications } from "../context/NotificationContext";
import { FaBell } from "react-icons/fa";
import './style/NotificationBell.css';
import { io } from "socket.io-client";

const socketUrl =
  process.env.NODE_ENV === "production"
    ? "wss://fadztrack.onrender.com"
    : "ws://localhost:5000";

const NotificationBell = () => {
  const {
    notifications,
    unread,
    setNotifications,
    setUnread,
    markAllRead,
  } = useNotifications();

  const [open, setOpen] = useState(false);
  const bellRef = useRef();
  const userId = localStorage.getItem("userId");

  // Debugging forceUpdate to re-render (optional)
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    if (!userId) return;

    const socket = io(socketUrl);
    console.log("Socket Connecting...");
    socket.emit("register", userId);

    socket.on("notification", (notif) => {
      console.log("Received notification:", notif);
      setNotifications((prev) => {
        const updatedNotifications = [notif, ...prev];
        console.log("Updated Notifications:", updatedNotifications);
        return updatedNotifications;
      });
      setUnread((prev) => prev + 1);
    });

    return () => {
      socket.disconnect();
      console.log("Socket disconnected");
    };
  }, [userId, setNotifications, setUnread]);

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
              notifications.slice(0, 8).map((n) => (
                <div
                  className={`notif-item${n.status === "unread" ? " unread" : ""}`}
                  key={n._id}
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