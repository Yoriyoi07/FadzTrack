import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import "./style/Loginpage.css";
import backgroundImage from "../assets/images/login_picture.png";
import TwoFactorAuth from "../components/TwoFactorAuth";

const LoginPage = () => {
  // State hooks for login form
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [loginError, setLoginError] = useState("");
  const [show2FA, setShow2FA] = useState(false); // Show 2FA form after initial login
  const navigate = useNavigate();

  // Email format validation using regex
  const validateEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  // Handle email input change and validate format
  const handleEmailChange = (e) => {
    const value = e.target.value;
    setEmail(value);
    setEmailError(
      value && !validateEmail(value) ? "Please enter a valid email address." : ""
    );
  };

  // Submit login credentials to backend
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoginError("");

    try {
      const res = await axios.post("http://localhost:5000/api/auth/login", { email, password });
      console.log("Login response:", res.data); 
      const { token, user, requires2FA } = res.data;

      if (requires2FA) {
        // Show 2FA component if backend requires verification
        setShow2FA(true);
      } else {
        // Store token and user data locally and redirect
        localStorage.setItem("token", token);
        localStorage.setItem("user", JSON.stringify(user));
        redirectBasedOnRole(user.role);
      }
    } catch (err) {
      console.log(err.response?.data); 
      // Display any login errors returned by server
      setLoginError(err.response?.data?.msg || "Login failed");
    }
  };

  // Called after successful 2FA verification
  const handle2FASuccess = () => {
    const user = JSON.parse(localStorage.getItem('user'));
    if (user) {
      redirectBasedOnRole(user.role);
    } else {
      setLoginError("User info missing after 2FA verification.");
    }
  };

  // Redirect user to dashboard based on role
  const redirectBasedOnRole = (role) => {
    if (role === "Project in Charge") {
      navigate("/h"); 
    } else if (role === "Project Manager") {
      navigate("/c"); 
    }else if (role === "Area Manager") {
      navigate("/am"); 
    }else if (role === "IT") {
      navigate("/it"); }
      else if (role === "CEO") {
      navigate("/ceo/dash"); 
    } else {
      setLoginError("Unknown user role");
    }
  };

  return (
    <div className="login-container">
      {/* Left side with background image and logo */}
      <div
        className="login-left"
        style={{ backgroundImage: `url(${backgroundImage})` }}
      >
        <img src="/images/Fadz-logo.png" alt="Fadz Logo" className="left-logo" />
      </div>

      {/* Right side login form */}
      <div className="login-right">
        <div className="login-form-container">
          <img src="/images/FadzLogo 1.png" alt="Fadz Logo" className="right-logo" />
          <h1 className="app-title">FadzTrack</h1>

          {/* Conditionally show 2FA component or login form */}
          {show2FA ? (
            <TwoFactorAuth email={email} onSuccess={handle2FASuccess} />
          ) : (
            <form onSubmit={handleSubmit}>
              {/* Email input field */}
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

              {/* Password input field with show/hide toggle */}
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

              {/* Remember me & Forgot password */}
              <div className="form-options">
                <div className="remember-me">
                  <input type="checkbox" id="remember" />
                  <label htmlFor="remember">Remember Me</label>
                </div>
                <a href="#" className="forgot-link">Forgot Password?</a>
              </div>

              {/* Show login error if any */}
              {loginError && <p className="error-message">{loginError}</p>}

              {/* Submit button - disabled if form is invalid */}
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
