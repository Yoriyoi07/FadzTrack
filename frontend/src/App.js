import React, { useEffect, useState, useCallback } from "react";
import { BrowserRouter as Router, useLocation } from "react-router-dom";
import AppRoutes from './components/Routes';
import { ToastContainer } from "react-toastify";
import 'react-toastify/dist/ReactToastify.css';
import { NotificationProvider } from "./context/NotificationContext";

const getUserId = () => {
  const stored = localStorage.getItem('user');
  return stored ? JSON.parse(stored)._id : undefined;
};

const App = () => {
  const [userId, setUserId] = useState(getUserId);

  // Update the userId whenever the localStorage user changes
  useEffect(() => {
    const syncUserId = () => setUserId(getUserId());
    window.addEventListener('storage', syncUserId);
    return () => window.removeEventListener('storage', syncUserId);
  }, []);

  // Force update of user ID
  const forceUserUpdate = useCallback(() => {
    setUserId(getUserId());
  }, []);

  const SkylineOverlay = () => {
    const location = useLocation();
    const [showSkyline, setShowSkyline] = useState(false);
    
    useEffect(() => {
      // Only add scroll listener if not on login page
      if (location.pathname === '/') return;
      
      const handleScroll = () => {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const windowHeight = window.innerHeight;
        const documentHeight = document.documentElement.scrollHeight;
        
        // Show skyline when scrolled to bottom (within 100px of bottom)
        const isAtBottom = scrollTop + windowHeight >= documentHeight - 100;
        setShowSkyline(isAtBottom);
      };
      
      window.addEventListener('scroll', handleScroll);
      // Check initial position
      handleScroll();
      
      return () => window.removeEventListener('scroll', handleScroll);
    }, [location.pathname]);
    
    if (location.pathname === '/') return null; // hide on login page
    
    return (
      <div
        className="app-cityline"
        aria-hidden="true"
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          height: 'var(--cityline-h)',
          pointerEvents: 'none',
          zIndex: 1,
          opacity: showSkyline ? 0.95 : 0,
          transition: 'opacity 0.3s ease-in-out',
          backgroundRepeat: 'repeat-x',
          backgroundPosition: 'center bottom',
          backgroundSize: 'auto 100%',
          backgroundImage: `url(${process.env.PUBLIC_URL || ''}/images/download.png)`
        }}
      />
    );
  };

  const BlueprintGrid = () => {
    const location = useLocation();
    if (location.pathname === '/') return null; // hide on login page
    return (
      <div
        className="app-blueprint-grid"
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          pointerEvents: 'none',
          zIndex: 1,
          opacity: 0.6,
          background: `
            /* Major grid every 96px */
            repeating-linear-gradient(0deg, rgba(0,0,0,0.5), rgba(0,0,0,0.5) 1px, transparent 1px, transparent 96px),
            repeating-linear-gradient(90deg, rgba(0,0,0,0.5), rgba(0,0,0,0.5) 1px, transparent 1px, transparent 96px),
            /* Minor grid every 24px */
            repeating-linear-gradient(0deg, rgba(0,0,0,0.35), rgba(0,0,0,0.35) 1px, transparent 1px, transparent 24px),
            repeating-linear-gradient(90deg, rgba(0,0,0,0.35), rgba(0,0,0,0.35) 1px, transparent 1px, transparent 24px)
          `
        }}
      />
    );
  };

  const AppShell = () => {
    const location = useLocation();
    const pad = location.pathname === '/' ? '16px' : 'max(16px, calc(var(--cityline-h) * 0.5))';
    // Prevent body scroll on login page
    React.useEffect(() => {
      if (location.pathname === '/') {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
      }
    }, [location.pathname]);
    return (
      <div className="app-shell" style={{ position: 'relative', minHeight: '100vh' }}>
        <BlueprintGrid />
        <div className="app-content" style={{ position: 'relative', zIndex: 3, paddingBottom: pad }}>
          <AppRoutes forceUserUpdate={forceUserUpdate} />
        </div>
        <SkylineOverlay />
      </div>
    );
  };

  return (
    <Router>
      <NotificationProvider userId={userId} key={userId}> {/* Pass the userId */}
        <style>
          {`
            /* Global blueprint grid visibility - make dashboard backgrounds transparent */
            .dashboard-main, .dashboard-content, .dashboard-container {
              background: transparent !important;
            }
            /* Keep specific card backgrounds but make main containers transparent */
            .dashboard-card, .welcome-card, .ceo-welcome-card, .am-welcome-card {
              background: inherit;
            }
          `}
        </style>
        <AppShell />
        <ToastContainer />
      </NotificationProvider>
    </Router>
  );
};

export default App;
