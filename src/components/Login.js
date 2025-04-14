import React, { useState } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import "./style/Loginpage.css";
import backgroundImage from "../assets/images/login_picture.png";

const LoginPage = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");

  const validateEmail = (value) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(value);
  };

  const handleEmailChange = (e) => {
    const value = e.target.value;
    setEmail(value);
    setEmailError(
      value && !validateEmail(value) ? "Please enter a valid email address." : ""
    );
  };

  return (
    <div className="login-container">
      {/* Left Side - Background Image */}
      <div
        className="login-left"
        style={{ backgroundImage: `url(${backgroundImage})` }}
      >
        <img src="/images/Fadz-logo.png" alt="Fadz Logo" className="left-logo" />
      </div>

      {/* Right Side - Login Form */}
      <div className="login-right">
        <div className="login-form-container">
          <img src="/images/FadzLogo 1.png" alt="Fadz Logo" className="right-logo" />
          <h1 className="app-title">FadzTrack</h1>

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
                placeholder="Enter your password"
                className="input-field"
              />
              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <FaEyeSlash size={16} style={{ display: "block" }} />
                ) : (
                  <FaEye size={16} style={{ display: "block" }} />
                )}
              </button>
            </div>
          </div>

          <div className="form-options">
            <div className="remember-me">
              <input type="checkbox" id="remember" />
              <label htmlFor="remember">Remember Me</label>
            </div>
            <a href="#" className="forgot-link">
              Forgot Password?
            </a>
          </div>

          <button className="login-button" disabled={!!emailError || !email}>
            Login
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
