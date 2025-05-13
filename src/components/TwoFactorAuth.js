import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './style/TwoFactorAuth.css';

const TwoFactorAuth = ({ email, onSuccess }) => {
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [cooldown, setCooldown] = useState(0); // in seconds

  // Handle verification of 2FA code
  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const response = await axios.post('http://localhost:5000/api/auth/verify-2fa', { email, code });

      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));

      onSuccess();
    } catch (error) {
      setMessage(error.response?.data?.msg || 'Verification failed.');
    }
  };

  // Handle resend code with cooldown
  const handleResend = async () => {
    try {
      const res = await axios.post('http://localhost:5000/api/auth/resend-2fa', { email });
      setMessage(res.data.msg);
      setCooldown(30); // start 30-second cooldown
    } catch (err) {
      setMessage(err.response?.data?.msg || 'Error resending code.');
    }
  };

  // Countdown effect
  useEffect(() => {
    if (cooldown === 0) return;

    const interval = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [cooldown]);

  return (
    <div className="two-fa-container">
      <h2>Enter Verification Code</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="6-digit code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          maxLength={6}
          required
        />
        <button type="submit">Verify</button>
      </form>

      {/* Resend Button */}
      <button onClick={handleResend} disabled={cooldown > 0} className="resend-button">
        {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend Code'}
      </button>

      {/* Message display */}
      {message && <p className="error-message">{message}</p>}
    </div>
  );
};

export default TwoFactorAuth;
