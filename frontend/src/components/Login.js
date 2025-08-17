// src/components/LoginPage.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api, { setAccessToken } from '../api/axiosInstance';
import { setUser, getUser } from '../api/userStore';
import { FaEye, FaEyeSlash } from "react-icons/fa";
import "./style/Loginpage.css";
import backgroundImage from "../assets/images/login_picture.png";
import TwoFactorAuth from "./TwoFactorAuth";
import FadzLogo from "../assets/images/FadzLogo1.png";

const LoginPage = ({ forceUserUpdate }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [loginError, setLoginError] = useState("");
  const [show2FA, setShow2FA] = useState(false);
  const navigate = useNavigate();

  const validateEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  const handleEmailChange = (e) => {
    const v = e.target.value;
    setEmail(v);
    setEmailError(v && !validateEmail(v) ? "Please enter a valid email address." : "");
  };

  const redirectBasedOnRole = (role) => {
    if (role === "Person in Charge" || role === "PIC") navigate("/pic", { replace: true });
    else if (role === "Project Manager") navigate("/pm", { replace: true });
    else if (role === "Area Manager") navigate("/am", { replace: true });
    else if (role === "IT") navigate("/it", { replace: true });
    else if (role === "CEO") navigate("/ceo/dash", { replace: true });
    else if (role === "HR") navigate("/hr/dash", { replace: true });
    else if (role === "Staff") navigate("/staff/current-project", { replace: true });
    else if (role === "HR - Site") navigate("/hr-site/current-project", { replace: true });
    else navigate("/", { replace: true });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoginError("");
    try {
      const res = await api.post("/auth/login", { email, password });
      const { requires2FA, accessToken, token, user } = res.data;

      if (requires2FA) { setShow2FA(true); return; }

      const finalToken = accessToken || token;
      if (!finalToken) { setLoginError("No access token returned from server."); return; }

      setAccessToken(finalToken);
      const saved = setUser(user); // 🔧 normalize & persist
      if (forceUserUpdate) forceUserUpdate();
      redirectBasedOnRole(saved?.role);
    } catch (err) {
      setLoginError(err.response?.data?.msg || "Login failed");
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    const u = getUser();
    if (token && u?.role) redirectBasedOnRole(u.role);
    // eslint-disable-next-line
  }, [navigate]);

  return (
    <div className="login-container">
      <div className="login-left" style={{ backgroundImage: `url(${backgroundImage})` }} />
      <div className="login-right">
        <div className="login-form-container">
          <img src={FadzLogo} alt="Fadz Logo" className="right-logo" />
          <h1 className="app-title">FadzTrack</h1>

          {show2FA ? (
            <TwoFactorAuth
              email={email}
              onSuccess={(accessToken, userFrom2FA) => {
                setAccessToken(accessToken);
                const saved = setUser(userFrom2FA); // 🔧 normalize & persist
                if (forceUserUpdate) forceUserUpdate();
                redirectBasedOnRole(saved?.role);
              }}
              forceUserUpdate={forceUserUpdate}
            />
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  type="text"
                  id="email"
                  value={email}
                  onChange={handleEmailChange}
                  placeholder="Enter your Email"
                  className={`input-field ${emailError ? "error" : ""}`}
                />
                {emailError && <p className="error-message">{emailError}</p>}
              </div>

              <div className="form-group">
                <label htmlFor="password">Password</label>
                <div className="password-input-container">
                  <input
                    type={showPassword ? "text" : "password"}
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="input-field"
                  />
                  <button
                    type="button"
                    className="toggle-password"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <FaEyeSlash size={16} /> : <FaEye size={16} />}
                  </button>
                </div>
              </div>

              {loginError && <p className="error-message">{loginError}</p>}

              <button type="submit" className="login-button" disabled={!!emailError || !email || !password}>
                Login
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
