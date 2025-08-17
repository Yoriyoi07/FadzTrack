// src/components/PrivateRoute.jsx
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { getUser } from '../api/userStore';

const PrivateRoute = ({ allowedRoles }) => {
  const token = localStorage.getItem('token');
  const user = getUser();

  if (!token || !user) return <Navigate to="/" replace />;
  if (allowedRoles?.length && !allowedRoles.includes(user.role)) return <Navigate to="/" replace />;

  return <Outlet />;
};

export default PrivateRoute;
