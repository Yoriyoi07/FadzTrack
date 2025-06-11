import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import AppRoutes from './components/Routes';
import { ToastContainer } from 'react-toastify';
import { NotificationProvider } from "./context/NotificationContext";

const userId = JSON.parse(localStorage.getItem('user'))?._id;

const App = () => {
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
