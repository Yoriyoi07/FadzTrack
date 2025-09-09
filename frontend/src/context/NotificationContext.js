import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import { toast } from "react-toastify";
import api from "../api/axiosInstance";
import { SOCKET_URL, SOCKET_PATH } from "../utils/socketConfig";

const NotificationContext = createContext();

export const useNotifications = () => useContext(NotificationContext);

// Use centralized socket URL/path

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

    const token = localStorage.getItem("token");
    if (!token) return;

    api
      .get("/notifications", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      .then((res) => {
        setNotifications(res.data);
        setUnread(res.data.filter((n) => n.status === "unread").length);
      })
      .catch((err) => {
        console.error("Failed to fetch notifications:", err);
        toast.error("Unable to load notifications");
      });
  }, [userId]);

  // Setup socket only once per userId
  useEffect(() => {
    if (!userId) return;

  const socket = io(SOCKET_URL, { path: SOCKET_PATH, transports: ["websocket","polling"], withCredentials: true });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("Socket connected successfully");
      socket.emit("register", userId);
    });

    socket.on("notification", (notif) => {
      console.log("Received notification:", notif);
      setNotifications((prev) => [notif, ...prev]);
      setUnread((prev) => prev + 1);
      toast.info(notif.message, { position: "top-right" });
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnected");
    });

    return () => {
      socket.off("connect");
      socket.off("notification");
      socket.off("disconnect");
      socket.disconnect();
      console.log("Socket disconnected");
    };
  }, [userId]);

  // Mark all as read
  const markAllRead = () => {
    setUnread(0);
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, status: "read" }))
    );

    const token = localStorage.getItem("token");
    if (!token) return;

    api.patch(
      "/notifications/mark-all-read",
      {},
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
  };

  // Mark a single notification as read
  const markAsRead = (notificationId) => {
    setNotifications((prev) =>
      prev.map((n) =>
        n._id === notificationId ? { ...n, status: "read" } : n
      )
    );
    setUnread((prev) => Math.max(prev - 1, 0));

    const token = localStorage.getItem("token");
    if (!token) return;

    api.patch(
      "/notifications/mark-read",
      { ids: [notificationId] },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
  };

  return (
    <NotificationContext.Provider
      value={{
  notifications,
  unread,
  markAllRead,
  setNotifications,
  setUnread,
  socketRef,
  markAsRead,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};