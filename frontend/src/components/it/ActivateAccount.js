import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../../api/axiosInstance';
import '../style/it_style/ActivateAccount.css';

const ActivateAccount = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const pass = (password || '').trim();
    const conf = (confirm || '').trim();
    const policyOk = /[A-Z]/.test(pass) && /\d/.test(pass) && pass.length >= 6;
    if (!pass || pass !== conf) {
      setError('Passwords must match and not be empty');
      return;
    }
    if (!policyOk) {
      setError('Password must be at least 6 characters and include an uppercase letter and a number.');
      return;
    }
    try {
      await api.post('/auth/activate-account', { token, password: pass });
      alert('Account activated! You can now log in.');
      navigate('/');
    } catch (err) {
      const msg = err?.response?.data?.msg || '';
      if (/already activated/i.test(msg)) {
        // Treat as success (token reuse / user double-click)
        alert('Account was already activated. You can log in now.');
        navigate('/');
        return;
      }
      if (/invalid|expired|token/i.test(msg)) {
        setError('Activation failed. The link may be expired or invalid.');
      } else if (msg) {
        setError(msg);
      } else {
        setError('Activation failed. Please try again later.');
      }
    }
  };

  const handleBackToLogin = () => {
    navigate('/');
  };

  if (!token) return <div>Invalid activation link</div>;

  return (
    <div className="activation-container">
      <div className="activation-card">
        <div className="icon-container">
          <svg className="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 12l2 2 4-4"/>
            <circle cx="12" cy="12" r="9"/>
          </svg>
        </div>
        
        <h1 className="title">Activate Your Account</h1>
        <p className="subtitle">Set up your password to complete account activation</p>
        
        <form onSubmit={handleSubmit} className="activation-form">
          <div className="form-group">
            <label className="form-label">New Password</label>
            <div className="input-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Create your password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                className="form-input"
              />
              <button
                type="button"
                className="toggle-password-btn"
                onClick={() => setShowPassword(!showPassword)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  {showPassword ? (
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                  ) : (
                    <>
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </>
                  )}
                </svg>
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Confirm Password</label>
            <div className="input-wrapper">
              <input
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm your password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                minLength={6}
                className="form-input"
              />
              <button
                type="button"
                className="toggle-password-btn"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  {showConfirmPassword ? (
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                  ) : (
                    <>
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </>
                  )}
                </svg>
              </button>
            </div>
          </div>

          {error && <div className="error-message">{error}</div>}

          {!error && password && (
            <div style={{ fontSize:12, marginTop:4, color: (/[^A-Z]/.test(password) || /[^0-9]/.test(password)) ? '#555' : '#2f855a' }}>
              <span style={{ display:'block', color: /[A-Z]/.test(password) ? '#2f855a' : '#b91c1c' }}>• At least one uppercase letter {/[A-Z]/.test(password) ? '✓' : ''}</span>
              <span style={{ display:'block', color: /\d/.test(password) ? '#2f855a' : '#b91c1c' }}>• At least one number {/\d/.test(password) ? '✓' : ''}</span>
              <span style={{ display:'block', color: password.length >= 6 ? '#2f855a' : '#b91c1c' }}>• Minimum 6 characters {password.length >= 6 ? '✓' : ''}</span>
            </div>
          )}

          <button type="submit" className="submit-button">
            Set Password &amp; Activate
          </button>
        </form> 
      </div>
    </div>
  );
};

export default ActivateAccount;