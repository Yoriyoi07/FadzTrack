import React, { createContext, useContext, useEffect, useState } from "react";
import { io } from "socket.io-client";
import { toast } from "react-toastify";
import api from "../api/axiosInstance";

const NotificationContext = createContext();

export const useNotifications = () => useContext(NotificationContext);

const socketUrl =
  process.env.NODE_ENV === "production"
    ? "https://fadztrack.vercel.app"
    : "http://localhost:5000";

export const NotificationProvider = ({ children, userId }) => {
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!userId) return;

    console.log("🔑 [NotificationProvider] userId:", userId);
    console.log("🌐 [NotificationProvider] Connecting to socketUrl:", socketUrl);

   api
  .get("/notifications", { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } })
  .then((res) => {
    setNotifications(res.data.reverse());
    setUnread(res.data.filter((n) => !n.read).length);
  });


    // Connect to socket
    const socket = io(socketUrl, { transports: ["websocket"] });

    socket.on("connect", () => {
      console.log("✅ [Socket.IO] Connected!", socket.id);
      socket.emit("register", userId);
      console.log("📨 [Socket.IO] Register emitted with userId:", userId);
    });

    socket.on("connect_error", (err) => {
      console.error("❌ [Socket.IO] Connection error:", err);
    });

    socket.on("disconnect", (reason) => {
      console.warn("⚠️ [Socket.IO] Disconnected:", reason);
    });

    socket.on("notification", (notif) => {
      console.log("📢 [Socket.IO] Notification received:", notif);
      setNotifications((prev) => [notif, ...prev]);
      setUnread((prev) => prev + 1);
      toast.info(notif.message, { position: "top-right" });
    });

    return () => {
      console.log("🛑 [Socket.IO] Disconnecting...");
      socket.disconnect();
    };
  }, [userId]);

  // Mark all as read
  const markAllRead = () => {
    setUnread(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
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
