import React, { useState,  useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from '../api/axiosInstance';
import { FaEye, FaEyeSlash } from "react-icons/fa";
import "./style/Loginpage.css";
import backgroundImage from "../assets/images/login_picture.png";
import TwoFactorAuth from "./TwoFactorAuth";
import FadzLogo from "../assets/images/FadzLogo1.png"

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
    const res = await api.post("/auth/login", { email, password });
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


  // Called after successful 2FA verification
  // const handle2FASuccess = () => {
  //   const user = JSON.parse(localStorage.getItem('user'));
  //   if (user) {
  //     redirectBasedOnRole(user.role);
  //   } else {
  //     setLoginError("User info missing after 2FA verification.");
  //   }
  // };

  // Redirect user to dashboard based on role
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
  }
};

  useEffect(() => {
    const token = localStorage.getItem("token");
    const user = JSON.parse(localStorage.getItem("user"));
    if (token && user && user.role) {
      redirectBasedOnRole(user.role);
    }
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
                    localStorage.setItem('token', accessToken); // <--- store accessToken, not token
                    localStorage.setItem('user', JSON.stringify(user));
                    redirectBasedOnRole(user.role);
                  }}
                />
              ): (
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
             {/*  <div className="form-options">
                <div className="remember-me">
                  <input type="checkbox" id="remember" />
                  <label htmlFor="remember">Remember Me</label>
                </div>
                <a href="#" className="forgot-link">Forgot Password?</a>
              </div> */}

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
