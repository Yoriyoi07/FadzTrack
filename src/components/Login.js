import React, { useState } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import "./style/Loginpage.css";

const LoginPage = () => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="container">
      {/* Left Side - Background Image */}
      <div className="left-side">
        <img src="/images/Fadz-logo.png" alt="Company Logo" className="company-logo" />
      </div>

      {/* Right Side - Login Form */}
      <div className="right-side">
        <img src="/images/FadzLogo 1.png" alt="App Logo" className="app-logo" />
        <h1 className="title">FadzTrack</h1>

        <div className="form-container">
          <p className="user">Username</p>
          <input type="text" placeholder="Enter your username" className="input-field" />

          <p className="user">Password</p>
          <div className="password-container">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              className="input-field"
            />
            <span className="eye-icon" onClick={() => setShowPassword(!showPassword)}>
              {showPassword ? <FaEyeSlash /> : <FaEye />}
            </span>
          </div>

          <div className="options">
            <label>
              <input type="checkbox" /> Remember Me
            </label>
            <a href="#" className="forgot-password">Forgot Password?</a>
          </div>

          <button className="login-button">Login</button>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
