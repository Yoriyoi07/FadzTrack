import React, { useState } from 'react';
import axios from 'axios';
import './style/TwoFactorAuth.css';

const TwoFactorAuth = ({ email, onSuccess }) => {
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');

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
      {message && <p className="error-message">{message}</p>}
    </div>
  );
};

export default TwoFactorAuth;
