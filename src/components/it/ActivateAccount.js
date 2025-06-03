import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../../api/axiosInstance';

const ActivateAccount = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password || password !== confirm) {
      setError('Passwords must match and not be empty');
      return;
    }
    try {
      await api.post('/auth/activate-account', { token, password });
      alert('Account activated! You can now log in.');
      navigate('/');
    } catch (err) {
      setError('Activation failed. The link may be expired or invalid.');
    }
  };

  if (!token) return <div>Invalid activation link</div>;

  return (
    <div className="activation-container">
      <h2>Activate Your Account</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="password"
          placeholder="New password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          minLength={6}
        />
        <input
          type="password"
          placeholder="Confirm password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          required
          minLength={6}
        />
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit">Set Password & Activate</button>
      </form>
    </div>
  );
};

export default ActivateAccount;
