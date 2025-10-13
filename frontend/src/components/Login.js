// src/components/LoginPage.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api, { setAccessToken } from '../api/axiosInstance';
import { setUser, getUser } from '../api/userStore';
import { FaEye, FaEyeSlash, FaEnvelope, FaLock } from "react-icons/fa";
import "./style/Loginpage.css";
import backgroundImage from "../assets/images/login_picture.png";
import TwoFactorAuth from "./TwoFactorAuth";
// Company logo - FADZ CONSTRUCTION INCORPORATED logo
const FadzLogo = "/images/fadz-company-logo.png";
// App logo - Abstract app logo with red base and blue elements
const AppLogo = "/images/fadz-app-logo.png";

const LoginPage = ({ forceUserUpdate }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [loginError, setLoginError] = useState("");
  const [show2FA, setShow2FA] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
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

  const getSpecificErrorMessage = (serverMessage, statusCode) => {
    const message = serverMessage.toLowerCase();
    
    // Check for specific indicators in the server message
    if (message.includes("email") || message.includes("user") || message.includes("not found") || message.includes("doesn't exist") || message.includes("no user") || message.includes("invalid email")) {
      return "Email address not found. Please check your email.";
    }
    
    if (message.includes("password") || message.includes("credentials") || message.includes("incorrect") || message.includes("wrong") || message.includes("mismatch") || message.includes("invalid password")) {
      return "Incorrect password. Please try again.";
    }
    
    if (message.includes("account") || message.includes("disabled") || message.includes("locked") || message.includes("suspended")) {
      return "Account is disabled. Please contact support.";
    }
    
    if (message.includes("too many") || message.includes("attempts") || message.includes("rate limit")) {
      return "Too many login attempts. Please try again later.";
    }
    
    // For generic messages, provide helpful guidance
    if (message.includes("invalid") || message.includes("failed") || message.includes("credentials") || message.includes("authentication")) {
      // This is a generic auth failure - try to be more helpful
      return "Invalid email or password. Please check both and try again.";
    }
    
    // If we have a server message, use it
    if (serverMessage) {
      return serverMessage;
    }
    
    // Default messages based on status code
    switch (statusCode) {
      case 401:
        return "Invalid email or password. Please check your credentials.";
      case 400:
        return "Invalid request. Please check your input.";
      case 403:
        return "Access denied. Please contact your administrator.";
      case 429:
        return "Too many login attempts. Please try again later.";
      case 500:
        return "Server error. Please try again later.";
      default:
        return "Login failed. Please check your credentials.";
    }
  };

  const checkEmailExists = async (email) => {
    try {
      console.log("Checking if email exists:", email);
      // Make a request to check if the email exists
      // This endpoint should exist on your backend or we can create a simple one
      const response = await api.post("/auth/check-email", { email });
      console.log("Email check response:", response.data);
      return response.data.exists;
    } catch (error) {
      // If the endpoint doesn't exist, we'll fall back to the old method
      console.log("Email check endpoint not available, falling back to generic error handling");
      console.log("Email check error:", error);
      return null;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoginError("");
    setIsLoading(true);
    
    // Check for empty fields first
    if (!email.trim() || !password.trim()) {
      setLoginError("Please fill in all required fields.");
      setIsLoading(false);
      return;
    }
    
    // Check if email format is valid before sending to server
    if (!validateEmail(email.trim())) {
      setLoginError("Please enter a valid email address.");
      setIsLoading(false);
      return;
    }
    
    // Declare emailExists variable in the proper scope
    let emailExists = null;
    
    try {
      // First, try to check if the email exists
      emailExists = await checkEmailExists(email.trim());
      
      if (emailExists === false) {
        // Email definitely doesn't exist
        setLoginError("Email address not found. Please check your email.");
        setIsLoading(false);
        return;
      }
      
      // Log what we're sending to the server
      console.log("Sending login request with:", { email: email.trim(), password: password ? "***" : "empty" });
      
  const res = await api.post("/auth/login", { email: email.trim(), password: (password || '').trim() });
      const { requires2FA, accessToken, token, user } = res.data;

      if (requires2FA) { 
        setShow2FA(true); 
        setIsLoading(false);
        return; 
      }

      const finalToken = accessToken || token;
      if (!finalToken) { 
        setLoginError("No access token returned from server."); 
        setIsLoading(false);
        return; 
      }

      setAccessToken(finalToken);
      const saved = setUser(user);
      if (forceUserUpdate) forceUserUpdate();
      redirectBasedOnRole(saved?.role);
    } catch (err) {
      // Provide more specific error messages based on server response
      let errorMessage = "Login failed. Please check your credentials.";
      
      // Log the full error for debugging
      console.log("Login error:", err);
      console.log("Response status:", err.response?.status);
      console.log("Response data:", err.response?.data);
      console.log("Email exists check result:", emailExists);
      
      // Get the server message
      const serverMessage = err.response?.data?.msg || err.response?.data?.message || "";
      const statusCode = err.response?.status;
      
      console.log("Server message:", serverMessage);
      console.log("Status code:", statusCode);
      console.log("Message analysis:", {
        hasEmail: serverMessage.toLowerCase().includes("email"),
        hasUser: serverMessage.toLowerCase().includes("user"),
        hasNotFound: serverMessage.toLowerCase().includes("not found"),
        hasPassword: serverMessage.toLowerCase().includes("password"),
        hasInvalid: serverMessage.toLowerCase().includes("invalid"),
        hasCredentials: serverMessage.toLowerCase().includes("credentials")
      });
      
      // Determine the error message based on what we know
      if (statusCode === 503 && serverMessage) {
        // Backend indicates 2FA email could not be sent
        errorMessage = serverMessage;
      } else {
      if (emailExists === false) {
        // We know the email doesn't exist
        errorMessage = "Email address not found. Please check your email.";
      } else if (emailExists === true) {
        // We know the email exists, so this must be a password issue
        errorMessage = "Incorrect password. Please try again.";
      } else {
        // We couldn't check email existence, so use server message analysis
        errorMessage = getSpecificErrorMessage(serverMessage, statusCode);
      }
      }
      
      // Handle network errors separately
      if (err.message && !statusCode) {
        if (err.message.includes("Network Error")) {
          errorMessage = "Network error. Please check your connection.";
        } else if (err.message.includes("timeout")) {
          errorMessage = "Request timeout. Please try again.";
        } else {
          errorMessage = err.message;
        }
      }
      
      setLoginError(errorMessage);
      setIsLoading(false);
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
      <div className="login-left" style={{ backgroundImage: `url(${backgroundImage})` }}>
        <div className="left-overlay">
          <div className="left-content">
            <img src={FadzLogo} alt="Fadz Company Logo" className="left-company-logo" />
            <h2 className="welcome-text">Welcome to</h2>
            <h1 className="brand-text">FadzTrack</h1>
            <p className="tagline">Streamline your project management workflow</p>
          </div>
        </div>
      </div>
      
      <div className="login-right">
        <div className="login-form-container">
          <div className="logo-section">
            <img src={AppLogo} alt="FadzTrack App Logo" className="right-logo" />
            <h1 className="app-title">FadzTrack</h1>
            <p className="app-subtitle">Sign in to your account</p>
          </div>

          {show2FA ? (
            <TwoFactorAuth
              email={email}
              onSuccess={(accessToken, userFrom2FA) => {
                setAccessToken(accessToken);
                const saved = setUser(userFrom2FA);
                if (forceUserUpdate) forceUserUpdate();
                redirectBasedOnRole(saved?.role);
              }}
              forceUserUpdate={forceUserUpdate}
            />
          ) : (
            <form onSubmit={handleSubmit} className="login-form">
              <div className="form-group">
                <label htmlFor="email" className="form-label">
                  <FaEnvelope className="input-icon" />
                    Email Address
                  {emailError && (
                    <span className="error-text">{emailError}</span>
                  )}
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={handleEmailChange}
                  placeholder="Enter your email address"
                  className={`input-field ${emailError ? "error" : ""}`}
                  autoComplete="email"
                  required
                />
              </div>

              <div className="form-group password-error-wrapper">
                <label htmlFor="password" className="form-label">
                  <FaLock className="input-icon" />
                  Password
                </label>
                <div className="password-input-container">
                  <input
                    type={showPassword ? "text" : "password"}
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="input-field"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    className="toggle-password"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <FaEyeSlash size={18} /> : <FaEye size={18} />}
                  </button>
                </div>
              </div>

              {loginError && (
                <div className="login-error-display">
                  <span className="login-error-text">{loginError}</span>
                </div>
              )}

              <button 
                type="submit" 
                className={`login-button ${isLoading ? 'loading' : ''}`} 
                disabled={!!emailError || !email || !password || isLoading}
              >
                {isLoading ? (
                  <span className="loading-text">
                    <span className="spinner"></span>
                    Signing in...
                  </span>
                ) : (
                  'Sign In'
                )}
              </button>

              <div className="form-footer">
                <p className="help-text">
                  Need help? Contact your system administrator
                </p>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
