// src/App.js
import React, { useEffect, useState, useCallback } from "react";
import { BrowserRouter as Router } from "react-router-dom";
import AppRoutes from './components/Routes';
import { ToastContainer } from "react-toastify";
import { NotificationProvider } from "./context/NotificationContext";

const getUserId = () => {
  const stored = localStorage.getItem('user');
  return stored ? JSON.parse(stored)._id : undefined;
};

const App = () => {
  const [userId, setUserId] = useState(getUserId);

  // Sync on storage change (other tabs)
  useEffect(() => {
    const syncUserId = () => setUserId(getUserId());
    window.addEventListener('storage', syncUserId);
    return () => window.removeEventListener('storage', syncUserId);
  }, []);

  // Provide to children: call this after login/logout
  const forceUserUpdate = useCallback(() => {
    setUserId(getUserId());
  }, []);

  return (
    <Router>
      <NotificationProvider userId={userId} key={userId}>
        <AppRoutes forceUserUpdate={forceUserUpdate} />
        <ToastContainer />
      </NotificationProvider>
    </Router>
  );
};

export default App;
