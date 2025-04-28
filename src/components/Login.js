import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import "./style/Loginpage.css";
import backgroundImage from "../assets/images/login_picture.png";
import TwoFactorAuth from "../components/TwoFactorAuth";

const LoginPage = () => {
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
      const res = await axios.post("http://localhost:5000/api/auth/login", { email, password });
      const { token, user, requires2FA } = res.data;

      if (requires2FA) {
        setShow2FA(true);
      } else {
        localStorage.setItem("token", token);
        localStorage.setItem("user", JSON.stringify(user));
        redirectBasedOnRole(user.role);
      }
    } catch (err) {
      setLoginError(err.response?.data?.msg || "Login failed");
    }
  };

  const handle2FASuccess = () => {
    const user = JSON.parse(localStorage.getItem('user'));
    if (user) {
      redirectBasedOnRole(user.role);
    } else {
      setLoginError("User info missing after 2FA verification.");
    }
  };

  const redirectBasedOnRole = (role) => {
    if (role === "pic") {
      navigate("/h");
    } else if (role === "pm") {
      navigate("/c");
    } else {
      setLoginError("Unknown user role");
    }
  };

  return (
    <div className="login-container">
      <div
        className="login-left"
        style={{ backgroundImage: `url(${backgroundImage})` }}
      >
        <img src="/images/Fadz-logo.png" alt="Fadz Logo" className="left-logo" />
      </div>

      <div className="login-right">
        <div className="login-form-container">
          <img src="/images/FadzLogo 1.png" alt="Fadz Logo" className="right-logo" />
          <h1 className="app-title">FadzTrack</h1>

          {show2FA ? (
            <TwoFactorAuth email={email} onSuccess={handle2FASuccess} />
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

              <div className="form-options">
                <div className="remember-me">
                  <input type="checkbox" id="remember" />
                  <label htmlFor="remember">Remember Me</label>
                </div>
                <a href="#" className="forgot-link">Forgot Password?</a>
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
