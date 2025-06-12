import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import AppRoutes from './components/Routes';
import { ToastContainer } from 'react-toastify';
import { NotificationProvider } from "./context/NotificationContext";

const App = () => {
  const [userId, setUserId] = useState(() =>
    JSON.parse(localStorage.getItem('user'))?._id
  );

  useEffect(() => {
    const listener = () => setUserId(JSON.parse(localStorage.getItem('user'))?._id);
    window.addEventListener('storage', listener); // just in case
    return () => window.removeEventListener('storage', listener);
  }, []);

  return (
    <Router>
      <NotificationProvider userId={userId}>
        <AppRoutes />
        <ToastContainer />
      </NotificationProvider>
    </Router>
  );
};

export default App;
