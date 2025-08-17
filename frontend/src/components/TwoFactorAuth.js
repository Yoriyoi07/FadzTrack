// src/components/TwoFactorAuth.jsx
import React, { useState, useEffect } from 'react';
import api, { setAccessToken } from '../api/axiosInstance';
import { setUser } from '../api/userStore';
import './style/TwoFactorAuth.css';

const TwoFactorAuth = ({ email, onSuccess, forceUserUpdate }) => {
  const [code, setCode] = useState('');
  const [remember, setRemember] = useState(true);
  const [message, setMessage] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (code.length !== 6) return;
    setSubmitting(true);
    setMessage('');
    try {
      const { data } = await api.post('/auth/verify-2fa', { email, code, rememberDevice: remember });
      setAccessToken(data.accessToken);
      const saved = setUser({ ...data.user }); // 🔧 normalize & persist

      if (onSuccess) onSuccess(data.accessToken, saved);
      if (forceUserUpdate) forceUserUpdate();
    } catch (error) {
      setMessage(error?.response?.data?.msg || 'Verification failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setResending(true);
    setMessage('');
    try {
      const res = await api.post('/auth/resend-2fa', { email });
      setMessage(res.data.msg || 'Code resent.');
      setCooldown(30);
    } catch (err) {
      setMessage(err?.response?.data?.msg || 'Error resending code.');
    } finally {
      setResending(false);
    }
  };

  useEffect(() => {
    if (!cooldown) return;
    const iv = setInterval(() => setCooldown((c) => (c <= 1 ? (clearInterval(iv), 0) : c - 1)), 1000);
    return () => clearInterval(iv);
  }, [cooldown]);

  return (
    <div className="two-fa-container">
      <h3>We sent a verification code to your email.</h3>
      <h2>Enter Verification Code</h2>

      <form onSubmit={handleSubmit} className="two-fa-form">
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="6-digit code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          maxLength={6}
          className="two-fa-input"
          required
        />

        <label className="two-fa-remember">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          Remember this device for 30 days
        </label>

        <button type="submit" className="two-fa-verify-btn" disabled={submitting || code.length !== 6}>
          {submitting ? 'Verifying…' : 'Verify'}
        </button>
      </form>

      <button onClick={handleResend} disabled={cooldown > 0 || resending} className="two-fa-resend-btn">
        {cooldown > 0 ? `Resend in ${cooldown}s` : resending ? 'Sending…' : 'Resend Code'}
      </button>

      {message && <p className="two-fa-message">{message}</p>}
    </div>
  );
};

export default TwoFactorAuth;
