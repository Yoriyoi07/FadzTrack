import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from '../api/axiosInstance';
import { FaEye, FaEyeSlash } from "react-icons/fa";
import "./style/Loginpage.css";
import backgroundImage from "../assets/images/login_picture.png";
import TwoFactorAuth from "./TwoFactorAuth";
import FadzLogo from "../assets/images/FadzLogo1.png"

const LoginPage = ({ forceUserUpdate }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [loginError, setLoginError] = useState("");
  const [show2FA, setShow2FA] = useState(false);
  const navigate = useNavigate();

  const validateEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const handleEmailChange = (e) => {
    const value = e.target.value;
    setEmail(value);
    setEmailError(
      value && !validateEmail(value) ? "Please enter a valid email address." : ""
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoginError("");
    try {
      const res = await api.post("/auth/login", { email, password });
      const { token, user, requires2FA } = res.data;
      if (requires2FA) {
        setShow2FA(true);
      } else {
        localStorage.setItem("token", token);
        localStorage.setItem("user", JSON.stringify(user));
        if (forceUserUpdate) forceUserUpdate();  // <-- ensures NotificationProvider gets user
        redirectBasedOnRole(user.role);
      }
    } catch (err) {
      setLoginError(err.response?.data?.msg || "Login failed");
    }
  };

  const redirectBasedOnRole = (role) => {
    if (role === "Person in Charge" || role === "PIC") {
      navigate("/pic", { replace: true });
    } else if (role === "Project Manager") {
      navigate("/pm", { replace: true });
    } else if (role === "Area Manager") {
      navigate("/am", { replace: true });
    } else if (role === "IT") {
      navigate("/it", { replace: true });
    } else if (role === "CEO") {
      navigate("/ceo/dash", { replace: true });
    } else if (role === "HR") {
      navigate("/hr/dash", { replace: true });
    }else if (role === "Staff") {
      navigate("/staff/current-project", { replace: true });
    } else if (role === "HRS") {
      navigate("/hr-site/current-project", { replace: true });
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    const user = JSON.parse(localStorage.getItem("user"));
    if (token && user && user.role) {
      redirectBasedOnRole(user.role);
    }
    // eslint-disable-next-line
  }, [navigate]);

  return (
    <div className="login-container">
      {/* Left side with background image and logo */}
      <div
        className="login-left"
        style={{ backgroundImage: `url(${backgroundImage})` }}
      >
      </div>
      {/* Right side login form */}
      <div className="login-right">
        <div className="login-form-container">
          <img src={FadzLogo} alt="Fadz Logo" className="right-logo" />
          <h1 className="app-title">FadzTrack</h1>
          {/* Conditionally show 2FA component or login form */}
          {show2FA ? (
            <TwoFactorAuth
              email={email}
              onSuccess={(accessToken, user) => {
                localStorage.setItem('token', accessToken);
                localStorage.setItem('user', JSON.stringify(user));
                if (forceUserUpdate) forceUserUpdate(); // <-- again, after 2FA success
                redirectBasedOnRole(user.role);
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
              <button
                type="submit"
                className="login-button"
                disabled={!!emailError || !email || !password}
              >
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
