// src/components/TwoFactorAuth.jsx
import React, { useState, useEffect } from 'react';
import { FaShieldAlt, FaClock, FaEnvelope, FaCheckCircle } from 'react-icons/fa';
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
      setMessage(res.data.msg || 'Code resent successfully.');
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
      <div className="two-fa-header">
        <div className="two-fa-title-row">
          <FaShieldAlt className="two-fa-icon" size={32} />
          <h2 className="two-fa-title">Two-Factor Authentication</h2>
        </div>
        <p className="two-fa-subtitle">
          We sent a verification code to <strong>{email}</strong>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="two-fa-form">
        <div className="verification-input-group">
          <label htmlFor="verification-code" className="verification-label">
            <FaEnvelope className="input-icon" />
            Enter Verification Code
          </label>
          <input
            id="verification-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="Enter 6-digit code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            maxLength={6}
            className="verification-input"
            required
          />
        </div>

        <div className="remember-device-group">
          <label className="remember-device-label">
            <input 
              type="checkbox" 
              checked={remember} 
              onChange={(e) => setRemember(e.target.checked)}
              className="remember-checkbox"
            />
            <span className="checkbox-custom"></span>
            <span className="remember-text">Remember this device for 30 days</span>
          </label>
        </div>

        <button 
          type="submit" 
          className={`verify-button ${submitting ? 'loading' : ''}`} 
          disabled={submitting || code.length !== 6}
        >
          {submitting ? (
            <span className="loading-content">
              <span className="spinner"></span>
              Verifying...
            </span>
          ) : (
            <>
              <FaCheckCircle className="button-icon" />
              Verify Code
            </>
          )}
        </button>
      </form>

      <div className="resend-section">
        <button 
          onClick={handleResend} 
          disabled={cooldown > 0 || resending} 
          className={`resend-button ${cooldown > 0 ? 'disabled' : ''}`}
        >
          {cooldown > 0 ? (
            <>
              <FaClock className="button-icon" />
              Resend in {cooldown}s
            </>
          ) : resending ? (
            <>
              <span className="spinner"></span>
              Sending...
            </>
          ) : (
            <>
              <FaEnvelope className="button-icon" />
              Resend Code
            </>
          )}
        </button>
      </div>

      {message && (
        <div className={`message-display ${message.includes('successfully') ? 'success' : 'error'}`}>
          <span className="message-text">{message}</span>
        </div>
      )}
    </div>
  );
};

export default TwoFactorAuth;
