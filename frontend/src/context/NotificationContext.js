// src/context/NotificationContext.js
import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import { toast } from "react-toastify";
import api from "../api/axiosInstance";

const NotificationContext = createContext();
export const useNotifications = () => useContext(NotificationContext);

const socketUrl =
  process.env.NODE_ENV === "production"
    ? "https://fadztrack-production.up.railway.app"
    : "http://localhost:5000";

export const NotificationProvider = ({ children, userId }) => {
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const socketRef = useRef(null);

  // Fetch notifications on mount or userId change
  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      setUnread(0);
      return;
    }
    api
      .get("/notifications", { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } })
      .then((res) => {
        setNotifications(res.data);
        setUnread(res.data.filter((n) => n.status === "unread").length);
      });
  }, [userId]);

  // Setup socket only once per userId
  useEffect(() => {
    if (!userId) return;
    if (socketRef.current) socketRef.current.disconnect();

    const socket = io(socketUrl, { transports: ["websocket"] });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("register", userId);
      // console.log("Socket.IO Connected & registered:", socket.id);
    });

    socket.on("notification", (notif) => {
      setNotifications((prev) => [notif, ...prev]);
      setUnread((prev) => prev + 1);
      toast.info(notif.message, { position: "top-right" });
    });

    return () => {
      socket.disconnect();
    };
  }, [userId]);

  // Mark all as read
  const markAllRead = () => {
    setUnread(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, status: "read" })));
    api.patch(
      "/notifications/mark-all-read",
      {},
      { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
    );
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unread,
        markAllRead,
        setUnread,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};
