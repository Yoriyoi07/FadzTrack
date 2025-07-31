import React, { useState, useEffect } from 'react';
import api from '../api/axiosInstance';
import './style/TwoFactorAuth.css';

const TwoFactorAuth = ({ email, onSuccess, forceUserUpdate }) => {
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [cooldown, setCooldown] = useState(0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post(
        '/auth/verify-2fa',
        { email, code }
      );
      onSuccess(data.accessToken, {
        ...data.user,
        _id: data.user._id || data.user.id
      });
      if (forceUserUpdate) forceUserUpdate(); // <-- ensure NotificationProvider gets new user
    } catch (error) {
      setMessage(error.response?.data?.msg || 'Verification failed.');
    }
  };

  const handleResend = async () => {
    try {
      const res = await api.post(
        '/auth/resend-2fa',
        { email }
      );
      setMessage(res.data.msg);
      setCooldown(30);
    } catch (err) {
      setMessage(err.response?.data?.msg || 'Error resending code.');
    }
  };

  useEffect(() => {
    if (!cooldown) return;
    const iv = setInterval(() => {
      setCooldown(c => (c <= 1 ? (clearInterval(iv), 0) : c - 1));
    }, 1000);
    return () => clearInterval(iv);
  }, [cooldown]);

  return (
    <div className="two-fa-container">
      <h3>We have sent a verification code to your email.</h3>
      <h2>Enter Verification Code</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="6-digit code"
          value={code}
          onChange={e => setCode(e.target.value)}
          maxLength={6}
          required
        />
        <button type="submit">Verify</button>
      </form>
      <button
        onClick={handleResend}
        disabled={cooldown > 0}
        className="resend-button"
      >
        {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend Code'}
      </button>
      {message && <p className="error-message">{message}</p>}
    </div>
  );
};

export default TwoFactorAuth;
